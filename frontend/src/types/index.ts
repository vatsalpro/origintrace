export interface InputAsset {
  id: string;
  investigation_id: string;
  asset_type: string;
  original_filename?: string;
  file_size_bytes: number;
  mime_type?: string;
  thumbnail_path?: string;
  sha256?: string;
  perceptual_hash?: string;
  difference_hash?: string;
  average_hash?: string;
  wavelet_hash?: string;
  image_width?: number;
  image_height?: number;
  image_format?: string;
  camera_make?: string;
  camera_model?: string;
  software?: string;
  capture_time?: string;
  gps_info: Record<string, any>;
  icc_profile?: string;
  exif_data: Record<string, any>;
  ocr_status?: string;
  ocr_confidence?: number;
  ocr_text?: string;
  extracted_entities: {
    urls?: string[];
    handles?: string[];
    hashtags?: string[];
    dates?: string[];
  };
  c2pa_status?: 'verified' | 'untrusted' | 'invalid' | 'no_manifest' | 'unavailable';
  c2pa_data?: Record<string, any>;
  created_at: string;
}

export interface EvidenceRecord {
  id: string;
  investigation_id: string;
  source_platform: string;
  source_url: string;
  source_post_id?: string;
  author_name?: string;
  author_handle?: string;
  title_or_caption?: string;
  content_snippet?: string;
  media_urls: string[];
  candidate_image_url?: string;
  candidate_thumbnail_path?: string;
  candidate_sha256?: string;
  candidate_phash?: string;
  candidate_dhash?: string;
  candidate_width?: number;
  candidate_height?: number;
  visual_similarity?: number;
  text_relevance?: number;
  source_reliability_score?: number;
  metadata_consistency_score?: number;
  match_type: string;
  composite_score: number;
  match_signals: Record<string, any>;
  evidence_strength: 'Strong match' | 'Probable match' | 'Possible match' | 'Related claim only' | 'Inconclusive';
  explanation?: string;
  reported_published_at?: string;
  reported_created_at?: string;
  wayback_capture_at?: string;
  retrieved_at?: string;
  primary_timestamp?: string;
  timestamp_type: 'source_publication' | 'archive_capture' | 'retrieval_only' | 'user_asserted';
  timestamp_reliability: 'high' | 'medium' | 'low' | 'unverified';
  ambiguity_notes?: string;
  access_status: string;
  original_raw_url?: string;
  source_domain?: string;
  url_type?: 'source_webpage' | 'direct_image' | 'thumbnail' | 'api_endpoint' | 'malformed';
  is_direct_image?: boolean;
  fallback_search_url?: string;
  fallback_query?: string;
  search_provider?: string;
  discovery_method?: string;
  created_at: string;
}

export interface ConnectorLog {
  id: string;
  connector_name: string;
  search_parameters: Record<string, any>;
  queries_executed?: string[];
  items_inspected?: number;
  status: string;
  results_count: number;
  started_at: string;
  completed_at?: string;
  duration_ms: number;
  coverage_notes?: string;
  error_message?: string;
}

export interface EarliestReference {
  evidence_id: string;
  platform: string;
  url: string;
  original_raw_url?: string;
  source_domain?: string;
  fallback_search_url?: string;
  candidate_image_url?: string;
  timestamp: string;
  timestamp_type: string;
  reliability: string;
  author?: string;
  title?: string;
  evidence_strength: string;
  ambiguity_notes?: string;
}

export interface StageDetail {
  status: 'pending' | 'running' | 'completed' | 'failed' | 'not_configured' | 'completed_no_matches';
  message: string;
  updated_at: string;
}

export interface Investigation {
  id: string;
  title: string;
  input_type: string;
  input_content?: string;
  status: string;
  current_stage?: string;
  stage_details?: Record<string, StageDetail>;
  parameters: Record<string, any>;
  selected_platforms?: string[];
  earliest_discovered_reference?: EarliestReference;
  summary?: string;
  is_synthetic: boolean;
  is_incognito?: boolean;
  created_at: string;
  updated_at: string;
  assets: InputAsset[];
  evidence_records: EvidenceRecord[];
  connector_logs: ConnectorLog[];
}

