import time
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
import httpx
from app.connectors.base import BaseConnector, ConnectorResult
from app.core.config import settings

def parse_iso_datetime(dt_str: Optional[str]) -> Optional[datetime]:
    if not dt_str:
        return None
    try:
        clean_str = dt_str.replace("Z", "+00:00")
        return datetime.fromisoformat(clean_str).astimezone(timezone.utc)
    except Exception:
        return None

class YouTubeConnector(BaseConnector):
    @property
    def name(self) -> str:
        return "youtube"

    @property
    def display_name(self) -> str:
        return "YouTube Video Platform"

    @property
    def category(self) -> str:
        return "video"

    @property
    def supported_operations(self) -> List[str]:
        return ["search_text", "health_check"]

    @property
    def requires_api_key(self) -> bool:
        return True

    def is_configured(self) -> bool:
        return bool(settings.YOUTUBE_API_KEY and len(settings.YOUTUBE_API_KEY.strip()) > 5)

    async def health_check(self) -> Dict[str, Any]:
        if not self.is_configured():
            return {
                "status": "unconfigured",
                "available": False,
                "notes": "YouTube API key not configured. Optional feature."
            }
        url = f"https://www.googleapis.com/youtube/v3/search?part=snippet&q=test&maxResults=1&key={settings.YOUTUBE_API_KEY}"
        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                res = await client.get(url)
                if res.status_code == 200:
                    return {"status": "healthy", "available": True, "notes": "YouTube Data API v3 active"}
                return {"status": "error", "available": False, "notes": f"HTTP {res.status_code}"}
        except Exception as e:
            return {"status": "error", "available": False, "notes": str(e)}

    async def search_text(self, query: str, options: Optional[Dict[str, Any]] = None) -> ConnectorResult:
        start_time = time.time()
        if not self.is_configured():
            return ConnectorResult(
                connector_name=self.name,
                status="not_configured",
                duration_ms=0,
                coverage_notes="YouTube Data API key is not configured. Connector skipped."
            )

        if not query or len(query.strip()) < 2:
            return ConnectorResult(
                connector_name=self.name,
                status="completed_no_matches",
                coverage_notes="Search query is too short or empty."
            )

        url = "https://www.googleapis.com/youtube/v3/search"
        params = {
            "part": "snippet",
            "q": query.strip(),
            "type": "video",
            "maxResults": "15",
            "key": settings.YOUTUBE_API_KEY
        }

        try:
            async with httpx.AsyncClient(timeout=settings.HTTP_TIMEOUT_SECONDS) as client:
                resp = await client.get(url, params=params)
                duration_ms = int((time.time() - start_time) * 1000)

                if resp.status_code == 403:
                    return ConnectorResult(
                        connector_name=self.name,
                        status="access_denied",
                        duration_ms=duration_ms,
                        coverage_notes="YouTube Data API quota exceeded or key invalid."
                    )
                if resp.status_code != 200:
                    return ConnectorResult(
                        connector_name=self.name,
                        status="error",
                        duration_ms=duration_ms,
                        error_message=f"YouTube returned HTTP {resp.status_code}",
                        coverage_notes="YouTube API error."
                    )

                data = resp.json()
                items = data.get("items", [])
                if not items:
                    return ConnectorResult(
                        connector_name=self.name,
                        status="completed_no_matches",
                        duration_ms=duration_ms,
                        coverage_notes=f"No matching videos discovered on YouTube for query '{query}'."
                    )

                records = []
                for item in items:
                    snippet = item.get("snippet", {})
                    video_id = item.get("id", {}).get("videoId")
                    if not video_id:
                        continue

                    dt = parse_iso_datetime(snippet.get("publishedAt"))
                    video_url = f"https://www.youtube.com/watch?v={video_id}"
                    thumbnails = snippet.get("thumbnails", {})
                    media_urls = [thumbnails[k]["url"] for k in ("high", "medium", "default") if k in thumbnails]

                    records.append({
                        "source_platform": "youtube",
                        "source_url": video_url,
                        "source_post_id": video_id,
                        "author_name": snippet.get("channelTitle"),
                        "author_handle": snippet.get("channelId"),
                        "title_or_caption": snippet.get("title"),
                        "content_snippet": snippet.get("description"),
                        "media_urls": media_urls[:1],
                        "match_type": "semantic_claim",
                        "composite_score": 0.80,
                        "match_signals": {
                            "channel": snippet.get("channelTitle"),
                            "live_broadcast": snippet.get("liveBroadcastContent")
                        },
                        "evidence_strength": "Probable match",
                        "reported_published_at": dt,
                        "primary_timestamp": dt,
                        "timestamp_type": "source_publication",
                        "timestamp_reliability": "high",
                        "ambiguity_notes": "Timestamp reported by YouTube API video publication record.",
                        "access_status": "accessible"
                    })

                records.sort(key=lambda r: r.get("primary_timestamp") or datetime.max.replace(tzinfo=timezone.utc))

                return ConnectorResult(
                    connector_name=self.name,
                    status="completed_with_matches",
                    records=records,
                    duration_ms=duration_ms,
                    coverage_notes=f"Discovered {len(records)} matching YouTube videos."
                )

        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            return ConnectorResult(
                connector_name=self.name,
                status="error",
                duration_ms=duration_ms,
                error_message=str(e),
                coverage_notes=f"YouTube query failed: {str(e)}"
            )
