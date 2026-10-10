import time
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
import httpx
from app.connectors.base import BaseConnector, ConnectorResult
from app.core.config import settings

class RedditConnector(BaseConnector):
    @property
    def name(self) -> str:
        return "reddit"

    @property
    def display_name(self) -> str:
        return "Reddit Public Discussions"

    @property
    def category(self) -> str:
        return "social"

    @property
    def supported_operations(self) -> List[str]:
        return ["search_text", "health_check"]

    @property
    def requires_api_key(self) -> bool:
        return True

    def is_configured(self) -> bool:
        return bool(settings.REDDIT_CLIENT_ID and settings.REDDIT_CLIENT_SECRET)

    async def health_check(self) -> Dict[str, Any]:
        if not self.is_configured():
            return {
                "status": "unconfigured",
                "available": False,
                "notes": "Reddit API credentials (Client ID & Secret) not configured. Optional connector."
            }
        # Attempt OAuth token request
        try:
            auth = (settings.REDDIT_CLIENT_ID, settings.REDDIT_CLIENT_SECRET)
            data = {"grant_type": "client_credentials"}
            headers = {"User-Agent": "OriginTraceAI/1.0"}
            async with httpx.AsyncClient(timeout=6.0) as client:
                res = await client.post("https://www.reddit.com/api/v1/access_token", data=data, auth=auth, headers=headers)
                if res.status_code == 200:
                    return {"status": "healthy", "available": True, "notes": "Reddit OAuth connected"}
                return {"status": "auth_failed", "available": False, "notes": f"HTTP {res.status_code}"}
        except Exception as e:
            return {"status": "error", "available": False, "notes": str(e)}

    async def search_text(self, query: str, options: Optional[Dict[str, Any]] = None) -> ConnectorResult:
        start_time = time.time()
        if not self.is_configured():
            return ConnectorResult(
                connector_name=self.name,
                status="not_configured",
                duration_ms=0,
                coverage_notes="Reddit API client credentials are not configured. Enable in Settings."
            )

        if not query or len(query.strip()) < 2:
            return ConnectorResult(
                connector_name=self.name,
                status="completed_no_matches",
                coverage_notes="Search query is too short or empty."
            )

        try:
            auth = (settings.REDDIT_CLIENT_ID, settings.REDDIT_CLIENT_SECRET)
            data = {"grant_type": "client_credentials"}
            headers = {"User-Agent": "OriginTraceAI-Forensics/1.0"}
            
            async with httpx.AsyncClient(timeout=settings.HTTP_TIMEOUT_SECONDS) as client:
                token_resp = await client.post("https://www.reddit.com/api/v1/access_token", data=data, auth=auth, headers=headers)
                if token_resp.status_code != 200:
                    duration_ms = int((time.time() - start_time) * 1000)
                    return ConnectorResult(
                        connector_name=self.name,
                        status="access_denied",
                        duration_ms=duration_ms,
                        coverage_notes="Failed to authenticate with Reddit OAuth API."
                    )
                
                token = token_resp.json().get("access_token")
                oauth_headers = {
                    "Authorization": f"Bearer {token}",
                    "User-Agent": "OriginTraceAI-Forensics/1.0"
                }
                
                search_url = "https://oauth.reddit.com/search"
                params = {"q": query.strip(), "sort": "relevance", "limit": 20}
                
                res = await client.get(search_url, headers=oauth_headers, params=params)
                duration_ms = int((time.time() - start_time) * 1000)
                
                if res.status_code != 200:
                    return ConnectorResult(
                        connector_name=self.name,
                        status="error",
                        duration_ms=duration_ms,
                        error_message=f"Reddit returned HTTP {res.status_code}",
                        coverage_notes="Reddit search failed."
                    )
                
                res_data = res.json()
                children = res_data.get("data", {}).get("children", [])
                if not children:
                    return ConnectorResult(
                        connector_name=self.name,
                        status="completed_no_matches",
                        duration_ms=duration_ms,
                        coverage_notes=f"No matching posts discovered on Reddit for '{query}'."
                    )
                
                records = []
                for item in children:
                    p = item.get("data", {})
                    created_utc = p.get("created_utc")
                    dt = datetime.fromtimestamp(created_utc, tz=timezone.utc) if created_utc else None
                    permalink = p.get("permalink", "")
                    post_url = f"https://www.reddit.com{permalink}" if permalink.startswith("/") else permalink
                    
                    records.append({
                        "source_platform": "reddit",
                        "source_url": post_url,
                        "source_post_id": p.get("id"),
                        "author_name": p.get("author"),
                        "author_handle": f"u/{p.get('author')}" if p.get("author") else None,
                        "title_or_caption": p.get("title"),
                        "content_snippet": (p.get("selftext") or "")[:400],
                        "media_urls": [p.get("url")] if p.get("url", "").endswith(('.jpg', '.png', '.webp', '.gif')) else [],
                        "match_type": "semantic_claim",
                        "composite_score": 0.80,
                        "match_signals": {
                            "subreddit": p.get("subreddit_name_prefixed"),
                            "score": p.get("score"),
                            "num_comments": p.get("num_comments")
                        },
                        "evidence_strength": "Probable match",
                        "reported_published_at": dt,
                        "primary_timestamp": dt,
                        "timestamp_type": "source_publication",
                        "timestamp_reliability": "high",
                        "ambiguity_notes": "Timestamp reported by Reddit post creation time.",
                        "access_status": "accessible"
                    })
                
                return ConnectorResult(
                    connector_name=self.name,
                    status="completed_with_matches",
                    records=records,
                    duration_ms=duration_ms,
                    coverage_notes=f"Discovered {len(records)} Reddit discussions."
                )

        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            return ConnectorResult(
                connector_name=self.name,
                status="error",
                duration_ms=duration_ms,
                error_message=str(e),
                coverage_notes=f"Reddit query error: {str(e)}"
            )
