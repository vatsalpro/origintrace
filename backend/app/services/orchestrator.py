import asyncio
import time
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app.models.entities import (
    Investigation,
    InputAsset,
    EvidenceRecord,
    ConnectorExecutionLog,
    InvestigationReport,
    HistoricalCapture
)
from app.connectors import get_all_connectors, get_connector
from app.connectors.wayback import WaybackConnector
from app.services.text_nlp import extract_search_phrases, extract_entities
from app.matching.engine import evaluate_image_match, evaluate_text_match
from app.timeline.builder import build_chronological_timeline
from app.graph.builder import build_origin_graph
from app.reports.generator import generate_investigation_report
from app.core.security import validate_public_url

async def run_investigation_pipeline(investigation_id: str, db: Session):
    """
    Executes the multi-source digital forensics investigation pipeline asynchronously.
    """
    inv = db.query(Investigation).filter(Investigation.id == investigation_id).first()
    if not inv:
        return

    inv.status = "processing"
    db.commit()

    try:
        # 1. Gather input assets & search terms
        assets = db.query(InputAsset).filter(InputAsset.investigation_id == investigation_id).all()
        target_asset = assets[0] if assets else None

        search_queries = []
        if inv.input_content and inv.input_type in ("text", "combined", "url"):
            search_queries.extend(extract_search_phrases(inv.input_content))
            if inv.input_content.strip() not in search_queries:
                search_queries.append(inv.input_content.strip())

        if target_asset and target_asset.ocr_text:
            ocr_phrases = extract_search_phrases(target_asset.ocr_text)
            search_queries.extend(ocr_phrases)

        # Remove empty or duplicate queries
        cleaned_queries = list(dict.fromkeys([q for q in search_queries if len(q) >= 3]))
        if not cleaned_queries and inv.input_content:
            cleaned_queries = [inv.input_content]

        discovered_evidence: List[Dict[str, Any]] = []

        # 2. Check and query social and search connectors
        connectors = get_all_connectors()
        for conn in connectors:
            start_ts = datetime.now(timezone.utc)
            start_mono = time.time()
            log_entry = ConnectorExecutionLog(
                investigation_id=investigation_id,
                connector_name=conn.name,
                search_parameters={"queries": cleaned_queries[:3]},
                started_at=start_ts
            )

            # Special case for Wayback: queries URLs found in input or candidate posts
            if conn.name == "wayback":
                candidate_urls = []
                if inv.input_type == "url" and inv.input_content:
                    candidate_urls.append(inv.input_content)
                elif target_asset and target_asset.extracted_entities:
                    candidate_urls.extend(target_asset.extracted_entities.get("urls", []))

                wb_conn: WaybackConnector = conn
                if candidate_urls:
                    for c_url in candidate_urls[:2]:
                        wb_res = await wb_conn.query_url_captures(c_url)
                        log_entry.status = wb_res.status
                        log_entry.results_count = len(wb_res.records)
                        log_entry.coverage_notes = wb_res.coverage_notes
                        log_entry.error_message = wb_res.error_message
                        for rec in wb_res.records:
                            discovered_evidence.append(rec)
                else:
                    log_entry.status = "completed_no_matches"
                    log_entry.coverage_notes = "No input URL provided to query historical Wayback snapshots."

            else:
                # Text/query based social connectors (Bluesky, Mastodon, YouTube, Reddit)
                if not conn.is_configured():
                    log_entry.status = "not_configured"
                    log_entry.coverage_notes = f"{conn.display_name} credentials not configured. Connector skipped gracefully."
                elif not cleaned_queries:
                    log_entry.status = "completed_no_matches"
                    log_entry.coverage_notes = "No distinctive text search terms available for query."
                else:
                    # Run search with primary query
                    primary_query = cleaned_queries[0]
                    res = await conn.search_text(primary_query)
                    log_entry.status = res.status
                    log_entry.results_count = len(res.records)
                    log_entry.coverage_notes = res.coverage_notes
                    log_entry.error_message = res.error_message

                    for rec in res.records:
                        # Perform cross-matching against input text if available
                        if inv.input_content:
                            match_type, score, strength, signals = evaluate_text_match(
                                inv.input_content,
                                rec.get("content_snippet", "")
                            )
                            rec["match_type"] = match_type
                            rec["composite_score"] = score
                            rec["evidence_strength"] = strength
                            rec["match_signals"].update(signals)

                        discovered_evidence.append(rec)

            log_entry.completed_at = datetime.now(timezone.utc)
            log_entry.duration_ms = int((time.time() - start_mono) * 1000)
            db.add(log_entry)
            db.commit()

        # 3. If input is direct URL, check web_search metadata extraction
        if inv.input_type == "url" and inv.input_content:
            web_conn = get_connector("web_search")
            if web_conn:
                meta = await web_conn.fetch_public_page_metadata(inv.input_content)
                if meta and not meta.get("error"):
                    discovered_evidence.append(meta)

        # 4. Deduplicate evidence by source_url
        unique_evidence_dict = {}
        for ev in discovered_evidence:
            url_key = ev.get("source_url")
            if url_key and url_key not in unique_evidence_dict:
                unique_evidence_dict[url_key] = ev

        saved_evidence_models = []
        for ev_data in unique_evidence_dict.values():
            ev_model = EvidenceRecord(
                investigation_id=investigation_id,
                source_platform=ev_data.get("source_platform", "web"),
                source_url=ev_data.get("source_url", ""),
                source_post_id=ev_data.get("source_post_id"),
                author_name=ev_data.get("author_name"),
                author_handle=ev_data.get("author_handle"),
                title_or_caption=ev_data.get("title_or_caption"),
                content_snippet=ev_data.get("content_snippet"),
                media_urls=ev_data.get("media_urls", []),
                match_type=ev_data.get("match_type", "semantic_claim"),
                composite_score=ev_data.get("composite_score", 0.7),
                match_signals=ev_data.get("match_signals", {}),
                evidence_strength=ev_data.get("evidence_strength", "Probable match"),
                reported_published_at=ev_data.get("reported_published_at"),
                reported_created_at=ev_data.get("reported_created_at"),
                wayback_capture_at=ev_data.get("wayback_capture_at"),
                primary_timestamp=ev_data.get("primary_timestamp"),
                timestamp_type=ev_data.get("timestamp_type", "source_publication"),
                timestamp_reliability=ev_data.get("timestamp_reliability", "medium"),
                ambiguity_notes=ev_data.get("ambiguity_notes"),
                access_status=ev_data.get("access_status", "accessible")
            )
            db.add(ev_model)
            saved_evidence_models.append(ev_model)

        db.commit()

        # 5. Build timeline and find earliest reference
        ev_dicts_for_timeline = [
            {
                "id": e.id,
                "source_platform": e.source_platform,
                "source_url": e.source_url,
                "author_name": e.author_name,
                "author_handle": e.author_handle,
                "title_or_caption": e.title_or_caption,
                "primary_timestamp": e.primary_timestamp,
                "reported_published_at": e.reported_published_at,
                "wayback_capture_at": e.wayback_capture_at,
                "timestamp_type": e.timestamp_type,
                "timestamp_reliability": e.timestamp_reliability,
                "evidence_strength": e.evidence_strength,
                "composite_score": e.composite_score,
                "media_urls": e.media_urls,
                "ambiguity_notes": e.ambiguity_notes
            }
            for e in saved_evidence_models
        ]

        timeline_data = build_chronological_timeline(ev_dicts_for_timeline)
        earliest_ref = timeline_data.get("earliest_discovered_reference")
        inv.earliest_discovered_reference = earliest_ref

        # 6. Generate Report
        logs = db.query(ConnectorExecutionLog).filter(ConnectorExecutionLog.investigation_id == investigation_id).all()
        log_dicts = [
            {
                "connector_name": l.connector_name,
                "status": l.status,
                "results_count": l.results_count,
                "coverage_notes": l.coverage_notes
            }
            for l in logs
        ]
        asset_dicts = [
            {
                "asset_type": a.asset_type,
                "sha256": a.sha256,
                "perceptual_hash": a.perceptual_hash,
                "difference_hash": a.difference_hash,
                "image_width": a.image_width,
                "image_height": a.image_height,
                "image_format": a.image_format,
                "ocr_text": a.ocr_text
            }
            for a in assets
        ]

        report_dict = generate_investigation_report(
            investigation={
                "id": inv.id,
                "title": inv.title,
                "input_type": inv.input_type,
                "input_content": inv.input_content,
                "created_at": inv.created_at
            },
            assets=asset_dicts,
            evidence=ev_dicts_for_timeline,
            connector_logs=log_dicts,
            earliest_reference=earliest_ref
        )

        inv_report = InvestigationReport(
            id=report_dict["id"],
            investigation_id=investigation_id,
            executive_summary=report_dict["executive_summary"],
            earliest_reference_id=earliest_ref.get("evidence_id") if earliest_ref else None,
            findings_count=report_dict["findings_count"],
            coverage_summary=report_dict["coverage_summary"],
            report_html=report_dict["report_html"],
            report_json=report_dict["report_json"],
            generated_at=report_dict["generated_at"]
        )
        db.add(inv_report)

        inv.summary = report_dict["executive_summary"]
        inv.status = "completed"
        db.commit()

    except Exception as e:
        inv.status = "partial_failure"
        inv.summary = f"Pipeline terminated with exception: {str(e)}"
        db.commit()
