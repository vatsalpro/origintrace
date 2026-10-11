import re
import socket
from urllib.parse import urlparse, parse_qs, unquote, quote_plus
from typing import Dict, Any, Optional, Tuple
import httpx

from app.core.security import validate_public_url, is_ip_blocked

IMAGE_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".gif", ".webp",
    ".bmp", ".svg", ".ico", ".tiff", ".avif"
}

THUMBNAIL_DOMAINS = {
    "encrypted-tbn0.gstatic.com",
    "tbn0.gstatic.com",
    "play-lh.googleusercontent.com"
}

DISALLOWED_SCHEMES = {"javascript", "data", "file", "blob", "about", "vbscript", "ftp"}

def unwrap_redirect_url(url: str) -> str:
    """
    Unwraps search engine and tracking redirect URLs to extract the actual target destination.
    Handles Google ('/url?q=...', '/url?url=...'), Google Lens, and similar redirect wrappers.
    """
    if not url or not isinstance(url, str):
        return ""

    url = url.strip()
    try:
        parsed = urlparse(url)
    except Exception:
        return url

    # Google / Lens Redirects
    if parsed.netloc.lower() in ("www.google.com", "google.com", "lens.google.com") and parsed.path.startswith("/url"):
        qs = parse_qs(parsed.query)
        target = qs.get("q") or qs.get("url")
        if target and target[0]:
            unwrapped = unquote(target[0])
            if unwrapped.startswith("http://") or unwrapped.startswith("https://"):
                return unwrapped

    # Bing Redirects
    if "bing.com" in parsed.netloc.lower() and parsed.path.startswith("/ck/a"):
        qs = parse_qs(parsed.query)
        target = qs.get("u")
        if target and target[0]:
            raw_u = target[0]
            if raw_u.startswith("a1"):  # Base64-like Bing encoding or direct URL
                pass  # Bing encrypted redirect, preserve original

    return url

def clean_and_extract_domain(url: str) -> str:
    """Extracts a clean, lowercase domain name from a URL."""
    try:
        parsed = urlparse(url)
        domain = parsed.netloc.lower()
        if ":" in domain:
            domain = domain.split(":")[0]
        return domain
    except Exception:
        return "web"

def classify_url_type(url: str) -> Tuple[str, bool]:
    """
    Classifies a URL into a distinct type:
    - 'source_webpage': Standard HTML webpage
    - 'direct_image': Direct image asset URL
    - 'thumbnail': Search engine or CDN thumbnail URL
    - 'api_endpoint': API response or service endpoint
    Returns: (url_type, is_direct_image)
    """
    try:
        parsed = urlparse(url)
        domain = parsed.netloc.lower()
        path = parsed.path.lower()

        # Check Internet Archive Wayback Machine captures
        if domain in ("web.archive.org", "archive.org") and "/web/" in path:
            return "archive_snapshot", False

        # Check thumbnail hosts
        if domain in THUMBNAIL_DOMAINS:
            return "thumbnail", True

        # Check direct image extensions
        for ext in IMAGE_EXTENSIONS:
            if path.endswith(ext) or f"{ext}?" in url.lower():
                return "direct_image", True

        # Check image CDN keywords in path
        if any(keyword in path for keyword in ("/images/", "/image-showcase/", "/wp-content/uploads/")):
            for ext in IMAGE_EXTENSIONS:
                if ext in path:
                    return "direct_image", True

        # Check API endpoints
        if "/api/" in path or path.startswith("/api"):
            return "api_endpoint", False

        return "source_webpage", False
    except Exception:
        return "source_webpage", False

def build_fallback_search_query(title: Optional[str], domain: str, platform: Optional[str] = None) -> Tuple[str, str]:
    """
    Constructs a secondary Google search query and clickable Google Search URL for the candidate.
    Clearly intended as a fallback discovery query, not the primary source.
    """
    clean_title = (title or "").strip()
    # Strip generic prefixes like "Visual Match Candidate"
    if clean_title.lower().startswith("visual match candidate") or not clean_title:
        query = f"site:{domain}" if domain and domain != "web" else (platform or "image source")
    else:
        # Use first 80 chars of title + domain filter
        truncated_title = clean_title[:80].strip()
        if domain and domain != "web":
            query = f'"{truncated_title}" site:{domain}'
        else:
            query = f'"{truncated_title}"'

    search_url = f"https://www.google.com/search?q={quote_plus(query)}"
    return query, search_url

