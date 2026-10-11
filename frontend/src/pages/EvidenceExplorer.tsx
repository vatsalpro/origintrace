import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Filter,
  ArrowUpDown,
  LayoutGrid,
  Table as TableIcon,
  ExternalLink,
  Image as ImageIcon,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Layers,
  ChevronDown,
  ChevronUp,
  Info,
  CheckCircle2,
  X,
  FileCode,
  Copy,
  Check,
  EyeOff,
  Trash2
} from 'lucide-react';
import { api } from '../services/api';
import { EvidenceRecord, Investigation } from '../types';
import { SourceLinkActions } from '../components/SourceLinkActions';
import { MediaPreviewModal } from '../components/MediaPreviewModal';
import {
  cleanAndNormalizeUrl,
  classifyUrlType,
  safeOpenExternalUrl,
  extractDomain
} from '../utils/url';

interface EvidenceExplorerProps {
  investigationId?: string;
  investigation?: Investigation;
}

export const EvidenceExplorer: React.FC<EvidenceExplorerProps> = ({
  investigationId,
  investigation: propInvestigation
}) => {
  const [investigation, setInvestigation] = useState<Investigation | null>(
    propInvestigation || null
  );
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [strengthFilter, setStrengthFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'score_desc' | 'score_asc'>('score_desc');
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceRecord | null>(null);
  const [previewMediaUrl, setPreviewMediaUrl] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (investigationId) {
      setLoading(true);
      api.getInvestigation(investigationId)
        .then((data) => {
          setInvestigation(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [investigationId]);

  const rawEvidence = investigation?.evidence_records || [];

  // Filter and sort evidence
  const filteredEvidence = useMemo(() => {
    return rawEvidence
      .filter((ev) => {
        // Platform filter
        if (platformFilter !== 'all' && ev.source_platform !== platformFilter) {
          return false;
        }
        // Match strength filter
        if (strengthFilter !== 'all') {
          if (strengthFilter === 'strong' && ev.evidence_strength !== 'Strong match') return false;
          if (strengthFilter === 'probable' && ev.evidence_strength !== 'Probable match') return false;
          if (strengthFilter === 'possible' && ev.evidence_strength !== 'Possible match') return false;
        }
        // Text search filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchesTitle = (ev.title_or_caption || '').toLowerCase().includes(q);
          const matchesUrl = (ev.source_url || '').toLowerCase().includes(q);
          const matchesAuthor = (ev.author_name || ev.author_handle || '').toLowerCase().includes(q);
          const matchesSnippet = (ev.content_snippet || '').toLowerCase().includes(q);
          const matchesId = (ev.id || '').toLowerCase().includes(q);
          if (!matchesTitle && !matchesUrl && !matchesAuthor && !matchesSnippet && !matchesId) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'score_desc') {
          return (b.composite_score || 0) - (a.composite_score || 0);
        }
        if (sortBy === 'score_asc') {
          return (a.composite_score || 0) - (b.composite_score || 0);
        }
        const timeA = a.primary_timestamp ? new Date(a.primary_timestamp).getTime() : 0;
        const timeB = b.primary_timestamp ? new Date(b.primary_timestamp).getTime() : 0;
        if (sortBy === 'date_desc') {
          return timeB - timeA;
        }
        return timeA - timeB;
      });
  }, [rawEvidence, platformFilter, strengthFilter, searchQuery, sortBy]);

  const handleCopyHash = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const platforms = Array.from(new Set(rawEvidence.map((e) => e.source_platform)));

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Title & Controls Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
              EVIDENCE EXPLORER
            </span>
            <span className="text-xs font-mono text-slate-500">
              {investigationId || 'Active Workbench'}
            </span>
            {investigation?.is_incognito && (
              <span className="text-[11px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                <EyeOff className="w-3 h-3 text-purple-600" /> Incognito
              </span>
            )}
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Discovered Evidence Catalog
          </h2>
          <p className="text-xs text-slate-500 font-mono mt-0.5">
            Detailed tabular and card explorer with provenance verification, hashes, and verified source links
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                viewMode === 'table'
                  ? 'bg-white text-blue-700 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Table View</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                viewMode === 'cards'
                  ? 'bg-white text-blue-700 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Card Grid</span>
            </button>
          </div>
        </div>
      </div>

      {/* Incognito Notice Banner */}
      {investigation?.is_incognito && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-100 border border-purple-200 flex items-center justify-center shrink-0">
              <EyeOff className="w-5 h-5 text-purple-700" />
            </div>
            <div>
              <div className="text-xs font-bold text-purple-900 uppercase tracking-wider font-mono flex items-center gap-2">
                Incognito Investigation Mode
                <span className="text-[10px] bg-purple-200/70 text-purple-800 px-1.5 py-0.5 rounded font-sans font-semibold">
                  History Not Recorded
                </span>
              </div>
              <p className="text-xs text-purple-700 mt-0.5">
                This inquiry was run ephemerally. It is excluded from the permanent case list and dashboard analytics.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={async () => {
              if (window.confirm('Permanently purge this incognito investigation and associated records?')) {
                if (investigation.id) {
                  await api.deleteInvestigation(investigation.id);
                  window.location.href = '/dashboard';
                }
              }
            }}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-red-50 text-red-600 border border-red-200 hover:border-red-300 rounded-lg text-xs font-semibold font-mono transition shadow-xs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Purge Session Now
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Search Input */}
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by evidence ID, title, author, URL, or keywords..."
            className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white font-mono"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Platform Filter */}
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 font-mono focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Sources ({rawEvidence.length})</option>
            {platforms.map((p) => (
              <option key={p} value={p}>
                {p.toUpperCase()}
              </option>
            ))}
          </select>

          {/* Strength Filter */}
          <select
            value={strengthFilter}
            onChange={(e) => setStrengthFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 font-mono focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Strengths</option>
            <option value="strong">Strong Match</option>
            <option value="probable">Probable Match</option>
            <option value="possible">Possible Match</option>
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 font-mono focus:outline-none focus:border-blue-500"
          >
            <option value="score_desc">Score (Highest First)</option>
            <option value="score_asc">Score (Lowest First)</option>
            <option value="date_desc">Date (Newest First)</option>
            <option value="date_asc">Date (Oldest First)</option>
          </select>
        </div>
      </div>

      {/* Main Content Area */}
      {filteredEvidence.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400 font-mono text-xs space-y-3 shadow-xs">
          <Layers className="w-8 h-8 mx-auto text-slate-300" />
          <p className="font-semibold text-slate-600">No matching evidence records found.</p>
          <p className="text-[11px] text-slate-400">
            Try adjusting your search query, clearing filters, or launching an investigation.
          </p>
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE VIEW */
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="p-3.5">ID / Platform</th>
                  <th className="p-3.5">Evidence Title & Link</th>
                  <th className="p-3.5">Author / Origin</th>
                  <th className="p-3.5">Verified Date</th>
                  <th className="p-3.5">Similarity / Match</th>
                  <th className="p-3.5">Hashes</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredEvidence.map((ev) => {
                  const cleanWeb = cleanAndNormalizeUrl(ev.source_url);
                  const cleanMedia = cleanAndNormalizeUrl(ev.candidate_image_url);
                  const thumb = ev.candidate_thumbnail_path || ev.candidate_image_url;

                  return (
                    <tr
                      key={ev.id}
                      onClick={() => setSelectedEvidence(ev)}
                      className="hover:bg-blue-50/40 transition cursor-pointer"
                    >
                      {/* ID / Platform */}
                      <td className="p-3.5 space-y-1 align-top">
                        <span className="font-bold text-blue-700 block text-[11px]">
                          {ev.id}
                        </span>
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                          {ev.source_platform}
                        </span>
                      </td>

                      {/* Title & Link */}
                      <td className="p-3.5 max-w-xs space-y-1 align-top">
                        <div className="flex items-start gap-2">
                          {thumb && (
                            <img
                              src={thumb}
                              alt="thumbnail"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewMediaUrl(cleanMedia || thumb);
                              }}
                              className="w-10 h-10 rounded object-cover border border-slate-200 shrink-0 hover:opacity-80 transition cursor-zoom-in"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          )}
                          <div className="min-w-0">
                            {/* Source title clicks safely open source webpage */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                safeOpenExternalUrl(cleanWeb || cleanMedia, e);
                              }}
                              title="Click to open source webpage"
                              className="font-semibold text-slate-900 hover:text-blue-600 transition text-left line-clamp-2 block hover:underline"
                            >
                              {ev.title_or_caption || ev.source_url}
                            </button>
                            <span className="text-[10px] text-slate-400 block truncate">
                              {cleanWeb ? extractDomain(cleanWeb) : 'No web URL'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Author */}
                      <td className="p-3.5 text-slate-800 align-top">
                        <span className="font-medium block truncate max-w-[130px]">
                          {ev.author_name || ev.author_handle || 'Unknown / Unspecified'}
                        </span>
                        {ev.author_handle && ev.author_name && (
                          <span className="text-[10px] text-slate-400 block truncate">
                            {ev.author_handle}
                          </span>
                        )}
                      </td>

                      {/* Verified Date */}
                      <td className="p-3.5 align-top">
                        {ev.primary_timestamp ? (
                          <>
                            <span className="text-slate-800 font-semibold block">
                              {new Date(ev.primary_timestamp).toLocaleDateString()}
                            </span>
                            <span className="text-[10px] text-slate-400 uppercase block">
                              {ev.timestamp_type.replace('_', ' ')}
                            </span>
                          </>
                        ) : (
                          <span className="text-slate-400 italic">Unknown Date</span>
                        )}
                      </td>

                      {/* Similarity / Match */}
                      <td className="p-3.5 align-top space-y-1">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                            ev.evidence_strength === 'Strong match'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : ev.evidence_strength === 'Probable match'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {ev.evidence_strength}
                        </span>
                        <div className="text-[11px] text-slate-600">
                          Score: <strong>{Math.round((ev.composite_score || 0) * 100)}%</strong>
                          {ev.visual_similarity !== undefined && (
                            <span className="block text-[10px] text-blue-600">
                              Visual: {Math.round(ev.visual_similarity * 100)}%
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Hashes */}
                      <td className="p-3.5 align-top text-[10px] text-slate-500 space-y-0.5">
                        {ev.candidate_phash ? (
                          <div className="truncate max-w-[110px]" title={`pHash: ${ev.candidate_phash}`}>
                            pHash: <span className="font-bold text-slate-700">{ev.candidate_phash.slice(0, 8)}...</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">No hash</span>
                        )}
                        {ev.candidate_sha256 && (
                          <div className="truncate max-w-[110px]" title={`SHA256: ${ev.candidate_sha256}`}>
                            SHA: <span className="font-bold text-slate-700">{ev.candidate_sha256.slice(0, 8)}...</span>
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 align-top text-right shrink-0">
                        <div onClick={(e) => e.stopPropagation()} className="inline-block">
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
                            onPreviewMedia={(url) => setPreviewMediaUrl(url)}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* CARD GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredEvidence.map((ev) => {
            const cleanWeb = cleanAndNormalizeUrl(ev.source_url);
            const cleanMedia = cleanAndNormalizeUrl(ev.candidate_image_url);
            const thumb = ev.candidate_thumbnail_path || ev.candidate_image_url;

            return (
              <div
                key={ev.id}
                onClick={() => setSelectedEvidence(ev)}
                className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 hover:border-blue-400 hover:shadow-md transition cursor-pointer flex flex-col justify-between shadow-xs"
              >
                <div className="space-y-3">
                  {/* Top Bar */}
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-blue-700 font-bold">{ev.id}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                        ev.evidence_strength === 'Strong match'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : ev.evidence_strength === 'Probable match'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {ev.source_platform}
                    </span>
                  </div>

                  {/* Media Preview if available */}
                  {thumb && (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewMediaUrl(cleanMedia || thumb);
                      }}
                      className="w-full h-36 bg-slate-50 rounded-lg border border-slate-200 overflow-hidden flex items-center justify-center cursor-zoom-in group relative"
                    >
                      <img
                        src={thumb}
                        alt="Candidate preview"
                        className="max-h-full max-w-full object-contain group-hover:scale-105 transition"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                      <div className="absolute inset-0 bg-slate-900/10 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-mono">
                        Inspect Image
                      </div>
                    </div>
                  )}

                  {/* Title & Clickable Link */}
                  <div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        safeOpenExternalUrl(cleanWeb || cleanMedia, e);
                      }}
                      title="Click to open source webpage"
                      className="font-bold text-sm text-slate-900 hover:text-blue-600 transition text-left line-clamp-2 block hover:underline"
                    >
                      {ev.title_or_caption || ev.source_url}
                    </button>
                    <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                      {cleanWeb ? extractDomain(cleanWeb) : 'No accessible URL'}
                    </span>
                  </div>

                  {/* Snippet */}
                  {ev.content_snippet && (
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-200 font-sans">
                      {ev.content_snippet}
                    </p>
                  )}

                  {/* Metrics Row */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-1 text-slate-600">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase block">Verified Date:</span>
                      <span className="text-slate-800 font-semibold">
                        {ev.primary_timestamp ? new Date(ev.primary_timestamp).toLocaleDateString() : 'Unknown'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase block">Composite Match:</span>
                      <span className="text-blue-700 font-semibold">
                        {Math.round((ev.composite_score || 0) * 100)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="pt-3 border-t border-slate-100 flex items-center justify-between"
                >
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
                    onPreviewMedia={(url) => setPreviewMediaUrl(url)}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedEvidence(ev);
                    }}
                    className="text-xs font-mono text-slate-500 hover:text-slate-900 transition underline"
                  >
                    Details
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detailed Evidence Inspector Modal / Drawer */}
      {selectedEvidence && (
        <div
          onClick={() => setSelectedEvidence(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150 select-none"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl relative text-slate-800 max-h-[90vh] overflow-y-auto"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold uppercase px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                  {selectedEvidence.source_platform}
                </span>
                <h3 className="text-sm font-bold text-slate-900">
                  Evidence Inspector: {selectedEvidence.id}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEvidence(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Core Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase block">Source Webpage URL</span>
                <span className="text-slate-900 break-all select-all font-semibold block">
                  {selectedEvidence.source_url || 'Unknown / Not provided'}
                </span>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase block">Direct Media URL</span>
                <span className="text-slate-900 break-all select-all font-semibold block">
                  {selectedEvidence.candidate_image_url || 'Unknown / No direct image'}
                </span>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase block">Discovery Time</span>
                <span className="text-slate-800 block">
                  {selectedEvidence.retrieved_at ? new Date(selectedEvidence.retrieved_at).toUTCString() : 'Unknown'}
                </span>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase block">Verified Published / Capture Date</span>
                <span className="text-emerald-700 font-bold block">
                  {selectedEvidence.primary_timestamp ? new Date(selectedEvidence.primary_timestamp).toUTCString() : 'Unknown / Undated'}
                </span>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase block">Perceptual Hash (pHash)</span>
                <span className="text-slate-900 font-mono select-all block">
                  {selectedEvidence.candidate_phash || 'Unknown / Not calculated'}
                </span>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase block">Cryptographic SHA-256</span>
                <span className="text-slate-900 font-mono select-all block">
                  {selectedEvidence.candidate_sha256 || 'Unknown / Not calculated'}
                </span>
              </div>
            </div>

            {/* Explanation & Technical Notes */}
            {selectedEvidence.explanation && (
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-1 text-xs">
                <span className="text-[10px] text-slate-500 uppercase font-mono block">
                  Forensic Explanation & Signal Breakdown
                </span>
                <p className="text-slate-700 leading-relaxed font-sans">
                  {selectedEvidence.explanation}
                </p>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200 text-xs font-mono">
              <SourceLinkActions
                sourceUrl={selectedEvidence.source_url}
                sourceTitle={selectedEvidence.title_or_caption}
                sourcePlatform={selectedEvidence.source_platform}
                candidateImageUrl={selectedEvidence.candidate_image_url}
                candidateThumbnailUrl={selectedEvidence.candidate_thumbnail_path}
                sourceDomain={selectedEvidence.source_domain}
                fallbackSearchUrl={selectedEvidence.fallback_search_url}
                fallbackQuery={selectedEvidence.fallback_query}
                urlType={selectedEvidence.url_type}
                isDirectImage={selectedEvidence.is_direct_image}
                accessStatus={selectedEvidence.access_status}
                onPreviewMedia={(url) => setPreviewMediaUrl(url)}
              />
              <button
                type="button"
                onClick={() => setSelectedEvidence(null)}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox / Media Preview Modal */}
      {previewMediaUrl && (
        <MediaPreviewModal
          mediaUrl={previewMediaUrl}
          title="Discovered Candidate Asset"
          onClose={() => setPreviewMediaUrl(null)}
        />
      )}
    </div>
  );
};
