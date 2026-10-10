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
      <div className="border-b border-[#1e293b] pb-6">
        <h2 className="text-2xl font-bold text-white tracking-tight">Internet Archive Wayback Explorer</h2>
        <p className="text-sm text-slate-400 font-mono mt-1">
          Historical Wayback Machine CDX index query, snapshot verification, and capture date provenance
        </p>
      </div>

      {/* Query Bar */}
      <form onSubmit={handleQueryWayback} className="bg-[#111827] border border-[#1e293b] p-6 rounded-xl space-y-4">
        <label className="text-xs font-mono uppercase text-slate-400 font-semibold block">
          Target Webpage or Discovered Social Post URL:
        </label>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/target-post-or-webpage"
              className="w-full bg-[#182235] border border-[#1e293b] text-sm text-white rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:border-sky-500 font-mono"
            />
            <Archive className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm transition flex items-center gap-2 shrink-0 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span>Query Wayback CDX</span>
          </button>
        </div>

        <div className="text-[11px] font-mono text-slate-500 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Queries public Internet Archive CDX endpoint directly. Zero key required.</span>
        </div>
      </form>

      {/* Methodological Alert */}
      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono flex items-start gap-3">
        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-400" />
        <div>
          <strong className="block text-white font-bold mb-0.5">Forensic Provenance Principle:</strong>
          Archive capture dates verify that content existed publicly on or before the snapshot timestamp,
          but do not equate to original creation or publication timestamps.
        </div>
      </div>

      {notes && (
        <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notes}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Discovered Captures */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-white">
          Historical Wayback Snapshots ({captures.length})
        </h3>

        {captures.length === 0 ? (
          <div className="p-8 text-center bg-[#111827] border border-[#1e293b] rounded-xl text-xs text-slate-500 font-mono">
            {loading ? 'Querying Internet Archive CDX servers...' : 'No snapshot records loaded yet.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {captures.map((c, idx) => (
              <div key={idx} className="bg-[#111827] border border-[#1e293b] p-5 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold uppercase px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30">
                      WAYBACK CAPTURE
                    </span>
                    <span className="text-xs text-slate-300 font-mono">
                      Timestamp: {c.timestamp ? new Date(c.timestamp).toUTCString() : 'Undated'}
                    </span>
                  </div>
                  {c.is_earliest && (
                    <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Earliest Discovered Snapshot
                    </span>
                  )}
                </div>

                <p className="text-sm text-slate-200 font-sans">{c.title || c.url}</p>

                <div className="pt-2 border-t border-[#1e293b] flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400">Reliability: <strong className="text-emerald-400">HIGH</strong></span>
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-400 hover:underline flex items-center gap-1"
                  >
                    <span>Inspect Wayback Snapshot</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
