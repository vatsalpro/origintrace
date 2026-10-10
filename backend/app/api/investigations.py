import uuid
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import HTMLResponse, JSONResponse
from sqlalchemy.orm import Session

from app.database.session import get_db
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
    OriginGraphResponse,
    ReportResponse
)
from app.core.config import settings
from app.core.security import validate_public_url, validate_image_file_bytes
from app.services.fingerprint import extract_image_fingerprints
from app.services.ocr import extract_ocr_text
from app.services.text_nlp import extract_entities
from app.timeline.builder import build_chronological_timeline
from app.graph.builder import build_origin_graph
from app.services.orchestrator import run_investigation_pipeline

router = APIRouter(prefix="/api/investigations", tags=["investigations"])

@router.get("", response_model=List[InvestigationResponse])
def list_investigations(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    """List investigations ordered by creation time descending."""
    return db.query(Investigation).order_by(Investigation.created_at.desc()).offset(skip).limit(limit).all()

@router.post("", response_model=InvestigationResponse)
async def create_investigation(
    background_tasks: BackgroundTasks,
    title: Optional[str] = Form(None),
    input_type: str = Form("text"),  # "url", "image", "video", "screenshot", "text", "combined"
    input_content: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    """
    Submits a new investigation inquiry with URL, image/screenshot upload, or text claim.
    """
    inv_id = f"INV-{uuid.uuid4().hex[:8].upper()}"
    final_title = title or f"Investigation {inv_id}"
    
    # URL Safety Verification if input is URL
    if input_type == "url" and input_content:
        is_safe, msg = validate_public_url(input_content)
        if not is_safe:
            raise HTTPException(status_code=400, detail=f"Invalid or unsafe URL: {msg}")

    new_inv = Investigation(
        id=inv_id,
        title=final_title,
        input_type=input_type,
        input_content=input_content,
        status="created"
    )
    db.add(new_inv)
    db.commit()
    db.refresh(new_inv)

    # Process file upload if provided
    if file and file.filename:
        file_bytes = await file.read()
        if len(file_bytes) > settings.MAX_UPLOAD_SIZE_BYTES:
            raise HTTPException(status_code=400, detail="Uploaded file exceeds maximum allowed size.")

        # Save to safe disk path
        safe_filename = f"{inv_id}_{uuid.uuid4().hex[:8]}_{Path(file.filename).name}"
        save_path = settings.UPLOADS_PATH / safe_filename
        with open(save_path, "wb") as f:
            f.write(file_bytes)

        asset_type = "image" if input_type in ("image", "screenshot") else ("video" if input_type == "video" else "file")
        
        # Image Fingerprinting & OCR
        is_valid_img, img_format, img_err = validate_image_file_bytes(file_bytes)
        fp_data = {}
        ocr_result_text = None
        extracted_entities = {}

        if is_valid_img:
            fp_data = extract_image_fingerprints(file_bytes)
            ocr_success, ocr_text, _ = extract_ocr_text(file_bytes)
            if ocr_success and ocr_text:
                ocr_result_text = ocr_text
                extracted_entities = extract_entities(ocr_text)

        asset = InputAsset(
            investigation_id=inv_id,
            asset_type=asset_type,
            file_path=str(save_path),
            original_filename=file.filename,
            file_size_bytes=len(file_bytes),
            sha256=fp_data.get("sha256"),
            perceptual_hash=fp_data.get("perceptual_hash"),
            difference_hash=fp_data.get("difference_hash"),
            average_hash=fp_data.get("average_hash"),
            wavelet_hash=fp_data.get("wavelet_hash"),
            image_width=fp_data.get("image_width"),
            image_height=fp_data.get("image_height"),
            image_format=fp_data.get("image_format"),
            exif_data=fp_data.get("exif_data", {}),
            ocr_text=ocr_result_text,
            extracted_entities=extracted_entities
        )
        db.add(asset)
        db.commit()

    # Launch background investigation orchestration pipeline
    background_tasks.add_task(run_investigation_pipeline, inv_id, db)

    db.refresh(new_inv)
    return new_inv

@router.get("/{inv_id}", response_model=InvestigationResponse)
def get_investigation(inv_id: str, db: Session = Depends(get_db)):
    inv = db.query(Investigation).filter(Investigation.id == inv_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found")
    return inv

@router.post("/{inv_id}/start")
async def start_investigation(inv_id: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    inv = db.query(Investigation).filter(Investigation.id == inv_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found")
    background_tasks.add_task(run_investigation_pipeline, inv_id, db)
    return {"message": "Investigation pipeline initiated", "investigation_id": inv_id, "status": "processing"}

@router.get("/{inv_id}/status")
def get_investigation_status(inv_id: str, db: Session = Depends(get_db)):
    inv = db.query(Investigation).filter(Investigation.id == inv_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found")
    
    logs = db.query(ConnectorExecutionLog).filter(ConnectorExecutionLog.investigation_id == inv_id).all()
    evidence_count = db.query(EvidenceRecord).filter(EvidenceRecord.investigation_id == inv_id).count()

    return {
        "id": inv.id,
        "status": inv.status,
        "evidence_count": evidence_count,
        "connectors_queried": len(logs),
        "earliest_discovered_reference": inv.earliest_discovered_reference,
        "summary": inv.summary
    }

@router.get("/{inv_id}/evidence", response_model=List[EvidenceRecordResponse])
def get_investigation_evidence(inv_id: str, db: Session = Depends(get_db)):
    records = db.query(EvidenceRecord).filter(EvidenceRecord.investigation_id == inv_id).order_by(EvidenceRecord.composite_score.desc()).all()
    return records

@router.get("/{inv_id}/timeline")
def get_investigation_timeline(inv_id: str, db: Session = Depends(get_db)):
    inv = db.query(Investigation).filter(Investigation.id == inv_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found")

    records = db.query(EvidenceRecord).filter(EvidenceRecord.investigation_id == inv_id).all()
    ev_dicts = [
        {
            "id": r.id,
            "source_platform": r.source_platform,
            "source_url": r.source_url,
            "author_name": r.author_name,
            "author_handle": r.author_handle,
            "title_or_caption": r.title_or_caption,
            "primary_timestamp": r.primary_timestamp,
            "reported_published_at": r.reported_published_at,
            "wayback_capture_at": r.wayback_capture_at,
            "timestamp_type": r.timestamp_type,
            "timestamp_reliability": r.timestamp_reliability,
            "evidence_strength": r.evidence_strength,
            "composite_score": r.composite_score,
            "media_urls": r.media_urls,
            "ambiguity_notes": r.ambiguity_notes
        }
        for r in records
    ]
    return build_chronological_timeline(ev_dicts)

@router.get("/{inv_id}/graph", response_model=OriginGraphResponse)
def get_investigation_graph(inv_id: str, db: Session = Depends(get_db)):
    inv = db.query(Investigation).filter(Investigation.id == inv_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found")

    records = db.query(EvidenceRecord).filter(EvidenceRecord.investigation_id == inv_id).all()
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
    return db.query(ConnectorExecutionLog).filter(ConnectorExecutionLog.investigation_id == inv_id).all()

@router.get("/{inv_id}/report", response_model=ReportResponse)
def get_investigation_report(inv_id: str, db: Session = Depends(get_db)):
    rep = db.query(InvestigationReport).filter(InvestigationReport.investigation_id == inv_id).order_by(InvestigationReport.generated_at.desc()).first()
    if not rep:
        raise HTTPException(status_code=404, detail="Report not generated yet for this investigation")
    return rep

@router.get("/{inv_id}/report/html", response_class=HTMLResponse)
def get_investigation_report_html(inv_id: str, db: Session = Depends(get_db)):
    rep = db.query(InvestigationReport).filter(InvestigationReport.investigation_id == inv_id).order_by(InvestigationReport.generated_at.desc()).first()
    if not rep or not rep.report_html:
        raise HTTPException(status_code=404, detail="HTML report not found")
    return rep.report_html
