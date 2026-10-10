import time
import re
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
import httpx
from bs4 import BeautifulSoup
from app.connectors.base import BaseConnector, ConnectorResult
from app.core.config import settings

def strip_html_content(html_str: str) -> str:
    if not html_str:
        return ""
    try:
        soup = BeautifulSoup(html_str, "html.parser")
        return soup.get_text(separator=" ").strip()
    except Exception:
        return re.sub(r'<[^>]+>', '', html_str).strip()

def parse_iso_datetime(dt_str: Optional[str]) -> Optional[datetime]:
    if not dt_str:
        return None
    try:
        clean_str = dt_str.replace("Z", "+00:00")
        return datetime.fromisoformat(clean_str).astimezone(timezone.utc)
    except Exception:
        return None

class MastodonConnector(BaseConnector):
    def __init__(self, instance: Optional[str] = None):
        self._instance = instance or settings.MASTODON_DEFAULT_INSTANCE

    @property
    def name(self) -> str:
        return "mastodon"

    @property
    def display_name(self) -> str:
        return f"Mastodon Federated Network ({self._instance})"

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
        url = f"https://{self._instance}/api/v1/instance"
        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                res = await client.get(url)
                if res.status_code == 200:
                    data = res.json()
                    title = data.get("title", self._instance)
                    return {"status": "healthy", "available": True, "notes": f"Connected to {title}"}
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

        instance = options.get("instance", self._instance) if options else self._instance
        endpoint = f"https://{instance}/api/v2/search"
        params = {"q": query.strip(), "type": "statuses", "limit": "20"}

        try:
            headers = {"User-Agent": "OriginTraceAI-Forensics/1.0 (+https://github.com/origintrace-ai)"}
            async with httpx.AsyncClient(timeout=settings.HTTP_TIMEOUT_SECONDS, headers=headers) as client:
                resp = await client.get(endpoint, params=params)
                duration_ms = int((time.time() - start_time) * 1000)

                if resp.status_code == 429:
                    return ConnectorResult(
                        connector_name=self.name,
                        status="rate_limited",
                        duration_ms=duration_ms,
                        coverage_notes=f"Mastodon instance {instance} rate limited public search requests."
                    )
                if resp.status_code != 200:
                    return ConnectorResult(
                        connector_name=self.name,
                        status="error",
                        duration_ms=duration_ms,
                        error_message=f"Mastodon instance {instance} returned HTTP {resp.status_code}",
                        coverage_notes="Mastodon API error."
                    )

                data = resp.json()
                statuses = data.get("statuses", [])
                if not statuses:
                    return ConnectorResult(
                        connector_name=self.name,
                        status="completed_no_matches",
                        duration_ms=duration_ms,
                        coverage_notes=f"No matching statuses discovered on Mastodon instance '{instance}'."
                    )

                records = []
                for s in statuses:
                    account = s.get("account", {})
                    dt = parse_iso_datetime(s.get("created_at"))
                    text = strip_html_content(s.get("content", ""))
                    post_url = s.get("url") or f"https://{instance}/@{account.get('username')}/{s.get('id')}"

                    media_urls = []
                    attachments = s.get("media_attachments", [])
                    for att in attachments:
                        if att.get("url"):
                            media_urls.append(att.get("url"))
                        elif att.get("preview_url"):
                            media_urls.append(att.get("preview_url"))

                    records.append({
                        "source_platform": "mastodon",
                        "source_url": post_url,
                        "source_post_id": str(s.get("id")),
                        "author_name": account.get("display_name") or account.get("username"),
                        "author_handle": f"@{account.get('acct')}" if account.get("acct") else None,
                        "title_or_caption": f"Mastodon status on {instance}",
                        "content_snippet": text,
                        "media_urls": media_urls,
                        "match_type": "semantic_claim",
                        "composite_score": 0.85,
                        "match_signals": {
                            "reblogs": s.get("reblogs_count", 0),
                            "favourites": s.get("favourites_count", 0),
                            "instance": instance
                        },
                        "evidence_strength": "Probable match",
                        "reported_published_at": dt,
                        "reported_created_at": dt,
                        "primary_timestamp": dt,
                        "timestamp_type": "source_publication",
                        "timestamp_reliability": "high",
                        "ambiguity_notes": f"Federated post indexed by instance {instance}.",
                        "access_status": "accessible"
                    })

                records.sort(key=lambda r: r.get("primary_timestamp") or datetime.max.replace(tzinfo=timezone.utc))

                return ConnectorResult(
                    connector_name=self.name,
                    status="completed_with_matches",
                    records=records,
                    duration_ms=duration_ms,
                    coverage_notes=f"Discovered {len(records)} matching statuses on Mastodon ({instance})."
                )

        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            return ConnectorResult(
                connector_name=self.name,
                status="error",
                duration_ms=duration_ms,
                error_message=str(e),
                coverage_notes=f"Failed to query Mastodon instance: {str(e)}"
            )
