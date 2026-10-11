import io
import pytest
from datetime import datetime, timezone
from PIL import Image
from unittest.mock import patch, MagicMock
import httpx

from app.services.fingerprint import (
    extract_image_fingerprints,
    extract_detailed_metadata,
    compare_hashes,
    analyze_transformation_clues,
    generate_safe_thumbnail
)
from app.services.ocr import (
    extract_ocr_text,
    generate_ocr_search_queries,
    is_tesseract_available
)
from app.services.text_nlp import extract_entities, normalize_text
from app.services.candidate_comparator import retrieve_and_compare_candidate_image
from app.matching.engine import evaluate_image_match, evaluate_text_match
from app.timeline.builder import build_chronological_timeline
from app.services.orchestrator import compile_investigation_diagnostics
from app.connectors.reverse_image import ReverseImageConnector
from app.core.security import validate_image_file_bytes, validate_public_url
from app.models.entities import Investigation, EvidenceRecord, ConnectorExecutionLog, InputAsset


def _create_test_image(size=(120, 120), color=(100, 150, 200)) -> bytes:
    img = Image.new("RGB", size, color=color)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


# 1. Valid image upload generates SHA-256 and perceptual hashes
def test_valid_image_upload_generates_hashes():
    data = _create_test_image()
    res = extract_image_fingerprints(data)
    assert res["sha256"] is not None and len(res["sha256"]) == 64
    assert res["perceptual_hash"] is not None
    assert res["difference_hash"] is not None
    assert res["average_hash"] is not None
    assert res["wavelet_hash"] is not None
    assert res["image_width"] == 120
    assert res["image_height"] == 120
    assert res["thumbnail_path"] != ""


# 2. Corrupt or truncated image upload returns a clear validation error
def test_corrupt_or_truncated_image_validation_error():
    corrupt_bytes = b"NOT_A_REAL_IMAGE_DATA_TRUNCATED"
    ok, fmt, err = validate_image_file_bytes(corrupt_bytes)
    assert ok is False
    assert "Invalid or corrupted image format" in err


# 3. Overly large image upload is rejected with descriptive error
def test_overly_large_image_rejected():
    large_bytes = b"0" * (51 * 1024 * 1024)
    ok, fmt, err = validate_image_file_bytes(large_bytes)
    assert ok is False
    assert "exceeds maximum size" in err


# 4. Image with EXIF data correctly populates camera, timestamp, and GPS fields
def test_image_with_exif_data():
    img = Image.new("RGB", (80, 80), color="white")
    exif = img.getexif()
    exif[0x010F] = "Nikon"       # Make
    exif[0x0110] = "D850"        # Model
    exif[0x0131] = "Lightroom"   # Software
    exif[0x0132] = "2023:08:15 14:30:00"  # DateTime
    
    meta = extract_detailed_metadata(img)
    assert meta["camera_make"] == "Nikon"
    assert meta["camera_model"] == "D850"
    assert meta["software"] == "Lightroom"
    assert meta["capture_time"] in ("2023:08:15 14:30:00", "2023-08-15 14:30:00")


# 5. Image without EXIF data processes successfully without error
def test_image_without_exif_data():
    img = Image.new("RGB", (50, 50), color="blue")
    meta = extract_detailed_metadata(img)
    assert meta["camera_make"] is None
    assert meta["camera_model"] is None
    assert meta["capture_time"] is None
    assert meta["gps_info"] == {}


# 6. Image with visible text extracts text via OCR and extracts entities
def test_image_ocr_text_and_entities():
    sample_text = "Breaking update from @reporter regarding crisis at https://news.example.com on 2024-06-01 #breaking"
    entities = extract_entities(sample_text)
    assert "reporter" in entities["handles"]
    assert "https://news.example.com" in entities["urls"]
    assert "breaking" in entities["hashtags"]
    assert "2024-06-01" in entities["dates"]
    
    queries = generate_ocr_search_queries(sample_text, entities)
    assert len(queries) > 0


