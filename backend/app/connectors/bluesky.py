import time
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
import httpx
from app.connectors.base import BaseConnector, ConnectorResult
from app.core.config import settings
from app.core.url_validator import validate_and_normalize_source_url

def parse_iso_datetime(dt_str: Optional[str]) -> Optional[datetime]:
    if not dt_str:
        return None
    try:
        # Handle Z suffix
        clean_str = dt_str.replace("Z", "+00:00")
        return datetime.fromisoformat(clean_str).astimezone(timezone.utc)
    except Exception:
        return None

class BlueskyConnector(BaseConnector):
    @property
    def name(self) -> str:
        return "bluesky"

    @property
    def display_name(self) -> str:
        return "Bluesky Public Network"

    @property
    def category(self) -> str:
        return "social"

    @property
    def supported_operations(self) -> List[str]:
        return ["search_text", "fetch_public_post", "health_check"]

    @property
    def requires_api_key(self) -> bool:
        return False

    def is_configured(self) -> bool:
        return True

    async def health_check(self) -> Dict[str, Any]:
        url = "https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=bsky.app"
        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                res = await client.get(url)
                if res.status_code == 200:
                    return {"status": "healthy", "available": True, "notes": "Bluesky public API reachable"}
                return {"status": "degraded", "available": True, "notes": f"HTTP {res.status_code}"}
        except Exception as e:
            return {"status": "unreachable", "available": False, "notes": str(e)}

    async def search_text(self, query: str, options: Optional[Dict[str, Any]] = None) -> ConnectorResult:
        start_time = time.time()
        if not query or len(query.strip()) < 2:
            return ConnectorResult(
                connector_name=self.name,
                status="completed_no_matches",
                coverage_notes="Search query is too short or empty."
            )

        endpoint = "https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts"
        params = {"q": query.strip(), "limit": "25"}

        try:
            async with httpx.AsyncClient(timeout=settings.HTTP_TIMEOUT_SECONDS) as client:
                resp = await client.get(endpoint, params=params)
                duration_ms = int((time.time() - start_time) * 1000)

                if resp.status_code == 429:
                    return ConnectorResult(
                        connector_name=self.name,
                        status="rate_limited",
                        duration_ms=duration_ms,
                        coverage_notes="Bluesky public API rate limit reached."
                    )
                if resp.status_code != 200:
                    return ConnectorResult(
                        connector_name=self.name,
                        status="error",
                        duration_ms=duration_ms,
                        error_message=f"Bluesky returned HTTP {resp.status_code}",
                        coverage_notes="Bluesky API error."
                    )

                data = resp.json()
                raw_posts = data.get("posts", [])
                if not raw_posts:
                    return ConnectorResult(
                        connector_name=self.name,
                        status="completed_no_matches",
                        duration_ms=duration_ms,
                        coverage_notes=f"No matching posts discovered on Bluesky for query '{query}'."
                    )

                records = []
                for p in raw_posts:
                    author = p.get("author", {})
                    record = p.get("record", {})
                    created_at_str = record.get("createdAt")
                    dt = parse_iso_datetime(created_at_str)

                    uri = p.get("uri", "")
                    rkey = uri.split("/")[-1] if "/" in uri else ""
                    handle = author.get("handle", "")
                    did = author.get("did", "")
                    actor = handle or did or (uri.split("/")[2] if uri.startswith("at://") else "")
                    
                    if actor and rkey:
                        post_url = f"https://bsky.app/profile/{actor}/post/{rkey}"
                    elif actor:
                        post_url = f"https://bsky.app/profile/{actor}"
                    else:
                        post_url = uri

                    title_str = f"Bluesky post by {handle or author.get('displayName') or 'user'}"
                    norm_url = validate_and_normalize_source_url(post_url, title_str, "bluesky")
                    clean_source_url = norm_url["clean_url"] if norm_url["is_valid"] else post_url

                    media_urls = []
                    embed = p.get("embed", {})
                    if "images" in embed and isinstance(embed["images"], list):
                        for img in embed["images"]:
                            if "fullsize" in img:
                                media_urls.append(img["fullsize"])
                            elif "thumb" in img:
                                media_urls.append(img["thumb"])

                    thumb_preview = media_urls[0] if media_urls else None
                    text_snippet = record.get("text", "")

                    records.append({
                        "source_platform": "bluesky",
                        "source_url": clean_source_url,
                        "source_post_id": uri,
                        "author_name": author.get("displayName") or handle,
                        "author_handle": f"@{handle}" if handle else None,
                        "title_or_caption": title_str,
                        "content_snippet": text_snippet,
                        "media_urls": media_urls,
                        "candidate_image_url": thumb_preview,
                        "candidate_thumbnail_url": thumb_preview,
                        "match_type": "semantic_claim",
                        "composite_score": 0.85,
                        "match_signals": {
                            "reposts": p.get("repostCount", 0),
                            "likes": p.get("likeCount", 0),
                            "indexed_at": p.get("indexedAt"),
                            "source_domain": norm_url["domain"] or "bsky.app",
                            "search_provider": "Bluesky Public AT Protocol",
                            "discovery_method": "text_query",
                            "fallback_search_url": norm_url["fallback_search_url"],
                            "fallback_query": norm_url["fallback_query"],
                            "original_raw_url": uri
                        },
                        "evidence_strength": "Probable match",
                        "reported_published_at": dt,
                        "reported_created_at": dt,
                        "primary_timestamp": dt,
                        "timestamp_type": "source_publication",
                        "timestamp_reliability": "high",
                        "ambiguity_notes": "Timestamp provided by authenticated Bluesky protocol record.",
                        "access_status": "accessible" if norm_url["is_valid"] else "malformed"
                    })

                records.sort(key=lambda r: r.get("primary_timestamp") or datetime.max.replace(tzinfo=timezone.utc))

                return ConnectorResult(
                    connector_name=self.name,
                    status="completed_with_matches",
                    records=records,
                    duration_ms=duration_ms,
                    coverage_notes=f"Discovered {len(records)} matching public posts on Bluesky."
                )

        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            return ConnectorResult(
                connector_name=self.name,
                status="error",
                duration_ms=duration_ms,
                error_message=str(e),
                coverage_notes=f"Failed to query Bluesky public network: {str(e)}"
            )

    async def fetch_public_post(self, url: str) -> Optional[Dict[str, Any]]:
        # Handles direct bsky.app URLs
        if "bsky.app" not in url:
            return None
        # Extract handle and rkey
        parts = url.rstrip("/").split("/")
        if "post" in parts:
            idx = parts.index("post")
            if idx > 0 and idx < len(parts) - 1:
                handle = parts[idx - 1]
                rkey = parts[idx + 1]
                # Return standardized structure
                return {
                    "source_platform": "bluesky",
                    "source_url": url,
                    "author_handle": f"@{handle}",
                    "source_post_id": f"at://{handle}/app.bsky.feed.post/{rkey}"
                }
        return None
