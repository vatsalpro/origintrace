import { Investigation, ConnectorStatus, OriginGraphData, BenchmarkSuiteResult, TimelineResponse, UrlAccessDiagnostics } from '../types';

const API_BASE = '/api';

export const api = {
  async getInvestigations(): Promise<Investigation[]> {
    const res = await fetch(`${API_BASE}/investigations`);
    if (!res.ok) throw new Error('Failed to fetch investigations');
    return res.json();
  },

  async getInvestigation(id: string): Promise<Investigation> {
    const res = await fetch(`${API_BASE}/investigations/${id}`);
    if (!res.ok) throw new Error(`Failed to fetch investigation ${id}`);
    return res.json();
  },

  async createInvestigation(formData: FormData): Promise<Investigation> {
    const res = await fetch(`${API_BASE}/investigations`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Creation failed' }));
      throw new Error(err.detail || 'Failed to create investigation');
    }
    return res.json();
  },

  async deleteInvestigation(id: string): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE}/investigations/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete investigation');
    return res.json();
  },

  async startInvestigation(id: string): Promise<{ message: string; status: string }> {
    const res = await fetch(`${API_BASE}/investigations/${id}/start`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to start investigation pipeline');
    return res.json();
  },

  async getInvestigationTimeline(id: string): Promise<TimelineResponse> {
    const res = await fetch(`${API_BASE}/investigations/${id}/timeline`);
    if (!res.ok) throw new Error('Failed to fetch timeline');
    return res.json();
  },

  async getInvestigationGraph(id: string): Promise<OriginGraphData> {
    const res = await fetch(`${API_BASE}/investigations/${id}/graph`);
    if (!res.ok) throw new Error('Failed to fetch graph data');
    return res.json();
  },

  async getInvestigationCoverage(id: string): Promise<any[]> {
    const res = await fetch(`${API_BASE}/investigations/${id}/coverage`);
    if (!res.ok) throw new Error('Failed to fetch coverage');
    return res.json();
  },

  async getInvestigationReport(id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/investigations/${id}/report`);
    if (!res.ok) throw new Error('Failed to fetch report');
    return res.json();
  },

  async getInvestigationReportHtmlUrl(id: string): Promise<string> {
    return `${API_BASE}/investigations/${id}/report/html`;
  },

  async getInvestigationStages(id: string): Promise<{ investigation_id: string; current_stage: string; status: string; stages: Record<string, any> }> {
    const res = await fetch(`${API_BASE}/investigations/${id}/stages`);
    if (!res.ok) throw new Error('Failed to fetch stages');
    return res.json();
  },

  async getInvestigationDiagnostics(id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/investigations/${id}/diagnostics`);
    if (!res.ok) throw new Error('Failed to fetch diagnostics');
    return res.json();
  },

  getAssetFileUrl(investigationId: string, assetId: string): string {
    return `${API_BASE}/investigations/${investigationId}/asset/${assetId}/file`;
  },

  getAssetThumbnailUrl(investigationId: string, assetId: string): string {
    return `${API_BASE}/investigations/${investigationId}/asset/${assetId}/thumbnail`;
  },

  getCandidateImageUrl(investigationId: string, evidenceId: string): string {
    return `${API_BASE}/investigations/${investigationId}/evidence/${evidenceId}/candidate-image`;
  },

  async getConnectors(): Promise<ConnectorStatus[]> {
    const res = await fetch(`${API_BASE}/connectors`);
    if (!res.ok) throw new Error('Failed to fetch connectors');
    return res.json();
  },

  async getConnectorsStatus(): Promise<Record<string, any>> {
    const res = await fetch(`${API_BASE}/connectors/status`);
    if (!res.ok) throw new Error('Failed to fetch connector health');
    return res.json();
  },

  async runBenchmark(): Promise<BenchmarkSuiteResult> {
    const res = await fetch(`${API_BASE}/benchmark/run`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to run benchmark suite');
    return res.json();
  },

  async verifyUrl(url: string): Promise<UrlAccessDiagnostics> {
    const res = await fetch(`${API_BASE}/investigations/verify-url?url=${encodeURIComponent(url)}`);
    if (!res.ok) throw new Error('Failed to verify URL status');
    return res.json();
  },

  async getIncognitoInvestigations(): Promise<Investigation[]> {
    const res = await fetch(`${API_BASE}/investigations/incognito/active`);
    if (!res.ok) throw new Error('Failed to fetch active incognito investigations');
    return res.json();
  },

  async clearIncognitoSession(): Promise<{ status: string; message: string }> {
    const res = await fetch(`${API_BASE}/investigations/incognito/clear`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to clear incognito session');
    return res.json();
  },

  async getIncognitoStatus(): Promise<{ is_active: boolean; active_cases_count: number; active_case_ids: string[] }> {
    const res = await fetch(`${API_BASE}/investigations/incognito/status`);
    if (!res.ok) throw new Error('Failed to fetch incognito status');
    return res.json();
  },
};
