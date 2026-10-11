import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
import httpx

from app.main import app
from app.core.url_validator import (
    validate_and_normalize_source_url,
    check_url_access_status,
    unwrap_redirect_url,
    classify_url_type
)
from app.timeline.builder import build_chronological_timeline
from app.graph.builder import build_origin_graph


@pytest.fixture
def client():
    return TestClient(app)


# Case 1: A valid, accessible source URL
def test_valid_accessible_source_url():
    url = "https://en.wikipedia.org/wiki/Digital_forensics"
    norm = validate_and_normalize_source_url(url, "Digital Forensics Overview", "wikipedia")
    assert norm["is_valid"] is True
    assert norm["clean_url"] == url
    assert norm["domain"] == "en.wikipedia.org"
    assert norm["url_type"] == "source_webpage"
    assert norm["is_direct_image"] is False
    assert "https://www.google.com/search?q=" in norm["fallback_search_url"]


@pytest.mark.anyio
async def test_accessible_source_url_probe():
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.headers = {"server": "nginx"}

    with patch("app.core.url_validator.validate_public_url", return_value=(True, "valid")), \
         patch("httpx.AsyncClient.head", return_value=mock_resp):
        res = await check_url_access_status("https://example.com/article")
        assert res["is_accessible"] is True
        assert res["status_code"] == 200
        assert res["access_status"] == "accessible"
        assert res["category"] == "public_web"


# Case 2: A source returning HTTP 403 (e.g. Cloudflare Edge / WAF)
@pytest.mark.anyio
async def test_source_returning_http_403_cloudflare():
    mock_resp = MagicMock()
    mock_resp.status_code = 403
    mock_resp.headers = {
        "server": "cloudflare",
        "cf-ray": "bom1::cn97b-1791632030798-ea9ecac1f61f"
    }

    with patch("app.core.url_validator.validate_public_url", return_value=(True, "valid")), \
         patch("httpx.AsyncClient.head", return_value=mock_resp):
        res = await check_url_access_status("https://protected-site.org/post/123")
        assert res["is_accessible"] is False
        assert res["status_code"] == 403
        assert res["access_status"] == "forbidden"
        assert res["category"] == "waf_or_cloudflare"
        assert "HTTP 403 Forbidden" in res["explanation"]
        assert "remains forensically valid" in res["explanation"]
        assert res["server_header"] == "cloudflare"


# Case 3: A source returning HTTP 404 Not Found
@pytest.mark.anyio
async def test_source_returning_http_404_not_found():
    mock_resp = MagicMock()
    mock_resp.status_code = 404
    mock_resp.headers = {"server": "Apache"}

    with patch("app.core.url_validator.validate_public_url", return_value=(True, "valid")), \
         patch("httpx.AsyncClient.head", return_value=mock_resp):
        res = await check_url_access_status("https://example.com/missing-page")
        assert res["is_accessible"] is False
        assert res["status_code"] == 404
        assert res["access_status"] == "not_found"
        assert res["category"] == "tombstoned"
        assert "HTTP 404 Not Found" in res["explanation"]


# Case 4: An invalid or missing URL
def test_invalid_or_missing_url():
    for invalid in [None, "", "   ", "\t"]:
        norm = validate_and_normalize_source_url(invalid, "Missing Item", "web")
        assert norm["is_valid"] is False
        assert norm["clean_url"] == ""
        assert norm["url_type"] == "malformed"
        assert norm["error_reason"] is not None


@pytest.mark.anyio
async def test_probe_invalid_url():
    res = await check_url_access_status("")
    assert res["is_accessible"] is False
    assert res["access_status"] == "malformed"
    assert res["category"] == "security_blocked"


# Case 5: A direct image URL correctly distinguished from a webpage
def test_direct_image_url_distinction():
    image_urls = [
        "https://cdn.example.com/images/cat.jpg",
        "https://cdn.example.com/photos/banner.PNG",
        "https://example.org/assets/logo.svg?v=2",
        "https://media.org/photo.webp#preview",
        "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR..."
    ]
    for img_url in image_urls:
        norm = validate_and_normalize_source_url(img_url, "Photo", "web")
        assert norm["is_valid"] is True
        assert norm["is_direct_image"] is True
        assert norm["url_type"] in ("direct_image", "thumbnail")

    # Regular HTML webpage must NOT be classified as direct image
    webpage_urls = [
        "https://example.com/blog/my-photos-from-vacation",
        "https://news.org/article/wildlife-photography",
        "https://tiktok.com/@user/video/12345"
    ]
    for web_url in webpage_urls:
        norm = validate_and_normalize_source_url(web_url, "Article", "web")
        assert norm["is_valid"] is True
        assert norm["is_direct_image"] is False
        assert norm["url_type"] == "source_webpage"


