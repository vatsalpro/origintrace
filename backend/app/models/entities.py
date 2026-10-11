import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Float, Boolean, Text, DateTime, JSON, ForeignKey
from sqlalchemy.orm import relationship
from app.database.session import Base

def utcnow():
    return datetime.now(timezone.utc)

class Investigation(Base):
    __tablename__ = "investigations"

    id = Column(String(36), primary_key=True, default=lambda: f"INV-{uuid.uuid4().hex[:8].upper()}")
    title = Column(String(255), nullable=False)
    input_type = Column(String(50), nullable=False)  # "url", "image", "video", "screenshot", "text", "combined"
    input_content = Column(Text, nullable=True)     # Post URL or text claim
    status = Column(String(50), default="created")  # "created", "processing", "completed", "completed_with_warnings", "failed"
    current_stage = Column(String(64), default="created")
    stage_details = Column(JSON, default=dict)
    parameters = Column(JSON, default=dict)
    selected_platforms = Column(JSON, default=list)
    earliest_discovered_reference = Column(JSON, nullable=True)
    summary = Column(Text, nullable=True)
    is_synthetic = Column(Boolean, default=False)
    is_incognito = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Relationships
    assets = relationship("InputAsset", back_populates="investigation", cascade="all, delete-orphan")
    evidence_records = relationship("EvidenceRecord", back_populates="investigation", cascade="all, delete-orphan")
    connector_logs = relationship("ConnectorExecutionLog", back_populates="investigation", cascade="all, delete-orphan")
    reports = relationship("InvestigationReport", back_populates="investigation", cascade="all, delete-orphan")


class InputAsset(Base):
    __tablename__ = "input_assets"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    investigation_id = Column(String(36), ForeignKey("investigations.id"), nullable=False)
    asset_type = Column(String(50), nullable=False)  # "image", "video", "screenshot", "text", "webpage"
    file_path = Column(String(512), nullable=True)
    thumbnail_path = Column(String(512), nullable=True)
    original_filename = Column(String(255), nullable=True)
    mime_type = Column(String(128), nullable=True)
    file_size_bytes = Column(Integer, default=0)
    
    # Image Fingerprints
    sha256 = Column(String(64), nullable=True, index=True)
    perceptual_hash = Column(String(64), nullable=True, index=True)
    difference_hash = Column(String(64), nullable=True)
    average_hash = Column(String(64), nullable=True)
    wavelet_hash = Column(String(64), nullable=True)
    image_width = Column(Integer, nullable=True)
    image_height = Column(Integer, nullable=True)
    image_format = Column(String(32), nullable=True)
    
    # Deep Metadata
    camera_make = Column(String(128), nullable=True)
    camera_model = Column(String(128), nullable=True)
    software = Column(String(128), nullable=True)
    capture_time = Column(String(64), nullable=True)
    gps_info = Column(JSON, default=dict)
    icc_profile = Column(String(128), nullable=True)
    exif_data = Column(JSON, default=dict)
    
    # Text & OCR Analysis
    ocr_status = Column(String(64), default="pending")  # "detected", "no_text_detected", "failed", "unavailable"
    ocr_confidence = Column(Float, nullable=True)
    ocr_text = Column(Text, nullable=True)
    extracted_entities = Column(JSON, default=dict)  # urls, hashtags, handles, dates

    # C2PA Content Credentials Verification
    c2pa_status = Column(String(64), default="unavailable")  # "verified", "invalid", "untrusted", "no_manifest", "unavailable"
    c2pa_data = Column(JSON, default=dict)
    
    created_at = Column(DateTime(timezone=True), default=utcnow)

    investigation = relationship("Investigation", back_populates="assets")


