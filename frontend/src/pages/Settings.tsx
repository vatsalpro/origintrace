import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Key,
  Cpu,
  Shield,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { api } from '../services/api';
import { ConnectorStatus } from '../types';

export const Settings: React.FC = () => {
  const [connectors, setConnectors] = useState<ConnectorStatus[]>([]);
  const [healthMap, setHealthMap] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  const fetchStatus = () => {
    setLoading(true);
    Promise.all([api.getConnectors(), api.getConnectorsStatus()])
      .then(([conns, statuses]) => {
        setConnectors(conns);
        setHealthMap(statuses);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1e293b] pb-6">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Source Connectors & System Settings</h2>
          <p className="text-sm text-slate-400 font-mono mt-1">
            Zero-cost open-source operation status, public connector health, and optional API configuration
          </p>
        </div>

        <button
          onClick={fetchStatus}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#182235] hover:bg-[#1f2d47] text-slate-200 border border-[#1e293b] text-xs font-mono font-semibold transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-400' : ''}`} />
          <span>Refresh Health</span>
        </button>
      </div>

      {/* Free-First Core Architecture Banner */}
      <div className="p-6 rounded-xl bg-gradient-to-r from-emerald-950/40 to-[#111827] border border-emerald-500/30 space-y-3">
        <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm font-mono">
          <Shield className="w-4 h-4 shrink-0" />
          <span>Zero-Cost Forensic Pipeline Active</span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed font-sans">
          OriginTrace AI executes image hashing, perceptual hashing, text token matching, and timeline reconstruction
          completely locally without external AI APIs or paid keys. Public search requests via the Wayback Machine, Bluesky,
          and Mastodon are supported by public network APIs out-of-the-box.
        </p>
      </div>

      {/* Connectors Status Cards */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-white">Configured Discovery Connectors ({connectors.length})</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {connectors.map((c) => {
            const health = healthMap[c.name]?.health;
            const isLive = c.is_available;

            return (
              <div key={c.name} className="bg-[#111827] border border-[#1e293b] p-5 rounded-xl space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${isLive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                      <h4 className="text-sm font-bold text-white">{c.display_name}</h4>
                    </div>
                    <span
                      className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold ${
                        isLive ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {isLive ? 'Operational' : 'Optional / Unconfigured'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed font-sans">
                    {c.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-[#1e293b] space-y-2 text-xs font-mono">
                  <div className="flex justify-between text-slate-400">
                    <span>Authentication:</span>
                    <span className="text-slate-200">{c.requires_api_key ? 'Requires API Key' : 'Zero Key (Public API)'}</span>
                  </div>
                  {c.limitations && (
                    <div className="text-[11px] text-slate-500 italic">
                      Notice: {c.limitations}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Optional Environment Variables Guide */}
      <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2 text-white font-semibold text-base border-b border-[#1e293b] pb-3">
          <Key className="w-5 h-5 text-sky-400" />
          <span>Optional Environment Variables Configuration (.env)</span>
        </div>

        <p className="text-xs text-slate-400 font-sans leading-relaxed">
          To enable optional connectors like YouTube Data API or Reddit OAuth, specify the environment variables in a <code className="text-sky-300">.env</code> file in your backend folder. If left unset, the platform operates seamlessly in free-first mode.
        </p>

        <div className="bg-[#182235] p-4 rounded-lg font-mono text-xs text-slate-300 space-y-1 overflow-x-auto">
          <div># Optional Google YouTube Data API v3 Key</div>
          <div className="text-sky-400">YOUTUBE_API_KEY=your_youtube_api_key_here</div>
          <div className="pt-2"># Optional Reddit Approved Developer Credentials</div>
          <div className="text-sky-400">REDDIT_CLIENT_ID=your_reddit_client_id</div>
          <div className="text-sky-400">REDDIT_CLIENT_SECRET=your_reddit_client_secret</div>
          <div className="pt-2"># Mastodon Default Federated Instance</div>
          <div className="text-sky-400">MASTODON_INSTANCE=mastodon.social</div>
        </div>
      </div>
    </div>
  );
};
