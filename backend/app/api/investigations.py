import json
import os
import uuid
from pathlib import Path
from typing import List, Optional
from contextlib import contextmanager
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from sqlalchemy.orm import Session

from app.database.session import get_db, IncognitoSessionLocal, reset_incognito_db
from app.models.entities import (
    Investigation,
    InputAsset,
    EvidenceRecord,
    ConnectorExecutionLog,
    InvestigationReport
)
from app.schemas.schemas import (
    InvestigationResponse,
    EvidenceRecordResponse,
    ConnectorLogResponse,
    TimelineEvent,
    TimelineResponse,
    OriginGraphResponse,
    ReportResponse
)
from app.core.config import settings
from app.core.security import validate_public_url, validate_image_file_bytes
from app.core.url_validator import check_url_access_status, validate_and_normalize_source_url
from app.services.fingerprint import extract_image_fingerprints
from app.services.ocr import extract_ocr_text
from app.services.text_nlp import extract_entities
from app.timeline.builder import build_chronological_timeline
from app.graph.builder import build_origin_graph
from app.services.orchestrator import run_investigation_pipeline, compile_investigation_diagnostics

router = APIRouter(prefix="/api/investigations", tags=["investigations"])

# Set of active in-memory incognito investigation IDs (never written to persistent disk database)
INCOGNITO_INVESTIGATION_IDS: set[str] = set()

def is_incognito_investigation(inv_id: Optional[str]) -> bool:
    """Checks if an investigation ID belongs to an active RAM-only incognito session."""
    if not inv_id:
        return False
    return inv_id in INCOGNITO_INVESTIGATION_IDS

def clear_incognito_temp_files():
    """Removes all temporary file artifacts created for in-memory incognito investigations."""
    incognito_dir = settings.INCOGNITO_UPLOADS_PATH
    if incognito_dir.exists():
        for f in incognito_dir.glob("*"):
            try:
                if f.is_file():
                    f.unlink()
            except Exception:
                pass

@contextmanager
def get_investigation_db(inv_id: str, default_db: Session):
    """
    Context manager yielding the appropriate database session:
    - If inv_id is an Incognito investigation, yields an in-memory session (IncognitoSessionLocal).
    - Otherwise, yields the standard persistent database session (default_db).
    """
    if is_incognito_investigation(inv_id):
        mem_db = IncognitoSessionLocal()
        try:
            yield mem_db
        finally:
            mem_db.close()
    else:
        yield default_db

@router.get("/verify-url")
async def verify_url_reachability(url: str):
    """
    Safely probes the HTTP reachability of a source URL for forensic diagnostics.
    Accurately reports HTTP 403 (Cloudflare/WAF), 401 (Authentication), 404 (Removed), or 200 (Accessible)
    without evading restrictions or executing bypasses.
    """
    return await check_url_access_status(url)

@router.get("/incognito/status")
def get_incognito_status():
    """Returns the current active incognito session status and count."""
    return {
        "is_active": len(INCOGNITO_INVESTIGATION_IDS) > 0,
        "active_cases_count": len(INCOGNITO_INVESTIGATION_IDS),
        "active_case_ids": list(INCOGNITO_INVESTIGATION_IDS)
    }

@router.get("/incognito/active", response_model=List[InvestigationResponse])
def list_active_incognito_investigations():
    """Returns active in-memory incognito investigations for the current session."""
    with IncognitoSessionLocal() as mem_db:
        invs = mem_db.query(Investigation).order_by(Investigation.created_at.desc()).all()
        for inv in invs:
            for r in inv.evidence_records:
                norm = validate_and_normalize_source_url(r.source_url, r.title_or_caption, r.source_platform)
                r.source_domain = norm["domain"]
                r.fallback_search_url = norm["fallback_search_url"]
                r.url_type = norm["url_type"]
                r.is_direct_image = norm["is_direct_image"]
                r.original_raw_url = r.source_url
        return [InvestigationResponse.model_validate(i) for i in invs]