export interface ConnectorStatus {
  name: string;
  display_name: string;
  category: string;
  is_available: boolean;
  is_configured: boolean;
  requires_api_key: boolean;
  supported_operations: string[];
  description: string;
  limitations: string;
}

export interface InvestigationDiagnostics {
  investigation_id: string;
  status: string;
  current_stage: string;
  stages: Record<string, StageDetail>;
  connectors_attempted: string[];
  successful_connectors: string[];
  unconfigured_connectors: string[];
  failed_connectors: string[];
  queries_executed: string[];
  total_candidates_found: number;
  visual_comparisons_completed: number;
  credits_consumed?: number;
  cache_hits?: number;
  reverse_image_configured?: boolean;
  masked_serpapi_key?: string;
  reasons_for_limited_results: string[];
}

export interface GraphNode {
  id: string;
  label: string;
  node_type: string;
  platform?: string;
  timestamp?: string;
  url?: string;
  evidence_strength?: string;
  is_earliest: boolean;
  data: Record<string, any>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relation_type: string;
  label: string;
  weight: number;
  evidence_notes?: string;
}

export interface OriginGraphData {
  investigation_id: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  total_nodes: number;
  total_edges: number;
}

export interface TimelineEvent {
  id: string;
  evidence_id?: string;
  timestamp?: string;
  event_timestamp?: string;
  event_type: 'source_publication' | 'archive_capture' | 'evidence_collection' | 'processing' | 'provenance_verification' | 'undated_evidence';
  timestamp_type: string;
  reliability: string;
  platform: string;
  title: string;
  author?: string;
  url?: string;
  original_raw_url?: string;
  source_domain?: string;
  url_type?: 'source_webpage' | 'direct_image' | 'thumbnail' | 'api_endpoint' | 'malformed';
  is_direct_image?: boolean;
  fallback_search_url?: string;
  fallback_query?: string;
  access_status?: string;
  search_provider?: string;
  discovery_method?: string;
  match_type: string;
  evidence_strength: string;
  composite_score: number;
  visual_similarity?: number;
  text_relevance?: number;
  explanation?: string;
  media_urls?: string[];
  candidate_image_url?: string;
  candidate_thumbnail_path?: string;
  ambiguity_notes?: string;
  uncertainty?: string;
  timestamp_provenance?: string;
  published_at?: string;
  archived_at?: string;
  retrieved_at?: string;
  investigation_created_at?: string;
  is_earliest: boolean;
  notes?: string;
}

export interface UrlAccessDiagnostics {
  checked_url: string;
  status_code?: number | null;
  access_status: 'accessible' | 'forbidden' | 'restricted' | 'not_found' | 'timeout' | 'error' | 'blocked_ssrf' | 'malformed' | 'rate_limited';
  category: 'public_web' | 'waf_or_cloudflare' | 'authentication_required' | 'tombstoned' | 'unreachable' | 'security_blocked' | 'rate_limited' | 'remote_error';
  is_accessible: boolean;
  explanation: string;
  server_header?: string | null;
}

export interface TimelineResponse {
  investigation_id: string;
  timeline_events: TimelineEvent[];
  undated_events: TimelineEvent[];
  collection_events: TimelineEvent[];
  source_events: TimelineEvent[];
  archive_events: TimelineEvent[];
  provenance_events: TimelineEvent[];
  processing_events: TimelineEvent[];
  total_events: number;
  dated_events_count: number;
  undated_events_count: number;
  earliest_discovered_reference?: EarliestReference | null;
  warnings?: string[];
  coverage_limitations?: string[];
}

export interface BenchmarkMetrics {
  precision: number;
  recall: number;
  false_match_rate: number;
  earliest_known_source_accuracy: number;
  true_positives: number;
  false_positives: number;
  true_negatives: number;
  false_negatives: number;
}

export interface BenchmarkSuiteResult {
  benchmark_name: string;
  dataset_size: number;
  test_cases: string[];
  metrics: BenchmarkMetrics;
  discovered_earliest_reference?: EarliestReference;
  evaluated_records: any[];
  methodological_notice: string;
  evaluated_at: string;
}