class EvidenceRecord(Base):
    __tablename__ = "evidence_records"

    id = Column(String(36), primary_key=True, default=lambda: f"EVD-{uuid.uuid4().hex[:8].upper()}")
    investigation_id = Column(String(36), ForeignKey("investigations.id"), nullable=False)
    source_platform = Column(String(50), nullable=False)  # "bluesky", "mastodon", "wayback", "youtube", "reddit", "reverse_image", "web", "synthetic"
    source_url = Column(String(1024), nullable=False)
    source_post_id = Column(String(255), nullable=True)
    author_name = Column(String(255), nullable=True)
    author_handle = Column(String(255), nullable=True)
    title_or_caption = Column(Text, nullable=True)
    content_snippet = Column(Text, nullable=True)
    media_urls = Column(JSON, default=list)
    
    # Candidate media comparison
    candidate_image_url = Column(String(1024), nullable=True)
    candidate_thumbnail_path = Column(String(512), nullable=True)
    candidate_sha256 = Column(String(64), nullable=True)
    candidate_phash = Column(String(64), nullable=True)
    candidate_dhash = Column(String(64), nullable=True)
    candidate_width = Column(Integer, nullable=True)
    candidate_height = Column(Integer, nullable=True)
    
    # Match Assessment & Separate Indicators
    match_type = Column(String(50), nullable=False)  # "exact", "strong_visual", "transformed_copy", "semantic_claim", "citation", "repost", "unrelated"
    composite_score = Column(Float, default=0.0)
    visual_similarity = Column(Float, nullable=True)
    text_relevance = Column(Float, nullable=True)
    source_reliability_score = Column(Float, default=0.5)
    metadata_consistency_score = Column(Float, default=0.5)
    match_signals = Column(JSON, default=dict)
    evidence_strength = Column(String(50), default="Inconclusive")  # Strong match, Probable match, Possible match, Related claim only, Inconclusive
    
    # Forensic Transparency
    explanation = Column(Text, nullable=True)  # What supports the result, observed vs inferred, what could invalidate it
    
    # Provenance Timestamps (Strict UTC + Reliability)
    reported_published_at = Column(DateTime(timezone=True), nullable=True)
    reported_created_at = Column(DateTime(timezone=True), nullable=True)
    wayback_capture_at = Column(DateTime(timezone=True), nullable=True)
    retrieved_at = Column(DateTime(timezone=True), default=utcnow)
    primary_timestamp = Column(DateTime(timezone=True), nullable=True)
    timestamp_type = Column(String(50), default="retrieval_only")  # "source_publication", "archive_capture", "retrieval_only", "user_asserted"
    timestamp_reliability = Column(String(50), default="unverified")  # "high", "medium", "low", "unverified"
    ambiguity_notes = Column(Text, nullable=True)

    access_status = Column(String(50), default="accessible")  # "accessible", "restricted", "tombstoned", "archived_only"
    created_at = Column(DateTime(timezone=True), default=utcnow)

    investigation = relationship("Investigation", back_populates="evidence_records")
    captures = relationship("HistoricalCapture", back_populates="evidence", cascade="all, delete-orphan")


class HistoricalCapture(Base):
    __tablename__ = "historical_captures"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    evidence_id = Column(String(36), ForeignKey("evidence_records.id"), nullable=False)
    original_url = Column(String(1024), nullable=False)
    wayback_url = Column(String(1024), nullable=False)
    capture_timestamp = Column(DateTime(timezone=True), nullable=False)
    status_code = Column(Integer, nullable=True)
    mime_type = Column(String(128), nullable=True)
    is_earliest_capture = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    evidence = relationship("EvidenceRecord", back_populates="captures")


class ConnectorExecutionLog(Base):
    __tablename__ = "connector_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    investigation_id = Column(String(36), ForeignKey("investigations.id"), nullable=False)
    connector_name = Column(String(64), nullable=False)
    search_parameters = Column(JSON, default=dict)
    queries_executed = Column(JSON, default=list)
    items_inspected = Column(Integer, default=0)
    status = Column(String(64), nullable=False)  # "completed_with_matches", "completed_no_matches", "partially_completed", "rate_limited", "access_denied", "not_configured", "error"
    results_count = Column(Integer, default=0)
    started_at = Column(DateTime(timezone=True), default=utcnow)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    duration_ms = Column(Integer, default=0)
    coverage_notes = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)

    investigation = relationship("Investigation", back_populates="connector_logs")


class InvestigationReport(Base):
    __tablename__ = "investigation_reports"

    id = Column(String(36), primary_key=True, default=lambda: f"REP-{uuid.uuid4().hex[:8].upper()}")
    investigation_id = Column(String(36), ForeignKey("investigations.id"), nullable=False)
    executive_summary = Column(Text, nullable=False)
    earliest_reference_id = Column(String(36), nullable=True)
    findings_count = Column(Integer, default=0)
    coverage_summary = Column(JSON, default=dict)
    report_html = Column(Text, nullable=True)
    report_json = Column(JSON, default=dict)
    generated_at = Column(DateTime(timezone=True), default=utcnow)

    investigation = relationship("Investigation", back_populates="reports")
