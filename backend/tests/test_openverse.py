import json
import pytest
from unittest.mock import patch, MagicMock
from app.connectors.openverse import OpenverseConnector

@pytest.fixture
def openverse_connector():
    return OpenverseConnector()

def test_openverse_properties(openverse_connector):
    assert openverse_connector.name == "openverse"
    assert openverse_connector.requires_api_key is False
    assert openverse_connector.is_configured() is True
    assert "search_text" in openverse_connector.supported_operations

@pytest.mark.anyio
async def test_openverse_health_check_success(openverse_connector):
    mock_resp = MagicMock()
    mock_resp.status_code = 200

    with patch("httpx.AsyncClient.get", return_value=mock_resp):
        res = await openverse_connector.health_check()
        assert res["status"] == "healthy"
        assert res["available"] is True
        assert "zero-key" in res["notes"]

@pytest.mark.anyio
async def test_openverse_health_check_rate_limited(openverse_connector):
    mock_resp = MagicMock()
    mock_resp.status_code = 429

    with patch("httpx.AsyncClient.get", return_value=mock_resp):
        res = await openverse_connector.health_check()
        assert res["status"] == "rate_limited"
        assert res["available"] is False

@pytest.mark.anyio
async def test_openverse_search_text_success(openverse_connector, tmp_path):
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "results": [
            {
                "id": "ov-12345",
                "title": "Historic Cathedral Architecture",
                "foreign_landing_url": "https://commons.wikimedia.org/wiki/File:Historic_Cathedral.jpg",
                "url": "https://upload.wikimedia.org/wikipedia/commons/a/ab/Historic_Cathedral.jpg",
                "thumbnail": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Historic_Cathedral.jpg/300px.jpg",
                "creator": "ArchivistJane",
                "license": "by",
                "license_version": "4.0",
                "attribution": "\"Historic Cathedral Architecture\" by ArchivistJane is licensed under CC BY 4.0",
                "indexed_on": "2022-04-15T08:30:00Z"
            }
        ]
    }

    # Use isolated cache dir
    with patch("app.core.config.settings.CACHE_PATH", tmp_path), \
         patch("httpx.AsyncClient.get", return_value=mock_resp):
        result = await openverse_connector.search_text("Cathedral Architecture")
        assert result.status == "completed_with_matches"
        assert len(result.records) == 1

        rec = result.records[0]
        assert rec["source_platform"] == "openverse"
        # Source URL must be true webpage landing URL, not direct candidate or thumbnail URL
        assert rec["source_url"] == "https://commons.wikimedia.org/wiki/File:Historic_Cathedral.jpg"
        assert rec["candidate_image_url"] == "https://upload.wikimedia.org/wikipedia/commons/a/ab/Historic_Cathedral.jpg"
        assert rec["author_name"] == "ArchivistJane"
        assert rec["title_or_caption"] == "Historic Cathedral Architecture"
        assert "CC BY 4.0" in rec["match_signals"]["cc_license"]
        assert rec["match_signals"]["attribution"] is not None
        assert rec["match_signals"]["search_provider"] == "Openverse Image Discovery"
        assert rec["match_signals"]["discovery_method"] == "text_metadata_search"

        # Verify caching: second search reads from cache without HTTP request
        with patch("httpx.AsyncClient.get", side_effect=Exception("Should not hit network on cache hit")):
            cached_result = await openverse_connector.search_text("Cathedral Architecture")
            assert cached_result.status == "completed_with_matches"
            assert len(cached_result.records) == 1
            assert "cache" in cached_result.coverage_notes.lower()

@pytest.mark.anyio
async def test_openverse_search_empty_results(openverse_connector, tmp_path):
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"results": []}

    with patch("app.core.config.settings.CACHE_PATH", tmp_path), \
         patch("httpx.AsyncClient.get", return_value=mock_resp):
        result = await openverse_connector.search_text("UniqueNonExistentQueryXYZ987")
        assert result.status == "completed_no_matches"
        assert len(result.records) == 0

@pytest.mark.anyio
async def test_openverse_short_query(openverse_connector):
    result = await openverse_connector.search_text("a")
    assert result.status == "completed_no_matches"
    assert "too short" in result.coverage_notes
