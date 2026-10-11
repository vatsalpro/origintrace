import time
import json
import hashlib
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from pathlib import Path
import httpx
from app.connectors.base import BaseConnector, ConnectorResult
from app.core.config import settings
from app.core.url_validator import validate_and_normalize_source_url

def parse_iso_datetime(dt_str: Optional[str]) -> Optional[datetime]:
    if not dt_str:
        return None
    try:
        clean_str = dt_str.replace("Z", "+00:00")
        return datetime.fromisoformat(clean_str).astimezone(timezone.utc)
    except Exception:
        return None

class OpenverseConnector(BaseConnector):
    """
    Openverse Image Discovery Connector.
    Queries the official Openverse API (https://api.openverse.org/v1/images/)
    for publicly licensed images using OCR phrases, extracted keywords, and investigator claims.
    
    NOTE: Openverse is a text/metadata-based image discovery source, NOT a reverse-image search.
    Candidate images retrieved from Openverse are subsequently compared against the uploaded
    target image using local perceptual hashes (pHash/dHash).
    """

    @property
    def name(self) -> str:
        return "openverse"

    @property
    def display_name(self) -> str:
        return "Openverse Image Discovery"

    @property
    def category(self) -> str:
        return "image_discovery"

    @property
    def supported_operations(self) -> List[str]:
        return ["search_text", "health_check"]

    @property
    def requires_api_key(self) -> bool:
        return False

    def is_configured(self) -> bool:
        return True

    def _get_cache_path(self, query: str) -> Path:
        cache_dir = settings.CACHE_PATH / "openverse"
        cache_dir.mkdir(parents=True, exist_ok=True)
        q_hash = hashlib.sha256(query.strip().lower().encode("utf-8")).hexdigest()
        return cache_dir / f"{q_hash}.json"

    async def health_check(self) -> Dict[str, Any]:
        url = "https://api.openverse.org/v1/images/?q=test&page_size=1"
        try:
            headers = {"User-Agent": "OriginTraceAI-Forensics/1.0 (https://origintrace.ai)"}
            async with httpx.AsyncClient(timeout=6.0) as client:
                res = await client.get(url, headers=headers)
                if res.status_code == 200:
                    return {
                        "status": "healthy",
                        "available": True,
                        "notes": "Connected to Openverse Public API (zero-key discovery active)."
                    }
                elif res.status_code == 429:
                    return {
                        "status": "rate_limited",
                        "available": False,
                        "notes": "Openverse rate limit encountered (HTTP 429)."
                    }
                return {"status": "error", "available": False, "notes": f"HTTP {res.status_code}"}
        except Exception as e:
            return {"status": "error", "available": False, "notes": str(e)}

    async def search_text(self, query: str, options: Optional[Dict[str, Any]] = None) -> ConnectorResult:
        start_time = time.time()
        clean_q = (query or "").strip()
        if len(clean_q) < 2:
            return ConnectorResult(
                connector_name=self.name,
                status="completed_no_matches",
                duration_ms=0,
                coverage_notes="Search query is too short or empty."
            )

        # Check local disk cache (TTL: 7 days)
        cache_file = self._get_cache_path(clean_q)
        if cache_file.exists():
            try:
                cached_data = json.loads(cache_file.read_text(encoding="utf-8"))
                cached_ts = cached_data.get("timestamp", 0)
                if time.time() - cached_ts < 7 * 86400:
                    records = cached_data.get("records", [])
                    # Re-parse datetimes in cached records
                    for r in records:
                        if r.get("primary_timestamp"):
                            r["primary_timestamp"] = parse_iso_datetime(r["primary_timestamp"])
                        if r.get("reported_published_at"):
                            r["reported_published_at"] = parse_iso_datetime(r["reported_published_at"])
                    duration_ms = int((time.time() - start_time) * 1000)
                    return ConnectorResult(
                        connector_name=self.name,
                        status="completed_with_matches" if records else "completed_no_matches",
                        records=records,
                        duration_ms=duration_ms,
                        coverage_notes=f"Retrieved {len(records)} Openverse candidate images from local 7-day cache."
                    )
            except Exception:
                pass

        url = "https://api.openverse.org/v1/images/"
        params = {
            "q": clean_q,
            "page_size": "15"
        }
        headers = {"User-Agent": "OriginTraceAI-Forensics/1.0 (https://origintrace.ai)"}

        try:
            async with httpx.AsyncClient(timeout=settings.HTTP_TIMEOUT_SECONDS) as client:
                resp = await client.get(url, params=params, headers=headers)
                duration_ms = int((time.time() - start_time) * 1000)

                if resp.status_code == 429:
                    return ConnectorResult(
                        connector_name=self.name,
                        status="rate_limited",
                        duration_ms=duration_ms,
                        coverage_notes="Openverse API rate limit encountered. Query postponed."
                    )
                if resp.status_code != 200:
                    return ConnectorResult(
                        connector_name=self.name,
                        status="error",
                        duration_ms=duration_ms,
                        error_message=f"Openverse returned HTTP {resp.status_code}",
                        coverage_notes="Openverse image search failed."
                    )

                data = resp.json()
                results = data.get("results", [])
                if not results:
                    # Cache empty result
                    try:
                        cache_file.write_text(json.dumps({"timestamp": time.time(), "records": []}), encoding="utf-8")
                    except Exception:
                        pass
                    return ConnectorResult(
                        connector_name=self.name,
                        status="completed_no_matches",
                        duration_ms=duration_ms,
                        coverage_notes=f"No matching publicly licensed images discovered on Openverse for query '{clean_q}'."
                    )

                records = []
                seen_urls = set()

                for item in results:
                    item_id = item.get("id")
                    foreign_url = item.get("foreign_landing_url") or item.get("url") or ""
                    if not foreign_url or foreign_url in seen_urls:
                        continue
                    seen_urls.add(foreign_url)

                    candidate_img = item.get("url")
                    thumb_img = item.get("thumbnail") or candidate_img
                    title = item.get("title") or "Openverse Discovered Image"
                    creator = item.get("creator") or "Unknown Creator"
                    license_name = (item.get("license") or "").upper()
                    license_ver = item.get("license_version") or ""
                    license_str = f"CC {license_name} {license_ver}".strip() if license_name else "Public Domain / Open License"
                    attribution = item.get("attribution") or f"\"{title}\" by {creator} ({license_str})"

                    indexed_dt = parse_iso_datetime(item.get("indexed_on"))

                    norm_url = validate_and_normalize_source_url(
                        foreign_url,
                        title=title,
                        source_platform="openverse"
                    )
                    clean_source_url = norm_url.get("clean_url") or foreign_url

                    records.append({
                        "source_platform": "openverse",
                        "source_url": clean_source_url,
                        "source_post_id": str(item_id),
                        "author_name": creator,
                        "author_handle": item.get("creator_url"),
                        "title_or_caption": title,
                        "content_snippet": attribution,
                        "media_urls": [candidate_img] if candidate_img else [],
                        "candidate_image_url": candidate_img,
                        "candidate_thumbnail_url": thumb_img,
                        "match_type": "semantic_claim",
                        "composite_score": 0.75,
                        "match_signals": {
                            "provider": item.get("provider"),
                            "source": item.get("source"),
                            "license": item.get("license"),
                            "license_version": item.get("license_version"),
                            "license_url": item.get("license_url"),
                            "cc_license": license_str,
                            "attribution": attribution,
                            "source_domain": norm_url.get("domain") or "openverse.org",
                            "search_provider": "Openverse Image Discovery",
                            "discovery_method": "text_metadata_search",
                            "fallback_search_url": norm_url.get("fallback_search_url"),
                            "fallback_query": norm_url.get("fallback_query"),
                            "original_raw_url": foreign_url
                        },
                        "evidence_strength": "Possible match",
                        "reported_published_at": indexed_dt,
                        "primary_timestamp": indexed_dt,
                        "timestamp_type": "source_publication",
                        "timestamp_reliability": "medium",
                        "ambiguity_notes": "Timestamp reflects Openverse catalog indexing date. Host platform publication may be earlier.",
                        "access_status": "accessible"
                    })

                # Sort by primary timestamp
                records.sort(key=lambda r: r.get("primary_timestamp") or datetime.max.replace(tzinfo=timezone.utc))

                # Cache serializable records
                try:
                    serializable = []
                    for r in records:
                        rc = dict(r)
                        if rc.get("primary_timestamp"):
                            rc["primary_timestamp"] = rc["primary_timestamp"].isoformat()
                        if rc.get("reported_published_at"):
                            rc["reported_published_at"] = rc["reported_published_at"].isoformat()
                        serializable.append(rc)
                    cache_file.write_text(json.dumps({"timestamp": time.time(), "records": serializable}), encoding="utf-8")
                except Exception:
                    pass

                return ConnectorResult(
                    connector_name=self.name,
                    status="completed_with_matches",
                    records=records,
                    duration_ms=duration_ms,
                    coverage_notes=f"Discovered {len(records)} candidate images on Openverse for query '{clean_q}'."
                )

        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            return ConnectorResult(
                connector_name=self.name,
                status="error",
                duration_ms=duration_ms,
                error_message=str(e),
                coverage_notes=f"Openverse discovery error: {str(e)}"
            )
