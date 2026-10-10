import React from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldAlert,
  Search,
  Database,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ExternalLink,
  Plus,
  ArrowRight,
  TrendingUp,
  FileText
} from 'lucide-react';
import { Investigation, ConnectorStatus } from '../types';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';

interface DashboardProps {
  investigations: Investigation[];
  connectors: ConnectorStatus[];
  onSelectInvestigation: (id: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  investigations,
  connectors,
  onSelectInvestigation,
}) => {
  // Aggregate real statistics strictly from application state
  const totalInvestigations = investigations.length;
  const allEvidence = investigations.flatMap((i) => i.evidence_records || []);
  const totalDiscoveredSources = allEvidence.length;
  const matchingContentCount = allEvidence.filter(
    (e) => e.evidence_strength === 'Strong match' || e.evidence_strength === 'Probable match'
  ).length;
  const unresolvedOrigins = investigations.filter((i) => !i.earliest_discovered_reference).length;

  // Platform coverage aggregation
  const platformCounts: Record<string, number> = {};
  allEvidence.forEach((ev) => {
    const p = ev.source_platform || 'web';
    platformCounts[p] = (platformCounts[p] || 0) + 1;
  });

  const chartData = Object.entries(platformCounts).map(([platform, count]) => ({
    platform: platform.toUpperCase(),
    count,
  }));

  const COLORS = ['#38BDF8', '#22C55E', '#A855F7', '#F59E0B', '#EF4444', '#06B6D4'];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Top Welcome & Tagline */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1e293b] pb-6">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Investigation Dashboard</h2>
          <p className="text-sm text-slate-400 font-mono mt-1">
            Trace the content. Reconstruct the timeline. Verify the evidence.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/new"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-sm transition shadow-lg shadow-sky-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Launch New Investigation</span>
          </Link>
        </div>
      </div>

      {totalInvestigations === 0 ? (
        /* Empty State */
        <div className="p-12 text-center bg-[#111827] border border-[#1e293b] rounded-xl space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-sky-500/10 flex items-center justify-center text-sky-400">
            <Search className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-semibold text-white">No Investigations Recorded Yet</h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Submit a public post URL, image, screenshot, or text claim to begin discovering earlier appearances across public sources and web archives.
          </p>
          <Link
            to="/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-sky-500 text-slate-950 font-semibold text-sm hover:bg-sky-400 transition"
          >
            <Plus className="w-4 h-4" /> Start First Investigation
          </Link>
        </div>
      ) : (
        <>
          {/* Key Metric Tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-[#111827] border border-[#1e293b] p-5 rounded-xl">
              <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-2 uppercase">
                <span>Total Investigations</span>
                <Database className="w-4 h-4 text-sky-400" />
              </div>
              <div className="text-3xl font-extrabold text-white">{totalInvestigations}</div>
              <div className="text-[11px] text-slate-500 mt-2">Active stored digital forensics cases</div>
            </div>

            <div className="bg-[#111827] border border-[#1e293b] p-5 rounded-xl">
              <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-2 uppercase">
                <span>Discovered Sources</span>
                <Search className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-3xl font-extrabold text-emerald-400">{totalDiscoveredSources}</div>
              <div className="text-[11px] text-slate-500 mt-2">Historical captures & public posts</div>
            </div>

            <div className="bg-[#111827] border border-[#1e293b] p-5 rounded-xl">
              <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-2 uppercase">
                <span>Matching Copies</span>
                <CheckCircle2 className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-3xl font-extrabold text-purple-400">{matchingContentCount}</div>
              <div className="text-[11px] text-slate-500 mt-2">Strong & probable perceptual matches</div>
            </div>

            <div className="bg-[#111827] border border-[#1e293b] p-5 rounded-xl">
              <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-2 uppercase">
                <span>Unresolved Origin</span>
                <ShieldAlert className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-3xl font-extrabold text-amber-400">{unresolvedOrigins}</div>
              <div className="text-[11px] text-slate-500 mt-2">Cases pending corroborated timestamps</div>
            </div>
          </div>

          {/* Middle Charts & Connector Health */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Discovered Platform Distribution */}
            <div className="lg:col-span-2 bg-[#111827] border border-[#1e293b] p-6 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-white">Source Platform Distribution</h3>
                  <p className="text-xs text-slate-400 font-mono">Discovered appearances across queried archives and networks</p>
                </div>
                <TrendingUp className="w-4 h-4 text-sky-400" />
              </div>
              {chartData.length > 0 ? (
                <div className="h-56 w-full pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="platform" stroke="#64748b" fontSize={11} tickLine={false} />
                      <YAxis stroke="#64748b" fontSize={11} tickLine={false} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#182235', borderColor: '#1e293b', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {chartData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-56 flex items-center justify-center text-xs text-slate-500">
                  No source records discovered yet.
                </div>
              )}
            </div>

            {/* Connector Status Panel */}
            <div className="bg-[#111827] border border-[#1e293b] p-6 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-white">Connector Health</h3>
                <Link to="/settings" className="text-xs text-sky-400 hover:underline font-mono">
                  Configure
                </Link>
              </div>
              <div className="space-y-2.5">
                {connectors.map((c) => (
                  <div key={c.name} className="flex items-center justify-between p-2.5 rounded-lg bg-[#182235]/60 border border-[#1e293b]">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${c.is_available ? 'bg-emerald-500' : 'bg-slate-500'}`} />
                      <span className="text-xs font-medium text-slate-200">{c.display_name.slice(0, 24)}</span>
                    </div>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                        c.is_available ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-700/40 text-slate-400'
                      }`}
                    >
                      {c.is_available ? 'Active' : 'Unconfigured'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Investigations List */}
          <div className="bg-[#111827] border border-[#1e293b] rounded-xl overflow-hidden">
            <div className="p-6 border-b border-[#1e293b] flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-white">Recent Forensic Inquiries</h3>
                <p className="text-xs text-slate-400 font-mono">Select a case to inspect evidence timeline, origin graph, and reports</p>
              </div>
              <Link to="/reports" className="text-xs text-sky-400 hover:underline flex items-center gap-1 font-mono">
                <span>View Reports</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-[#1e293b]">
              {investigations.map((inv) => (
                <div
                  key={inv.id}
                  onClick={() => onSelectInvestigation(inv.id)}
                  className="p-5 hover:bg-[#182235]/40 transition cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-mono font-bold text-sky-400">{inv.id}</span>
                      <h4 className="text-sm font-semibold text-white">{inv.title}</h4>
                      {inv.is_synthetic && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          Synthetic Benchmark
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-1">
                      {inv.summary || inv.input_content || 'No summary available.'}
                    </p>
                    <div className="flex items-center gap-4 text-[11px] text-slate-500 pt-1 font-mono">
                      <span>Type: {inv.input_type.toUpperCase()}</span>
                      <span>Records: {inv.evidence_records?.length || 0}</span>
                      <span>Created: {new Date(inv.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {inv.earliest_discovered_reference ? (
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-mono text-emerald-400 font-bold block">
                          Earliest Reference Discovered
                        </span>
                        <span className="text-xs font-mono text-slate-300">
                          {new Date(inv.earliest_discovered_reference.timestamp).toLocaleDateString()} on {inv.earliest_discovered_reference.platform.toUpperCase()}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500 font-mono italic">Origin Unresolved</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
