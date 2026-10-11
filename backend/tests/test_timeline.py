import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from app.timeline.builder import build_chronological_timeline, parse_iso_or_any_timestamp
from app.api.benchmark import run_synthetic_benchmark_suite
from app.main import app

# 1. Existing backward compatibility tests
def test_chronological_timeline():
    t_early = datetime(2020, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    t_late = datetime(2022, 5, 10, 8, 30, 0, tzinfo=timezone.utc)

    records = [
        {
            "id": "rec_late",
            "source_platform": "bluesky",
            "source_url": "https://bsky.app/post/2",
            "primary_timestamp": t_late,
            "timestamp_type": "source_publication",
            "timestamp_reliability": "high",
            "evidence_strength": "Probable match",
            "composite_score": 0.8
        },
        {
            "id": "rec_early",
            "source_platform": "wayback",
            "source_url": "https://web.archive.org/post/1",
            "primary_timestamp": t_early,
            "timestamp_type": "archive_capture",
            "timestamp_reliability": "high",
            "evidence_strength": "Strong match",
            "composite_score": 0.95
        }
    ]

    res = build_chronological_timeline(records, include_processing_events=False)
    events = res["timeline_events"]
    assert len(events) == 2
    assert events[0]["id"] == "rec_early"
    assert events[0]["is_earliest"] is True
    assert res["earliest_discovered_reference"]["evidence_id"] == "rec_early"


def test_synthetic_benchmark():
    bench = run_synthetic_benchmark_suite()
    assert bench["dataset_size"] == 4
    metrics = bench["metrics"]
    assert metrics["precision"] >= 0.8
    assert metrics["recall"] >= 0.8
    assert metrics["earliest_known_source_accuracy"] == 1.0


# 2. Several dated evidence records sorted chronologically
def test_multiple_dated_evidence_chronological_sorting():
    t1 = "2019-03-15T10:00:00Z"
    t2 = "2021-08-20T14:30:00Z"
    t3 = "2023-01-05T09:15:00Z"

    records = [
        {"id": "EV-3", "source_url": "https://url3.com", "reported_published_at": t3, "source_platform": "bluesky"},
        {"id": "EV-1", "source_url": "https://url1.com", "reported_published_at": t1, "source_platform": "web"},
        {"id": "EV-2", "source_url": "https://url2.com", "wayback_capture_at": t2, "source_platform": "wayback"},
    ]

    res = build_chronological_timeline(records, include_processing_events=False)
    events = res["timeline_events"]
    assert len(events) == 3
    assert events[0]["id"] == "EV-1"
    assert events[1]["id"] == "EV-2"
    assert events[2]["id"] == "EV-3"
    assert events[0]["is_earliest"] is True
    assert res["earliest_discovered_reference"]["evidence_id"] == "EV-1"


# 3. Only undated evidence records (neither publication nor retrieval timestamps)
def test_investigation_only_undated_evidence():
    records = [
        {"id": "EV-UNDATED-1", "source_url": "https://unverified.com/img1", "source_platform": "reverse_image"},
        {"id": "EV-UNDATED-2", "source_url": "https://unverified.com/img2", "source_platform": "reverse_image"},
    ]

    res = build_chronological_timeline(records, include_processing_events=False)
    assert len(res["timeline_events"]) == 0
    assert len(res["undated_events"]) == 2
    assert res["total_events"] == 2
    assert res["undated_events_count"] == 2
    assert res["undated_events"][0]["id"] == "EV-UNDATED-1"
    assert any("could not be associated with a valid timestamp" in w for w in res["warnings"])


# 4. Mixed dated and undated evidence
def test_mixed_dated_and_undated_evidence():
    records = [
        {"id": "EV-DATED", "source_url": "https://news.com", "reported_published_at": "2022-04-10T12:00:00Z", "source_platform": "web"},
        {"id": "EV-UNDATED", "source_url": "https://unknown.com", "source_platform": "reverse_image"},
    ]

    res = build_chronological_timeline(records, include_processing_events=False)
    assert len(res["timeline_events"]) == 1
    assert len(res["undated_events"]) == 1
    assert res["total_events"] == 2
    assert res["timeline_events"][0]["id"] == "EV-DATED"
    assert res["undated_events"][0]["id"] == "EV-UNDATED"


# 5. Evidence collection events (retrieval date but NO publication date)
def test_collection_events_labeled_and_timestamped():
    retrieval_time = "2026-10-10T12:00:00Z"
    records = [
        {
            "id": "EV-COLL-1",
            "source_url": "https://example.com/asset",
            "title_or_caption": "Visual match on designer site",
            "retrieved_at": retrieval_time,
            "source_platform": "reverse_image"
        }
    ]

    res = build_chronological_timeline(records, include_processing_events=False)
    assert len(res["timeline_events"]) == 1
    assert len(res["collection_events"]) == 1
    ev = res["timeline_events"][0]
    assert ev["event_type"] == "evidence_collection"
    assert "Evidence collected by OriginTrace" in ev["title"]
    assert ev["timestamp_provenance"] == "Discovered and recorded by OriginTrace AI workbench"
    assert "Does NOT represent original content creation date" in ev["uncertainty"]


# 6. Invalid and malformed timestamp strings handled gracefully without crashing
def test_invalid_timestamp_strings_handled_gracefully():
    malformed_strings = [
        "not-a-date",
        "2022-99-99",
        "invalid_timestamp_123",
        "NULL",
        ""
    ]

    for bad_ts in malformed_strings:
        parsed = parse_iso_or_any_timestamp(bad_ts)
        assert parsed is None

    # Feeding records with invalid timestamps
    records = [
        {"id": "EV-BAD-1", "source_url": "https://site.com", "reported_published_at": "corrupt_date"},
        {"id": "EV-BAD-2", "source_url": "https://site.com/2", "primary_timestamp": "invalid_val"}
    ]
    res = build_chronological_timeline(records, include_processing_events=False)
    assert len(res["undated_events"]) == 2
    assert len(res["timeline_events"]) == 0


# 7. Timezone offsets and UTC standardization
def test_timezone_offsets_standardized_to_utc():
    # 15:00 UTC+5 is 10:00 UTC (earlier than 11:00 UTC)
    t_offset_plus5 = "2024-05-01T15:00:00+05:00"
    t_utc = "2024-05-01T11:00:00Z"

    parsed_plus5 = parse_iso_or_any_timestamp(t_offset_plus5)
    parsed_utc = parse_iso_or_any_timestamp(t_utc)

    assert parsed_plus5 is not None
    assert parsed_utc is not None
    assert parsed_plus5 < parsed_utc
    assert parsed_plus5.tzinfo == timezone.utc

    records = [
        {"id": "EV-LATE", "source_url": "https://b.com", "reported_published_at": t_utc},
        {"id": "EV-EARLY", "source_url": "https://a.com", "reported_published_at": t_offset_plus5},
    ]
    res = build_chronological_timeline(records, include_processing_events=False)
    assert res["timeline_events"][0]["id"] == "EV-EARLY"
    assert res["timeline_events"][1]["id"] == "EV-LATE"


# 8. Duplicate evidence records deduplication
def test_duplicate_evidence_records_deduplicated():
    t = "2023-06-01T10:00:00Z"
    records = [
        {"id": "EV-DUP", "source_url": "https://same.com", "reported_published_at": t, "source_platform": "web"},
        {"id": "EV-DUP", "source_url": "https://same.com", "reported_published_at": t, "source_platform": "web"},
    ]

    res = build_chronological_timeline(records, include_processing_events=False)
    assert len(res["timeline_events"]) == 1


# 9. Missing optional fields in evidence record
def test_missing_optional_fields_safe():
    # Only minimal keys provided
    records = [
        {"source_url": "https://minimal.com"}
    ]
    res = build_chronological_timeline(records, include_processing_events=False)
    assert res["total_events"] == 1
    item = res["undated_events"][0]
    assert item["title"] == "https://minimal.com"
    assert item["author"] is None
    assert item["visual_similarity"] is None
    assert item["explanation"] is None


# 10. Completely empty investigation
def test_empty_investigation_returns_valid_structure():
    res = build_chronological_timeline([], include_processing_events=False)
    assert res["timeline_events"] == []
    assert res["undated_events"] == []
    assert res["collection_events"] == []
    assert res["total_events"] == 0
    assert res["earliest_discovered_reference"] is None


# 11. Evidence with publication date but no collection date
def test_publication_date_without_collection_date():
    records = [
        {
            "id": "EV-PUB-ONLY",
            "source_url": "https://news.org/2018",
            "reported_published_at": "2018-04-12T08:00:00Z",
            "source_platform": "web"
        }
    ]
    res = build_chronological_timeline(records, include_processing_events=False)
    assert len(res["timeline_events"]) == 1
    assert res["timeline_events"][0]["event_type"] == "source_publication"
    assert res["timeline_events"][0]["published_at"] is not None
    assert res["timeline_events"][0]["retrieved_at"] is None


# 12. Evidence with collection date but no publication date
def test_collection_date_without_publication_date():
    records = [
        {
            "id": "EV-COLL-ONLY",
            "source_url": "https://img-match.com",
            "retrieved_at": "2026-10-10T16:00:00Z",
            "source_platform": "reverse_image"
        }
    ]
    res = build_chronological_timeline(records, include_processing_events=False)
    assert len(res["timeline_events"]) == 1
    assert res["timeline_events"][0]["event_type"] == "evidence_collection"
    assert res["timeline_events"][0]["published_at"] is None
    assert res["timeline_events"][0]["retrieved_at"] is not None


# 13. System processing events integration
def test_system_processing_events_inclusion():
    class DummyInvestigation:
        id = "INV-PROC-TEST"
        created_at = datetime(2026, 10, 10, 9, 0, 0, tzinfo=timezone.utc)

    class DummyAsset:
        id = "ASSET-1"
        created_at = datetime(2026, 10, 10, 9, 1, 0, tzinfo=timezone.utc)
        original_filename = "photo.jpg"
        sha256 = "1234567890abcdef1234567890abcdef"
        perceptual_hash = "abcdef1234567890"
        image_width = 800
        image_height = 600
        capture_time = "2024-01-15T12:00:00Z"
        camera_make = "Sony"
        camera_model = "A7III"
        ocr_text = "Headline Text"

    class DummyLog:
        id = "LOG-1"
        connector_name = "reverse_image"
        status = "completed_with_matches"
        results_count = 5
        started_at = datetime(2026, 10, 10, 9, 2, 0, tzinfo=timezone.utc)

    inv = DummyInvestigation()
    assets = [DummyAsset()]
    logs = [DummyLog()]

    res = build_chronological_timeline(
        evidence_records=[],
        investigation=inv,
        assets=assets,
        logs=logs,
        include_processing_events=True
    )

    assert len(res["processing_events"]) == 3
    # Check that the camera EXIF date was extracted as a dated hardware event
    assert any(e["event_type"] == "source_publication" and "Sony" in e["title"] for e in res["timeline_events"])


# 14. Backend API 404 for nonexistent investigation
def test_backend_timeline_api_404():
    client = TestClient(app)
    response = client.get("/api/investigations/NONEXISTENT-INV-9999/timeline")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()