def validate_and_normalize_source_url(
    raw_url: Optional[str],
    title: Optional[str] = None,
    source_platform: Optional[str] = None
) -> Dict[str, Any]:
    """
    Comprehensive validation and normalization for discovered source URLs.
    
    1. Validates URL syntax and rejects unsafe schemes (data:, javascript:, file:).
    2. Unwraps search engine and tracking redirects to recover the true destination.
    3. Distinguishes source webpages, direct candidate images, thumbnails, and API endpoints.
    4. Computes secondary search fallback queries.
    5. Preserves the original raw URL for forensic auditability.
    """
    if not raw_url or not isinstance(raw_url, str) or not raw_url.strip():
        domain = (source_platform or "web").lower()
        query, search_url = build_fallback_search_query(title, domain, source_platform)
        return {
            "is_valid": False,
            "clean_url": "",
            "original_raw_url": raw_url or "",
            "domain": domain,
            "url_type": "malformed",
            "is_direct_image": False,
            "fallback_search_url": search_url,
            "fallback_query": query,
            "error_reason": "Source URL is missing or empty."
        }

    stripped = raw_url.strip()

    # Convert ATProto URIs to canonical bsky.app web URLs
    if stripped.startswith("at://"):
        at_body = stripped[5:]
        parts = at_body.split("/")
        if len(parts) >= 3 and parts[1] == "app.bsky.feed.post":
            actor = parts[0]
            rkey = parts[2]
            stripped = f"https://bsky.app/profile/{actor}/post/{rkey}"
        elif len(parts) == 1 and parts[0]:
            stripped = f"https://bsky.app/profile/{parts[0]}"

    # Reject dangerous or local schemes
    for disallowed in DISALLOWED_SCHEMES:
        if stripped.lower().startswith(f"{disallowed}:") or stripped.lower().startswith(f"{disallowed}/"):
            domain = (source_platform or "web").lower()
            query, search_url = build_fallback_search_query(title, domain, source_platform)
            return {
                "is_valid": False,
                "clean_url": "",
                "original_raw_url": stripped,
                "domain": domain,
                "url_type": "malformed",
                "is_direct_image": False,
                "fallback_search_url": search_url,
                "fallback_query": query,
                "error_reason": f"Disallowed URL scheme '{disallowed}:'. Only http and https are permitted."
            }

    # Unwrap any search redirect wrappers (e.g. Google Lens / Google redirects)
    unwrapped = unwrap_redirect_url(stripped)

    # Prepend https:// if protocol was omitted (e.g. 'example.com/page')
    if not (unwrapped.startswith("http://") or unwrapped.startswith("https://")):
        if "." in unwrapped and not unwrapped.startswith("/") and not unwrapped.startswith("#"):
            unwrapped = "https://" + unwrapped
        else:
            domain = (source_platform or "web").lower()
            query, search_url = build_fallback_search_query(title, domain, source_platform)
            return {
                "is_valid": False,
                "clean_url": "",
                "original_raw_url": stripped,
                "domain": domain,
                "url_type": "malformed",
                "is_direct_image": False,
                "fallback_search_url": search_url,
                "fallback_query": query,
                "error_reason": "URL has no valid HTTP or HTTPS protocol."
            }

    try:
        parsed = urlparse(unwrapped)
    except Exception as e:
        domain = (source_platform or "web").lower()
        query, search_url = build_fallback_search_query(title, domain, source_platform)
        return {
            "is_valid": False,
            "clean_url": "",
            "original_raw_url": stripped,
            "domain": domain,
            "url_type": "malformed",
            "is_direct_image": False,
            "fallback_search_url": search_url,
            "fallback_query": query,
            "error_reason": f"Malformed URL format: {str(e)}"
        }

    hostname = (parsed.hostname or "").lower()
    if not hostname:
        domain = (source_platform or "web").lower()
        query, search_url = build_fallback_search_query(title, domain, source_platform)
        return {
            "is_valid": False,
            "clean_url": "",
            "original_raw_url": stripped,
            "domain": domain,
            "url_type": "malformed",
            "is_direct_image": False,
            "fallback_search_url": search_url,
            "fallback_query": query,
            "error_reason": "URL contains no valid host name."
        }

    # Check for loopback / internal private hostnames
    if hostname in ("localhost", "127.0.0.1", "0.0.0.0", "::1", "metadata.google.internal"):
        domain = hostname
        query, search_url = build_fallback_search_query(title, domain, source_platform)
        return {
            "is_valid": False,
            "clean_url": "",
            "original_raw_url": stripped,
            "domain": domain,
            "url_type": "malformed",
            "is_direct_image": False,
            "fallback_search_url": search_url,
            "fallback_query": query,
            "error_reason": f"Access to private/internal hostname '{hostname}' is blocked."
        }

    domain = hostname
    url_type, is_direct_image = classify_url_type(unwrapped)
    query, search_url = build_fallback_search_query(title, domain, source_platform)

    return {
        "is_valid": True,
        "clean_url": unwrapped,
        "original_raw_url": stripped,
        "domain": domain,
        "url_type": url_type,
        "is_direct_image": is_direct_image,
        "fallback_search_url": search_url,
        "fallback_query": query,
        "error_reason": None
    }


