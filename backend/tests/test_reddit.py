import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from app.main import app
from app.connectors import CONNECTORS
from app.connectors.openverse import OpenverseConnector
from app.models.entities import EvidenceRecord, Investigation
from app.timeline.builder import build_chronological_timeline

@pytest.fixture
def client():
    return TestClient(app)

def test_reddit_removed_from_active_connectors():
    """Verify Reddit is completely removed from active connector registry and replaced with Openverse."""
    assert "reddit" not in CONNECTORS
    assert "openverse" in CONNECTORS
    assert isinstance(CONNECTORS["openverse"], OpenverseConnector)

def test_reddit_callback_endpoint_disabled(client):
    """Verify Reddit OAuth callback endpoint is completely removed."""
    res = client.get("/api/connectors/reddit/callback?code=mock_code_123&state=mock_state")
    assert res.status_code == 404

def test_historical_reddit_evidence_preserved_in_timeline():
    """
    Forensic requirement: Preserve historical investigations and stored Reddit evidence.
    Existing database records from Reddit must still render cleanly in the timeline.
    """
    mock_inv = Investigation(
        id="inv_historical_reddit",
        title="Historical Case with Reddit Evidence",
        input_type="image",
        status="completed",
        created_at=datetime(2023, 5, 1, 10, 0, 0, tzinfo=timezone.utc)
    )

    historical_record = EvidenceRecord(
        id="ev_historical_reddit_1",
        investigation_id="inv_historical_reddit",
        source_platform="reddit",
        source_url="https://www.reddit.com/r/technology/comments/xyz123/historical_post/",
        author_name="HistoricalAuthor",
        title_or_caption="Historical post discovered before Reddit deprecation",
        candidate_image_url="https://i.redd.it/historical_sample.png",
        match_type="semantic_claim",
        reported_published_at=datetime(2023, 4, 20, 12, 0, 0, tzinfo=timezone.utc),
        primary_timestamp=datetime(2023, 4, 20, 12, 0, 0, tzinfo=timezone.utc),
        timestamp_type="source_publication",
        timestamp_reliability="high",
        retrieved_at=datetime(2023, 5, 1, 10, 5, 0, tzinfo=timezone.utc),
        visual_similarity=0.92,
        composite_score=0.88,
        evidence_strength="Strong match",
        match_signals={"source_domain": "reddit.com"},
        access_status="accessible"
    )

    timeline_resp = build_chronological_timeline(
        investigation=mock_inv,
        evidence_records=[historical_record],
        logs=[]
    )

    # Historical record must appear in timeline
    assert len(timeline_resp["timeline_events"]) >= 1
    found = False
    for ev in timeline_resp["timeline_events"]:
        if ev["platform"] == "reddit":
            found = True
            assert ev["evidence_id"] == "ev_historical_reddit_1"
            assert ev["url"] == "https://www.reddit.com/r/technology/comments/xyz123/historical_post/"
            assert ev["author"] == "HistoricalAuthor"
            assert ev["event_type"] == "source_publication"
            assert "reddit.com" in ev["source_domain"]
            break
    assert found, "Historical Reddit evidence must be present in the timeline"