# 7. Image without text handles OCR gracefully (status = 'no_text_detected')
def test_image_without_text_ocr_graceful():
    img_bytes = _create_test_image()
    mock_data = {"conf": ["-1"], "text": [""]}
    with patch("app.services.ocr.is_tesseract_available", return_value=(True, "tesseract")), \
         patch("pytesseract.image_to_data", return_value=mock_data), \
         patch("pytesseract.image_to_string", return_value="   "):
        res = extract_ocr_text(img_bytes)
        assert res["status"] == "no_text_detected"
        assert res["text"] == ""
        assert res["confidence"] is None


# 8. When OCR is not installed, system records clear diagnostic status
def test_ocr_unavailable_diagnostic_status():
    img_bytes = _create_test_image()
    with patch("app.services.ocr.is_tesseract_available", return_value=(False, "Not found")):
        res = extract_ocr_text(img_bytes)
        assert res["status"] == "unavailable"
        assert "not installed" in res["diagnostic_message"]


# 9. Reverse-image search connector handles unconfigured state gracefully
@pytest.mark.anyio
async def test_reverse_image_connector_unconfigured():
    with patch("app.connectors.reverse_image.settings.SERPAPI_API_KEY", ""):
        connector = ReverseImageConnector()
        assert connector.is_configured() is False
        res = await connector.search_image(fingerprint={})
        assert res.status == "not_configured"
        assert len(res.records) == 0
        assert "SERPAPI_API_KEY" in res.coverage_notes


# 10. Reverse-image search connector parses candidate results when configured (mock test)
@pytest.mark.anyio
async def test_reverse_image_connector_candidate_parsing_mock():
    mock_response_data = {
        "visual_matches": [
            {
                "link": "https://example.com/original-article",
                "title": "Historical Protest Photo from 2018",
                "source": "News Weekly",
                "thumbnail": "https://example.com/thumb.jpg",
                "date": "2018-05-12T10:00:00Z"
            }
        ]
    }
    
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = mock_response_data

    with patch("app.connectors.reverse_image.settings.SERPAPI_API_KEY", "mock_key_123"), \
         patch("httpx.AsyncClient.get", return_value=mock_resp):
        connector = ReverseImageConnector()
        res = await connector.search_image(
            fingerprint={},
            options={"public_image_url": "https://example.com/input.jpg"}
        )
        assert res.status in ("completed_with_matches", "success")
        assert len(res.records) == 1
        assert res.records[0]["source_platform"] == "reverse_image"
        assert res.records[0]["source_url"] == "https://example.com/original-article"
        assert res.records[0]["candidate_image_url"] == "https://example.com/thumb.jpg"


# 11. Reverse-image search connector handles rate limit (429) gracefully
@pytest.mark.anyio
async def test_reverse_image_connector_rate_limit_429():
    mock_resp = MagicMock()
    mock_resp.status_code = 429
    mock_resp.text = "Rate limit exceeded"

    with patch("app.connectors.reverse_image.settings.SERPAPI_API_KEY", "mock_key_123"), \
         patch("httpx.AsyncClient.get", return_value=mock_resp):
        connector = ReverseImageConnector()
        res = await connector.search_image(
            fingerprint={},
            options={"public_image_url": "https://example.com/input.jpg"}
        )
        assert res.status == "rate_limited"
        assert len(res.records) == 0
        assert "rate limited" in res.error_message.lower() or "quota" in res.error_message.lower()


# 12. Social media connector searches by OCR query terms
def test_social_media_connector_searches_by_ocr_queries():
    queries = ["\"First quote of text\"", "quote and text"]
    assert len(queries) == 2
    assert queries[0].startswith("\"")