async def check_url_access_status(url: str, timeout_seconds: float = 4.0) -> Dict[str, Any]:
    """
    Safely probes the HTTP reachability of a source URL for forensic diagnostics.
    
    Forensic Guarantees:
    - Never proxies content to bypass WAF, CAPTCHAs, or paywalls.
    - Strictly prevents SSRF against internal/private infrastructure.
    - Accurately reports HTTP 403, 401, 404, or timeouts without claiming the source is fake.
    """
    norm = validate_and_normalize_source_url(url)
    if not norm["is_valid"]:
        return {
            "checked_url": url,
            "status_code": None,
            "access_status": "malformed",
            "category": "security_blocked",
            "is_accessible": False,
            "explanation": norm["error_reason"] or "URL is invalid or malformed.",
            "server_header": None
        }

    clean_url = norm["clean_url"]

    # SSRF verification
    is_safe, ssrf_msg = validate_public_url(clean_url)
    if not is_safe:
        return {
            "checked_url": clean_url,
            "status_code": None,
            "access_status": "blocked_ssrf",
            "category": "security_blocked",
            "is_accessible": False,
            "explanation": f"URL failed SSRF safety check: {ssrf_msg}",
            "server_header": None
        }

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
    }

    try:
        async with httpx.AsyncClient(timeout=timeout_seconds, follow_redirects=True, headers=headers) as client:
            # Try HEAD first; fallback to GET if HEAD method not allowed (405)
            try:
                resp = await client.head(clean_url)
                if resp.status_code == 405:
                    resp = await client.get(clean_url)
            except httpx.TimeoutException:
                raise
            except Exception:
                resp = await client.get(clean_url)

            code = resp.status_code
            server_header = resp.headers.get("server") or resp.headers.get("cf-ray")

            if code == 200:
                return {
                    "checked_url": clean_url,
                    "status_code": code,
                    "access_status": "accessible",
                    "category": "public_web",
                    "is_accessible": True,
                    "explanation": "Destination server responded successfully (HTTP 200 OK).",
                    "server_header": server_header
                }
            elif code == 403:
                # WAF / Cloudflare / Bot Protection / Regional Block
                return {
                    "checked_url": clean_url,
                    "status_code": code,
                    "access_status": "forbidden",
                    "category": "waf_or_cloudflare",
                    "is_accessible": False,
                    "explanation": (
                        "Destination website returned HTTP 403 Forbidden. The remote server denied automated access "
                        "(e.g., Cloudflare bot challenge, WAF rules, paywalls, or region restrictions). "
                        "The source URL remains forensically valid."
                    ),
                    "server_header": server_header
                }
            elif code == 401:
                return {
                    "checked_url": clean_url,
                    "status_code": code,
                    "access_status": "restricted",
                    "category": "authentication_required",
                    "is_accessible": False,
                    "explanation": "Destination website requires user credentials or authentication.",
                    "server_header": server_header
                }
            elif code == 404:
                return {
                    "checked_url": clean_url,
                    "status_code": code,
                    "access_status": "not_found",
                    "category": "tombstoned",
                    "is_accessible": False,
                    "explanation": (
                        "Destination resource returned HTTP 404 Not Found. "
                        "The webpage or media asset may have been moved, renamed, or deleted since discovery."
                    ),
                    "server_header": server_header
                }
            elif code == 429:
                return {
                    "checked_url": clean_url,
                    "status_code": code,
                    "access_status": "rate_limited",
                    "category": "rate_limited",
                    "is_accessible": False,
                    "explanation": "Destination website returned HTTP 429 Too Many Requests (rate limit exceeded).",
                    "server_header": server_header
                }
            else:
                return {
                    "checked_url": clean_url,
                    "status_code": code,
                    "access_status": "http_error",
                    "category": "remote_error",
                    "is_accessible": False,
                    "explanation": f"Destination server returned HTTP {code}.",
                    "server_header": server_header
                }

    except httpx.TimeoutException:
        return {
            "checked_url": clean_url,
            "status_code": None,
            "access_status": "timeout",
            "category": "unreachable",
            "is_accessible": False,
            "explanation": "Connection to destination server timed out.",
            "server_header": None
        }
    except Exception as e:
        return {
            "checked_url": clean_url,
            "status_code": None,
            "access_status": "unreachable",
            "category": "unreachable",
            "is_accessible": False,
            "explanation": f"Could not reach destination server: {str(e)}",
            "server_header": None
        }
