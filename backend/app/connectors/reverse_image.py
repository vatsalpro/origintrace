import io
import json
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict, Any, Optional
import httpx
from PIL import Image

from app.connectors.base import BaseConnector, ConnectorResult
from app.core.config import settings
from app.core.url_validator import validate_and_normalize_source_url

class ReverseImageConnector(BaseConnector):
    """
    Reverse Image Search Connector for SerpApi Google Lens.
    
    Implements the official SerpApi Google Lens API workflow:
    1. For remote images: passes 'url' directly to https://serpapi.com/search.json?engine=google_lens
    2. For local images: uploads to https://serpapi.com/image (max 500 KB, automatically optimized)
       to obtain a temporary 'image_id', then queries https://serpapi.com/search.json?engine=google_lens&image_id=...
    
    Features quota awareness, SHA-256 caching to avoid repeating searches, robust rate-limit (429)
    handling, provider timeout protection, and transparent diagnostics.
    """

    @property
    def name(self) -> str:
        return "reverse_image"

    @property
    def display_name(self) -> str:
        return "Reverse Image Search (Google Lens / SerpApi)"

    @property
    def category(self) -> str:
        return "image_search"

    @property
    def supported_operations(self) -> List[str]:
        return ["search_image", "health_check"]

    @property
    def requires_api_key(self) -> bool:
        return True

    def is_configured(self) -> bool:
        return bool(settings.SERPAPI_API_KEY and len(settings.SERPAPI_API_KEY.strip()) >= 8)

    def get_masked_api_key(self) -> str:
        """Returns masked API key for safe UI and diagnostic display."""
        key = (settings.SERPAPI_API_KEY or "").strip()
        if len(key) >= 8:
            return f"{key[:4]}...{key[-4:]}"
        return "(not configured)"

    async def health_check(self) -> Dict[str, Any]:
        """
        Validates SerpApi connection and retrieves real account quota info
        without exposing credentials.
        """
        if not self.is_configured():
            return {
                "status": "unconfigured",
                "available": False,
                "notes": "SERPAPI_API_KEY is not configured in .env. External visual discovery is skipped."
            }

        try:
            url = f"https://serpapi.com/account?api_key={settings.SERPAPI_API_KEY}"
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get(url)
                if res.status_code == 200:
                    data = res.json()
                    plan = data.get("plan_name", "Free Plan")
                    searches_left = data.get("total_searches_left", "unknown")
                    per_month = data.get("searches_per_month", 250)
                    return {
                        "status": "healthy",
                        "available": True,
                        "plan": plan,
                        "searches_remaining": searches_left,
                        "searches_per_month": per_month,
                        "masked_key": self.get_masked_api_key(),
                        "notes": f"Connected to SerpApi ({plan}): {searches_left}/{per_month} searches remaining."
                    }
                elif res.status_code == 401:
                    return {
                        "status": "auth_failed",
                        "available": False,
                        "notes": "SerpApi API key rejected (HTTP 401 Unauthorized)."
                    }
                elif res.status_code == 429:
                    return {
                        "status": "rate_limited",
                        "available": False,
                        "notes": "SerpApi account quota exhausted or rate limited (HTTP 429)."
                    }
                return {"status": "error", "available": False, "notes": f"SerpApi returned HTTP {res.status_code}"}
        except httpx.TimeoutException:
            return {"status": "timeout", "available": False, "notes": "Connection to SerpApi account endpoint timed out."}
        except Exception as e:
            return {"status": "unreachable", "available": False, "notes": f"Could not reach SerpApi: {str(e)}"}

    def _get_cache_path(self, sha256_hash: str) -> Path:
        return settings.CACHE_PATH / f"serpapi_lens_{sha256_hash[:32]}.json"

    def _read_cache(self, sha256_hash: str) -> Optional[List[Dict[str, Any]]]:
        if not sha256_hash:
            return None
        cache_file = self._get_cache_path(sha256_hash)
        if not cache_file.is_file():
            return None
        try:
            with open(cache_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            cached_at = data.get("timestamp", 0)
            if time.time() - cached_at > settings.SERPAPI_CACHE_TTL_SECONDS:
                return None  # Expired
            return data.get("records", [])
        except Exception:
            return None

    def _write_cache(self, sha256_hash: str, records: List[Dict[str, Any]]):
        if not sha256_hash:
            return
        try:
            cache_file = self._get_cache_path(sha256_hash)
            cache_file.parent.mkdir(parents=True, exist_ok=True)
            with open(cache_file, "w", encoding="utf-8") as f:
                json.dump({"timestamp": time.time(), "records": records}, f, indent=2)
        except Exception:
            pass

    def _prepare_upload_bytes(self, raw_bytes: bytes) -> bytes:
        """
        SerpApi Image API limits uploads to 500 KB.
        If file is larger than 450 KB, optimize and resize to JPEG under 450 KB.
        """
        if len(raw_bytes) <= 460800:  # 450 KB
            return raw_bytes

        try:
            with Image.open(io.BytesIO(raw_bytes)) as img:
                rgb = img.convert("RGB")
                # Scale down if large
                max_dimension = 1000
                if max(rgb.size) > max_dimension:
                    rgb.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)

                out = io.BytesIO()
                rgb.save(out, format="JPEG", quality=80, optimize=True)
                compressed = out.getvalue()
                if len(compressed) <= 490000:
                    return compressed
                
                # Further compress if still slightly large
                out2 = io.BytesIO()
                rgb.save(out2, format="JPEG", quality=65, optimize=True)
                return out2.getvalue()
        except Exception:
            return raw_bytes

    async def search_image(self, fingerprint: Dict[str, Any], options: Optional[Dict[str, Any]] = None) -> ConnectorResult:
        """
        Executes Google Lens reverse image search using SerpApi.
        Uses SHA-256 caching to prevent consuming search credits on repeated checks.
        """
        start_time = time.time()
        options = options or {}
        sha256_hash = fingerprint.get("sha256") or ""

        # 1. Check if connector is configured
        if not self.is_configured():
            return ConnectorResult(
                connector_name=self.name,
                status="not_configured",
                duration_ms=0,
                coverage_notes=(
                    "Reverse-image search provider is not configured. Global web reverse-image lookup "
                    "requires a SERPAPI_API_KEY in .env. Set SERPAPI_API_KEY to search Google Lens indexes."
                ),
                credits_consumed=0,
                is_cached=False
            )

        # 2. Check cache first to avoid consuming credits
        cached_records = self._read_cache(sha256_hash)
        if cached_records is not None:
            duration_ms = int((time.time() - start_time) * 1000)
            return ConnectorResult(
                connector_name=self.name,
                status="completed_with_matches" if cached_records else "completed_no_matches",
                records=cached_records,
                duration_ms=duration_ms,
                coverage_notes=f"Cached Google Lens results reused (0 search credits consumed). Discovered {len(cached_records)} candidates.",
                credits_consumed=0,
                is_cached=True
            )

        public_image_url = options.get("public_image_url")
        file_path = options.get("file_path")
        image_bytes = options.get("image_bytes")

        if not public_image_url and not file_path and not image_bytes:
            return ConnectorResult(
                connector_name=self.name,
                status="completed_no_matches",
                duration_ms=0,
                coverage_notes="No public image URL or accessible file path provided for reverse-image query.",
                credits_consumed=0,
                is_cached=False
            )

        try:
            search_endpoint = "https://serpapi.com/search.json"
            image_id = None

            async with httpx.AsyncClient(timeout=settings.HTTP_TIMEOUT_SECONDS) as client:
                # 3. Handle image submission
                if public_image_url:
                    search_params = {
                        "engine": "google_lens",
                        "url": public_image_url,
                        "api_key": settings.SERPAPI_API_KEY
                    }
                    resp = await client.get(search_endpoint, params=search_params)
                else:
                    # Local image: Step 1 upload to SerpApi Image API
                    if file_path and Path(file_path).is_file():
                        with open(file_path, "rb") as f:
                            raw_data = f.read()
                    elif image_bytes:
                        raw_data = image_bytes
                    else:
                        return ConnectorResult(
                            connector_name=self.name,
                            status="completed_no_matches",
                            duration_ms=0,
                            coverage_notes="Image file could not be read for reverse-image query.",
                            credits_consumed=0,
                            is_cached=False
                        )

                    optimized_bytes = self._prepare_upload_bytes(raw_data)
                    upload_url = "https://serpapi.com/image"
                    files = {"image": ("target_image.jpg", optimized_bytes, "image/jpeg")}
                    data = {"api_key": settings.SERPAPI_API_KEY}

                    upload_resp = await client.post(upload_url, files=files, data=data)
                    if upload_resp.status_code == 401:
                        return ConnectorResult(
                            connector_name=self.name,
                            status="access_denied",
                            duration_ms=int((time.time() - start_time) * 1000),
                            error_message="Invalid SerpApi credentials.",
                            coverage_notes="Authentication failed for reverse-image search provider.",
                            credits_consumed=0,
                            is_cached=False
                        )
                    elif upload_resp.status_code == 429:
                        return ConnectorResult(
                            connector_name=self.name,
                            status="rate_limited",
                            duration_ms=int((time.time() - start_time) * 1000),
                            error_message="Reverse image search quota exceeded or rate limited.",
                            coverage_notes="SerpApi returned HTTP 429 rate limit during image upload.",
                            credits_consumed=0,
                            is_cached=False
                        )
                    elif upload_resp.status_code != 200:
                        return ConnectorResult(
                            connector_name=self.name,
                            status="error",
                            duration_ms=int((time.time() - start_time) * 1000),
                            error_message=f"SerpApi Image API returned HTTP {upload_resp.status_code}",
                            coverage_notes="Failed to upload image to SerpApi Image API.",
                            credits_consumed=0,
                            is_cached=False
                        )

                    upload_data = upload_resp.json()
                    image_id = upload_data.get("image_id")
                    if not image_id:
                        return ConnectorResult(
                            connector_name=self.name,
                            status="error",
                            duration_ms=int((time.time() - start_time) * 1000),
                            error_message="SerpApi Image API did not return an image_id.",
                            coverage_notes="Image upload succeeded but image_id was missing.",
                            credits_consumed=0,
                            is_cached=False
                        )

                    # Step 2: Query Google Lens search using image_id
                    search_params = {
                        "engine": "google_lens",
                        "image_id": image_id,
                        "api_key": settings.SERPAPI_API_KEY
                    }
                    resp = await client.get(search_endpoint, params=search_params)

                duration_ms = int((time.time() - start_time) * 1000)

                # 4. Handle Search Response Status
                if resp.status_code == 401:
                    return ConnectorResult(
                        connector_name=self.name,
                        status="access_denied",
                        duration_ms=duration_ms,
                        error_message="Invalid SerpApi credentials.",
                        coverage_notes="Authentication failed for reverse-image search provider.",
                        credits_consumed=0,
                        is_cached=False
                    )
                elif resp.status_code == 429:
                    return ConnectorResult(
                        connector_name=self.name,
                        status="rate_limited",
                        duration_ms=duration_ms,
                        error_message="Reverse image search quota exceeded or rate limited.",
                        coverage_notes="SerpApi returned HTTP 429 rate limit.",
                        credits_consumed=0,
                        is_cached=False
                    )
                elif resp.status_code != 200:
                    return ConnectorResult(
                        connector_name=self.name,
                        status="error",
                        duration_ms=duration_ms,
                        error_message=f"Provider returned HTTP {resp.status_code}",
                        coverage_notes=f"Failed to query reverse-image provider (HTTP {resp.status_code}).",
                        credits_consumed=0,
                        is_cached=False
                    )

                data = resp.json()
                # Check for SerpApi inline error message
                if "error" in data:
                    err_msg = data.get("error", "")
                    if "limit" in err_msg.lower() or "quota" in err_msg.lower():
                        return ConnectorResult(
                            connector_name=self.name,
                            status="rate_limited",
                            duration_ms=duration_ms,
                            error_message="Reverse image search quota exceeded or rate limited.",
                            coverage_notes=f"SerpApi reported quota limit: {err_msg}",
                            credits_consumed=0,
                            is_cached=False
                        )
                    return ConnectorResult(
                        connector_name=self.name,
                        status="error",
                        duration_ms=duration_ms,
                        error_message=err_msg,
                        coverage_notes=f"SerpApi reported error: {err_msg}",
                        credits_consumed=0,
                        is_cached=False
                    )

                # 5. Parse Visual Matches & Exact Matches
                visual_matches = data.get("visual_matches", [])
                exact_matches = data.get("exact_matches", [])
                combined_matches = exact_matches + visual_matches

                if not combined_matches:
                    self._write_cache(sha256_hash, [])
                    return ConnectorResult(
                        connector_name=self.name,
                        status="completed_no_matches",
                        records=[],
                        duration_ms=duration_ms,
                        coverage_notes="No visual matches discovered by Google Lens for this image.",
                        credits_consumed=1,
                        is_cached=False
                    )

                records = []
                seen_urls = set()

                for match in combined_matches[:15]:
                    cand_link = match.get("link")
                    if not cand_link or cand_link in seen_urls:
                        continue
                    seen_urls.add(cand_link)

                    cand_title = match.get("title", "Visual Match Candidate")
                    cand_source = match.get("source", "Web")
                    cand_thumbnail = match.get("thumbnail")
                    cand_full_image = match.get("image")  # Direct source image if reported

                    # Validate, normalize, and classify discovered source URL
                    norm_url = validate_and_normalize_source_url(cand_link, cand_title, cand_source)

                    # If cand_link was actually a direct image URL, ensure direct image points to it
                    if norm_url["is_direct_image"] and not cand_full_image:
                        cand_full_image = norm_url["clean_url"]

                    chosen_img = cand_full_image or cand_thumbnail
                    clean_source_url = norm_url["clean_url"] if norm_url["is_valid"] else cand_link

                    records.append({
                        "source_platform": "reverse_image",
                        "source_url": clean_source_url,
                        "source_post_id": str(match.get("position", "")),
                        "author_name": cand_source,
                        "author_handle": None,
                        "title_or_caption": cand_title,
                        "content_snippet": f"Visual match candidate discovered via Google Lens. Source: {cand_source}",
                        "media_urls": [chosen_img] if chosen_img else [],
                        "candidate_image_url": chosen_img,
                        "candidate_thumbnail_url": cand_thumbnail,
                        "match_type": "strong_visual",
                        "composite_score": 0.88,
                        "match_signals": {
                            "engine": "google_lens",
                            "search_provider": "Google Lens (SerpApi)",
                            "discovery_method": "visual_search",
                            "source": cand_source,
                            "source_domain": norm_url["domain"],
                            "original_raw_url": cand_link,
                            "url_type": norm_url["url_type"],
                            "is_direct_image": norm_url["is_direct_image"],
                            "fallback_search_url": norm_url["fallback_search_url"],
                            "fallback_query": norm_url["fallback_query"],
                            "thumbnail": cand_thumbnail,
                            "direct_image": cand_full_image,
                            "position": match.get("position"),
                            "validation_notes": norm_url["error_reason"]
                        },
                        "evidence_strength": "Probable match",
                        "reported_published_at": match.get("date"),
                        "primary_timestamp": None,
                        "timestamp_type": "retrieval_only",
                        "timestamp_reliability": "low",
                        "ambiguity_notes": (
                            f"Discovered via Google Lens visual indexing on {norm_url['domain']}. "
                            "Awaiting candidate image comparison."
                        ),
                        "access_status": "accessible" if norm_url["is_valid"] else "malformed"
                    })

                # Write to cache
                self._write_cache(sha256_hash, records)

                return ConnectorResult(
                    connector_name=self.name,
                    status="completed_with_matches" if records else "completed_no_matches",
                    records=records,
                    duration_ms=duration_ms,
                    coverage_notes=f"Discovered {len(records)} visual matches via Google Lens (1 search credit consumed).",
                    credits_consumed=1,
                    is_cached=False
                )

        except httpx.TimeoutException:
            duration_ms = int((time.time() - start_time) * 1000)
            return ConnectorResult(
                connector_name=self.name,
                status="timeout",
                duration_ms=duration_ms,
                error_message="Reverse image search provider timed out.",
                coverage_notes="Google Lens request exceeded timeout limit.",
                credits_consumed=0,
                is_cached=False
            )
        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            return ConnectorResult(
                connector_name=self.name,
                status="error",
                duration_ms=duration_ms,
                error_message=str(e),
                coverage_notes=f"Reverse image search exception: {str(e)}",
                credits_consumed=0,
                is_cached=False
            )
