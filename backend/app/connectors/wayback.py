import time
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
import httpx
from app.connectors.base import BaseConnector, ConnectorResult
from app.core.config import settings

def parse_wayback_timestamp(ts_str: str) -> Optional[datetime]:
    """Parses 14-digit Wayback timestamp 'YYYYMMDDhhmmss' into UTC datetime."""
    if not ts_str or len(ts_str) < 8:
        return None
    try:
        ts_str = ts_str.ljust(14, '0')[:14]
        dt = datetime.strptime(ts_str, "%Y%m%d%H%M%S")
        return dt.replace(tzinfo=timezone.utc)
    except Exception:
        return None

class WaybackConnector(BaseConnector):
    @property
    def name(self) -> str:
        return "wayback"

    @property
    def display_name(self) -> str:
        return "Internet Archive Wayback Machine"

    @property
    def category(self) -> str:
        return "archive"

    @property
    def supported_operations(self) -> List[str]:
        return ["query_url_captures", "health_check"]

    @property
    def requires_api_key(self) -> bool:
        return False

    def is_configured(self) -> bool:
        return True

    async def health_check(self) -> Dict[str, Any]:
        url = "https://web.archive.org/cdx/search/cdx?url=archive.org&limit=1&output=json"
        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                res = await client.get(url)
                if res.status_code == 200:
                    return {"status": "healthy", "available": True, "notes": "Wayback CDX API responsive"}
                return {"status": "degraded", "available": True, "notes": f"HTTP {res.status_code}"}
        except Exception as e:
            return {"status": "unreachable", "available": False, "notes": str(e)}

    async def query_url_captures(self, target_url: str, limit: int = 30) -> ConnectorResult:
        """
        Queries Wayback Machine CDX API for historical snapshots of a target URL.
        """
        start_time = time.time()
        cdx_endpoint = "https://web.archive.org/cdx/search/cdx"
        params = {
            "url": target_url,
            "output": "json",
            "limit": str(limit),
            "fl": "timestamp,original,mimetype,statuscode,digest",
            "collapse": "digest"  # unique content snapshots only
        }

        try:
            async with httpx.AsyncClient(timeout=settings.HTTP_TIMEOUT_SECONDS) as client:
                resp = await client.get(cdx_endpoint, params=params)

                duration_ms = int((time.time() - start_time) * 1000)

                if resp.status_code == 429:
                    return ConnectorResult(
                        connector_name=self.name,
                        status="rate_limited",
                        duration_ms=duration_ms,
                        coverage_notes="Internet Archive CDX API returned 429 rate limit."
                    )

                if resp.status_code != 200:
                    return ConnectorResult(
                        connector_name=self.name,
                        status="error",
                        duration_ms=duration_ms,
                        error_message=f"Wayback returned HTTP {resp.status_code}",
                        coverage_notes="Archive API returned an unexpected response code."
                    )

                data = resp.json()
                if not data or len(data) <= 1:
                    # Header row only or empty
                    return ConnectorResult(
                        connector_name=self.name,
                        status="completed_no_matches",
                        duration_ms=duration_ms,
                        coverage_notes=f"No Wayback Machine historical captures discovered for URL '{target_url}'."
                    )

                headers = data[0]
                rows = data[1:]

                records = []
                for idx, row in enumerate(rows):
                    row_dict = dict(zip(headers, row))
                    ts_str = row_dict.get("timestamp", "")
                    original = row_dict.get("original", target_url)
                    parsed_dt = parse_wayback_timestamp(ts_str)
                    wayback_snapshot_url = f"https://web.archive.org/web/{ts_str}/{original}" if ts_str else ""

                    records.append({
                        "source_platform": "wayback",
                        "source_url": wayback_snapshot_url,
                        "source_post_id": f"wb-{ts_str}",
                        "title_or_caption": f"Wayback Snapshot of {original}",
                        "content_snippet": f"Archived capture at timestamp {ts_str} (MIME: {row_dict.get('mimetype')}, Status: {row_dict.get('statuscode')})",
                        "match_type": "archive_capture",
                        "composite_score": 0.95,
                        "match_signals": {
                            "archive_digest": row_dict.get("digest"),
                            "status_code": row_dict.get("statuscode"),
                            "mimetype": row_dict.get("mimetype"),
                            "original_url": original
                        },
                        "evidence_strength": "Strong match",
                        "reported_published_at": None,
                        "wayback_capture_at": parsed_dt,
                        "primary_timestamp": parsed_dt,
                        "timestamp_type": "archive_capture",
                        "timestamp_reliability": "high",
                        "ambiguity_notes": "Archived snapshot timestamp corresponds to archive capture time, not necessarily original publication date.",
                        "access_status": "accessible"
                    })

                # Sort by capture timestamp ascending
                records.sort(key=lambda r: r.get("wayback_capture_at") or datetime.max.replace(tzinfo=timezone.utc))

                return ConnectorResult(
                    connector_name=self.name,
                    status="completed_with_matches",
                    records=records,
                    duration_ms=duration_ms,
                    coverage_notes=f"Discovered {len(records)} distinct historical snapshots on the Wayback Machine."
                )

        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            return ConnectorResult(
                connector_name=self.name,
                status="error",
                duration_ms=duration_ms,
                error_message=str(e),
                coverage_notes=f"Failed to query Internet Archive: {str(e)}"
            )
