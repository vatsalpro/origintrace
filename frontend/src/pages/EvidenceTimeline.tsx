import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  AlertTriangle,
  Calendar,
  Filter,
  Archive,
  Info,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Cpu,
  Database,
  AlertCircle,
  Shield
} from 'lucide-react';
import { api } from '../services/api';
import { TimelineEvent, TimelineResponse } from '../types';
import { SourceLinkActions } from '../components/SourceLinkActions';
import { safeOpenExternalUrl } from '../utils/url';
import { MediaPreviewModal } from '../components/MediaPreviewModal';

interface EvidenceTimelineProps {
  investigationId?: string;
}

type EventCategoryFilter = 'all' | 'source_publication' | 'archive_capture' | 'evidence_collection' | 'processing' | 'provenance' | 'undated';

export const EvidenceTimeline: React.FC<EvidenceTimelineProps> = ({ investigationId }) => {
  const [timelineData, setTimelineData] = useState<TimelineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<EventCategoryFilter>('all');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [strengthFilter, setStrengthFilter] = useState<string>('all');

  // Expanded card state
  const [expandedEventIds, setExpandedEventIds] = useState<Set<string>>(new Set());
  const [previewMedia, setPreviewMedia] = useState<{ url: string; title: string } | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedEventIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const fetchTimeline = useCallback(() => {
    if (!investigationId) {
      setLoading(false);
      setTimelineData(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    api
      .getInvestigationTimeline(investigationId)
      .then((data) => {
        setTimelineData(data);
        setLoading(false);
      })
      .catch((err: any) => {
        setError(err.message || 'Failed to retrieve timeline data from backend API');
        setLoading(false);
      });
  }, [investigationId]);

  useEffect(() => {
    setExpandedEventIds(new Set());
    setCategoryFilter('all');
    fetchTimeline();
  }, [investigationId, fetchTimeline]);

  if (!investigationId) {
    return (
      <div className="p-12 text-center text-slate-500 font-mono bg-white border border-slate-200 rounded-2xl m-8 shadow-xs">
        <Clock className="w-10 h-10 mx-auto text-slate-400 mb-3" />
        <h3 className="text-base font-semibold text-slate-900">No Investigation Selected</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
          Please select an investigation from the header or initiate a new case to inspect its chronological timeline.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-16 text-center text-blue-600 font-mono flex flex-col items-center justify-center gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
        <span className="text-sm font-semibold text-slate-900">Reconstructing chronological provenance timeline...</span>
        <span className="text-xs text-slate-500">Case ID: {investigationId}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="p-6 rounded-xl bg-red-50 border border-red-200 text-red-700 space-y-4 shadow-xs">
          <div className="flex items-center gap-2.5 font-bold text-base text-red-800">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <span>Timeline API Request Failed</span>
          </div>
          <p className="text-xs font-mono text-slate-700">
            {error}
          </p>
          <button
            onClick={fetchTimeline}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-xs flex items-center gap-1.5 transition shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Request</span>
          </button>
        </div>
      </div>
    );
  }

  const rawDatedEvents: TimelineEvent[] = timelineData?.timeline_events || [];
  const rawUndatedEvents: TimelineEvent[] = timelineData?.undated_events || [];
  const collectionEvents: TimelineEvent[] = timelineData?.collection_events || [];
  const sourceEvents: TimelineEvent[] = timelineData?.source_events || [];
  const processingEvents: TimelineEvent[] = timelineData?.processing_events || [];
  const earliestRef = timelineData?.earliest_discovered_reference;
  const warnings = timelineData?.warnings || [];

  // Determine current active event pool based on categoryFilter
  let poolEvents: TimelineEvent[] = [];
  if (categoryFilter === 'all') {
    poolEvents = rawDatedEvents;
  } else if (categoryFilter === 'source_publication') {
    poolEvents = rawDatedEvents.filter((ev) => ev.event_type === 'source_publication');
  } else if (categoryFilter === 'archive_capture') {
    poolEvents = rawDatedEvents.filter((ev) => ev.event_type === 'archive_capture');
  } else if (categoryFilter === 'evidence_collection') {
    poolEvents = rawDatedEvents.filter((ev) => ev.event_type === 'evidence_collection');
  } else if (categoryFilter === 'provenance') {
    poolEvents = rawDatedEvents.filter((ev) => ev.event_type === 'provenance_verification');
  } else if (categoryFilter === 'processing') {
    poolEvents = rawDatedEvents.filter((ev) => ev.event_type === 'processing');
  } else if (categoryFilter === 'undated') {
    poolEvents = rawUndatedEvents;
  }

  // Filter events by platform and strength
  const filteredEvents = poolEvents.filter((ev) => {
    if (platformFilter !== 'all' && ev.platform !== platformFilter) return false;
    if (strengthFilter !== 'all' && ev.evidence_strength !== strengthFilter) return false;
    return true;
  });

  const formatEventDate = (ts?: string) => {
    if (!ts) return 'Undated Evidence';
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return ts;
      return d.toUTCString();
    } catch {
      return ts;
    }
  };

  const getEventBadge = (ev: TimelineEvent) => {
    switch (ev.event_type) {
      case 'provenance_verification':
        return {
          label: 'C2PA Content Credentials Assertion',
          color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          icon: Shield
        };
      case 'source_publication':
        return {
          label: 'Source Publication',
          color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          icon: Calendar
        };
      case 'archive_capture':
        return {
          label: 'Wayback Archive Snapshot',
          color: 'bg-blue-50 text-blue-700 border-blue-200',
          icon: Archive
        };
      case 'evidence_collection':
        return {
          label: 'Evidence Collected by OriginTrace',
          color: 'bg-amber-50 text-amber-800 border-amber-200',
          icon: Database
        };
      case 'processing':
        return {
          label: 'System Processing Event',
          color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          icon: Cpu
        };
      default:
        return {
          label: 'Undated Evidence',
          color: 'bg-slate-100 text-slate-700 border-slate-200',
          icon: Info
        };
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      {/* Page Title & Top Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Chronological Evidence Timeline</h2>
          <p className="text-sm text-slate-500 font-mono mt-1">
            Case {investigationId} — Chronological temporal provenance sequence across verified sources & archives
          </p>
        </div>

        <button
          onClick={fetchTimeline}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-mono font-semibold transition self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          <span>Refresh Timeline</span>
        </button>
      </div>

      {/* Structured Forensic Warnings & Guidance Banner */}
      {warnings.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-2 text-xs font-mono">
          <div className="flex items-center gap-2 text-amber-800 font-bold">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>Forensic Provenance & Timestamp Transparency Notices</span>
          </div>
          <ul className="list-disc list-inside text-slate-700 space-y-1 pl-1">
            {warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Earliest Discovered Reference Callout */}
      {earliestRef && (
        <div className="p-5 rounded-xl bg-gradient-to-r from-blue-50/90 via-indigo-50/40 to-white border-2 border-blue-400 relative overflow-hidden shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-blue-700">
                  Earliest Discovered Matching Reference
                </span>
              </div>
              <h3
                onClick={() => earliestRef.url && safeOpenExternalUrl(earliestRef.url, earliestRef.title)}
                className={`text-lg font-bold text-slate-900 pt-1 ${
                  earliestRef.url ? 'hover:text-blue-600 hover:underline cursor-pointer' : ''
                }`}
              >
                {earliestRef.title || earliestRef.url}
              </h3>
              <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-600 pt-1">
                <span>Platform: <strong className="text-blue-700">{earliestRef.platform.toUpperCase()}</strong></span>
                <span>Date: <strong className="text-emerald-700">{formatEventDate(earliestRef.timestamp)}</strong></span>
                <span>Type: <strong className="text-slate-800">{earliestRef.timestamp_type.replace('_', ' ').toUpperCase()}</strong></span>
                <span>Reliability: <strong className="text-slate-800">{earliestRef.reliability.toUpperCase()}</strong></span>
              </div>
              {earliestRef.ambiguity_notes && (
                <p className="text-xs text-slate-600 italic pt-2">
                  Notice: {earliestRef.ambiguity_notes}
                </p>
              )}
            </div>

            <div className="shrink-0 pt-1">
              <SourceLinkActions
                sourceUrl={earliestRef.url}
                sourceTitle={earliestRef.title}
                sourcePlatform={earliestRef.platform}
                candidateImageUrl={earliestRef.candidate_image_url}
                sourceDomain={earliestRef.source_domain}
                fallbackSearchUrl={earliestRef.fallback_search_url}
              />
            </div>
          </div>
        </div>
      )}

      {/* Category Tabs & Filter Toolbar */}
      <div className="space-y-3">
        {/* Category Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3 text-xs font-mono">
          {[
            { id: 'all', label: 'All Dated Events', count: rawDatedEvents.length },
            { id: 'source_publication', label: 'Source Publications', count: sourceEvents.length },
            { id: 'archive_capture', label: 'Wayback Captures', count: rawDatedEvents.filter(e => e.event_type === 'archive_capture').length },
            { id: 'provenance', label: 'C2PA Credentials', count: rawDatedEvents.filter(e => e.event_type === 'provenance_verification').length },
            { id: 'evidence_collection', label: 'Collected by OriginTrace', count: collectionEvents.length },
            { id: 'processing', label: 'Processing Logs', count: processingEvents.length },
            { id: 'undated', label: 'Undated Evidence', count: rawUndatedEvents.length },
          ].map((tab) => {
            const active = categoryFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setCategoryFilter(tab.id as EventCategoryFilter)}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 border transition ${
                  active
                    ? 'bg-blue-50 text-blue-700 border-blue-300 font-bold shadow-2xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`px-1.5 py-0.2 rounded text-[10px] ${active ? 'bg-blue-200/70 text-blue-800' : 'bg-slate-100 text-slate-600'}`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Secondary Sub-Filters (Platform & Match Strength) */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 p-3 rounded-xl text-xs font-mono shadow-xs">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-slate-500">
              <Filter className="w-3.5 h-3.5" />
              <span>Platform:</span>
              <select
                value={platformFilter}
                onChange={(e) => setPlatformFilter(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-slate-800 text-xs focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Sources</option>
                <option value="reverse_image">Reverse Image (Google Lens)</option>
                <option value="openverse">Openverse Discovery</option>
                <option value="c2pa">C2PA Credentials</option>
                <option value="wayback">Wayback Machine</option>
                <option value="mastodon">Mastodon</option>
                <option value="bluesky">Bluesky</option>
                <option value="web">Web Discovery</option>
                <option value="system">OriginTrace System</option>
                <option value="camera_hardware">Camera Hardware</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-slate-500">
              <span>Match Strength:</span>
              <select
                value={strengthFilter}
                onChange={(e) => setStrengthFilter(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-slate-800 text-xs focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Strengths</option>
                <option value="Strong match">Strong Match</option>
                <option value="Probable match">Probable Match</option>
                <option value="Possible match">Possible Match</option>
                <option value="Inconclusive">Inconclusive</option>
                <option value="System event">System Event</option>
              </select>
            </div>
          </div>

          <div className="text-slate-500 text-[11px]">
            Showing <strong className="text-slate-900">{filteredEvents.length}</strong> of {poolEvents.length} events
          </div>
        </div>
      </div>

      {/* Main Chronological Timeline Sequence */}
      <div className="space-y-6 relative before:absolute before:inset-0 before:left-6 before:w-0.5 before:bg-slate-200">
        {filteredEvents.length === 0 ? (
          <div className="p-12 text-center bg-white border border-slate-200 rounded-xl text-slate-500 font-mono space-y-2 shadow-xs">
            <Clock className="w-8 h-8 mx-auto text-slate-400 mb-2" />
            <h4 className="text-sm font-semibold text-slate-900">No Events Found for Selected Criteria</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {rawDatedEvents.length === 0 && rawUndatedEvents.length === 0
                ? 'No evidence records or execution logs are associated with this investigation.'
                : 'Try switching the category tab above to "All Dated Events", "Collected by OriginTrace", or "Undated Evidence".'}
            </p>
          </div>
        ) : (
          filteredEvents.map((ev, index) => {
            const isEarliest = ev.is_earliest;
            const isExpanded = expandedEventIds.has(ev.id);
            const dateStr = formatEventDate(ev.event_timestamp || ev.timestamp);
            const badge = getEventBadge(ev);
            const BadgeIcon = badge.icon;
            const candidateImg = ev.candidate_image_url || (ev.media_urls && ev.media_urls[0]);

            return (
              <div key={ev.id || index} className="relative flex items-start gap-6 group">
                {/* Node Anchor Icon */}
                <div
                  className={`w-12 h-12 rounded-full border-2 flex items-center justify-center shrink-0 z-10 transition shadow-sm ${
                    isEarliest
                      ? 'bg-blue-600 border-blue-400 text-white shadow-blue-500/20'
                      : ev.event_type === 'provenance_verification'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                      : ev.event_type === 'processing'
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                      : ev.event_type === 'evidence_collection'
                      ? 'bg-amber-50 border-amber-300 text-amber-800'
                      : 'bg-white border-slate-300 text-slate-600 group-hover:border-blue-400'
                  }`}
                >
                  <BadgeIcon className="w-5 h-5" />
                </div>

                {/* Event Card */}
                <div
                  className={`flex-1 bg-white border p-5 rounded-xl space-y-3 transition shadow-xs ${
                    isEarliest
                      ? 'border-blue-400 shadow-sm shadow-blue-500/10'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* Card Header: Platform, Type Badge, and Date */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-blue-700 border border-slate-200">
                        {ev.platform.replace('_', ' ')}
                      </span>

                      <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border flex items-center gap-1 ${badge.color}`}>
                        <BadgeIcon className="w-3 h-3" />
                        <span>{badge.label}</span>
                      </span>

                      {isEarliest && (
                        <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Earliest Discovered
                        </span>
                      )}
                    </div>

                    <div className="text-xs font-mono text-slate-600 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{dateStr}</span>
                    </div>
                  </div>

                  {/* Card Body: Title, Author, Thumbnail, Explanation */}
                  <div className="flex flex-col sm:flex-row gap-4">
                    {/* Candidate Preview Thumbnail (if media available) */}
                    {candidateImg && (
                      <div
                        onClick={() => setPreviewMedia({ url: candidateImg, title: ev.title })}
                        className="w-24 h-24 rounded-lg bg-slate-50 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-blue-400 hover:opacity-90 transition group/thumb relative"
                        title="Click to preview candidate media"
                      >
                        <img
                          src={
                            ev.evidence_id
                              ? api.getCandidateImageUrl(investigationId, ev.evidence_id)
                              : candidateImg
                          }
                          alt="Candidate Evidence"
                          className="max-h-full max-w-full object-cover transition duration-150 group-hover/thumb:scale-105"
                          onError={(e) => {
                            if (candidateImg) {
                              (e.target as HTMLImageElement).src = candidateImg;
                            }
                          }}
                        />
                      </div>
                    )}

                    <div className="flex-1 space-y-1">
                      <h4
                        onClick={() => ev.url && safeOpenExternalUrl(ev.url, ev.title)}
                        className={`text-base font-semibold text-slate-900 ${
                          ev.url ? 'hover:text-blue-600 hover:underline cursor-pointer' : ''
                        }`}
                        title={ev.url ? `Open source: ${ev.url}` : undefined}
                      >
                        {ev.title}
                      </h4>

                      {ev.author && (
                        <p className="text-xs text-slate-500 font-mono">
                          Author/Publisher: <span className="text-slate-800 font-semibold">{ev.author}</span>
                        </p>
                      )}

                      {/* Uncertainty / Provenance Callout */}
                      {ev.uncertainty && (
                        <div className="p-2.5 rounded bg-amber-50 border border-amber-200 text-xs font-mono text-slate-700 mt-2">
                          <span className="text-amber-800 font-semibold block mb-0.5">Forensic Provenance Note:</span>
                          <span>{ev.uncertainty}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Summary Metric Chips */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
                    <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-slate-500">
                      {ev.evidence_strength && (
                        <span>Match: <strong className="text-slate-800">{ev.evidence_strength}</strong></span>
                      )}
                      {ev.composite_score !== undefined && ev.event_type !== 'processing' && (
                        <span>Score: <strong className="text-slate-800">{Math.round((ev.composite_score || 0) * 100)}%</strong></span>
                      )}
                      {ev.visual_similarity !== undefined && (
                        <span className="text-blue-700">
                          Visual Match: <strong>{Math.round(ev.visual_similarity * 100)}%</strong>
                        </span>
                      )}
                      <span>Reliability: <strong className="text-slate-800">{ev.reliability.toUpperCase()}</strong></span>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Expand / Collapse Details Button */}
                      <button
                        onClick={() => toggleExpand(ev.id)}
                        className="text-xs font-mono text-slate-500 hover:text-slate-900 flex items-center gap-1 transition"
                      >
                        <span>{isExpanded ? 'Hide Details' : 'Inspect Details'}</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>

                      {/* External Source Link & Search Fallback */}
                      <SourceLinkActions
                        sourceUrl={ev.url}
                        sourceTitle={ev.title}
                        sourcePlatform={ev.platform}
                        candidateImageUrl={ev.candidate_image_url}
                        candidateThumbnailUrl={ev.candidate_thumbnail_path}
                        sourceDomain={ev.source_domain}
                        fallbackSearchUrl={ev.fallback_search_url}
                        fallbackQuery={ev.fallback_query}
                        urlType={ev.url_type}
                        isDirectImage={ev.is_direct_image}
                        searchProvider={ev.search_provider}
                        discoveryMethod={ev.discovery_method}
                        accessStatus={ev.access_status}
                      />
                    </div>
                  </div>

                  {/* Expandable Deep Forensic Details */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-slate-200 space-y-3 font-mono text-xs text-slate-700 bg-slate-50 p-4 rounded-lg">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <span className="text-slate-500 uppercase text-[10px] block">Evidence Reference ID</span>
                          <span className="text-slate-900 font-semibold">{ev.evidence_id || ev.id}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 uppercase text-[10px] block">Timestamp Provenance</span>
                          <span className="text-blue-700 font-semibold">{ev.timestamp_provenance || 'System Log'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 uppercase text-[10px] block">Publication / Attributable Time</span>
                          <span className="text-slate-800">{ev.published_at ? formatEventDate(ev.published_at) : 'None Recorded'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 uppercase text-[10px] block">OriginTrace Collection Time</span>
                          <span className="text-slate-800">{ev.retrieved_at ? formatEventDate(ev.retrieved_at) : 'None Recorded'}</span>
                        </div>
                      </div>

                      {ev.explanation && (
                        <div className="pt-2 border-t border-slate-200">
                          <span className="text-slate-500 uppercase text-[10px] block mb-1">Detailed Technical Explanation</span>
                          <p className="text-slate-700 text-xs leading-relaxed">{ev.explanation}</p>
                        </div>
                      )}

                      {ev.url && (
                        <div className="pt-2 border-t border-slate-200">
                          <span className="text-slate-500 uppercase text-[10px] block mb-1">Direct Source URL</span>
                          <a
                            href={ev.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline break-all"
                          >
                            {ev.url}
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Dedicated Undated Evidence Section (always visible when undated events exist and not already filtered to it) */}
      {rawUndatedEvents.length > 0 && categoryFilter !== 'undated' && (
        <div className="pt-8 border-t border-slate-200 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
              <Info className="w-5 h-5 text-amber-600" />
              <span>Undated Evidence Candidates ({rawUndatedEvents.length})</span>
            </div>
            <button
              onClick={() => setCategoryFilter('undated')}
              className="text-xs font-mono text-blue-600 hover:underline flex items-center gap-1 font-semibold"
            >
              <span>View in Timeline Mode</span>
            </button>
          </div>

          <p className="text-xs font-mono text-slate-500 leading-relaxed">
            The following evidence candidates were discovered across searched platforms and reverse-image engines, but lack identifiable publication or archive timestamp metadata. To maintain forensic completeness, they are accounted for below:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
            {rawUndatedEvents.slice(0, 6).map((ue) => (
              <div key={ue.id} className="bg-white border border-slate-200 p-4 rounded-xl space-y-2 flex flex-col justify-between shadow-xs">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold border border-blue-200">
                      {ue.platform}
                    </span>
                    <span className="text-[10px] text-slate-400">ID: {ue.evidence_id?.slice(0, 8)}</span>
                  </div>
                  <h5
                    onClick={() => ue.url && safeOpenExternalUrl(ue.url, ue.title)}
                    className={`text-sm font-semibold text-slate-900 truncate pt-1 ${
                      ue.url ? 'hover:text-blue-600 hover:underline cursor-pointer' : ''
                    }`}
                    title={ue.url ? `Open source: ${ue.url}` : undefined}
                  >
                    {ue.title}
                  </h5>
                  {ue.author && <p className="text-slate-500 text-[11px]">Source: {ue.author}</p>}
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-amber-700 font-semibold">No verifiable publication date</span>
                  <SourceLinkActions
                    sourceUrl={ue.url}
                    sourceTitle={ue.title}
                    sourcePlatform={ue.platform}
                    candidateImageUrl={ue.candidate_image_url}
                    candidateThumbnailUrl={ue.candidate_thumbnail_path}
                    sourceDomain={ue.source_domain}
                    fallbackSearchUrl={ue.fallback_search_url}
                    fallbackQuery={ue.fallback_query}
                    urlType={ue.url_type}
                    isDirectImage={ue.is_direct_image}
                    compact={true}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Media Lightbox Preview Modal */}
      <MediaPreviewModal
        mediaUrl={previewMedia?.url || null}
        title={previewMedia?.title}
        onClose={() => setPreviewMedia(null)}
      />
    </div>
  );
};
