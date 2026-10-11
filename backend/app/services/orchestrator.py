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
from app.connectors.reverse_image import ReverseImageConnector
from app.services.text_nlp import extract_search_phrases, extract_entities
from app.services.ocr import generate_ocr_search_queries
from app.matching.engine import evaluate_image_match, evaluate_text_match
from app.services.candidate_comparator import retrieve_and_compare_candidate_image
from app.timeline.builder import build_chronological_timeline
from app.graph.builder import build_origin_graph
from app.reports.generator import generate_investigation_report
from app.core.security import validate_public_url
from app.services.c2pa_verifier import c2pa_verifier

STAGES = [
    ("intake", "Validating and registering immutable evidence asset"),
    ("fingerprinting", "Generating cryptographic and multi-algorithm perceptual hashes"),
    ("metadata_extraction", "Extracting EXIF, ICC color profiles, and camera metadata"),
    ("ocr_processing", "Running optical character recognition and entity extraction"),
    ("query_generation", "Formulating multi-angle search queries from extracted clues"),
    ("online_discovery", "Querying active source connectors and reverse-image engines"),
    ("candidate_comparison", "Retrieving candidate media and executing visual comparison"),
    ("timeline_construction", "Reconstructing chronological provenance timeline"),
    ("report_compilation", "Compiling evidence report and forensic diagnostics"),
    ("completed", "Investigation workflow completed successfully")
]

