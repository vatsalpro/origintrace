from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class InvestigationCreate(BaseModel):
    title: Optional[str] = None
    input_type: str = Field(..., description="url, image, video, screenshot, text, combined")
    input_content: Optional[str] = Field(None, description="URL or text claim")
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    selected_platforms: Optional[List[str]] = None
    is_synthetic: bool = False

class InputAssetResponse(BaseModel):
    id: str
    investigation_id: str
    asset_type: str
    original_filename: Optional[str] = None
    file_size_bytes: int = 0
    sha256: Optional[str] = None
    perceptual_hash: Optional[str] = None
    difference_hash: Optional[str] = None
    average_hash: Optional[str] = None
    wavelet_hash: Optional[str] = None
    image_width: Optional[int] = None
    image_height: Optional[int] = None
    image_format: Optional[str] = None
    exif_data: Dict[str, Any] = {}
    ocr_text: Optional[str] = None
    extracted_entities: Dict[str, Any] = {}
    created_at: datetime

    class Config:
        from_attributes = True

class MatchSignals(BaseModel):
    sha256_match: bool = False
    phash_distance: Optional[int] = None
    dhash_distance: Optional[int] = None
    text_overlap_pct: Optional[float] = None
    semantic_similarity: Optional[float] = None
    dimension_similarity: Optional[float] = None
    transformation_notes: Optional[str] = None

class EvidenceRecordResponse(BaseModel):
    id: str
    investigation_id: str
    source_platform: str
    source_url: str
    source_post_id: Optional[str] = None
    author_name: Optional[str] = None
    author_handle: Optional[str] = None
    title_or_caption: Optional[str] = None
    content_snippet: Optional[str] = None
    media_urls: List[str] = []
    match_type: str
    composite_score: float
    match_signals: Dict[str, Any] = {}
    evidence_strength: str
    reported_published_at: Optional[datetime] = None
    reported_created_at: Optional[datetime] = None
    wayback_capture_at: Optional[datetime] = None
    retrieved_at: Optional[datetime] = None
    primary_timestamp: Optional[datetime] = None
    timestamp_type: str
    timestamp_reliability: str
    ambiguity_notes: Optional[str] = None
    access_status: str
    created_at: datetime

    class Config:
        from_attributes = True

class ConnectorLogResponse(BaseModel):
    id: str
    connector_name: str
    search_parameters: Dict[str, Any] = {}
    status: str
    results_count: int
    started_at: datetime
    completed_at: Optional[datetime] = None
    duration_ms: int = 0
    coverage_notes: Optional[str] = None
    error_message: Optional[str] = None

    class Config:
        from_attributes = True

class InvestigationResponse(BaseModel):
    id: str
    title: str
    input_type: str
    input_content: Optional[str] = None
    status: str
    parameters: Dict[str, Any] = {}
    earliest_discovered_reference: Optional[Dict[str, Any]] = None
    summary: Optional[str] = None
    is_synthetic: bool = False
    created_at: datetime
    updated_at: datetime
    assets: List[InputAssetResponse] = []
    evidence_records: List[EvidenceRecordResponse] = []
    connector_logs: List[ConnectorLogResponse] = []

    class Config:
        from_attributes = True

class ConnectorStatus(BaseModel):
    name: str
    display_name: str
    category: str
    is_available: bool
    is_configured: bool
    requires_api_key: bool
    supported_operations: List[str]
    description: str
    limitations: str

class TimelineEvent(BaseModel):
    id: str
    timestamp: datetime
    timestamp_type: str  # source_publication, archive_capture, retrieval_only
    reliability: str     # high, medium, low
    platform: str
    title: str
    author: Optional[str] = None
    url: str
    match_type: str
    evidence_id: str
    evidence_strength: str
    is_earliest: bool = False
    notes: Optional[str] = None

class GraphNode(BaseModel):
    id: str
    label: str
    node_type: str  # input, post, archive, image, claim, author
    platform: Optional[str] = None
    timestamp: Optional[str] = None
    url: Optional[str] = None
    evidence_strength: Optional[str] = None
    is_earliest: bool = False
    data: Dict[str, Any] = {}

class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    relation_type: str  # exact_duplicate, visual_similarity, text_similarity, explicit_repost, archive_capture, origin_candidate
    label: str
    weight: float = 1.0
    evidence_notes: Optional[str] = None

class OriginGraphResponse(BaseModel):
    investigation_id: str
    nodes: List[GraphNode]
    edges: List[GraphEdge]

class ReportResponse(BaseModel):
    id: str
    investigation_id: str
    executive_summary: str
    earliest_reference: Optional[Dict[str, Any]] = None
    findings_count: int
    coverage_summary: Dict[str, Any]
    report_html: str
    report_json: Dict[str, Any]
    generated_at: datetime

    class Config:
        from_attributes = True

class BenchmarkResult(BaseModel):
    test_case: str
    expected_earliest_id: Optional[str]
    discovered_earliest_id: Optional[str]
    earliest_source_matched: bool
    precision: float
    recall: float
    false_match_rate: float
    details: Dict[str, Any]
