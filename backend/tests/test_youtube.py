import pytest
from unittest.mock import patch, MagicMock
from app.connectors.youtube import YouTubeConnector
from app.core.config import settings

@pytest.fixture
def youtube_connector():
    return YouTubeConnector()

def test_youtube_configuration(youtube_connector):
    with patch.object(settings, "YOUTUBE_API_KEY", "AIzaSyTestKey1234567890"):
        assert youtube_connector.is_configured() is True
        masked = youtube_connector.get_masked_api_key()
        assert masked == "AIza...7890"
        assert "TestKey" not in masked

    with patch.object(settings, "YOUTUBE_API_KEY", ""):
        assert youtube_connector.is_configured() is False
        assert youtube_connector.get_masked_api_key() == "(not configured)"

@pytest.mark.anyio
async def test_youtube_health_check_success(youtube_connector):
    mock_resp = MagicMock()
    mock_resp.status_code = 200

    with patch.object(settings, "YOUTUBE_API_KEY", "AIzaSyTestKey1234567890"), \
         patch("httpx.AsyncClient.get", return_value=mock_resp):
        res = await youtube_connector.health_check()
        assert res["status"] == "healthy"
        assert res["available"] is True
        assert res["masked_key"] == "AIza...7890"

@pytest.mark.anyio
async def test_youtube_health_check_quota_exceeded(youtube_connector):
    mock_resp = MagicMock()
    mock_resp.status_code = 403

    with patch.object(settings, "YOUTUBE_API_KEY", "AIzaSyTestKey1234567890"), \
         patch("httpx.AsyncClient.get", return_value=mock_resp):
        res = await youtube_connector.health_check()
        assert res["status"] == "rate_limited"
        assert res["available"] is False

@pytest.mark.anyio
async def test_youtube_search_text_success(youtube_connector):
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "items": [
            {
                "id": {"videoId": "abc123xyz"},
                "snippet": {
                    "title": "Historical Documentary on Evidence",
                    "description": "Original documentary broadcast in 2021",
                    "channelTitle": "Forensics Channel",
                    "channelId": "UC12345",
                    "publishedAt": "2021-04-15T12:00:00Z",
                    "liveBroadcastContent": "none",
                    "thumbnails": {
                        "high": {"url": "https://i.ytimg.com/vi/abc123xyz/hqdefault.jpg"}
                    }
                }
            }
        ]
    }

    with patch.object(settings, "YOUTUBE_API_KEY", "AIzaSyTestKey1234567890"), \
         patch("httpx.AsyncClient.get", return_value=mock_resp):
        result = await youtube_connector.search_text("Historical Documentary")
        assert result.status == "completed_with_matches"
        assert len(result.records) == 1

        rec = result.records[0]
        assert rec["source_platform"] == "youtube"
        assert rec["source_url"] == "https://www.youtube.com/watch?v=abc123xyz"
        assert rec["candidate_image_url"] == "https://i.ytimg.com/vi/abc123xyz/hqdefault.jpg"
        assert rec["author_name"] == "Forensics Channel"
        assert rec["title_or_caption"] == "Historical Documentary on Evidence"
        assert rec["match_signals"]["source_domain"] == "youtube.com"
        assert "fallback_search_url" in rec["match_signals"]
        assert rec["primary_timestamp"].year == 2021

@pytest.mark.anyio
async def test_youtube_search_text_quota_error(youtube_connector):
    mock_resp = MagicMock()
    mock_resp.status_code = 403

    with patch.object(settings, "YOUTUBE_API_KEY", "AIzaSyTestKey1234567890"), \
         patch("httpx.AsyncClient.get", return_value=mock_resp):
        result = await youtube_connector.search_text("Forensic sample")
        assert result.status == "access_denied"
        assert "quota" in result.coverage_notes.lower()
