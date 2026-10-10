import React, { useState, useEffect } from 'react';
import {
  Clock,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Calendar,
  Filter,
  CheckCircle,
  Archive,
  Info
} from 'lucide-react';
import { api } from '../services/api';
import { TimelineEvent } from '../types';

interface EvidenceTimelineProps {
  investigationId?: string;
}

export const EvidenceTimeline: React.FC<EvidenceTimelineProps> = ({ investigationId }) => {
  const [timelineData, setTimelineData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [strengthFilter, setStrengthFilter] = useState<string>('all');

  useEffect(() => {
    if (!investigationId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .getInvestigationTimeline(investigationId)
      .then((data) => {
        setTimelineData(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [investigationId]);

  if (!investigationId) {
    return (
      <div className="p-12 text-center text-slate-400 font-mono">
        Please select or start an investigation to inspect its chronological timeline.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-12 text-center text-sky-400 font-mono flex items-center justify-center gap-2">
        <Clock className="w-5 h-5 animate-spin" />
        <span>Reconstructing chronological provenance timeline...</span>
      </div>
    );
  }

  const rawEvents: TimelineEvent[] = timelineData?.timeline_events || [];
  const earliestRef = timelineData?.earliest_discovered_reference;

  // Filter events
  const filteredEvents = rawEvents.filter((ev) => {
    if (platformFilter !== 'all' && ev.platform !== platformFilter) return false;
    if (strengthFilter !== 'all' && ev.evidence_strength !== strengthFilter) return false;
    return true;
  });

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      {/* Page Title & Context */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1e293b] pb-6">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Chronological Evidence Timeline</h2>
          <p className="text-sm text-slate-400 font-mono mt-1">
            Case {investigationId} — Temporal provenance sequence across verified sources & archives
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
            <Filter className="w-3.5 h-3.5" />
            <span>Platform:</span>
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="bg-[#182235] border border-[#1e293b] rounded px-2 py-1 text-slate-200 text-xs"
            >
              <option value="all">All</option>
              <option value="mastodon">Mastodon</option>
              <option value="bluesky">Bluesky</option>
              <option value="wayback">Wayback Machine</option>
              <option value="reddit">Reddit</option>
              <option value="youtube">YouTube</option>
              <option value="web">Web</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
            <span>Match:</span>
            <select
              value={strengthFilter}
              onChange={(e) => setStrengthFilter(e.target.value)}
              className="bg-[#182235] border border-[#1e293b] rounded px-2 py-1 text-slate-200 text-xs"
            >
              <option value="all">All</option>
              <option value="Strong match">Strong Match</option>
              <option value="Probable match">Probable Match</option>
              <option value="Possible match">Possible Match</option>
            </select>
          </div>
        </div>
      </div>

      {/* Earliest Discovered Reference Callout */}
      {earliestRef && (
        <div className="p-5 rounded-xl bg-gradient-to-r from-sky-950/60 to-[#111827] border-2 border-sky-500/40 relative overflow-hidden">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-sky-400">
                  Earliest Discovered Matching Reference
                </span>
              </div>
              <h3 className="text-lg font-bold text-white pt-1">
                {earliestRef.title || earliestRef.url}
              </h3>
              <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-300 pt-1">
                <span>Platform: <strong className="text-sky-300">{earliestRef.platform.toUpperCase()}</strong></span>
                <span>Date: <strong className="text-emerald-400">{new Date(earliestRef.timestamp).toUTCString()}</strong></span>
                <span>Type: <strong className="text-slate-300">{earliestRef.timestamp_type.replace('_', ' ').toUpperCase()}</strong></span>
                <span>Reliability: <strong className="text-slate-300">{earliestRef.reliability.toUpperCase()}</strong></span>
              </div>
              {earliestRef.ambiguity_notes && (
                <p className="text-xs text-slate-400 italic pt-2">
                  Notice: {earliestRef.ambiguity_notes}
                </p>
              )}
            </div>

            <a
              href={earliestRef.url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5 shrink-0 transition"
            >
              <span>Inspect Source</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      )}

      {/* Chronological Timeline Sequence */}
      <div className="space-y-6 relative before:absolute before:inset-0 before:left-6 before:w-0.5 before:bg-[#1e293b]">
        {filteredEvents.length === 0 ? (
          <div className="p-8 text-center bg-[#111827] border border-[#1e293b] rounded-xl text-xs text-slate-400 font-mono">
            No matching events found for current filter criteria.
          </div>
        ) : (
          filteredEvents.map((ev, index) => {
            const isEarliest = ev.is_earliest;
            const dateStr = new Date(ev.timestamp).toUTCString();

            return (
              <div key={ev.id || index} className="relative flex items-start gap-6 group">
                {/* Node Anchor */}
                <div
                  className={`w-12 h-12 rounded-full border-2 flex items-center justify-center shrink-0 z-10 transition shadow-lg ${
                    isEarliest
                      ? 'bg-sky-500 border-sky-300 text-slate-950 shadow-sky-500/30'
                      : 'bg-[#182235] border-[#1e293b] text-slate-300 group-hover:border-sky-500/50'
                  }`}
                >
                  {ev.platform === 'wayback' ? (
                    <Archive className="w-5 h-5" />
                  ) : (
                    <Clock className="w-5 h-5" />
                  )}
                </div>

                {/* Event Card */}
                <div
                  className={`flex-1 bg-[#111827] border p-5 rounded-xl space-y-3 transition ${
                    isEarliest
                      ? 'border-sky-500/50 shadow-md shadow-sky-500/10'
                      : 'border-[#1e293b] hover:border-slate-700'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold uppercase px-2 py-0.5 rounded bg-[#182235] text-sky-400 border border-[#1e293b]">
                        {ev.platform}
                      </span>
                      {isEarliest && (
                        <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          Earliest Reference
                        </span>
                      )}
                      <span className="text-xs font-mono text-slate-400">
                        {ev.timestamp_type === 'archive_capture' ? 'Wayback Snapshot' : 'Publication Time'}
                      </span>
                    </div>

                    <div className="text-xs font-mono text-slate-400">
                      {dateStr}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-base font-semibold text-white">{ev.title}</h4>
                    {ev.author && (
                      <p className="text-xs text-slate-400 font-mono mt-0.5">Author/Publisher: {ev.author}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#1e293b] text-xs">
                    <div className="flex items-center gap-3 font-mono text-[11px] text-slate-400">
                      <span>Match: <strong className="text-slate-200">{ev.evidence_strength}</strong></span>
                      <span>Score: <strong className="text-slate-200">{Math.round((ev.composite_score || 0) * 100)}%</strong></span>
                      <span>Reliability: <strong className="text-slate-200">{ev.reliability.toUpperCase()}</strong></span>
                    </div>

                    <a
                      href={ev.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-400 hover:text-sky-300 font-mono flex items-center gap-1 transition"
                    >
                      <span>Open Evidence URL</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
