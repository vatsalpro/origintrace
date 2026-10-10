export interface InputAsset {
  id: string;
  investigation_id: string;
  asset_type: string;
  original_filename?: string;
  file_size_bytes: number;
  sha256?: string;
  perceptual_hash?: string;
  difference_hash?: string;
  average_hash?: string;
  wavelet_hash?: string;
  image_width?: number;
  image_height?: number;
  image_format?: string;
  exif_data: Record<string, any>;
  ocr_text?: string;
  extracted_entities: {
    urls?: string[];
    handles?: string[];
    hashtags?: string[];
    dates?: string[];
  };
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
  match_type: string;
  composite_score: number;
  match_signals: Record<string, any>;
  evidence_strength: 'Strong match' | 'Probable match' | 'Possible match' | 'Related claim only' | 'Inconclusive';
  reported_published_at?: string;
  reported_created_at?: string;
  wayback_capture_at?: string;
  retrieved_at?: string;
  primary_timestamp?: string;
  timestamp_type: 'source_publication' | 'archive_capture' | 'retrieval_only' | 'user_asserted';
  timestamp_reliability: 'high' | 'medium' | 'low' | 'unverified';
  ambiguity_notes?: string;
  access_status: string;
  created_at: string;
}

export interface ConnectorLog {
  id: string;
  connector_name: string;
  search_parameters: Record<string, any>;
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
  timestamp: string;
  timestamp_type: string;
  reliability: string;
  author?: string;
  title?: string;
  evidence_strength: string;
  ambiguity_notes?: string;
}

export interface Investigation {
  id: string;
  title: string;
  input_type: string;
  input_content?: string;
  status: string;
  parameters: Record<string, any>;
  earliest_discovered_reference?: EarliestReference;
  summary?: string;
  is_synthetic: boolean;
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
  evidence_id: string;
  timestamp: string;
  timestamp_type: string;
  reliability: string;
  platform: string;
  title: string;
  author?: string;
  url: string;
  match_type: string;
  evidence_strength: string;
  composite_score: number;
  media_urls?: string[];
  ambiguity_notes?: string;
  is_earliest: boolean;
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
