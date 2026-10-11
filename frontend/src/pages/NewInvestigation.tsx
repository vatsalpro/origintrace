import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  Link as LinkIcon,
  FileText,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Calendar,
  Layers,
  ShieldAlert,
  EyeOff,
  VenetianMask,
  Info,
  Trash2
} from 'lucide-react';
import { api } from '../services/api';
import { useIncognito } from '../context/IncognitoContext';

interface NewInvestigationProps {
  onInvestigationCreated: (id: string) => void;
}

export const NewInvestigation: React.FC<NewInvestigationProps> = ({ onInvestigationCreated }) => {
  const navigate = useNavigate();
  const {
    isIncognito: globalIncognito,
    enterIncognito,
    refreshIncognitoInvestigations,
    setShowPrivacyModal,
  } = useIncognito();

  const [inputType, setInputType] = useState<'url' | 'image' | 'video' | 'screenshot' | 'text' | 'combined'>('image');
  const [title, setTitle] = useState('');
  const [urlOrText, setUrlOrText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isIncognito, setIsIncognito] = useState(globalIncognito);

  useEffect(() => {
    setIsIncognito(globalIncognito);
  }, [globalIncognito]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([
    'reverse_image',
    'openverse',
    'wayback',
    'bluesky',
    'mastodon',
    'web_search',
    'youtube'
  ]);

  const [connectorsList, setConnectorsList] = useState<Array<{ id: string; label: string; ready: boolean }>>([
    { id: 'reverse_image', label: 'Reverse Image (Google Lens / SerpApi)', ready: true },
    { id: 'openverse', label: 'Openverse Image Discovery (Zero Key)', ready: true },
    { id: 'wayback', label: 'Wayback Machine (CDX)', ready: true },
    { id: 'bluesky', label: 'Bluesky Public API', ready: true },
    { id: 'mastodon', label: 'Mastodon Federated', ready: true },
    { id: 'web_search', label: 'Web Page Metadata', ready: true },
    { id: 'youtube', label: 'YouTube API (Active)', ready: true },
  ]);

  React.useEffect(() => {
    api.getConnectors()
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const mapped = data.map((c) => {
            const isReady = c.is_configured || !c.requires_api_key;
            let label = c.display_name;
            if (c.name === 'youtube') {
              label = isReady ? 'YouTube API (Active)' : 'YouTube API (Optional Key)';
            } else if (c.name === 'openverse') {
              label = 'Openverse Image Discovery (Zero Key)';
            }
            return {
              id: c.name,
              label,
              ready: isReady
            };
          });
          setConnectorsList(mapped);

          // Auto-select active connectors
          const activeIds = mapped.filter((m) => m.ready).map((m) => m.id);
          setSelectedPlatforms((prev) => Array.from(new Set([...prev, ...activeIds])));
        }
      })
      .catch((err) => {
        console.warn('Could not fetch connector list:', err);
      });
  }, []);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeInvId, setActiveInvId] = useState<string | null>(null);
  const [stageProgress, setStageProgress] = useState<{
    current_stage: string;
    status: string;
    stages: Record<string, { status: string; message: string; updated_at?: string }>;
  } | null>(null);

  const STAGES_ORDER = [
    { key: 'intake', label: '1. Intake' },
    { key: 'fingerprinting', label: '2. Fingerprinting' },
    { key: 'metadata_extraction', label: '3. Metadata' },
    { key: 'ocr_processing', label: '4. OCR Text' },
    { key: 'query_generation', label: '5. Query Gen' },
    { key: 'online_discovery', label: '6. Discovery' },
    { key: 'candidate_comparison', label: '7. Comparison' },
    { key: 'timeline_construction', label: '8. Timeline' },
    { key: 'report_compilation', label: '9. Report' },
    { key: 'completed', label: '10. Complete' }
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (selected.size > 50 * 1024 * 1024) {
        setError('Selected file exceeds the maximum allowed size of 50MB.');
        return;
      }
      setFile(selected);
      setError(null);
    }
  };

  // Poll stage progress if activeInvId is set
  React.useEffect(() => {
    if (!activeInvId) return;

    const interval = setInterval(async () => {
      try {
        const stageData = await api.getInvestigationStages(activeInvId);
        setStageProgress(stageData);
        if (stageData.status === 'completed' || stageData.status === 'failed') {
          setLoading(false);
          clearInterval(interval);
        }
      } catch (err) {
        console.error('Stage poll error:', err);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeInvId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setStageProgress(null);

    try {
      const formData = new FormData();
      if (title.trim()) formData.append('title', title.trim());
      formData.append('input_type', inputType);

      if (urlOrText.trim()) {
        formData.append('input_content', urlOrText.trim());
      }

      if (file) {
        formData.append('file', file);
      }

      // Send selected platforms to orchestrator
      formData.append('selected_platforms', JSON.stringify(selectedPlatforms));

      // Incognito mode flag
      if (isIncognito) {
        formData.append('is_incognito', 'true');
      }

      const inv = await api.createInvestigation(formData);
      setActiveInvId(inv.id);
      if (isIncognito) {
        await refreshIncognitoInvestigations();
      }
      onInvestigationCreated(inv.id);
    } catch (err: any) {
      setError(err.message || 'Failed to submit investigation inquiry');
      setLoading(false);
    }
  };

  const togglePlatform = (p: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((item) => item !== p) : [...prev, p]
    );
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Initiate Digital Forensics Investigation</h2>
        <p className="text-sm text-slate-500 font-mono mt-1">
          Submit content to trace prior public appearances across supported networks and historical web archives.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-700 text-sm">
          <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
          <div>
            <span className="font-semibold block">Security or Validation Error</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {activeInvId && (
        <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-3 text-emerald-700 text-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
          <div>
            <span className="font-semibold block">Inquiry Registered Successfully ({activeInvId})</span>
            <span>Forensic pipeline execution in progress. Track real-time progress below.</span>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 p-6 rounded-xl space-y-6 shadow-xs">
        {/* Title */}
        <div className="space-y-1.5">
          <label className="text-xs font-mono uppercase text-slate-600 font-semibold">Investigation Title / Case Reference</label>
          <input
            type="text"
            placeholder="e.g. Suspected Recycled Disaster Photo in Breaking News"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 text-sm text-slate-900 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:bg-white font-medium shadow-2xs"
          />
        </div>

        {/* Input Type Selector */}
        <div className="space-y-2">
          <label className="text-xs font-mono uppercase text-slate-600 font-semibold">Evidence Input Mode</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {[
              { id: 'image', label: 'Image', icon: Upload },
              { id: 'screenshot', label: 'Screenshot', icon: Upload },
              { id: 'url', label: 'Public URL', icon: LinkIcon },
              { id: 'text', label: 'Text Claim', icon: FileText },
              { id: 'combined', label: 'Combined', icon: Layers },
              { id: 'video', label: 'Video Frame', icon: Upload },
            ].map((mode) => {
              const Icon = mode.icon;
              const isSelected = inputType === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setInputType(mode.id as any)}
                  className={`p-3 rounded-lg border text-center flex flex-col items-center gap-1.5 transition ${
                    isSelected
                      ? 'bg-blue-50 border-blue-500 text-blue-700 font-semibold shadow-2xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-xs">{mode.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* File Upload Box (if image, screenshot, video, combined) */}
        {['image', 'screenshot', 'video', 'combined'].includes(inputType) && (
          <div className="space-y-2">
            <label className="text-xs font-mono uppercase text-slate-600 font-semibold">
              Target Media File Upload (Max 50MB)
            </label>
            <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-6 text-center bg-slate-50/50 transition">
              <input
                type="file"
                id="file-upload"
                onChange={handleFileChange}
                accept="image/*,video/*"
                className="hidden"
              />
              <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-2">
                <Upload className="w-8 h-8 text-blue-600" />
                <span className="text-sm font-medium text-slate-800">
                  {file ? file.name : 'Click to browse or drop target image/screenshot'}
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  Calculates SHA-256, pHash, dHash, aHash, wHash, verifies C2PA Content Credentials, and runs OCR extraction
                </span>
              </label>
            </div>
          </div>
        )}

        {/* URL or Text Claim Input */}
        {['url', 'text', 'combined'].includes(inputType) && (
          <div className="space-y-1.5">
            <label className="text-xs font-mono uppercase text-slate-600 font-semibold">
              {inputType === 'url' ? 'Public Post or Webpage URL (SSRF Protected)' : 'Text Claim or Caption'}
            </label>
            <textarea
              rows={3}
              placeholder={
                inputType === 'url'
                  ? 'https://example.com/breaking-news-post-or-image.jpg'
                  : 'Enter the exact caption or textual claim to discover across public feeds...'
              }
              value={urlOrText}
              onChange={(e) => setUrlOrText(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 text-sm text-slate-900 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:bg-white shadow-2xs font-mono"
            />
          </div>
        )}

        {/* Target Platforms */}
        <div className="space-y-2">
          <label className="text-xs font-mono uppercase text-slate-600 font-semibold">Available Search Sources</label>
          <div className="flex flex-wrap gap-2">
            {connectorsList.map((p) => {
              const active = selectedPlatforms.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => togglePlatform(p.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-mono flex items-center gap-1.5 border transition ${
                    active
                      ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium'
                      : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${p.ready ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  {p.label}
                </button>
              );
            })}
          </div>

          {selectedPlatforms.includes('reverse_image') && (
            <div className="p-2.5 rounded-lg bg-blue-50/80 border border-blue-200 text-[11px] font-mono text-blue-900 flex flex-wrap items-center justify-between gap-2">
              <span>⚡ <strong>Reverse Image (Google Lens):</strong> Uses 1 SerpApi credit per live search. Identical images (SHA-256 match) are cached locally at 0 credit cost.</span>
              <span className="text-emerald-700 font-semibold px-2 py-0.5 rounded bg-emerald-100 border border-emerald-200">Free Plan: 250 Searches / Mo</span>
            </div>
          )}

          {selectedPlatforms.includes('openverse') && (
            <div className="p-2.5 rounded-lg bg-blue-50/80 border border-blue-200 text-[11px] font-mono text-blue-900 flex flex-wrap items-center justify-between gap-2">
              <span>🎨 <strong>Openverse Image Discovery:</strong> Searches Creative Commons & public domain media using OCR phrases and text keywords. Candidate images compared via perceptual hashing.</span>
              <span className="text-emerald-700 font-semibold px-2 py-0.5 rounded bg-emerald-100 border border-emerald-200">Zero Key Required (100% Free)</span>
            </div>
          )}

          {selectedPlatforms.includes('youtube') && (
            <div className="p-2.5 rounded-lg bg-blue-50/80 border border-blue-200 text-[11px] font-mono text-blue-900 flex flex-wrap items-center justify-between gap-2">
              <span>📹 <strong>YouTube Data API v3:</strong> Verified with API key. Searches video titles, descriptions & thumbnails.</span>
              <span className="text-emerald-700 font-semibold px-2 py-0.5 rounded bg-emerald-100 border border-emerald-200">Free Tier: 10,000 Units / Day</span>
            </div>
          )}
        </div>

        {/* Incognito Forensic Search Option */}
        <div className={`p-4 rounded-xl border transition-all ${
          isIncognito 
            ? 'bg-purple-50/80 border-purple-300 ring-2 ring-purple-400/20 shadow-xs' 
            : 'bg-slate-50 border-slate-200 hover:border-slate-300'
        }`}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                isIncognito ? 'bg-purple-600 text-white shadow-xs' : 'bg-slate-200 text-slate-600'
              }`}>
                <VenetianMask className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900">Incognito Investigation Mode</span>
                  <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${
                    isIncognito 
                      ? 'bg-purple-100 text-purple-800 border-purple-200' 
                      : 'bg-slate-100 text-slate-500 border-slate-200'
                  }`}>
                    {isIncognito ? 'History NOT Recorded (RAM Only)' : 'Standard Case Logging'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-sans leading-relaxed">
                  When enabled, this search is purely ephemeral. Findings will <strong>not</strong> be recorded in your persistent case history, dashboard inquiry metrics, or saved case dropdown.
                </p>

                {isIncognito && (
                  <div className="mt-2.5 p-3 rounded-lg bg-white/80 border border-purple-200 text-xs space-y-1">
                    <div className="flex items-center justify-between font-bold text-purple-900">
                      <span className="flex items-center gap-1.5 font-mono text-[11px] uppercase">
                        <ShieldAlert className="w-3.5 h-3.5 text-purple-700" />
                        Privacy Scope & Boundary
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowPrivacyModal(true)}
                        className="text-[11px] text-purple-700 hover:text-purple-900 hover:underline flex items-center gap-1 font-mono"
                      >
                        <Info className="w-3 h-3" /> Details
                      </button>
                    </div>
                    <p className="text-[11px] text-purple-800/90 leading-relaxed font-sans">
                      Incognito Mode prevents OriginTrace AI from logging your activity locally in its database. However, it does not guarantee anonymity from network providers (ISPs), external websites queried, or system monitors.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Toggle Button */}
            <button
              type="button"
              role="switch"
              aria-checked={isIncognito}
              onClick={() => {
                const next = !isIncognito;
                setIsIncognito(next);
                if (next) enterIncognito();
              }}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                isIncognito ? 'bg-purple-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  isIncognito ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 rounded-lg text-white font-bold text-sm transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 ${
              isIncognito ? 'bg-purple-700 hover:bg-purple-800' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Forensic Pipeline Active — Inspecting Evidence...</span>
              </>
            ) : isIncognito ? (
              <>
                <VenetianMask className="w-4 h-4" />
                <span>Launch Incognito Inquiry (RAM Only — Unrecorded)</span>
              </>
            ) : (
              <span>Launch Origin Inquiry</span>
            )}
          </button>
        </div>
      </form>

      {/* 10-Stage Forensic Pipeline Progress Card */}
      {activeInvId && (
        <div className="bg-white border border-blue-200 rounded-xl p-6 space-y-6 shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-mono px-2 py-0.5 rounded font-semibold uppercase border ${
                  isIncognito ? 'bg-purple-50 text-purple-700 border-purple-200 flex items-center gap-1' : 'bg-blue-50 text-blue-700 border-blue-200'
                }`}>
                  {isIncognito ? <><EyeOff className="w-3 h-3" /> Incognito Case</> : 'Case ID'}
                </span>
                <span className="text-base font-bold font-mono text-slate-900">{activeInvId}</span>
              </div>
              <p className="text-xs text-slate-500 font-mono mt-1">
                {isIncognito 
                  ? 'Private session — execution tracking in real-time (not saved to history)'
                  : 'Multi-stage forensic pipeline execution tracking in real-time'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {isIncognito && (
                <button
                  type="button"
                  onClick={async () => {
                    if (activeInvId && confirm('Permanently erase this incognito investigation now? All evidence and memory will be destroyed.')) {
                      await api.deleteInvestigation(activeInvId);
                      setActiveInvId(null);
                      setStageProgress(null);
                      navigate('/dashboard');
                    }
                  }}
                  className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 flex items-center gap-1 transition"
                  title="Wipe and destroy this session immediately"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Erase Session Now
                </button>
              )}
              {stageProgress?.status === 'completed' ? (
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> PIPELINE COMPLETED
                </span>
              ) : stageProgress?.status === 'failed' ? (
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" /> PIPELINE FAILED
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1.5 animate-pulse">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> EXECUTING STAGES
                </span>
              )}
            </div>
          </div>

          {/* Progress Overview */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-slate-600">
              <span>Pipeline Stage Progression</span>
              <span className="text-blue-600 font-semibold">
                {stageProgress?.current_stage
                  ? `Active Stage: ${stageProgress.current_stage.toUpperCase()}`
                  : 'Initializing...'}
              </span>
            </div>

            {/* Stages Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              {STAGES_ORDER.map(({ key, label }) => {
                const stage = stageProgress?.stages?.[key];
                const stageStatus = stage?.status || 'pending';
                const isCurrent = stageProgress?.current_stage === key;

                let badgeColor = 'bg-slate-50 text-slate-500 border-slate-200';
                let icon = <span className="w-2 h-2 rounded-full bg-slate-400" />;

                if (stageStatus === 'completed') {
                  badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                  icon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />;
                } else if (stageStatus === 'running' || isCurrent) {
                  badgeColor = 'bg-blue-50 text-blue-700 border-blue-300 ring-1 ring-blue-300';
                  icon = <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 shrink-0" />;
                } else if (stageStatus === 'not_configured' || stageStatus === 'completed_no_matches') {
                  badgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
                  icon = <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />;
                } else if (stageStatus === 'failed') {
                  badgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
                  icon = <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />;
                }

                return (
                  <div
                    key={key}
                    className={`p-3 rounded-lg border flex flex-col justify-between gap-1.5 transition text-xs font-mono ${badgeColor}`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-[11px] truncate">{label}</span>
                      {icon}
                    </div>
                    <span className="text-[10px] opacity-80 truncate" title={stage?.message || stageStatus}>
                      {stage?.message || stageStatus}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Navigation Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate('/timeline')}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs font-mono transition flex items-center gap-2 shadow-xs"
            >
              <span>View Chronological Timeline</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/analysis')}
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-medium text-xs font-mono transition flex items-center gap-2"
            >
              <span>Inspect Image & OCR Analysis</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/graph')}
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-medium text-xs font-mono transition flex items-center gap-2"
            >
              <span>Explore Evidence Graph</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/reports')}
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-medium text-xs font-mono transition flex items-center gap-2"
            >
              <span>Generate Audit Report</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
