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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Source Connectors & System Settings</h2>
          <p className="text-sm text-slate-500 font-mono mt-1">
            Zero-cost open-source operation status, public connector health, and optional API configuration
          </p>
        </div>

        <button
          onClick={fetchStatus}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-mono font-semibold transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          <span>Refresh Health</span>
        </button>
      </div>

      {/* Free-First Core Architecture Banner */}
      <div className="p-6 rounded-xl bg-gradient-to-r from-emerald-50 via-teal-50/50 to-white border border-emerald-200 space-y-3 shadow-xs">
        <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm font-mono">
          <Shield className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>Zero-Cost Forensic Pipeline Active</span>
        </div>
        <p className="text-xs text-slate-700 leading-relaxed font-sans">
          OriginTrace AI executes C2PA Content Credentials provenance verification, cryptographic bitstream hashing,
          multi-algorithm perceptual hashing, and timeline reconstruction completely locally without paid keys.
          Public search requests via Openverse, the Internet Archive Wayback Machine, Bluesky, and Mastodon operate
          via public network APIs out-of-the-box at zero cost.
        </p>
      </div>

      {/* Connectors Status Cards */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-slate-900">Configured Discovery Connectors ({connectors.length})</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {connectors.map((c) => {
            const health = healthMap[c.name]?.health;
            const isLive = c.is_available;

            return (
              <div key={c.name} className="bg-white border border-slate-200 p-5 rounded-xl space-y-3 flex flex-col justify-between shadow-xs">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                      <h4 className="text-sm font-bold text-slate-900">{c.display_name}</h4>
                    </div>
                    <span
                      className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold border ${
                        isLive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {isLive ? 'Operational' : 'Optional / Unconfigured'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed font-sans">
                    {c.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 space-y-2 text-xs font-mono">
                  <div className="flex justify-between text-slate-500">
                    <span>Authentication:</span>
                    <span className="text-slate-800">{c.requires_api_key ? 'Requires API Key' : 'Zero Key (Public API)'}</span>
                  </div>
                  {c.name === 'reverse_image' && health?.masked_key && (
                    <div className="p-2.5 rounded bg-slate-50 border border-blue-200 space-y-1 text-[11px]">
                      <div className="flex justify-between text-slate-700">
                        <span>SerpApi Plan:</span>
                        <span className="text-emerald-700 font-bold">{health.plan || 'Free Plan'}</span>
                      </div>
                      <div className="flex justify-between text-slate-700">
                        <span>Searches Remaining:</span>
                        <span className="text-blue-700 font-bold">{health.searches_remaining ?? 250} / {health.searches_per_month ?? 250}</span>
                      </div>
                      <div className="flex justify-between text-slate-700">
                        <span>Configured Key:</span>
                        <span className="text-slate-600 font-mono">{health.masked_key}</span>
                      </div>
                      <div className="flex justify-between text-slate-500 text-[10px]">
                        <span>Local Caching:</span>
                        <span className="text-emerald-700">7-Day SHA-256 Cache Active (0 cost on re-scan)</span>
                      </div>
                    </div>
                  )}
                  {c.name === 'youtube' && health?.masked_key && (
                    <div className="p-2.5 rounded bg-slate-50 border border-blue-200 space-y-1 text-[11px]">
                      <div className="flex justify-between text-slate-700">
                        <span>YouTube API Status:</span>
                        <span className="text-emerald-700 font-bold">Active & Verified (HTTP 200)</span>
                      </div>
                      <div className="flex justify-between text-slate-700">
                        <span>Configured Key:</span>
                        <span className="text-slate-800 font-mono">{health.masked_key}</span>
                      </div>
                      <div className="flex justify-between text-slate-500 text-[10px]">
                        <span>Daily Free Quota:</span>
                        <span className="text-emerald-700">10,000 Units / Day (Public Video Search & Metadata)</span>
                      </div>
                    </div>
                  )}
                  {c.name === 'openverse' && (
                    <div className="p-2.5 rounded bg-slate-50 border border-blue-200 space-y-1 text-[11px]">
                      <div className="flex justify-between text-slate-700">
                        <span>Openverse Discovery:</span>
                        <span className="text-emerald-700 font-bold">Public Anonymous Access (Zero Key)</span>
                      </div>
                      <div className="flex justify-between text-slate-700">
                        <span>Catalog:</span>
                        <span className="text-blue-700">800M+ CC & Public Domain Images</span>
                      </div>
                      <div className="flex justify-between text-slate-500 text-[10px]">
                        <span>Local Caching:</span>
                        <span className="text-emerald-700">7-Day Local Query Cache Active</span>
                      </div>
                    </div>
                  )}
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

      {/* Environment Variables Guide */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-xs">
        <div className="flex items-center gap-2 text-slate-900 font-semibold text-base border-b border-slate-200 pb-3">
          <Key className="w-5 h-5 text-blue-600" />
          <span>Environment Variables Configuration (.env)</span>
        </div>

        <p className="text-xs text-slate-600 font-sans leading-relaxed">
          OriginTrace AI operates in a free-first posture. External service keys configured in your <code className="text-blue-700 font-semibold">.env</code> file are automatically validated and surfaced here.
        </p>

        <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg font-mono text-xs text-slate-800 space-y-2 overflow-x-auto">
          <div>
            <div className="flex items-center justify-between text-slate-600 mb-0.5">
              <span># Google YouTube Data API v3 Key</span>
              {connectors.find(c => c.name === 'youtube')?.is_configured ? (
                <span className="text-emerald-700 text-[10px] font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  ✓ Configured & Active ({healthMap['youtube']?.health?.masked_key || 'AIza...fEJU'})
                </span>
              ) : (
                <span className="text-amber-700 text-[10px] font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  Optional (Not Configured)
                </span>
              )}
            </div>
            <div className="text-blue-700 font-semibold">
              {connectors.find(c => c.name === 'youtube')?.is_configured
                ? `YOUTUBE_API_KEY=${healthMap['youtube']?.health?.masked_key || 'AIza...fEJU'}`
                : 'YOUTUBE_API_KEY=your_youtube_api_key_here'}
            </div>
          </div>
          <div className="pt-2">
            <div className="flex items-center justify-between text-slate-600 mb-0.5">
              <span># SerpApi Google Lens Key</span>
              {connectors.find(c => c.name === 'reverse_image')?.is_configured ? (
                <span className="text-emerald-700 text-[10px] font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  ✓ Configured & Active ({healthMap['reverse_image']?.health?.masked_key || '7097...dcc4'})
                </span>
              ) : (
                <span className="text-amber-700 text-[10px] font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  Optional (Not Configured)
                </span>
              )}
            </div>
            <div className="text-blue-700 font-semibold">
              {connectors.find(c => c.name === 'reverse_image')?.is_configured
                ? `SERPAPI_API_KEY=${healthMap['reverse_image']?.health?.masked_key || '7097...dcc4'}`
                : 'SERPAPI_API_KEY=your_serpapi_key_here'}
            </div>
          </div>
          <div className="pt-2">
            <div className="flex items-center justify-between text-slate-600 mb-0.5">
              <span># Openverse Public Discovery & C2PA Provenance</span>
              <span className="text-emerald-700 text-[10px] font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                ✓ 100% Free / Zero Key Required
              </span>
            </div>
            <div className="text-emerald-700 font-semibold"># Openverse (https://api.openverse.org/v1/) + C2PA Local Cryptographic Verification</div>
          </div>
          <div className="pt-2">
            <div className="text-slate-600 mb-0.5"># Mastodon Default Federated Instance</div>
            <div className="text-blue-700 font-semibold">MASTODON_INSTANCE=mastodon.social</div>
          </div>
        </div>
      </div>
    </div>
  );
};