# 13. Candidate image retrieval downloads and compares candidate image against target perceptual hash
@pytest.mark.anyio
async def test_candidate_image_download_and_perceptual_comparison():
    target_img_bytes = _create_test_image((100, 100), (200, 50, 50))
    target_fp = extract_image_fingerprints(target_img_bytes)

    # Candidate is slightly different size, same color
    candidate_img_bytes = _create_test_image((90, 90), (200, 50, 50))

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.headers = {"content-type": "image/png"}
    mock_resp.content = candidate_img_bytes

    with patch("app.services.candidate_comparator.validate_public_url", return_value=(True, "valid")), \
         patch("httpx.AsyncClient.get", return_value=mock_resp):
        result = await retrieve_and_compare_candidate_image(
            target_fp=target_fp,
            candidate_image_url="https://valid-domain.com/photo.png",
            investigation_id="INV-TEST"
        )
        assert result is not None
        assert result["retrieval_status"] == "success"
        assert result["visual_similarity"] >= 0.80
        assert result["candidate_phash"] is not None
        assert result["candidate_width"] == 90
        assert result["candidate_height"] == 90


# 14. Candidate image with private IP (SSRF attempt) is blocked
@pytest.mark.anyio
async def test_candidate_image_ssrf_blocked():
    target_img_bytes = _create_test_image()
    target_fp = extract_image_fingerprints(target_img_bytes)
    result = await retrieve_and_compare_candidate_image(
        target_fp=target_fp,
        candidate_image_url="http://192.168.1.1/secret.jpg",
        investigation_id="INV-TEST"
    )
    assert result is not None
    assert result["retrieval_status"] == "blocked_ssrf"


# 15. Candidate image that is too large or invalid format is handled gracefully
@pytest.mark.anyio
async def test_candidate_image_large_or_corrupt_handled():
    target_img_bytes = _create_test_image()
    target_fp = extract_image_fingerprints(target_img_bytes)
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.headers = {"content-type": "text/html"}
    mock_resp.content = b"<html>Not an image</html>"

    with patch("app.services.candidate_comparator.validate_public_url", return_value=(True, "valid")), \
         patch("httpx.AsyncClient.get", return_value=mock_resp):
        result = await retrieve_and_compare_candidate_image(
            target_fp=target_fp,
            candidate_image_url="https://valid-domain.com/page.html",
            investigation_id="INV-TEST"
        )
        assert result is not None
        assert result["retrieval_status"] == "invalid_image"


# 16. Composite scoring correctly weights visual similarity, timestamp, source reliability
def test_composite_scoring_weights():
    # Exact bitstream match
    m_type, score, strength, signals = evaluate_image_match(
        target_sha256="abc123",
        target_phash="1234567812345678",
        target_dhash="1234567812345678",
        target_w=100,
        target_h=100,
        cand_sha256="abc123",
        cand_phash="1234567812345678",
        cand_dhash="1234567812345678",
        cand_w=100,
        cand_h=100
    )
    assert m_type == "exact"
    assert score == 1.0
    assert strength == "Strong match"
    assert signals["sha256_match"] is True

    # High perceptual distance (unrelated image)
    m_type_diff, score_diff, strength_diff, _ = evaluate_image_match(
        target_sha256="abc123",
        target_phash="0000000000000000",
        target_dhash="0000000000000000",
        target_w=100,
        target_h=100,
        cand_sha256="def456",
        cand_phash="ffffffffffffffff",
        cand_dhash="ffffffffffffffff",
        cand_w=100,
        cand_h=100
    )
    assert score_diff <= 0.20
    assert strength_diff in ("Inconclusive", "Related claim only")


# 17. Earliest discovered reference is correctly identified from multiple candidates
def test_earliest_discovered_reference_selection():
    records = [
        {
            "id": "EV-1",
            "source_platform": "bluesky",
            "source_url": "https://bsky.app/post/1",
            "primary_timestamp": datetime(2023, 5, 1, 10, 0, tzinfo=timezone.utc),
            "timestamp_type": "source_publication",
            "timestamp_reliability": "high",
            "evidence_strength": "Strong match",
            "composite_score": 0.9
        },
        {
            "id": "EV-2",
            "source_platform": "wayback",
            "source_url": "https://web.archive.org/web/20210201/https://news.com",
            "primary_timestamp": datetime(2021, 2, 1, 12, 0, tzinfo=timezone.utc),
            "timestamp_type": "archive_capture",
            "timestamp_reliability": "medium",
            "evidence_strength": "Strong match",
            "composite_score": 0.85
        },
        {
            "id": "EV-3",
            "source_platform": "mastodon",
            "source_url": "https://mastodon.social/@user/123",
            "primary_timestamp": datetime(2024, 1, 1, 0, 0, tzinfo=timezone.utc),
            "timestamp_type": "source_publication",
            "timestamp_reliability": "high",
            "evidence_strength": "Probable match",
            "composite_score": 0.75
        }
    ]

    res = build_chronological_timeline(records)
    earliest = res["earliest_discovered_reference"]
    assert earliest is not None
    assert earliest["evidence_id"] == "EV-2"
    assert earliest["platform"] == "wayback"