@router.post("/incognito/clear")
def clear_all_incognito_sessions():
    """
    Purges all active in-memory incognito investigation data.
    Removes temporary file uploads from disk and resets the in-memory SQLite schema.
    Guarantees no remnant evidence persists in memory or storage.
    """
    clear_incognito_temp_files()
    INCOGNITO_INVESTIGATION_IDS.clear()
    reset_incognito_db()
    return {
        "status": "cleared",
        "message": "All in-memory incognito investigations and temporary files have been permanently cleared."
    }

@router.get("", response_model=List[InvestigationResponse])
def list_investigations(
    skip: int = 0,
    limit: int = 50,
    incognito_only: bool = False,
    include_incognito: bool = False,
    db: Session = Depends(get_db)
):
    """
    List investigations ordered by creation time descending.
    Persistent database history NEVER includes incognito investigations.
    If incognito_only=True is explicitly requested, lists only active in-memory incognito sessions.
    """
    if incognito_only:
        with IncognitoSessionLocal() as mem_db:
            invs = mem_db.query(Investigation).order_by(Investigation.created_at.desc()).offset(skip).limit(limit).all()
            for inv in invs:
                for r in inv.evidence_records:
                    norm = validate_and_normalize_source_url(r.source_url, r.title_or_caption, r.source_platform)
                    r.source_domain = norm["domain"]
                    r.fallback_search_url = norm["fallback_search_url"]
                    r.url_type = norm["url_type"]
                    r.is_direct_image = norm["is_direct_image"]
                    r.original_raw_url = r.source_url
            return [InvestigationResponse.model_validate(i) for i in invs]

    # Default: Persistent database records ONLY.
    query = db.query(Investigation)
    if not include_incognito:
        query = query.filter((Investigation.is_incognito == False) | (Investigation.is_incognito == None))
    invs = query.order_by(Investigation.created_at.desc()).offset(skip).limit(limit).all()
    for inv in invs:
        for r in inv.evidence_records:
            norm = validate_and_normalize_source_url(r.source_url, r.title_or_caption, r.source_platform)
            r.source_domain = norm["domain"]
            r.fallback_search_url = norm["fallback_search_url"]
            r.url_type = norm["url_type"]
            r.is_direct_image = norm["is_direct_image"]
            r.original_raw_url = r.source_url
    return [InvestigationResponse.model_validate(i) for i in invs]

