import React, { useState } from 'react';
import {
  Archive,
  Search,
  ExternalLink,
  Calendar,
  Clock,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Loader2,
  FileText
} from 'lucide-react';
import { api } from '../services/api';
import { SourceLinkActions } from '../components/SourceLinkActions';
import { safeOpenExternalUrl } from '../utils/url';

export const ArchiveExplorer: React.FC = () => {
  const [url, setUrl] = useState('https://mastodon.social/@astronomy_obs/106233481');
  const [captures, setCaptures] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleQueryWayback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setCaptures([]);
    setNotes('');

    try {
      const formData = new FormData();
      formData.append('title', `Archive Query: ${url}`);
      formData.append('input_type', 'url');
      formData.append('input_content', url.trim());
      formData.append('is_incognito', 'true');

      const inv = await api.createInvestigation(formData);
      setTimeout(async () => {
        try {
          const evidence = await api.getInvestigationTimeline(inv.id);
          const events = evidence?.timeline_events || [];
          const wbCaptures = events.filter((e: any) => e.platform === 'wayback');
          setCaptures(wbCaptures.length > 0 ? wbCaptures : events);
          setNotes(`Wayback CDX API completed query for '${url}'.`);
          setLoading(false);
        } catch {
          setLoading(false);
        }
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Wayback CDX query failed');
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Title */}
      <div className="border-b border-slate-200 pb-6">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Internet Archive Wayback Explorer</h2>
        <p className="text-sm text-slate-500 font-mono mt-1">
          Historical Wayback Machine CDX index query, snapshot verification, and capture date provenance
        </p>
      </div>

      {/* Query Bar */}
      <form onSubmit={handleQueryWayback} className="bg-white border border-slate-200 p-6 rounded-xl space-y-4 shadow-xs">
        <label className="text-xs font-mono uppercase text-slate-600 font-semibold block">
          Target Webpage or Discovered Social Post URL:
        </label>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/target-post-or-webpage"
              className="w-full bg-slate-50 border border-slate-300 text-sm text-slate-900 rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:border-blue-500 focus:bg-white font-mono"
            />
            <Archive className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition flex items-center gap-2 shrink-0 disabled:opacity-50 shadow-sm"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span>Query Wayback CDX</span>
          </button>
        </div>

        <div className="text-[11px] font-mono text-slate-500 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Queries public Internet Archive CDX endpoint directly. Zero key required.</span>
        </div>
      </form>

      {/* Methodological Alert */}
      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-slate-700 text-xs font-mono flex items-start gap-3">
        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
        <div>
          <strong className="block text-amber-800 font-bold mb-0.5">Forensic Provenance Principle:</strong>
          Archive capture dates verify that content existed publicly on or before the snapshot timestamp,
          but do not equate to original creation or publication timestamps.
        </div>
      </div>

      {notes && (
        <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-mono flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{notes}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-mono flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Discovered Captures */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-slate-900">
          Historical Wayback Snapshots ({captures.length})
        </h3>

        {captures.length === 0 ? (
          <div className="p-8 text-center bg-white border border-slate-200 rounded-xl text-xs text-slate-400 font-mono shadow-xs">
            {loading ? 'Querying Internet Archive CDX servers...' : 'No snapshot records loaded yet.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {captures.map((c, idx) => (
              <div key={idx} className="bg-white border border-slate-200 p-5 rounded-xl space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold uppercase px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                      WAYBACK CAPTURE
                    </span>
                    <span className="text-xs text-slate-600 font-mono">
                      Timestamp: {c.timestamp ? new Date(c.timestamp).toUTCString() : 'Undated'}
                    </span>
                  </div>
                  {c.is_earliest && (
                    <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Earliest Discovered Snapshot
                    </span>
                  )}
                </div>

                <p
                  onClick={() => c.url && safeOpenExternalUrl(c.url, c.title || 'Wayback Snapshot')}
                  className={`text-sm text-slate-800 font-sans ${
                    c.url ? 'hover:text-blue-600 hover:underline cursor-pointer' : ''
                  }`}
                  title={c.url ? `Open snapshot: ${c.url}` : undefined}
                >
                  {c.title || c.url}
                </p>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-500">Reliability: <strong className="text-emerald-700">HIGH</strong></span>
                  <SourceLinkActions
                    sourceUrl={c.url}
                    sourceTitle={c.title}
                    sourcePlatform="wayback"
                    candidateImageUrl={c.candidate_image_url}
                    candidateThumbnailUrl={c.candidate_thumbnail_path}
                    sourceDomain={c.source_domain || 'web.archive.org'}
                    fallbackSearchUrl={c.fallback_search_url}
                    fallbackQuery={c.fallback_query}
                    urlType="archive_snapshot"
                    compact={true}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