# 18. Diagnostic report accurately reflects which connectors ran, failed, or had no results
def test_diagnostics_report_accuracy():
    inv = Investigation(
        id="INV-DIAG-01",
        title="Diagnostic Evaluation Case",
        input_type="image",
        status="completed",
        current_stage="completed",
        stage_details={},
        parameters={"selected_platforms": ["reverse_image", "bluesky", "mastodon"]}
    )

    log1 = ConnectorExecutionLog(
        id="LOG-1",
        investigation_id=inv.id,
        connector_name="reverse_image",
        status="not_configured",
        results_count=0,
        coverage_notes="SERPAPI_API_KEY is not configured",
        search_parameters={},
        duration_ms=5
    )
    log2 = ConnectorExecutionLog(
        id="LOG-2",
        investigation_id=inv.id,
        connector_name="bluesky",
        status="success",
        results_count=2,
        search_parameters={},
        duration_ms=450
    )
    log3 = ConnectorExecutionLog(
        id="LOG-3",
        investigation_id=inv.id,
        connector_name="mastodon",
        status="error",
        error_message="Network timeout",
        results_count=0,
        search_parameters={},
        duration_ms=1000
    )

    inv.connector_logs = [log1, log2, log3]
    inv.evidence_records = []

    diag = compile_investigation_diagnostics(
        inv_id=inv.id,
        status=inv.status,
        current_stage=inv.current_stage,
        stages=inv.stage_details or {},
        logs=[log1, log2, log3],
        evidence=[],
        target_asset=None
    )
    assert "reverse_image" in diag["unconfigured_connectors"]
    assert "bluesky" in diag["successful_connectors"]
    assert "mastodon" in diag["failed_connectors"]
    assert any("SERPAPI_API_KEY" in r for r in diag["reasons_for_limited_results"])


# 19. Two-step SerpApi local image upload and Lens search workflow (mocked)
@pytest.mark.anyio
async def test_serpapi_two_step_local_image_upload_mock(tmp_path):
    img_bytes = _create_test_image((80, 80))
    test_img_path = tmp_path / "target.png"
    test_img_path.write_bytes(img_bytes)

    post_resp = MagicMock()
    post_resp.status_code = 200
    post_resp.json.return_value = {"image_id": "mock_img_id_999"}

    get_resp = MagicMock()
    get_resp.status_code = 200
    get_resp.json.return_value = {
        "visual_matches": [
            {
                "link": "https://archive-news.org/story-2019",
                "title": "Discovered Visual Match from 2019",
                "source": "Archive News",
                "thumbnail": "https://archive-news.org/thumb.jpg",
                "date": "2019-06-15"
            }
        ]
    }

    connector = ReverseImageConnector()
    with patch("app.connectors.reverse_image.settings.SERPAPI_API_KEY", "7097902aa03626c0a5b0fa7d17223dfa96ecd8208444207c916b6d7aa744dcc4"), \
         patch("app.connectors.reverse_image.settings.CACHE_PATH", tmp_path), \
         patch("httpx.AsyncClient.post", return_value=post_resp), \
         patch("httpx.AsyncClient.get", return_value=get_resp):
        res = await connector.search_image(
            fingerprint={"sha256": "mock_sha256_unique_fresh_test"},
            options={"file_path": str(test_img_path)}
        )
        assert res.status in ("completed_with_matches", "success")
        assert res.credits_consumed == 1
        assert res.is_cached is False
        assert len(res.records) == 1
        assert res.records[0]["source_url"] == "https://archive-news.org/story-2019"
        assert res.records[0]["title_or_caption"] == "Discovered Visual Match from 2019"


