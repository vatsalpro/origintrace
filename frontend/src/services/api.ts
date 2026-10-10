import { Investigation, ConnectorStatus, OriginGraphData, BenchmarkSuiteResult } from '../types';

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

  async startInvestigation(id: string): Promise<{ message: string; status: string }> {
    const res = await fetch(`${API_BASE}/investigations/${id}/start`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to start investigation pipeline');
    return res.json();
  },

  async getInvestigationTimeline(id: string): Promise<any> {
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
};
