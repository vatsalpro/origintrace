from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

def build_chronological_timeline(evidence_records: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Constructs a verified chronological timeline of discovered evidence.
    Determines the earliest discovered matching reference and flags provenance ambiguities.
    """
    valid_events = []
    undated_events = []

    for ev in evidence_records:
        # Check available timestamps in hierarchy of reliability
        # 1. source_publication / creation
        # 2. archive_capture
        # 3. retrieval_only
        primary_ts = ev.get("primary_timestamp") or ev.get("reported_published_at") or ev.get("wayback_capture_at")
        ts_type = ev.get("timestamp_type", "retrieval_only")
        reliability = ev.get("timestamp_reliability", "unverified")

        item = {
            "id": ev.get("id"),
            "evidence_id": ev.get("id"),
            "timestamp": primary_ts,
            "timestamp_type": ts_type,
            "reliability": reliability,
            "platform": ev.get("source_platform", "unknown"),
            "title": ev.get("title_or_caption") or ev.get("source_url"),
            "author": ev.get("author_name") or ev.get("author_handle"),
            "url": ev.get("source_url"),
            "match_type": ev.get("match_type", "match"),
            "evidence_strength": ev.get("evidence_strength", "Inconclusive"),
            "composite_score": ev.get("composite_score", 0.0),
            "media_urls": ev.get("media_urls", []),
            "ambiguity_notes": ev.get("ambiguity_notes"),
            "is_earliest": False
        }

        if primary_ts:
            valid_events.append(item)
        else:
            undated_events.append(item)

    # Sort valid events strictly by timestamp ascending (UTC)
    valid_events.sort(key=lambda x: x["timestamp"])

    earliest_reference = None
    if valid_events:
        # Mark the earliest discovered matching reference
        valid_events[0]["is_earliest"] = True
        earliest_reference = {
            "evidence_id": valid_events[0]["id"],
            "platform": valid_events[0]["platform"],
            "url": valid_events[0]["url"],
            "timestamp": valid_events[0]["timestamp"].isoformat() if hasattr(valid_events[0]["timestamp"], "isoformat") else str(valid_events[0]["timestamp"]),
            "timestamp_type": valid_events[0]["timestamp_type"],
            "reliability": valid_events[0]["reliability"],
            "author": valid_events[0]["author"],
            "title": valid_events[0]["title"],
            "evidence_strength": valid_events[0]["evidence_strength"],
            "ambiguity_notes": valid_events[0]["ambiguity_notes"] or "Earliest discovered reference among actively queried public sources."
        }

    return {
        "timeline_events": valid_events,
        "undated_events": undated_events,
        "total_events": len(valid_events) + len(undated_events),
        "earliest_discovered_reference": earliest_reference
    }
