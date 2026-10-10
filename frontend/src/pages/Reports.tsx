import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Printer,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Layers,
  CheckCircle2
} from 'lucide-react';
import { api } from '../services/api';
import { Investigation } from '../types';

interface ReportsProps {
  investigationId?: string;
  investigation?: Investigation;
}

export const Reports: React.FC<ReportsProps> = ({ investigationId, investigation }) => {
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!investigationId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .getInvestigationReport(investigationId)
      .then((data) => {
        setReportData(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [investigationId]);

  if (!investigationId) {
    return (
      <div className="p-12 text-center text-slate-400 font-mono">
        Please select an investigation to generate and export its digital forensics report.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-12 text-center text-sky-400 font-mono flex items-center justify-center gap-2">
        <Clock className="w-5 h-5 animate-spin" />
        <span>Compiling structured digital forensics report...</span>
      </div>
    );
  }

  const earliestRef = reportData?.earliest_reference || investigation?.earliest_discovered_reference;
  const coverage = reportData?.coverage_summary || {};
  const evidenceList = investigation?.evidence_records || [];

  const handleDownloadJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(reportData?.report_json || reportData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `origintrace_report_${investigationId}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleOpenHtml = () => {
    window.open(`/api/investigations/${investigationId}/report/html`, '_blank');
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1e293b] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30">
              FORENSIC INVESTIGATION REPORT
            </span>
            <span className="text-xs font-mono text-slate-400">Ref: {investigationId}</span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">{investigation?.title || `Inquiry ${investigationId}`}</h2>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleDownloadJson}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#182235] hover:bg-[#1f2d47] text-slate-200 border border-[#1e293b] text-xs font-mono font-semibold transition"
          >
            <Download className="w-3.5 h-3.5 text-sky-400" />
            <span>Export JSON</span>
          </button>

          <button
            onClick={handleOpenHtml}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition shadow-lg shadow-sky-500/20"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Open Standalone HTML Report</span>
          </button>
        </div>
      </div>

      {/* 1. Executive Summary */}
      <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-6 space-y-4">
        <h3 className="text-base font-semibold text-white border-b border-[#1e293b] pb-3">
          1. Executive Summary
        </h3>
        <p className="text-sm text-slate-300 leading-relaxed font-sans">
          {reportData?.executive_summary || investigation?.summary || 'Provenance analysis in progress.'}
        </p>

        {earliestRef && (
          <div className="p-4 rounded-lg bg-[#182235] border border-[#1e293b] space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between text-slate-400">
              <span className="font-bold text-sky-400 uppercase">Earliest Discovered Appearance:</span>
              <span className="text-emerald-400 font-bold">{earliestRef.platform.toUpperCase()}</span>
            </div>
            <div className="text-white font-semibold">
              {earliestRef.title || earliestRef.url}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-slate-400 text-[11px] pt-1">
              <span>Timestamp: <strong className="text-slate-200">{new Date(earliestRef.timestamp).toUTCString()}</strong></span>
              <span>Type: <strong className="text-slate-200">{earliestRef.timestamp_type}</strong></span>
              <span>Reliability: <strong className="text-slate-200">{earliestRef.reliability.toUpperCase()}</strong></span>
            </div>
          </div>
        )}
      </div>

      {/* 2. Target Assets Evidence */}
      {investigation?.assets && investigation.assets.length > 0 && (
        <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-6 space-y-4">
          <h3 className="text-base font-semibold text-white border-b border-[#1e293b] pb-3">
            2. Target Asset Fingerprints & Analysis
          </h3>
          {investigation.assets.map((a, i) => (
            <div key={i} className="bg-[#182235] p-4 rounded-lg border border-[#1e293b] space-y-2 text-xs font-mono">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-slate-300">
                <div><span className="text-slate-500">Asset Type:</span> {a.asset_type.toUpperCase()}</div>
                <div><span className="text-slate-500">Geometry:</span> {a.image_width}x{a.image_height} ({a.image_format || 'N/A'})</div>
                <div className="col-span-2 break-all"><span className="text-slate-500">SHA-256:</span> {a.sha256 || 'N/A'}</div>
                <div><span className="text-slate-500">pHash:</span> {a.perceptual_hash || 'N/A'}</div>
                <div><span className="text-slate-500">dHash:</span> {a.difference_hash || 'N/A'}</div>
              </div>
              {a.ocr_text && (
                <div className="pt-2 border-t border-[#1e293b]">
                  <span className="text-slate-500 block mb-1">OCR Extracted Text:</span>
                  <div className="text-slate-200 bg-[#111827] p-2.5 rounded font-sans text-xs">
                    {a.ocr_text}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 3. Discovered Evidence Table */}
      <div className="bg-[#111827] border border-[#1e293b] rounded-xl overflow-hidden space-y-4">
        <div className="p-6 pb-0">
          <h3 className="text-base font-semibold text-white">
            3. Discovered Evidence Records ({evidenceList.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#182235] text-slate-400 uppercase text-[11px] border-b border-[#1e293b]">
              <tr>
                <th className="p-3.5">Platform</th>
                <th className="p-3.5">Source URL</th>
                <th className="p-3.5">Author / Handle</th>
                <th className="p-3.5">Date (UTC)</th>
                <th className="p-3.5">Match Type</th>
                <th className="p-3.5">Strength</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e293b] text-slate-300">
              {evidenceList.map((ev, i) => (
                <tr key={i} className="hover:bg-[#182235]/40 transition">
                  <td className="p-3.5 font-bold text-sky-400 uppercase">{ev.source_platform}</td>
                  <td className="p-3.5">
                    <a
                      href={ev.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-400 hover:underline flex items-center gap-1 max-w-[200px] truncate"
                    >
                      <span>{ev.source_url}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  </td>
                  <td className="p-3.5 text-slate-200">{ev.author_name || ev.author_handle || 'N/A'}</td>
                  <td className="p-3.5">
                    {ev.primary_timestamp ? new Date(ev.primary_timestamp).toLocaleDateString() : 'Undated'}
                  </td>
                  <td className="p-3.5 uppercase text-slate-400">{ev.match_type}</td>
                  <td className="p-3.5 font-semibold text-white">{ev.evidence_strength}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Limitations and Methodological Principles */}
      <div className="bg-[#182235] border border-[#1e293b] rounded-xl p-6 space-y-3 text-xs leading-relaxed">
        <h4 className="font-semibold text-amber-400 font-mono flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Forensic Limitations & Provenance Boundaries</span>
        </h4>
        <ul className="space-y-1.5 text-slate-300 list-disc list-inside">
          <li>Finding the earliest public appearance does not establish the definitive original creator without primary author authentication.</li>
          <li>Archive capture dates (Internet Archive) indicate historical web presence at that moment, not initial publication.</li>
          <li>Searches are subject to public platform availability; private, deleted, or unindexed accounts are outside scope.</li>
          <li>All conclusions in this report are grounded strictly in stored verifiable evidence.</li>
        </ul>
      </div>
    </div>
  );
};
