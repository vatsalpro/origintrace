from datetime import datetime, timezone
from app.timeline.builder import build_chronological_timeline
from app.api.benchmark import run_synthetic_benchmark_suite

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

    res = build_chronological_timeline(records)
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