# Case 6: A source requiring login / authentication (HTTP 401)
@pytest.mark.anyio
async def test_source_requiring_login_http_401():
    mock_resp = MagicMock()
    mock_resp.status_code = 401
    mock_resp.headers = {"www-authenticate": "Bearer"}

    with patch("app.core.url_validator.validate_public_url", return_value=(True, "valid")), \
         patch("httpx.AsyncClient.head", return_value=mock_resp):
        res = await check_url_access_status("https://private.corp.com/dashboard")
        assert res["is_accessible"] is False
        assert res["status_code"] == 401
        assert res["access_status"] == "restricted"
        assert res["category"] == "authentication_required"
        assert "requires user credentials" in res["explanation"]


# Case 7: Malformed URLs returned by search providers (data:, javascript:, redirects)
def test_malformed_search_provider_urls():
    # Dangerous schemes rejected
    data_url = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
    norm_data = validate_and_normalize_source_url(data_url)
    assert norm_data["is_valid"] is False
    assert norm_data["url_type"] == "malformed"
    assert "Disallowed URL scheme" in norm_data["error_reason"]

    js_url = "javascript:alert(1)"
    norm_js = validate_and_normalize_source_url(js_url)
    assert norm_js["is_valid"] is False
    assert "Disallowed URL scheme" in norm_js["error_reason"]

    # Google redirect unwrap
    wrapped_google = "https://www.google.com/url?q=https%3A%2F%2Findependent-news.org%2Fstory-99&sa=U&ved=2ahUKEwi"
    unwrapped = unwrap_redirect_url(wrapped_google)
    assert unwrapped == "https://independent-news.org/story-99"

    norm_wrapped = validate_and_normalize_source_url(wrapped_google, "News Story", "google")
    assert norm_wrapped["is_valid"] is True
    assert norm_wrapped["clean_url"] == "https://independent-news.org/story-99"
    assert norm_wrapped["domain"] == "independent-news.org"


# Case 8: SSRF and internal hostname rejection
def test_ssrf_internal_hostname_rejection():
    internal_urls = [
        "http://localhost:8080/admin",
        "http://127.0.0.1:8000/api",
        "http://0.0.0.0/test",
        "http://metadata.google.internal/computeMetadata/v1/"
    ]
    for i_url in internal_urls:
        norm = validate_and_normalize_source_url(i_url)
        assert norm["is_valid"] is False
        assert "blocked" in norm["error_reason"].lower()


