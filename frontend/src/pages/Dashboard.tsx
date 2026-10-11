import React from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldAlert,
  Search,
  Database,
  CheckCircle2,
  Clock,
  Plus,
  ArrowRight,
  TrendingUp,
  Layers,
  Activity,
  VenetianMask,
  Info,
  LogOut,
  Trash2
} from 'lucide-react';
import { Investigation, ConnectorStatus } from '../types';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { useIncognito } from '../context/IncognitoContext';

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
  const {
    isIncognito,
    incognitoInvestigations,
    enterIncognito,
    requestExitIncognito,
    clearIncognitoSession,
    setShowPrivacyModal,
  } = useIncognito();

  // Active dataset depends on whether Incognito Mode is enabled
  const activeCases = isIncognito ? incognitoInvestigations : investigations;

  // Aggregate statistics strictly from active session scope
  const totalInvestigations = activeCases.length;
  const allEvidence = activeCases.flatMap((i) => i.evidence_records || []);
  const totalDiscoveredSources = allEvidence.length;
  const matchingContentCount = allEvidence.filter(
    (e) => e.evidence_strength === 'Strong match' || e.evidence_strength === 'Probable match'
  ).length;
  const unresolvedOrigins = activeCases.filter((i) => !i.earliest_discovered_reference).length;

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

  const COLORS = ['#2563EB', '#0F9D78', '#805AD5', '#C78616', '#D14343', '#0891B2'];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 select-none">
      {/* Top Welcome & Tagline */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E2E8F0] pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl font-bold text-[#17243A] tracking-tight">Investigation Dashboard</h2>
            {isIncognito && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-bold bg-purple-100 text-purple-800 border border-purple-300">
                <VenetianMask className="w-3.5 h-3.5 text-purple-700" />
                <span>RAM-Only Workspace</span>
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-[#64748B] font-mono mt-1">
            {isIncognito
              ? 'Private investigation session active. Findings remain in memory only and will never reach disk history.'
              : 'Trace the content. Reconstruct the timeline. Verify the evidence.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Incognito Quick Mode Toggle */}
          {!isIncognito ? (
            <button
              type="button"
              onClick={enterIncognito}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-semibold font-mono transition shadow-2xs"
              title="Switch to Incognito Mode (RAM-only unrecorded investigation)"
            >
              <VenetianMask className="w-4 h-4 text-purple-700" />
              <span>Start Incognito</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={requestExitIncognito}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-900 border border-purple-300 text-xs font-semibold font-mono transition shadow-2xs"
              title="Exit Incognito Mode"
            >
              <LogOut className="w-4 h-4 text-purple-800" />
              <span>Exit Incognito</span>
            </button>
          )}

          <Link
            to="/evidence"
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#F8FAFD] hover:bg-slate-100 text-[#17243A] border border-[#E2E8F0] text-xs font-semibold font-mono transition shadow-xs"
          >
            <Layers className="w-3.5 h-3.5 text-[#2563EB]" />
            <span>Evidence Catalog</span>
          </Link>
          <Link
            to="/new"
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-xs sm:text-sm transition shadow-sm text-white ${
              isIncognito ? 'bg-purple-700 hover:bg-purple-800' : 'bg-[#2563EB] hover:bg-blue-700'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>{isIncognito ? 'Launch Incognito Inquiry' : 'Launch New Investigation'}</span>
          </Link>
        </div>
      </div>

      {/* Incognito Notice Card when Incognito is Active */}
      {isIncognito && (
        <div className="p-4 rounded-xl bg-purple-50/90 border border-purple-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-purple-900 shadow-2xs">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-600 text-white flex items-center justify-center shrink-0 mt-0.5">
              <VenetianMask className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">Incognito Session Active</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-200/80 text-purple-900 font-bold border border-purple-300">
                  RAM ONLY
                </span>
              </div>
              <p className="text-xs text-purple-800/90 leading-relaxed font-sans">
                Activity performed now is held strictly in memory. Normal persistent history remains hidden and untouched.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowPrivacyModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold bg-white border border-purple-200 text-purple-800 hover:bg-purple-100/60 transition shadow-2xs"
            >
              <Info className="w-3.5 h-3.5 text-purple-600" />
              <span>Privacy Scope</span>
            </button>
            {incognitoInvestigations.length > 0 && (
              <button
                type="button"
                onClick={clearIncognitoSession}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 transition shadow-2xs"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>Clear Session</span>
              </button>
            )}
          </div>
        </div>
      )}

      {totalInvestigations === 0 ? (
        /* Empty State */
        <div className="p-12 text-center bg-white border border-[#E2E8F0] rounded-2xl space-y-4 shadow-xs">
          <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center ${
            isIncognito ? 'bg-purple-50 border border-purple-200 text-purple-600' : 'bg-blue-50 border border-blue-200/80 text-[#2563EB]'
          }`}>
            {isIncognito ? <VenetianMask className="w-8 h-8" /> : <Search className="w-8 h-8" />}
          </div>
          <h3 className="text-lg font-bold text-[#17243A]">
            {isIncognito ? 'No In-Memory Investigations Yet' : 'No Investigations Recorded Yet'}
          </h3>
          <p className="text-xs sm:text-sm text-[#64748B] max-w-md mx-auto leading-relaxed">
            {isIncognito
              ? 'Launch an unrecorded inquiry to inspect content and trace origins without saving any queries or findings to persistent case history.'
              : 'Submit a public post URL, image, screenshot, or text claim to begin discovering earlier appearances across public sources and web archives.'}
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Link
              to="/new"
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-white font-semibold text-sm transition shadow-sm ${
                isIncognito ? 'bg-purple-700 hover:bg-purple-800' : 'bg-[#2563EB] hover:bg-blue-700'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>{isIncognito ? 'Start Incognito Inquiry' : 'Start First Investigation'}</span>
            </Link>
            {isIncognito && (
              <button
                type="button"
                onClick={requestExitIncognito}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-100 transition"
              >
                <span>Exit Incognito</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Key Metric Tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white border border-[#E2E8F0] p-5 rounded-2xl shadow-xs">
              <div className="flex items-center justify-between text-[#64748B] text-xs font-mono mb-2 uppercase font-semibold">
                <span>{isIncognito ? 'Session Cases' : 'Total Investigations'}</span>
                <Database className={`w-4 h-4 ${isIncognito ? 'text-purple-600' : 'text-[#2563EB]'}`} />
              </div>
              <div className={`text-3xl font-extrabold ${isIncognito ? 'text-purple-700' : 'text-[#17243A]'}`}>
                {totalInvestigations}
              </div>
              <div className="text-[11px] text-[#64748B] mt-2 font-mono">
                {isIncognito ? 'Temporary in-memory inquiries' : 'Active stored forensic inquiries'}
              </div>
            </div>

            <div className="bg-white border border-[#E2E8F0] p-5 rounded-2xl shadow-xs">
              <div className="flex items-center justify-between text-[#64748B] text-xs font-mono mb-2 uppercase font-semibold">
                <span>Discovered Sources</span>
                <Search className="w-4 h-4 text-[#0F9D78]" />
              </div>
              <div className="text-3xl font-extrabold text-[#0F9D78]">{totalDiscoveredSources}</div>
              <div className="text-[11px] text-[#64748B] mt-2 font-mono">Archive snapshots & public posts</div>
            </div>

            <div className="bg-white border border-[#E2E8F0] p-5 rounded-2xl shadow-xs">
              <div className="flex items-center justify-between text-[#64748B] text-xs font-mono mb-2 uppercase font-semibold">
                <span>Matching Copies</span>
                <CheckCircle2 className="w-4 h-4 text-[#805AD5]" />
              </div>
              <div className="text-3xl font-extrabold text-[#805AD5]">{matchingContentCount}</div>
              <div className="text-[11px] text-[#64748B] mt-2 font-mono">Strong & probable visual matches</div>
            </div>

            <div className="bg-white border border-[#E2E8F0] p-5 rounded-2xl shadow-xs">
              <div className="flex items-center justify-between text-[#64748B] text-xs font-mono mb-2 uppercase font-semibold">
                <span>Unresolved Origin</span>
                <ShieldAlert className="w-4 h-4 text-[#C78616]" />
              </div>
              <div className="text-3xl font-extrabold text-[#C78616]">{unresolvedOrigins}</div>
              <div className="text-[11px] text-[#64748B] mt-2 font-mono">Pending corroborated timestamps</div>
            </div>
          </div>

          {/* Middle Charts & Connector Health */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Discovered Platform Distribution */}
            <div className="lg:col-span-2 bg-white border border-[#E2E8F0] p-6 rounded-2xl space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-[#17243A]">Source Platform Distribution</h3>
                  <p className="text-xs text-[#64748B] font-mono">
                    {isIncognito ? 'In-memory discoveries across queried providers' : 'Discovered appearances across queried archives and networks'}
                  </p>
                </div>
                <TrendingUp className="w-4 h-4 text-[#2563EB]" />
              </div>
              {chartData.length > 0 ? (
                <div className="h-56 w-full pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="platform" stroke="#64748B" fontSize={11} tickLine={false} />
                      <YAxis stroke="#64748B" fontSize={11} tickLine={false} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#FFFFFF',
                          borderColor: '#E2E8F0',
                          borderRadius: '10px',
                          color: '#17243A',
                          fontSize: '12px',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.08)'
                        }}
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
                <div className="h-56 flex items-center justify-center text-xs text-[#64748B] font-mono">
                  No source records discovered yet.
                </div>
              )}
            </div>

            {/* Connector Status Panel */}
            <div className="bg-white border border-[#E2E8F0] p-6 rounded-2xl space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#2563EB]" />
                  <h3 className="text-base font-bold text-[#17243A]">Connector Health</h3>
                </div>
                <Link to="/settings" className="text-xs text-[#2563EB] hover:underline font-mono font-semibold">
                  Configure
                </Link>
              </div>
              <div className="space-y-2.5">
                {connectors.map((c) => (
                  <div key={c.name} className="flex items-center justify-between p-2.5 rounded-lg bg-[#F8FAFD] border border-[#E2E8F0]">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${c.is_available ? 'bg-[#0F9D78]' : 'bg-slate-400'}`} />
                      <span className="text-xs font-semibold text-[#17243A]">{c.display_name.slice(0, 24)}</span>
                    </div>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border ${
                        c.is_available ? 'bg-emerald-50 text-[#0F9D78] border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}
                    >
                      {c.is_available ? 'Active' : 'Optional'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Investigations List */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden shadow-xs">
            <div className="p-6 border-b border-[#E2E8F0] flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#17243A]">
                  {isIncognito ? 'Active In-Memory Inquiries' : 'Recent Forensic Inquiries'}
                </h3>
                <p className="text-xs text-[#64748B] font-mono">
                  {isIncognito
                    ? 'Temporary unrecorded cases — select to inspect in-memory timeline and graph'
                    : 'Select a case to inspect evidence timeline, origin graph, and reports'}
                </p>
              </div>
              <Link to="/reports" className="text-xs text-[#2563EB] hover:underline flex items-center gap-1 font-mono font-semibold">
                <span>View Reports</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-slate-100">
              {activeCases.map((inv) => (
                <div
                  key={inv.id}
                  onClick={() => onSelectInvestigation(inv.id)}
                  className={`p-5 transition cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    isIncognito ? 'hover:bg-purple-50/50' : 'hover:bg-[#F8FAFD]'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span className={`text-xs font-mono font-bold ${isIncognito ? 'text-purple-700' : 'text-[#2563EB]'}`}>
                        {inv.id}
                      </span>
                      <h4 className="text-sm font-bold text-[#17243A]">{inv.title}</h4>
                      {isIncognito && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200 font-bold flex items-center gap-1">
                          <VenetianMask className="w-3 h-3" /> RAM ONLY
                        </span>
                      )}
                      {inv.is_synthetic && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-50 text-[#C78616] border border-amber-200 font-semibold">
                          Synthetic Benchmark
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#64748B] line-clamp-1">
                      {inv.summary || inv.input_content || 'No summary available.'}
                    </p>
                    <div className="flex items-center gap-4 text-[11px] text-[#64748B] pt-1 font-mono">
                      <span>Type: {inv.input_type.toUpperCase()}</span>
                      <span>Records: {inv.evidence_records?.length || 0}</span>
                      <span>{isIncognito ? 'Session Time:' : 'Created:'} {new Date(inv.created_at).toLocaleTimeString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {inv.earliest_discovered_reference ? (
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-mono text-[#0F9D78] font-bold block">
                          Earliest Reference Discovered
                        </span>
                        <span className="text-xs font-mono text-[#17243A]">
                          {new Date(inv.earliest_discovered_reference.timestamp).toLocaleDateString()} on {inv.earliest_discovered_reference.platform.toUpperCase()}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-[#64748B] font-mono italic">Origin Unresolved</span>
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
