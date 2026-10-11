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
import { SourceLinkActions } from '../components/SourceLinkActions';
import { safeOpenExternalUrl } from '../utils/url';

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
      <div className="p-12 text-center text-slate-500 font-mono bg-white border border-slate-200 rounded-2xl m-8 shadow-xs">
        <FileText className="w-10 h-10 mx-auto text-slate-400 mb-3" />
        <h3 className="text-base font-semibold text-slate-900">No Investigation Selected</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
          Please select an investigation from the header to generate and export its digital forensics report.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-16 text-center text-blue-600 font-mono flex flex-col items-center justify-center gap-3">
        <Clock className="w-8 h-8 animate-spin text-blue-600" />
        <span className="text-sm font-semibold text-slate-900">Compiling structured digital forensics report...</span>
        <span className="text-xs text-slate-500">Case ID: {investigationId}</span>
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
              FORENSIC INVESTIGATION REPORT
            </span>
            <span className="text-xs font-mono text-slate-500">Ref: {investigationId}</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{investigation?.title || `Inquiry ${investigationId}`}</h2>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleDownloadJson}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-mono font-semibold transition"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span>Export JSON</span>
          </button>

          <button
            onClick={handleOpenHtml}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Open Standalone HTML Report</span>
          </button>
        </div>
      </div>

      {/* 1. Executive Summary */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-xs">
        <h3 className="text-base font-semibold text-slate-900 border-b border-slate-200 pb-3">
          1. Executive Summary
        </h3>
        <p className="text-sm text-slate-700 leading-relaxed font-sans">
          {reportData?.executive_summary || investigation?.summary || 'Provenance analysis in progress.'}
        </p>

        {earliestRef && (
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between text-slate-500">
              <span className="font-bold text-blue-700 uppercase">Earliest Discovered Appearance:</span>
              <span className="text-emerald-700 font-bold">{earliestRef.platform.toUpperCase()}</span>
            </div>
            <div
              onClick={() => earliestRef.url && safeOpenExternalUrl(earliestRef.url, earliestRef.title)}
              className={`text-slate-900 font-semibold ${
                earliestRef.url ? 'hover:text-blue-600 hover:underline cursor-pointer' : ''
              }`}
              title={earliestRef.url ? `Open source: ${earliestRef.url}` : undefined}
            >
              {earliestRef.title || earliestRef.url}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200">
              <div className="flex flex-wrap items-center gap-4 text-slate-600 text-[11px]">
                <span>Timestamp: <strong className="text-slate-800">{new Date(earliestRef.timestamp).toUTCString()}</strong></span>
                <span>Type: <strong className="text-slate-800">{earliestRef.timestamp_type}</strong></span>
                <span>Reliability: <strong className="text-slate-800">{earliestRef.reliability.toUpperCase()}</strong></span>
              </div>
              <SourceLinkActions
                sourceUrl={earliestRef.url}
                sourceTitle={earliestRef.title}
                sourcePlatform={earliestRef.platform}
                candidateImageUrl={earliestRef.candidate_image_url}
                sourceDomain={earliestRef.source_domain}
                fallbackSearchUrl={earliestRef.fallback_search_url}
                compact={true}
              />
            </div>
          </div>
        )}
      </div>

      {/* 2. Target Assets Evidence */}
      {investigation?.assets && investigation.assets.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-xs">
          <h3 className="text-base font-semibold text-slate-900 border-b border-slate-200 pb-3">
            2. Target Asset Fingerprints & Analysis
          </h3>
          {investigation.assets.map((a, i) => (
            <div key={i} className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2 text-xs font-mono">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-slate-700">
                <div><span className="text-slate-400">Asset Type:</span> {a.asset_type.toUpperCase()}</div>
                <div><span className="text-slate-400">Geometry:</span> {a.image_width}x{a.image_height} ({a.image_format || 'N/A'})</div>
                <div className="col-span-2 break-all"><span className="text-slate-400">SHA-256:</span> {a.sha256 || 'N/A'}</div>
                <div><span className="text-slate-400">pHash:</span> {a.perceptual_hash || 'N/A'}</div>
                <div><span className="text-slate-400">dHash:</span> {a.difference_hash || 'N/A'}</div>
              </div>
              {a.ocr_text && (
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-slate-500 block mb-1">OCR Extracted Text:</span>
                  <div className="text-slate-800 bg-white border border-slate-200 p-2.5 rounded font-sans text-xs">
                    {a.ocr_text}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 3. Discovered Evidence Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden space-y-4 shadow-xs">
        <div className="p-6 pb-0">
          <h3 className="text-base font-semibold text-slate-900">
            3. Discovered Evidence Records ({evidenceList.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-50 text-slate-600 uppercase text-[11px] border-b border-slate-200">
              <tr>
                <th className="p-3.5">Platform</th>
                <th className="p-3.5">Source URL</th>
                <th className="p-3.5">Author / Handle</th>
                <th className="p-3.5">Date (UTC)</th>
                <th className="p-3.5">Match Type</th>
                <th className="p-3.5">Strength</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {evidenceList.map((ev, i) => (
                <tr key={i} className="hover:bg-slate-50/70 transition">
                  <td className="p-3.5 font-bold text-blue-700 uppercase">{ev.source_platform}</td>
                  <td className="p-3.5">
                    <SourceLinkActions
                      sourceUrl={ev.source_url}
                      sourceTitle={ev.title_or_caption}
                      sourcePlatform={ev.source_platform}
                      candidateImageUrl={ev.candidate_image_url}
                      candidateThumbnailUrl={ev.candidate_thumbnail_path}
                      sourceDomain={ev.source_domain}
                      fallbackSearchUrl={ev.fallback_search_url}
                      fallbackQuery={ev.fallback_query}
                      urlType={ev.url_type}
                      isDirectImage={ev.is_direct_image}
                      accessStatus={ev.access_status}
                      compact={true}
                    />
                  </td>
                  <td className="p-3.5 text-slate-800">{ev.author_name || ev.author_handle || 'N/A'}</td>
                  <td className="p-3.5">
                    {ev.primary_timestamp ? new Date(ev.primary_timestamp).toLocaleDateString() : 'Undated'}
                  </td>
                  <td className="p-3.5 uppercase text-slate-500">{ev.match_type}</td>
                  <td className="p-3.5 font-semibold text-slate-900">{ev.evidence_strength}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Limitations and Methodological Principles */}
      <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-6 space-y-3 text-xs leading-relaxed text-slate-700">
        <h4 className="font-semibold text-amber-800 font-mono flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
          <span>Forensic Limitations & Provenance Boundaries</span>
        </h4>
        <ul className="space-y-1.5 text-slate-700 list-disc list-inside">
          <li>Finding the earliest public appearance does not establish the definitive original creator without primary author authentication.</li>
          <li>Archive capture dates (Internet Archive) indicate historical web presence at that moment, not initial publication.</li>
          <li>Searches are subject to public platform availability; private, deleted, or unindexed accounts are outside scope.</li>
          <li>All conclusions in this report are grounded strictly in stored verifiable evidence.</li>
        </ul>
      </div>
    </div>
  );
};