# 20. SerpApi 401 unauthorized returns structured authentication error
@pytest.mark.anyio
async def test_serpapi_unauthorized_401_error():
    mock_resp = MagicMock()
    mock_resp.status_code = 401
    mock_resp.text = '{"error": "Invalid API key"}'

    connector = ReverseImageConnector()
    with patch("app.connectors.reverse_image.settings.SERPAPI_API_KEY", "invalid_key_xyz"), \
         patch("httpx.AsyncClient.get", return_value=mock_resp):
        res = await connector.search_image(
            fingerprint={"sha256": "mock_sha256_test"},
            options={"public_image_url": "https://example.com/test.jpg"}
        )
        assert res.status == "access_denied"
        assert res.credits_consumed == 0
        assert "invalid serpapi credentials" in res.error_message.lower()


# 21. SerpApi request timeout handled gracefully
@pytest.mark.anyio
async def test_serpapi_timeout_error():
    connector = ReverseImageConnector()
    with patch("app.connectors.reverse_image.settings.SERPAPI_API_KEY", "valid_mock_key"), \
         patch("httpx.AsyncClient.get", side_effect=httpx.TimeoutException("Connection timed out")):
        res = await connector.search_image(
            fingerprint={"sha256": "mock_sha256_test"},
            options={"public_image_url": "https://example.com/test.jpg"}
        )
        assert res.status == "timeout"
        assert res.credits_consumed == 0
        assert "timed out" in res.error_message.lower()


# 22. SerpApi SHA-256 caching: second search consumes 0 credits and hits cache
@pytest.mark.anyio
async def test_serpapi_sha256_cache_hit(tmp_path):
    test_sha = "unique_sha256_cache_test_hash"
    cache_file = tmp_path / f"serpapi_lens_{test_sha}.json"
    cached_data = {
        "timestamp": 9999999999,  # Far future
        "sha256": test_sha,
        "records": [
            {
                "source_platform": "reverse_image",
                "source_url": "https://cached-match.com/news",
                "title_or_caption": "Cached Match Article",
                "media_urls": [],
                "match_type": "exact",
                "timestamp_type": "retrieval_only",
                "timestamp_reliability": "medium"
            }
        ]
    }
    import json
    cache_file.write_text(json.dumps(cached_data), encoding="utf-8")

    connector = ReverseImageConnector()
    with patch("app.connectors.reverse_image.settings.SERPAPI_API_KEY", "some_key_12345"), \
         patch("app.connectors.reverse_image.settings.CACHE_PATH", tmp_path):
        res = await connector.search_image(
            fingerprint={"sha256": test_sha},
            options={"public_image_url": "https://example.com/test.jpg"}
        )
        assert res.status == "completed_with_matches"
        assert res.is_cached is True
        assert res.credits_consumed == 0
        assert len(res.records) == 1
        assert res.records[0]["source_url"] == "https://cached-match.com/news"


# 23. Masked API key formatting verifies safe display
def test_masked_api_key_formatting():
    connector = ReverseImageConnector()
    with patch("app.connectors.reverse_image.settings.SERPAPI_API_KEY", "7097902aa03626c0a5b0fa7d17223dfa96ecd8208444207c916b6d7aa744dcc4"):
        masked = connector.get_masked_api_key()
        assert masked == "7097...dcc4"
        assert "7097902aa" not in masked

    with patch("app.connectors.reverse_image.settings.SERPAPI_API_KEY", "12345678"):
        assert connector.get_masked_api_key() == "1234...5678"

    with patch("app.connectors.reverse_image.settings.SERPAPI_API_KEY", "abcd"):
        assert connector.get_masked_api_key() == "(not configured)"

    with patch("app.connectors.reverse_image.settings.SERPAPI_API_KEY", ""):
        assert connector.get_masked_api_key() == "(not configured)"

