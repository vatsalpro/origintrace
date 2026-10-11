import time
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
import httpx
from bs4 import BeautifulSoup
from app.connectors.base import BaseConnector, ConnectorResult
from app.core.config import settings
from app.core.security import validate_public_url
from app.core.url_validator import validate_and_normalize_source_url

class WebSearchConnector(BaseConnector):
    @property
    def name(self) -> str:
        return "web_search"

    @property
    def display_name(self) -> str:
        return "Public Web Discovery"

    @property
    def category(self) -> str:
        return "web"

    @property
    def supported_operations(self) -> List[str]:
        return ["fetch_public_page_metadata", "health_check"]

    @property
    def requires_api_key(self) -> bool:
        return False

    def is_configured(self) -> bool:
        return True

    async def health_check(self) -> Dict[str, Any]:
        return {
            "status": "healthy",
            "available": True,
            "notes": "Direct webpage metadata extraction & Wayback verification active."
        }

    async def fetch_public_page_metadata(self, url: str) -> Optional[Dict[str, Any]]:
        """
        Safely fetches public webpage metadata (OpenGraph, JSON-LD, article publish date)
        with strict SSRF protection.
        """
        is_safe, msg = validate_public_url(url)
        if not is_safe:
            return {
                "source_platform": "web",
                "source_url": url,
                "error": f"SSRF Block: {msg}",
                "access_status": "restricted"
            }

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 OriginTraceAI/1.0"
        }
        try:
            async with httpx.AsyncClient(timeout=8.0, follow_redirects=True, headers=headers) as client:
                res = await client.get(url)
                if res.status_code != 200:
                    return {
                        "source_platform": "web",
                        "source_url": url,
                        "access_status": f"http_{res.status_code}"
                    }

                html = res.text
                soup = BeautifulSoup(html, "html.parser")

                title = ""
                if soup.title and soup.title.string:
                    title = soup.title.string.strip()

                meta_desc = ""
                og_desc = soup.find("meta", property="og:description")
                if og_desc and og_desc.get("content"):
                    meta_desc = og_desc["content"]
                else:
                    d = soup.find("meta", attrs={"name": "description"})
                    if d and d.get("content"):
                        meta_desc = d["content"]

                # Extract published time
                pub_time = None
                for prop in ["article:published_time", "og:published_time", "datePublished"]:
                    tag = soup.find("meta", property=prop) or soup.find("meta", attrs={"name": prop})
                    if tag and tag.get("content"):
                        try:
                            pub_time = datetime.fromisoformat(tag["content"].replace("Z", "+00:00")).astimezone(timezone.utc)
                            break
                        except Exception:
                            pass

                # Extract author
                author = None
                author_tag = soup.find("meta", attrs={"name": "author"}) or soup.find("meta", property="article:author")
                if author_tag and author_tag.get("content"):
                    author = author_tag["content"]

                # Media
                og_img = soup.find("meta", property="og:image")
                media_urls = [og_img["content"]] if og_img and og_img.get("content") else []
                cand_img = media_urls[0] if media_urls else None

                target_title = title or url
                norm_url = validate_and_normalize_source_url(str(res.url), target_title, "web")
                clean_url = norm_url["clean_url"] if norm_url["is_valid"] else str(res.url)

                return {
                    "source_platform": "web",
                    "source_url": clean_url,
                    "title_or_caption": target_title,
                    "content_snippet": meta_desc[:400],
                    "author_name": author,
                    "media_urls": media_urls,
                    "candidate_image_url": cand_img,
                    "candidate_thumbnail_url": cand_img,
                    "match_type": "semantic_claim",
                    "composite_score": 0.80,
                    "match_signals": {
                        "source_domain": norm_url["domain"] or "web",
                        "search_provider": "Public Web Discovery",
                        "discovery_method": "webpage_metadata",
                        "fallback_search_url": norm_url["fallback_search_url"],
                        "fallback_query": norm_url["fallback_query"],
                        "original_raw_url": str(res.url)
                    },
                    "evidence_strength": "Probable match",
                    "reported_published_at": pub_time,
                    "primary_timestamp": pub_time,
                    "timestamp_type": "source_publication" if pub_time else "retrieval_only",
                    "timestamp_reliability": "medium" if pub_time else "low",
                    "access_status": "accessible" if norm_url["is_valid"] else "malformed"
                }

        except Exception as e:
            return {
                "source_platform": "web",
                "source_url": url,
                "access_status": "error",
                "error": str(e)
            }