@router.post("", response_model=InvestigationResponse)
async def create_investigation(
    background_tasks: BackgroundTasks,
    title: Optional[str] = Form(None),
    input_type: str = Form("text"),  # "url", "image", "video", "screenshot", "text", "combined"
    input_content: Optional[str] = Form(None),
    selected_platforms: Optional[str] = Form(None),
    is_incognito: bool = Form(False),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    """
    Submits a new investigation inquiry with URL, image/screenshot upload, or text claim.
    When is_incognito=True, persists strictly in RAM (in-memory SQLite), NEVER writing to the disk database.
    """
    inv_prefix = "INV-INC" if is_incognito else "INV"
    inv_id = f"{inv_prefix}-{uuid.uuid4().hex[:8].upper()}"
    final_title = title or f"Investigation {inv_id}"
    
    # URL Safety Verification if input is URL
    if input_type == "url" and input_content:
        is_safe, msg = validate_public_url(input_content)
        if not is_safe:
            raise HTTPException(status_code=400, detail=f"Invalid or unsafe URL: {msg}")

    # Parse selected platforms if provided
    platforms_list = []
    if selected_platforms:
        try:
            platforms_list = json.loads(selected_platforms)
        except Exception:
            platforms_list = [p.strip() for p in selected_platforms.split(",") if p.strip()]

    new_inv = Investigation(
        id=inv_id,
        title=final_title,
        input_type=input_type,
        input_content=input_content,
        selected_platforms=platforms_list,
        is_incognito=is_incognito,
        current_stage="intake",
        stage_details={
            "intake": {
                "status": "running",
                "message": "Validating uploaded evidence...",
            }
        },
        status="created"
    )

    if is_incognito:
        INCOGNITO_INVESTIGATION_IDS.add(inv_id)
        active_db = IncognitoSessionLocal()
    else:
        active_db = db

    try:
        active_db.add(new_inv)
        active_db.commit()
        active_db.refresh(new_inv)

        # Process file upload if provided
        if file and file.filename:
            file_bytes = await file.read()
            if len(file_bytes) > settings.MAX_UPLOAD_SIZE_BYTES:
                raise HTTPException(status_code=400, detail="Uploaded file exceeds maximum allowed size.")

            # Save to safe disk path (use incognito temp folder for incognito sessions)
            safe_filename = f"{inv_id}_{uuid.uuid4().hex[:8]}_{Path(file.filename).name}"
            upload_target_dir = settings.INCOGNITO_UPLOADS_PATH if is_incognito else settings.UPLOADS_PATH
            save_path = upload_target_dir / safe_filename
            with open(save_path, "wb") as f:
                f.write(file_bytes)

            asset_type = "image" if input_type in ("image", "screenshot") else ("video" if input_type == "video" else "file")
            
            # Image Fingerprinting & OCR
            is_valid_img, img_format, img_err = validate_image_file_bytes(file_bytes)
            fp_data = {}
            ocr_result = {"status": "skipped", "text": "", "confidence": None, "diagnostic_message": "Not an image file."}
            extracted_entities = {}

            if is_valid_img:
                fp_data = extract_image_fingerprints(file_bytes, asset_id=inv_id)
                ocr_result = extract_ocr_text(file_bytes)
                if ocr_result["text"]:
                    extracted_entities = extract_entities(ocr_result["text"])

            asset = InputAsset(
                investigation_id=inv_id,
                asset_type=asset_type,
                file_path=str(save_path),
                thumbnail_path=fp_data.get("thumbnail_path"),
                original_filename=file.filename,
                mime_type=file.content_type or f"image/{img_format.lower()}",
                file_size_bytes=len(file_bytes),
                sha256=fp_data.get("sha256"),
                perceptual_hash=fp_data.get("perceptual_hash"),
                difference_hash=fp_data.get("difference_hash"),
                average_hash=fp_data.get("average_hash"),
                wavelet_hash=fp_data.get("wavelet_hash"),
                image_width=fp_data.get("image_width"),
                image_height=fp_data.get("image_height"),
                image_format=fp_data.get("image_format"),
                camera_make=fp_data.get("camera_make"),
                camera_model=fp_data.get("camera_model"),
                software=fp_data.get("software"),
                capture_time=fp_data.get("capture_time"),
                gps_info=fp_data.get("gps_info", {}),
                icc_profile=fp_data.get("icc_profile"),
                exif_data=fp_data.get("exif_data", {}),
                ocr_status=ocr_result.get("status"),
                ocr_confidence=ocr_result.get("confidence"),
                ocr_text=ocr_result.get("text"),
                extracted_entities=extracted_entities
            )
            active_db.add(asset)
            active_db.commit()

        # Launch background investigation orchestration pipeline
        background_tasks.add_task(run_investigation_pipeline, inv_id)

        active_db.refresh(new_inv)
        return InvestigationResponse.model_validate(new_inv)
    finally:
        if is_incognito:
            active_db.close()

@router.get("/{inv_id}", response_model=InvestigationResponse)
def get_investigation(inv_id: str, db: Session = Depends(get_db)):
    with get_investigation_db(inv_id, db) as active_db:
        inv = active_db.query(Investigation).filter(Investigation.id == inv_id).first()
        if not inv:
            raise HTTPException(status_code=404, detail="Investigation not found")
        for r in inv.evidence_records:
            norm = validate_and_normalize_source_url(r.source_url, r.title_or_caption, r.source_platform)
            r.source_domain = norm["domain"]
            r.fallback_search_url = norm["fallback_search_url"]
            r.url_type = norm["url_type"]
            r.is_direct_image = norm["is_direct_image"]
            r.original_raw_url = r.source_url
        return InvestigationResponse.model_validate(inv)

@router.post("/{inv_id}/start")
async def start_investigation(inv_id: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    with get_investigation_db(inv_id, db) as active_db:
        inv = active_db.query(Investigation).filter(Investigation.id == inv_id).first()
        if not inv:
            raise HTTPException(status_code=404, detail="Investigation not found")
        background_tasks.add_task(run_investigation_pipeline, inv_id)
        return {"message": "Investigation pipeline initiated", "investigation_id": inv_id, "status": "processing"}

@router.get("/{inv_id}/status")
def get_investigation_status(inv_id: str, db: Session = Depends(get_db)):
    with get_investigation_db(inv_id, db) as active_db:
        inv = active_db.query(Investigation).filter(Investigation.id == inv_id).first()
        if not inv:
            raise HTTPException(status_code=404, detail="Investigation not found")
        
        logs = active_db.query(ConnectorExecutionLog).filter(ConnectorExecutionLog.investigation_id == inv_id).all()
        evidence_count = active_db.query(EvidenceRecord).filter(EvidenceRecord.investigation_id == inv_id).count()

        return {
            "id": inv.id,
            "status": inv.status,
            "current_stage": inv.current_stage,
            "stage_details": inv.stage_details or {},
            "evidence_count": evidence_count,
            "connectors_queried": len(logs),
            "earliest_discovered_reference": inv.earliest_discovered_reference,
            "summary": inv.summary,
            "is_incognito": bool(inv.is_incognito)
        }

@router.get("/{inv_id}/stages")
def get_investigation_stages(inv_id: str, db: Session = Depends(get_db)):
    with get_investigation_db(inv_id, db) as active_db:
        inv = active_db.query(Investigation).filter(Investigation.id == inv_id).first()
        if not inv:
            raise HTTPException(status_code=404, detail="Investigation not found")
        return {
            "investigation_id": inv_id,
            "status": inv.status,
            "current_stage": inv.current_stage or "created",
            "stages": inv.stage_details or {}
        }

@router.get("/{inv_id}/evidence", response_model=List[EvidenceRecordResponse])
def get_investigation_evidence(inv_id: str, db: Session = Depends(get_db)):
    with get_investigation_db(inv_id, db) as active_db:
        records = active_db.query(EvidenceRecord).filter(EvidenceRecord.investigation_id == inv_id).order_by(EvidenceRecord.composite_score.desc()).all()
        for r in records:
            norm = validate_and_normalize_source_url(r.source_url, r.title_or_caption, r.source_platform)
            r.source_domain = norm["domain"]
            r.fallback_search_url = norm["fallback_search_url"]
            r.url_type = norm["url_type"]
            r.is_direct_image = norm["is_direct_image"]
            r.original_raw_url = r.source_url
        return records

@router.get("/{inv_id}/timeline", response_model=TimelineResponse)
def get_investigation_timeline(inv_id: str, db: Session = Depends(get_db)):
    with get_investigation_db(inv_id, db) as active_db:
        inv = active_db.query(Investigation).filter(Investigation.id == inv_id).first()
        if not inv:
            raise HTTPException(status_code=404, detail="Investigation not found")

        records = active_db.query(EvidenceRecord).filter(EvidenceRecord.investigation_id == inv_id).all()
        assets = active_db.query(InputAsset).filter(InputAsset.investigation_id == inv_id).all()
        logs = active_db.query(ConnectorExecutionLog).filter(ConnectorExecutionLog.investigation_id == inv_id).all()

        ev_dicts = [
            {
                "id": r.id,
                "source_platform": r.source_platform,
                "source_url": r.source_url,
                "source_post_id": r.source_post_id,
                "author_name": r.author_name,
                "author_handle": r.author_handle,
                "title_or_caption": r.title_or_caption,
                "content_snippet": r.content_snippet,
                "primary_timestamp": r.primary_timestamp,
                "reported_published_at": r.reported_published_at,
                "reported_created_at": r.reported_created_at,
                "wayback_capture_at": r.wayback_capture_at,
                "retrieved_at": r.retrieved_at,
                "created_at": r.created_at,
                "timestamp_type": r.timestamp_type,
                "timestamp_reliability": r.timestamp_reliability,
                "evidence_strength": r.evidence_strength,
                "composite_score": r.composite_score,
                "visual_similarity": r.visual_similarity,
                "text_relevance": r.text_relevance,
                "explanation": r.explanation,
                "media_urls": r.media_urls,
                "candidate_image_url": r.candidate_image_url,
                "candidate_thumbnail_path": r.candidate_thumbnail_path,
                "match_type": r.match_type,
                "match_signals": r.match_signals,
                "ambiguity_notes": r.ambiguity_notes
            }
            for r in records
        ]
        return build_chronological_timeline(ev_dicts, investigation=inv, assets=assets, logs=logs)

@router.get("/{inv_id}/graph", response_model=OriginGraphResponse)
def get_investigation_graph(inv_id: str, db: Session = Depends(get_db)):
    with get_investigation_db(inv_id, db) as active_db:
        inv = active_db.query(Investigation).filter(Investigation.id == inv_id).first()
        if not inv:
            raise HTTPException(status_code=404, detail="Investigation not found")

        records = active_db.query(EvidenceRecord).filter(EvidenceRecord.investigation_id == inv_id).all()
        ev_dicts = [
            {
                "id": r.id,
                "source_platform": r.source_platform,
                "source_url": r.source_url,
                "author_name": r.author_name,
                "author_handle": r.author_handle,
                "title_or_caption": r.title_or_caption,
                "primary_timestamp": r.primary_timestamp,
                "match_type": r.match_type,
                "evidence_strength": r.evidence_strength,
                "composite_score": r.composite_score,
                "match_signals": r.match_signals,
                "ambiguity_notes": r.ambiguity_notes,
                "content_snippet": r.content_snippet
            }
            for r in records
        ]
        earliest_id = inv.earliest_discovered_reference.get("evidence_id") if inv.earliest_discovered_reference else None
        return build_origin_graph(inv.id, inv.title, inv.input_type, ev_dicts, earliest_id)

@router.get("/{inv_id}/coverage", response_model=List[ConnectorLogResponse])
def get_investigation_coverage(inv_id: str, db: Session = Depends(get_db)):
    with get_investigation_db(inv_id, db) as active_db:
        return active_db.query(ConnectorExecutionLog).filter(ConnectorExecutionLog.investigation_id == inv_id).all()

@router.get("/{inv_id}/diagnostics")
def get_investigation_diagnostics(inv_id: str, db: Session = Depends(get_db)):
    with get_investigation_db(inv_id, db) as active_db:
        inv = active_db.query(Investigation).filter(Investigation.id == inv_id).first()
        if not inv:
            raise HTTPException(status_code=404, detail="Investigation not found")

        logs = active_db.query(ConnectorExecutionLog).filter(ConnectorExecutionLog.investigation_id == inv_id).all()
        evidence = active_db.query(EvidenceRecord).filter(EvidenceRecord.investigation_id == inv_id).all()
        assets = active_db.query(InputAsset).filter(InputAsset.investigation_id == inv_id).all()
        target_asset = assets[0] if assets else None

        return compile_investigation_diagnostics(
            inv_id=inv.id,
            status=inv.status,
            current_stage=inv.current_stage or "created",
            stages=inv.stage_details or {},
            logs=logs,
            evidence=evidence,
            target_asset=target_asset
        )

@router.get("/{inv_id}/report", response_model=ReportResponse)
def get_investigation_report(inv_id: str, db: Session = Depends(get_db)):
    with get_investigation_db(inv_id, db) as active_db:
        rep = active_db.query(InvestigationReport).filter(InvestigationReport.investigation_id == inv_id).order_by(InvestigationReport.generated_at.desc()).first()
        if not rep:
            raise HTTPException(status_code=404, detail="Report not generated yet for this investigation")
        return rep

@router.get("/{inv_id}/report/html", response_class=HTMLResponse)
def get_investigation_report_html(inv_id: str, db: Session = Depends(get_db)):
    with get_investigation_db(inv_id, db) as active_db:
        rep = active_db.query(InvestigationReport).filter(InvestigationReport.investigation_id == inv_id).order_by(InvestigationReport.generated_at.desc()).first()
        if not rep or not rep.report_html:
            raise HTTPException(status_code=404, detail="HTML report not found")
        return rep.report_html

# --- Media Serving Endpoints ---
@router.get("/{inv_id}/asset/{asset_id}/file")
def get_asset_file(inv_id: str, asset_id: str, db: Session = Depends(get_db)):
    with get_investigation_db(inv_id, db) as active_db:
        asset = active_db.query(InputAsset).filter(InputAsset.id == asset_id, InputAsset.investigation_id == inv_id).first()
        if not asset or not asset.file_path or not os.path.exists(asset.file_path):
            raise HTTPException(status_code=404, detail="Asset file not found")
        return FileResponse(asset.file_path, media_type=asset.mime_type or "image/jpeg")

@router.get("/{inv_id}/asset/{asset_id}/thumbnail")
def get_asset_thumbnail(inv_id: str, asset_id: str, db: Session = Depends(get_db)):
    with get_investigation_db(inv_id, db) as active_db:
        asset = active_db.query(InputAsset).filter(InputAsset.id == asset_id, InputAsset.investigation_id == inv_id).first()
        if not asset:
            raise HTTPException(status_code=404, detail="Asset not found")
        if asset.thumbnail_path and os.path.exists(asset.thumbnail_path):
            return FileResponse(asset.thumbnail_path, media_type="image/jpeg")
        if asset.file_path and os.path.exists(asset.file_path):
            return FileResponse(asset.file_path, media_type=asset.mime_type or "image/jpeg")
        raise HTTPException(status_code=404, detail="Thumbnail not available")

@router.get("/{inv_id}/evidence/{evidence_id}/candidate-image")
def get_candidate_cached_image(inv_id: str, evidence_id: str, db: Session = Depends(get_db)):
    with get_investigation_db(inv_id, db) as active_db:
        record = active_db.query(EvidenceRecord).filter(EvidenceRecord.id == evidence_id, EvidenceRecord.investigation_id == inv_id).first()
        if not record or not record.candidate_thumbnail_path or not os.path.exists(record.candidate_thumbnail_path):
            raise HTTPException(status_code=404, detail="Candidate image preview not cached locally")
        return FileResponse(record.candidate_thumbnail_path, media_type="image/jpeg")

@router.delete("/{inv_id}")
def delete_investigation(inv_id: str, db: Session = Depends(get_db)):
    """
    Permanently delete an investigation, its evidence records, execution logs, and reports.
    If incognito, purges strictly from the RAM-only database and discards memory state.
    If normal, deletes from the persistent database.
    Also removes any cached assets or thumbnails on disk.
    """
    is_incog = is_incognito_investigation(inv_id)

    with get_investigation_db(inv_id, db) as active_db:
        inv = active_db.query(Investigation).filter(Investigation.id == inv_id).first()
        if not inv:
            raise HTTPException(status_code=404, detail="Investigation not found")

        # Clean up input asset files
        assets = active_db.query(InputAsset).filter(InputAsset.investigation_id == inv_id).all()
        for asset in assets:
            if asset.file_path and os.path.exists(asset.file_path):
                try:
                    os.remove(asset.file_path)
                except OSError:
                    pass
            if asset.thumbnail_path and os.path.exists(asset.thumbnail_path):
                try:
                    os.remove(asset.thumbnail_path)
                except OSError:
                    pass

        # Clean up evidence candidate thumbnails
        evidence_records = active_db.query(EvidenceRecord).filter(EvidenceRecord.investigation_id == inv_id).all()
        for ev in evidence_records:
            if ev.candidate_thumbnail_path and os.path.exists(ev.candidate_thumbnail_path):
                try:
                    os.remove(ev.candidate_thumbnail_path)
                except OSError:
                    pass

        # Clean up report pdfs
        reports = active_db.query(InvestigationReport).filter(InvestigationReport.investigation_id == inv_id).all()
        for rep in reports:
            if rep.pdf_path and os.path.exists(rep.pdf_path):
                try:
                    os.remove(rep.pdf_path)
                except OSError:
                    pass

        # Delete db records
        active_db.query(ConnectorExecutionLog).filter(ConnectorExecutionLog.investigation_id == inv_id).delete(synchronize_session=False)
        active_db.query(EvidenceRecord).filter(EvidenceRecord.investigation_id == inv_id).delete(synchronize_session=False)
        active_db.query(InputAsset).filter(InputAsset.investigation_id == inv_id).delete(synchronize_session=False)
        active_db.query(InvestigationReport).filter(InvestigationReport.investigation_id == inv_id).delete(synchronize_session=False)
        active_db.delete(inv)
        active_db.commit()

    if is_incog:
        INCOGNITO_INVESTIGATION_IDS.discard(inv_id)

    return {"status": "deleted", "id": inv_id, "message": "Investigation permanently erased."}