# Case 9: FastAPI verify-url endpoint
def test_api_verify_url_endpoint(client):
    mock_resp = MagicMock()
    mock_resp.status_code = 403
    mock_resp.headers = {"server": "cloudflare", "cf-ray": "bom1::test"}

    with patch("app.core.url_validator.validate_public_url", return_value=(True, "valid")), \
         patch("httpx.AsyncClient.head", return_value=mock_resp):
        resp = client.get("/api/investigations/verify-url", params={"url": "https://example.com/page"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["status_code"] == 403
        assert data["access_status"] == "forbidden"
        assert data["category"] == "waf_or_cloudflare"


# Case 10: Timeline reconstruction enriches events with fallbacks
def test_timeline_reconstruction_url_enrichment():
    records = [
        {
            "id": "EVD-101",
            "source_platform": "reverse_image",
            "source_url": "https://www.tiktok.com/@creator/video/99887766",
            "candidate_image_url": "https://m.media-amazon.com/images/I/412b.jpg",
            "title_or_caption": "Viral Dance Clip",
            "retrieved_at": "2024-05-10T12:00:00Z",
            "match_signals": {
                "search_provider": "Google Lens (SerpApi)",
                "discovery_method": "visual_search"
            }
        }
    ]

    res = build_chronological_timeline(records)
    assert res["total_events"] >= 1
    event = res["timeline_events"][0] if res["timeline_events"] else res["collection_events"][0]
    assert event["source_domain"] == "www.tiktok.com"
    assert event["url"] == "https://www.tiktok.com/@creator/video/99887766"
    assert event["fallback_search_url"] is not None
    assert "https://www.google.com/search?q=" in event["fallback_search_url"]
    assert event["is_direct_image"] is False
    assert event["candidate_image_url"] == "https://m.media-amazon.com/images/I/412b.jpg"


# Case 11: URLs containing query parameters, encoding, and fragments preserved without double encoding
def test_query_params_and_fragments_preserved():
    url = "https://example.com/search?q=forensic%20investigation&filter=all&page=2#results-section"
    norm = validate_and_normalize_source_url(url, "Search Results", "web")
    assert norm["is_valid"] is True
    assert norm["clean_url"] == url
    assert "%20" in norm["clean_url"]
    assert "%2520" not in norm["clean_url"]  # No double encoding
    assert "#results-section" in norm["clean_url"]
    assert "filter=all" in norm["clean_url"]


# Case 12: Archive snapshot links classification
def test_archive_snapshot_url_classification():
    wayback_url = "https://web.archive.org/web/20210412101530/https://example.com/story"
    norm = validate_and_normalize_source_url(wayback_url, "Archived Story", "wayback")
    assert norm["is_valid"] is True
    assert norm["clean_url"] == wayback_url
    assert norm["domain"] == "web.archive.org"
    assert norm["url_type"] == "archive_snapshot"
    assert norm["is_direct_image"] is False


# Case 13: ATProto URIs resolution to canonical bsky.app URLs
def test_atproto_uri_resolution():
    at_uri = "at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.post/3kht5l76dzk2r"
    norm = validate_and_normalize_source_url(at_uri, "Bluesky Post", "bluesky")
    assert norm["is_valid"] is True
    assert norm["clean_url"] == "https://bsky.app/profile/did:plc:z72i7hdynmk6r22z27h6tvur/post/3kht5l76dzk2r"
    assert norm["domain"] == "bsky.app"
    assert norm["url_type"] == "source_webpage"


# Case 14: Source records with only a thumbnail URL
def test_thumbnail_only_source_record():
    thumb_url = "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRTest123"
    norm = validate_and_normalize_source_url(thumb_url, "Thumbnail Candidate", "reverse_image")
    assert norm["is_valid"] is True
    assert norm["url_type"] == "thumbnail"
    assert norm["is_direct_image"] is True
    assert norm["domain"] == "encrypted-tbn0.gstatic.com"


# Case 15: Origin graph source navigation and URL metadata enrichment
def test_origin_graph_source_navigation_metadata():
    records = [
        {
            "id": "EVD-201",
            "source_platform": "mastodon",
            "source_url": "https://mastodon.social/@researcher/109876543",
            "candidate_image_url": "https://files.mastodon.social/media_attachments/files/001/img.png",
            "title_or_caption": "Mastodon Scientific Discovery",
            "author_handle": "@researcher",
            "evidence_strength": "Strong match",
            "composite_score": 0.92,
            "primary_timestamp": "2023-01-15T08:30:00Z"
        }
    ]
    graph = build_origin_graph("INV-TEST", "Target Artifact", "image", records)
    assert graph["total_nodes"] >= 2
    ev_node = next((n for n in graph["nodes"] if n["id"] == "EVD-201"), None)
    assert ev_node is not None
    assert ev_node["url"] == "https://mastodon.social/@researcher/109876543"
    assert ev_node["data"]["source_domain"] == "mastodon.social"
    assert ev_node["data"]["candidate_image_url"] == "https://files.mastodon.social/media_attachments/files/001/img.png"
    assert ev_node["data"]["fallback_search_url"] is not None


# Case 16: Unavailable sources and honest diagnostic reporting
@pytest.mark.anyio
async def test_unavailable_sources_and_fallback_actions():
    # Timeout probe
    with patch("app.core.url_validator.validate_public_url", return_value=(True, "valid")), \
         patch("httpx.AsyncClient.head", side_effect=httpx.TimeoutException("Read timed out")):
        res = await check_url_access_status("https://slow-server.org/asset.jpg")
        assert res["is_accessible"] is False
        assert res["access_status"] == "timeout"
        assert res["category"] == "unreachable"
        assert "timed out" in res["explanation"]

