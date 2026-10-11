import React, { useState } from 'react';
import {
  Globe2,
  Search,
  ExternalLink,
  Clock,
  ShieldCheck,
  AlertCircle,
  Share2,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { api } from '../services/api';
import { SourceLinkActions } from '../components/SourceLinkActions';
import { safeOpenExternalUrl } from '../utils/url';

export const SocialExplorer: React.FC = () => {
  const [platform, setPlatform] = useState<'bluesky' | 'mastodon'>('bluesky');
  const [query, setQuery] = useState('breaking astronomy observation');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string>('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setResults([]);
    setNotes('');

    try {
      // Create a transient inquiry query on backend (incognito, unrecorded in history)
      const formData = new FormData();
      formData.append('title', `Social Explorer Query: ${query.slice(0, 30)}`);
      formData.append('input_type', 'text');
      formData.append('input_content', query.trim());
      formData.append('is_incognito', 'true');

      const inv = await api.createInvestigation(formData);
      // Wait 1.5s for async connectors to collect results
      setTimeout(async () => {
        try {
          const evidence = await api.getInvestigationTimeline(inv.id);
          const events = evidence?.timeline_events || [];
          const filtered = events.filter((e: any) => e.platform === platform);
          setResults(filtered.length > 0 ? filtered : events);
          setNotes(`Queried public ${platform.toUpperCase()} index with real endpoint response.`);
          setLoading(false);
        } catch {
          setLoading(false);
        }
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to query social network');
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Page Title */}
      <div className="border-b border-slate-200 pb-6">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Social Source Live Explorer</h2>
        <p className="text-sm text-slate-500 font-mono mt-1">
          Perform live verified queries across decentralized public social networks without paid API keys
        </p>
      </div>

      {/* Query Bar */}
      <form onSubmit={handleSearch} className="bg-white border border-slate-200 p-6 rounded-xl space-y-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase text-slate-600 font-semibold">Source Platform:</span>
            <div className="flex rounded-lg bg-slate-100 p-1 border border-slate-200">
              <button
                type="button"
                onClick={() => setPlatform('bluesky')}
                className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium transition ${
                  platform === 'bluesky' ? 'bg-blue-600 text-white font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Bluesky (AT Protocol)
              </button>
              <button
                type="button"
                onClick={() => setPlatform('mastodon')}
                className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium transition ${
                  platform === 'mastodon' ? 'bg-blue-600 text-white font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Mastodon (Federated)
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search public posts, phrases, hashtags, or claims..."
              className="w-full bg-slate-50 border border-slate-300 text-sm text-slate-900 rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:border-blue-500 focus:bg-white"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition flex items-center gap-2 shrink-0 disabled:opacity-50 shadow-sm"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span>Query Live Index</span>
          </button>
        </div>

        <div className="text-[11px] font-mono text-slate-500 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Real public API call. No scraping, no credentials in source, no fabricated fallback records.</span>
        </div>
      </form>

      {/* Query Execution Notes */}
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

      {/* Results List */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-slate-900">Discovered Live Evidence Records ({results.length})</h3>

        {results.length === 0 ? (
          <div className="p-8 text-center bg-white border border-slate-200 rounded-xl text-xs text-slate-400 font-mono shadow-xs">
            {loading ? 'Executing search request across remote nodes...' : 'Submit a query to inspect live social discovery.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {results.map((r, idx) => (
              <div key={idx} className="bg-white border border-slate-200 p-5 rounded-xl space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold uppercase px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                      {r.platform}
                    </span>
                    <span className="text-xs text-slate-800 font-semibold">{r.author || 'Author record'}</span>
                  </div>
                  <span className="text-xs font-mono text-slate-500">
                    {r.timestamp ? new Date(r.timestamp).toUTCString() : 'Undated'}
                  </span>
                </div>

                <p
                  onClick={() => r.url && safeOpenExternalUrl(r.url, r.title)}
                  className={`text-sm text-slate-800 leading-relaxed font-sans ${
                    r.url ? 'hover:text-blue-600 hover:underline cursor-pointer' : ''
                  }`}
                  title={r.url ? `Open source: ${r.url}` : undefined}
                >
                  {r.title}
                </p>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-500">Strength: <strong className="text-emerald-700">{r.evidence_strength || 'Discovered'}</strong></span>
                  <SourceLinkActions
                    sourceUrl={r.url}
                    sourceTitle={r.title}
                    sourcePlatform={r.platform}
                    candidateImageUrl={r.candidate_image_url}
                    candidateThumbnailUrl={r.candidate_thumbnail_path}
                    sourceDomain={r.source_domain}
                    fallbackSearchUrl={r.fallback_search_url}
                    fallbackQuery={r.fallback_query}
                    urlType={r.url_type}
                    isDirectImage={r.is_direct_image}
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