def update_stage(db: Session, inv: Investigation, stage: str, status: str = "running", message: str = ""):
    inv.current_stage = stage
    details = dict(inv.stage_details or {})
    details[stage] = {
        "status": status,
        "message": message,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    inv.stage_details = details
    db.commit()

async def run_investigation_pipeline(investigation_id: str, db: Optional[Session] = None):
    """
    Executes the observable, multi-stage digital forensics investigation pipeline.
    Respects Incognito Mode by routing all updates strictly to in-memory storage (never disk).
    """
    from app.api.investigations import is_incognito_investigation
    from app.database.session import IncognitoSessionLocal, SessionLocal

    is_incognito = is_incognito_investigation(investigation_id)
    created_session = False
    if is_incognito:
        db = IncognitoSessionLocal()
        created_session = True
    elif db is None:
        db = SessionLocal()
        created_session = True

    inv = db.query(Investigation).filter(Investigation.id == investigation_id).first()
    if not inv:
        if created_session:
            db.close()
        return

    inv.status = "processing"
    db.commit()

    try:
        # STAGE 1: INTAKE & ASSET REGISTRATION
        update_stage(db, inv, "intake", "running", "Validating registered evidence assets...")
        assets = db.query(InputAsset).filter(InputAsset.investigation_id == investigation_id).all()
        target_asset = assets[0] if assets else None
        update_stage(db, inv, "intake", "completed", f"Verified {len(assets)} input asset(s).")

        # STAGE 2 & 3: FINGERPRINTING & METADATA CONFIRMATION + C2PA VERIFICATION
        update_stage(db, inv, "fingerprinting", "completed", f"Generated SHA-256 ({target_asset.sha256[:16] if target_asset and target_asset.sha256 else 'N/A'}...) and perceptual hashes.")
        
        c2pa_result = {"has_manifest": False, "status": "unavailable"}
        if target_asset and target_asset.file_path:
            c2pa_result = c2pa_verifier.verify_file(target_asset.file_path)
            target_asset.c2pa_status = c2pa_result.get("status", "unavailable")
            target_asset.c2pa_data = c2pa_result
            db.commit()

        c2pa_diag = f"C2PA: {c2pa_result.get('status_label', 'No credentials')}" if c2pa_result.get("has_manifest") else "No C2PA manifest"
        has_exif = bool(target_asset and (target_asset.camera_make or target_asset.capture_time or target_asset.exif_data))
        update_stage(
            db, inv, "metadata_extraction", "completed",
            f"Metadata extracted: {target_asset.camera_make or 'Camera stripped'}, capture time: {target_asset.capture_time or 'No EXIF timestamp'}. {c2pa_diag}."
            if target_asset else "No file asset attached."
        )

        # STAGE 4: OCR STATUS & CLUE HARVESTING
        update_stage(db, inv, "ocr_processing", "running", "Inspecting OCR extraction results...")
        ocr_status = target_asset.ocr_status if target_asset else "no_asset"
        ocr_text = target_asset.ocr_text if target_asset else ""
        entities = target_asset.extracted_entities if target_asset else {}
        
        ocr_diag = f"OCR status: {ocr_status}. Extracted {len(ocr_text)} characters." if ocr_text else f"OCR status: {ocr_status}."
        update_stage(db, inv, "ocr_processing", "completed", ocr_diag)

        # STAGE 5: QUERY GENERATION
        update_stage(db, inv, "query_generation", "running", "Generating multi-angle search queries...")
        search_queries: List[str] = []

        # From user text input
        if inv.input_content and inv.input_type in ("text", "combined", "url"):
            search_queries.extend(extract_search_phrases(inv.input_content))
            if inv.input_content.strip() not in search_queries:
                search_queries.append(inv.input_content.strip())

        # From OCR text (phrase in quotes, phrase + handle, phrase + date)
        if ocr_text:
            ocr_queries = generate_ocr_search_queries(ocr_text, entities)
            search_queries.extend(ocr_queries)

        cleaned_queries = list(dict.fromkeys([q for q in search_queries if len(q) >= 3]))
        update_stage(db, inv, "query_generation", "completed", f"Formulated {len(cleaned_queries)} focused discovery queries.")

        # STAGE 6: ONLINE DISCOVERY
        update_stage(db, inv, "online_discovery", "running", "Querying configured source connectors...")
        selected_platforms = inv.selected_platforms or []
        discovered_evidence: List[Dict[str, Any]] = []

        # Record C2PA Provenance Manifest finding if detected
        if c2pa_result.get("has_manifest"):
            signed_at_dt = None
            if c2pa_result.get("signed_at"):
                try:
                    signed_at_dt = datetime.fromisoformat(c2pa_result["signed_at"].replace("Z", "+00:00")).astimezone(timezone.utc)
                except Exception:
                    pass

            discovered_evidence.append({
                "source_platform": "c2pa",
                "source_url": f"c2pa://{target_asset.sha256[:16]}" if target_asset and target_asset.sha256 else "c2pa://manifest",
                "source_post_id": c2pa_result.get("claim_generator") or "c2pa_manifest",
                "author_name": c2pa_result.get("author") or c2pa_result.get("issuer"),
                "author_handle": c2pa_result.get("issuer"),
                "title_or_caption": f"C2PA Content Credentials: {c2pa_result.get('status_label', 'Manifest Detected')}",
                "content_snippet": (
                    f"Generated by {c2pa_result.get('claim_generator')}. "
                    f"Signer: {c2pa_result.get('issuer') or 'Self-Signed'}. "
                    f"Status: {c2pa_result.get('status_label')}. "
                    f"Actions: {len(c2pa_result.get('actions', []))} logged."
                ),
                "media_urls": [],
                "match_type": "provenance_manifest",
                "composite_score": 1.0 if c2pa_result.get("status") == "verified" else 0.85,
                "match_signals": {
                    "claim_generator": c2pa_result.get("claim_generator"),
                    "issuer": c2pa_result.get("issuer"),
                    "status": c2pa_result.get("status"),
                    "is_ai_generated": c2pa_result.get("is_ai_generated"),
                    "actions_count": len(c2pa_result.get("actions", [])),
                    "source_domain": "c2pa.org",
                    "search_provider": "C2PA Provenance Verification",
                    "discovery_method": "embedded_manifest"
                },
                "evidence_strength": "Cryptographic proof" if c2pa_result.get("status") == "verified" else "Cryptographic assertion",
                "reported_published_at": signed_at_dt,
                "primary_timestamp": signed_at_dt,
                "timestamp_type": "provenance_verification",
                "timestamp_reliability": "high" if c2pa_result.get("status") == "verified" else "medium",
                "ambiguity_notes": (
                    "Cryptographic signature guarantees manifest integrity since signing, "
                    "but does not independently certify the real-world factual accuracy of depicted content."
                ),
                "access_status": "accessible"
            })

        all_conns = get_all_connectors()
        for conn in all_conns:
            # Respect user platform selection if provided
            if selected_platforms and conn.name not in selected_platforms:
                continue

            start_ts = datetime.now(timezone.utc)
            start_mono = time.time()
            log_entry = ConnectorExecutionLog(
                investigation_id=investigation_id,
                connector_name=conn.name,
                search_parameters={"queries": cleaned_queries[:3]},
                started_at=start_ts
            )

            # A. REVERSE IMAGE SEARCH CONNECTOR
            if conn.name == "reverse_image":
                if not conn.is_configured():
                    log_entry.status = "not_configured"
                    log_entry.coverage_notes = (
                        "Reverse image search engine (SerpApi Google Lens) requires SERPAPI_API_KEY in .env. "
                        "Connector skipped gracefully."
                    )
                else:
                    search_opts = {}
                    if target_asset and target_asset.file_path:
                        search_opts["file_path"] = target_asset.file_path
                    elif inv.input_type == "url" and inv.input_content:
                        search_opts["public_image_url"] = inv.input_content

                    if search_opts:
                        fp_dict = {
                            "sha256": target_asset.sha256 if target_asset else None,
                            "perceptual_hash": target_asset.perceptual_hash if target_asset else None
                        }
                        res = await conn.search_image(fp_dict, search_opts)
                        log_entry.status = res.status
                        log_entry.results_count = len(res.records)
                        log_entry.coverage_notes = res.coverage_notes
                        log_entry.error_message = res.error_message
                        for r in res.records:
                            discovered_evidence.append(r)
                    else:
                        log_entry.status = "completed_no_matches"
                        log_entry.coverage_notes = "No local image file or public image URL available for reverse-image search."

            # B. WAYBACK MACHINE CDX CONNECTOR (Queries candidate source URLs discovered across Google Lens, Openverse, OCR)
            elif conn.name == "wayback":
                candidate_urls = []
                if inv.input_type == "url" and inv.input_content:
                    candidate_urls.append(inv.input_content)
                if entities and "urls" in entities:
                    candidate_urls.extend(entities.get("urls", []))

                # Include source landing URLs discovered by Google Lens, Openverse, or other connectors
                for ev_item in discovered_evidence:
                    s_u = ev_item.get("source_url")
                    if s_u and s_u.startswith("http") and "web.archive.org" not in s_u and "c2pa://" not in s_u:
                        candidate_urls.append(s_u)

                unique_cand_urls = list(dict.fromkeys(candidate_urls))

                wb_conn: WaybackConnector = conn
                if unique_cand_urls:
                    wb_records_all = []
                    for c_url in unique_cand_urls[:3]:
                        wb_res = await wb_conn.query_url_captures(c_url, limit=15)
                        if wb_res.records:
                            wb_records_all.extend(wb_res.records)

                    log_entry.status = "completed_with_matches" if wb_records_all else "completed_no_matches"
                    log_entry.results_count = len(wb_records_all)
                    log_entry.coverage_notes = f"Queried Wayback for {len(unique_cand_urls[:3])} candidate URL(s). Discovered {len(wb_records_all)} snapshots."
                    log_entry.error_message = None
                    for rec in wb_records_all:
                        discovered_evidence.append(rec)
                else:
                    log_entry.status = "completed_no_matches"
                    log_entry.coverage_notes = "No candidate source URLs discovered across Google Lens, Openverse, or OCR to query Wayback Machine snapshots."

            # C. TEXT-BASED CONNECTORS (Openverse, Bluesky, Mastodon, YouTube)
            else:
                if not conn.is_configured():
                    log_entry.status = "not_configured"
                    log_entry.coverage_notes = f"{conn.display_name} credentials not configured. Skipped."
                elif not cleaned_queries:
                    log_entry.status = "completed_no_matches"
                    log_entry.coverage_notes = (
                        "No text queries generated. Target image contains no readable text, "
                        "and no caption claim was provided."
                    )
                else:
                    # Run search with primary queries
                    records_for_conn = []
                    for q in cleaned_queries[:2]:
                        res = await conn.search_text(q)
                        if res.status == "completed_with_matches":
                            records_for_conn.extend(res.records)
                    
                    log_entry.status = "completed_with_matches" if records_for_conn else "completed_no_matches"
                    log_entry.results_count = len(records_for_conn)
                    log_entry.queries_executed = cleaned_queries[:2]
                    log_entry.coverage_notes = f"Executed {len(cleaned_queries[:2])} queries against {conn.display_name}."

                    for rec in records_for_conn:
                        discovered_evidence.append(rec)

            log_entry.completed_at = datetime.now(timezone.utc)
            log_entry.duration_ms = int((time.time() - start_mono) * 1000)
            db.add(log_entry)
            db.commit()

        # D. Direct URL web page metadata extraction if URL input
        if inv.input_type == "url" and inv.input_content:
            web_conn = get_connector("web_search")
            if web_conn:
                meta = await web_conn.fetch_public_page_metadata(inv.input_content)
                if meta and not meta.get("error"):
                    discovered_evidence.append(meta)

        update_stage(db, inv, "online_discovery", "completed", f"Collected {len(discovered_evidence)} candidate evidence items.")

        # STAGE 7: CANDIDATE IMAGE RETRIEVAL & COMPARISON
        update_stage(db, inv, "candidate_comparison", "running", "Retrieving candidate media and comparing fingerprints...")
        target_fp = {
            "sha256": target_asset.sha256 if target_asset else None,
            "perceptual_hash": target_asset.perceptual_hash if target_asset else None,
            "difference_hash": target_asset.difference_hash if target_asset else None,
            "image_width": target_asset.image_width if target_asset else None,
            "image_height": target_asset.image_height if target_asset else None,
        }

        # Deduplicate evidence by source_url
        unique_evidence_dict: Dict[str, Dict[str, Any]] = {}
        for ev in discovered_evidence:
            url_key = ev.get("source_url")
            if url_key and url_key not in unique_evidence_dict:
                unique_evidence_dict[url_key] = ev

        comparisons_performed = 0
        saved_evidence_models = []

        for ev_data in unique_evidence_dict.values():
            media_urls = ev_data.get("media_urls", [])
            cand_img_url = ev_data.get("candidate_image_url") or (media_urls[0] if media_urls else None)

            # Perform candidate image retrieval & perceptual comparison if candidate has image URL
            if cand_img_url and target_fp.get("sha256"):
                comp_result = await retrieve_and_compare_candidate_image(target_fp, cand_img_url, investigation_id)
                if comp_result:
                    r_status = comp_result.get("retrieval_status")
                    if r_status == "success":
                        comparisons_performed += 1
                        ev_data["candidate_thumbnail_path"] = comp_result.get("candidate_thumbnail_path")
                        ev_data["candidate_sha256"] = comp_result.get("candidate_sha256")
                        ev_data["candidate_phash"] = comp_result.get("candidate_phash")
                        ev_data["candidate_dhash"] = comp_result.get("candidate_dhash")
                        ev_data["candidate_width"] = comp_result.get("candidate_width")
                        ev_data["candidate_height"] = comp_result.get("candidate_height")
                        ev_data["visual_similarity"] = comp_result.get("visual_similarity")
                        ev_data["match_type"] = comp_result.get("match_type")
                        ev_data["composite_score"] = comp_result.get("composite_score")
                        ev_data["evidence_strength"] = comp_result.get("evidence_strength")
                        ev_data["explanation"] = comp_result.get("explanation")
                        if "match_signals" in ev_data:
                            ev_data["match_signals"].update(comp_result.get("match_signals", {}))
                    elif r_status == "forbidden_403":
                        ev_data["access_status"] = "restricted"
                        ev_data["ambiguity_notes"] = "Candidate image server returned HTTP 403 Forbidden (hotlink protection or Cloudflare edge barrier)."
                    elif r_status == "unauthorized_401":
                        ev_data["access_status"] = "restricted"
                        ev_data["ambiguity_notes"] = "Candidate resource requires login credentials or authentication."
                    elif r_status == "not_found_404":
                        ev_data["access_status"] = "tombstoned"
                        ev_data["ambiguity_notes"] = "Candidate resource returned HTTP 404 Not Found (asset moved or removed)."
                    elif r_status == "blocked_ssrf":
                        ev_data["access_status"] = "restricted"
                        ev_data["ambiguity_notes"] = f"Candidate URL failed security policy: {comp_result.get('error')}"

            # Compute text relevance if input text claim exists
            if inv.input_content:
                text_match, t_score, t_str, t_signals = evaluate_text_match(
                    inv.input_content,
                    ev_data.get("content_snippet", "")
                )
                ev_data["text_relevance"] = t_score
                if not ev_data.get("visual_similarity"):
                    ev_data["match_type"] = text_match
                    ev_data["composite_score"] = t_score
                    ev_data["evidence_strength"] = t_str
                if "match_signals" in ev_data:
                    ev_data["match_signals"].update(t_signals)

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
                candidate_image_url=cand_img_url,
                candidate_thumbnail_path=ev_data.get("candidate_thumbnail_path"),
                candidate_sha256=ev_data.get("candidate_sha256"),
                candidate_phash=ev_data.get("candidate_phash"),
                candidate_dhash=ev_data.get("candidate_dhash"),
                candidate_width=ev_data.get("candidate_width"),
                candidate_height=ev_data.get("candidate_height"),
                visual_similarity=ev_data.get("visual_similarity"),
                text_relevance=ev_data.get("text_relevance"),
                source_reliability_score=0.8 if ev_data.get("source_platform") in ("wayback", "mastodon", "bluesky") else 0.5,
                metadata_consistency_score=0.8,
                match_type=ev_data.get("match_type", "semantic_claim"),
                composite_score=ev_data.get("composite_score", 0.6),
                match_signals=ev_data.get("match_signals", {}),
                evidence_strength=ev_data.get("evidence_strength", "Inconclusive"),
                explanation=ev_data.get("explanation"),
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
        update_stage(db, inv, "candidate_comparison", "completed", f"Compared {comparisons_performed} candidate image(s) side-by-side.")

        # STAGE 8: TIMELINE RECONSTRUCTION
        update_stage(db, inv, "timeline_construction", "running", "Organizing evidence into chronological provenance timeline...")
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

        logs = db.query(ConnectorExecutionLog).filter(ConnectorExecutionLog.investigation_id == investigation_id).all()
        timeline_data = build_chronological_timeline(
            ev_dicts_for_timeline,
            investigation=inv,
            assets=[target_asset] if target_asset else [],
            logs=logs
        )
        earliest_ref = timeline_data.get("earliest_discovered_reference")
        inv.earliest_discovered_reference = earliest_ref
        update_stage(db, inv, "timeline_construction", "completed", f"Timeline organized with {len(ev_dicts_for_timeline)} events.")

        # STAGE 9: REPORT COMPILATION & DIAGNOSTICS
        update_stage(db, inv, "report_compilation", "running", "Compiling structured forensic report...")
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
                "camera_make": a.camera_make,
                "camera_model": a.camera_model,
                "software": a.software,
                "capture_time": a.capture_time,
                "ocr_status": a.ocr_status,
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
        update_stage(db, inv, "report_compilation", "completed", "Report compiled and persisted.")

        # FINAL COMPLETION
        inv.status = "completed"
        update_stage(db, inv, "completed", "completed", "All investigation stages finished.")
        db.commit()

    except Exception as e:
        inv.status = "partial_failure"
        inv.summary = f"Pipeline terminated with exception: {str(e)}"
        update_stage(db, inv, inv.current_stage or "unknown", "failed", str(e))
        db.commit()
    finally:
        if created_session and db:
            try:
                db.close()
            except Exception:
                pass

def compile_investigation_diagnostics(
    inv_id: str,
    status: str,
    current_stage: str,
    stages: Dict[str, Any],
    logs: List[Any],
    evidence: List[Any],
    target_asset: Optional[Any] = None
) -> Dict[str, Any]:
    """Compiles comprehensive diagnostic metrics and explanations for an investigation."""
    connectors_attempted = [l.connector_name for l in logs]
    successful_connectors = [l.connector_name for l in logs if l.status in ("completed_with_matches", "success")]
    unconfigured_connectors = [l.connector_name for l in logs if l.status == "not_configured"]
    failed_connectors = [l.connector_name for l in logs if l.status in ("error", "access_denied", "rate_limited", "timeout")]
    all_queries = [q for l in logs for q in (getattr(l, "queries_executed", None) or [])]

    # Calculate credits consumed and cache hits
    credits_consumed = sum(1 for l in logs if l.connector_name == "reverse_image" and "1 search credit consumed" in (l.coverage_notes or ""))
    cache_hits = sum(1 for l in logs if "Cached Google Lens results reused" in (l.coverage_notes or ""))

    reasons_for_limited_results = []
    if not target_asset or not getattr(target_asset, "ocr_text", None):
        reasons_for_limited_results.append(
            "Uploaded asset contains no readable text, preventing text-query generation across social networks."
        )
    if "reverse_image" in unconfigured_connectors:
        reasons_for_limited_results.append(
            "Reverse image search engine (SerpApi) is unconfigured. Web-scale visual discovery requires SERPAPI_API_KEY in .env."
        )
    if any(l.status == "rate_limited" for l in logs):
        reasons_for_limited_results.append(
            "Provider rate limit or free quota ceiling reached during search execution."
        )
    if not successful_connectors and not evidence:
        reasons_for_limited_results.append(
            "No matching public references discovered across actively queried open platforms."
        )

    from app.connectors.reverse_image import ReverseImageConnector
    rev_conn = ReverseImageConnector()

    return {
        "investigation_id": inv_id,
        "status": status,
        "current_stage": current_stage,
        "stages": stages,
        "connectors_attempted": connectors_attempted,
        "successful_connectors": successful_connectors,
        "unconfigured_connectors": unconfigured_connectors,
        "failed_connectors": failed_connectors,
        "queries_executed": list(dict.fromkeys(all_queries)),
        "total_candidates_found": len(evidence),
        "visual_comparisons_completed": sum(1 for e in evidence if getattr(e, "visual_similarity", None) is not None),
        "credits_consumed": credits_consumed,
        "cache_hits": cache_hits,
        "reverse_image_configured": rev_conn.is_configured(),
        "masked_serpapi_key": rev_conn.get_masked_api_key(),
        "reasons_for_limited_results": reasons_for_limited_results
    }
