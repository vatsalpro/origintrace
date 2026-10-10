import sys
from pathlib import Path
from datetime import datetime, timezone, timedelta

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.database.session import SessionLocal, Base, engine
from app.models.entities import (
    Investigation,
    InputAsset,
    EvidenceRecord,
    ConnectorExecutionLog,
    InvestigationReport
)
from app.reports.generator import generate_investigation_report
from app.timeline.builder import build_chronological_timeline
from app.api.benchmark import create_synthetic_test_image
from app.services.fingerprint import extract_image_fingerprints
from PIL import Image
from io import BytesIO

def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    existing = db.query(Investigation).filter(Investigation.id == "INV-DEMO-001").first()
    if existing:
        print("Demo investigation already seeded.")
        db.close()
        return

    print("Seeding synthetic forensic investigation benchmark into database...")

    # Create synthetic test assets
    img_bytes = create_synthetic_test_image("ORIGIN TRACE FORENSIC EVIDENCE SAMPLE", color="#1E3A8A")
    fp = extract_image_fingerprints(img_bytes)

    # Base dates
    t0 = datetime(2021, 5, 12, 14, 22, 0, tzinfo=timezone.utc)
    t1 = datetime(2021, 5, 12, 18, 45, 0, tzinfo=timezone.utc)
    t2 = datetime(2022, 8, 4, 9, 10, 0, tzinfo=timezone.utc)
    t3 = datetime(2023, 1, 15, 20, 30, 0, tzinfo=timezone.utc)

    inv = Investigation(
        id="INV-DEMO-001",
        title="Forensic Benchmark: Solar Observation Leak Claim",
        input_type="image",
        input_content="Viral astronomical observation snapshot claimed to be taken in 2024",
        status="completed",
        is_synthetic=True,
        summary=(
            "Digital forensics inquiry resolved earliest discovered matching reference to 2021-05-12 14:22:00 UTC "
            "on Mastodon (@astronomy_obs). Archive captures confirm web existence prior to 2024 viral resurgences."
        ),
        created_at=datetime.now(timezone.utc)
    )
    db.add(inv)

    asset = InputAsset(
        id="AST-DEMO-001",
        investigation_id="INV-DEMO-001",
        asset_type="image",
        original_filename="solar_event_leak_2024.png",
        file_size_bytes=len(img_bytes),
        sha256=fp["sha256"],
        perceptual_hash=fp["perceptual_hash"],
        difference_hash=fp["difference_hash"],
        average_hash=fp["average_hash"],
        wavelet_hash=fp["wavelet_hash"],
        image_width=400,
        image_height=300,
        image_format="PNG",
        ocr_text="ORIGIN TRACE FORENSIC EVIDENCE SAMPLE",
        extracted_entities={"handles": ["astronomy_obs"], "dates": ["2021-05-12"]}
    )
    db.add(asset)

    evidence_items = [
        EvidenceRecord(
            id="EVD-001",
            investigation_id="INV-DEMO-001",
            source_platform="mastodon",
            source_url="https://mastodon.social/@astronomy_obs/106233481",
            source_post_id="106233481",
            author_name="Solar Observer Research Group",
            author_handle="@astronomy_obs",
            title_or_caption="Primary release of anomalous solar limb spectrum data",
            content_snippet="Raw preliminary calibration image from high-altitude spectrometer sensor.",
            match_type="exact",
            composite_score=1.0,
            match_signals={"sha256_match": True, "phash_distance": 0},
            evidence_strength="Strong match",
            reported_published_at=t0,
            primary_timestamp=t0,
            timestamp_type="source_publication",
            timestamp_reliability="high",
            ambiguity_notes="Earliest discovered reference. Author post contains matching cryptographic hash."
        ),
        EvidenceRecord(
            id="EVD-002",
            investigation_id="INV-DEMO-001",
            source_platform="wayback",
            source_url="https://web.archive.org/web/20210512184500/https://mastodon.social/@astronomy_obs/106233481",
            source_post_id="wb-20210512184500",
            author_name="Internet Archive Crawler",
            author_handle=None,
            title_or_caption="Wayback Historical Snapshot of mastodon post",
            content_snippet="Archived copy captured 4 hours after initial publication. Verifies historical online presence.",
            match_type="archive_capture",
            composite_score=0.98,
            match_signals={"status_code": 200, "mimetype": "text/html"},
            evidence_strength="Strong match",
            wayback_capture_at=t1,
            primary_timestamp=t1,
            timestamp_type="archive_capture",
            timestamp_reliability="high",
            ambiguity_notes="Archive snapshot confirms content existed in publicly accessible form on May 12, 2021."
        ),
        EvidenceRecord(
            id="EVD-003",
            investigation_id="INV-DEMO-001",
            source_platform="bluesky",
            source_url="https://bsky.app/profile/space_curator.bsky.social/post/3kdf482n11",
            source_post_id="at://space_curator.bsky.social/post/3kdf482n11",
            author_name="Space Curator Feed",
            author_handle="@space_curator.bsky.social",
            title_or_caption="Rescaled repost: Incredible solar phenomena observed",
            content_snippet="Circulating summary of the solar event with cropped borders and compressed quality.",
            match_type="transformed_copy",
            composite_score=0.92,
            match_signals={"phash_distance": 2, "transformation": "Scaled down & recompressed"},
            evidence_strength="Strong match",
            reported_published_at=t2,
            primary_timestamp=t2,
            timestamp_type="source_publication",
            timestamp_reliability="high",
            ambiguity_notes="Repost occurs 15 months after original Mastodon reference."
        ),
        EvidenceRecord(
            id="EVD-004",
            investigation_id="INV-DEMO-001",
            source_platform="reddit",
            source_url="https://reddit.com/r/space/comments/viral_solar_leak",
            source_post_id="t3_solar_viral",
            author_name="ViralNewsAggregator",
            author_handle="u/ViralNewsAggregator",
            title_or_caption="Alleged secret 2024 leaked NASA observatory recording!",
            content_snippet="User post incorrectly attributing the 2021 observation to a 2024 secret leak.",
            match_type="semantic_claim",
            composite_score=0.82,
            match_signals={"phash_distance": 4, "text_similarity": 0.45},
            evidence_strength="Probable match",
            reported_published_at=t3,
            primary_timestamp=t3,
            timestamp_type="source_publication",
            timestamp_reliability="high",
            ambiguity_notes="Viral repost misrepresenting publication date by claiming 2024 origin."
        )
    ]

    for ev in evidence_items:
        db.add(ev)

    connector_logs = [
        ConnectorExecutionLog(
            investigation_id="INV-DEMO-001",
            connector_name="wayback",
            search_parameters={"url": "https://mastodon.social/@astronomy_obs/106233481"},
            status="completed_with_matches",
            results_count=1,
            duration_ms=420,
            coverage_notes="Successfully retrieved historical Wayback Machine captures."
        ),
        ConnectorExecutionLog(
            investigation_id="INV-DEMO-001",
            connector_name="bluesky",
            search_parameters={"query": "solar limb spectrum data"},
            status="completed_with_matches",
            results_count=1,
            duration_ms=310,
            coverage_notes="Discovered public post matches on AT Protocol feed."
        ),
        ConnectorExecutionLog(
            investigation_id="INV-DEMO-001",
            connector_name="mastodon",
            search_parameters={"query": "solar limb spectrum data"},
            status="completed_with_matches",
            results_count=1,
            duration_ms=580,
            coverage_notes="Queried mastodon.social federated instance."
        ),
        ConnectorExecutionLog(
            investigation_id="INV-DEMO-001",
            connector_name="youtube",
            search_parameters={"query": "solar limb spectrum data"},
            status="not_configured",
            results_count=0,
            duration_ms=0,
            coverage_notes="YouTube Data API key not configured. Gracefully skipped."
        )
    ]

    for cl in connector_logs:
        db.add(cl)

    # Set earliest reference
    inv.earliest_discovered_reference = {
        "evidence_id": "EVD-001",
        "platform": "mastodon",
        "url": "https://mastodon.social/@astronomy_obs/106233481",
        "timestamp": t0.isoformat(),
        "timestamp_type": "source_publication",
        "reliability": "high",
        "author": "Solar Observer Research Group (@astronomy_obs)",
        "title": "Primary release of anomalous solar limb spectrum data",
        "evidence_strength": "Strong match",
        "ambiguity_notes": "Earliest discovered reference in queried dataset. Published 2021-05-12."
    }

    # Generate Report
    rep_dict = generate_investigation_report(
        investigation={"id": inv.id, "title": inv.title, "input_type": inv.input_type, "input_content": inv.input_content, "created_at": inv.created_at},
        assets=[{"asset_type": "image", "sha256": fp["sha256"], "perceptual_hash": fp["perceptual_hash"], "difference_hash": fp["difference_hash"], "image_width": 400, "image_height": 300, "image_format": "PNG", "ocr_text": "ORIGIN TRACE FORENSIC EVIDENCE SAMPLE"}],
        evidence=[
            {
                "id": e.id, "source_platform": e.source_platform, "source_url": e.source_url, "author_name": e.author_name,
                "author_handle": e.author_handle, "title_or_caption": e.title_or_caption, "primary_timestamp": e.primary_timestamp,
                "timestamp_type": e.timestamp_type, "timestamp_reliability": e.timestamp_reliability, "evidence_strength": e.evidence_strength,
                "composite_score": e.composite_score, "content_snippet": e.content_snippet
            }
            for e in evidence_items
        ],
        connector_logs=[{"connector_name": c.connector_name, "status": c.status, "results_count": c.results_count, "coverage_notes": c.coverage_notes} for c in connector_logs],
        earliest_reference=inv.earliest_discovered_reference
    )

    report_model = InvestigationReport(
        id=rep_dict["id"],
        investigation_id="INV-DEMO-001",
        executive_summary=rep_dict["executive_summary"],
        earliest_reference_id="EVD-001",
        findings_count=len(evidence_items),
        coverage_summary=rep_dict["coverage_summary"],
        report_html=rep_dict["report_html"],
        report_json=rep_dict["report_json"],
        generated_at=datetime.now(timezone.utc)
    )
    db.add(report_model)

    db.commit()
    db.close()
    print("Seed complete: INV-DEMO-001 populated successfully.")

if __name__ == "__main__":
    seed()
