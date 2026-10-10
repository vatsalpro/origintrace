import React, { useState } from 'react';
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
  ShieldAlert
} from 'lucide-react';
import { api } from '../services/api';

interface NewInvestigationProps {
  onInvestigationCreated: (id: string) => void;
}

export const NewInvestigation: React.FC<NewInvestigationProps> = ({ onInvestigationCreated }) => {
  const navigate = useNavigate();
  const [inputType, setInputType] = useState<'url' | 'image' | 'video' | 'screenshot' | 'text' | 'combined'>('image');
  const [title, setTitle] = useState('');
  const [urlOrText, setUrlOrText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['wayback', 'bluesky', 'mastodon']);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setStatusMessage('Uploading and extracting cryptographic fingerprints & perceptual hashes...');

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

      const inv = await api.createInvestigation(formData);
      setSuccessId(inv.id);
      setStatusMessage(`Investigation ${inv.id} launched! Querying archive snapshots and social platforms...`);
      onInvestigationCreated(inv.id);

      // Brief delay to let background task register before navigating to timeline
      setTimeout(() => {
        navigate('/timeline');
      }, 1500);
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
        <h2 className="text-2xl font-bold text-white tracking-tight">Initiate Digital Forensics Investigation</h2>
        <p className="text-sm text-slate-400 font-mono mt-1">
          Submit content to trace prior public appearances across supported networks and historical web archives.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-400 text-sm">
          <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block">Security or Validation Error</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {successId && (
        <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3 text-emerald-400 text-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <div>
            <span className="font-semibold block">Inquiry Registered Successfully ({successId})</span>
            <span>{statusMessage}</span>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-[#111827] border border-[#1e293b] p-6 rounded-xl space-y-6">
        {/* Title */}
        <div className="space-y-1.5">
          <label className="text-xs font-mono uppercase text-slate-300 font-semibold">Investigation Title / Case Reference</label>
          <input
            type="text"
            placeholder="e.g. Suspected Recycled Disaster Photo in Breaking News"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-[#182235] border border-[#1e293b] text-sm text-white rounded-lg px-4 py-2.5 focus:outline-none focus:border-sky-500"
          />
        </div>

        {/* Input Type Selector */}
        <div className="space-y-2">
          <label className="text-xs font-mono uppercase text-slate-300 font-semibold">Evidence Input Mode</label>
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
                      ? 'bg-sky-500/20 border-sky-500 text-sky-400 font-semibold'
                      : 'bg-[#182235] border-[#1e293b] text-slate-400 hover:text-white hover:bg-[#1f2d47]'
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
            <label className="text-xs font-mono uppercase text-slate-300 font-semibold">
              Target Media File Upload (Max 50MB)
            </label>
            <div className="border-2 border-dashed border-[#1e293b] hover:border-sky-500/50 rounded-xl p-6 text-center bg-[#182235]/40 transition">
              <input
                type="file"
                id="file-upload"
                onChange={handleFileChange}
                accept="image/*,video/*"
                className="hidden"
              />
              <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-2">
                <Upload className="w-8 h-8 text-sky-400" />
                <span className="text-sm font-medium text-slate-200">
                  {file ? file.name : 'Click to browse or drop target image/screenshot'}
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  Calculates SHA-256, pHash, dHash, aHash, wHash and runs OCR extraction
                </span>
              </label>
            </div>
          </div>
        )}

        {/* URL or Text Claim Input */}
        {['url', 'text', 'combined'].includes(inputType) && (
          <div className="space-y-1.5">
            <label className="text-xs font-mono uppercase text-slate-300 font-semibold">
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
              className="w-full bg-[#182235] border border-[#1e293b] text-sm text-white rounded-lg px-4 py-2.5 focus:outline-none focus:border-sky-500"
            />
          </div>
        )}

        {/* Target Platforms */}
        <div className="space-y-2">
          <label className="text-xs font-mono uppercase text-slate-300 font-semibold">Available Search Sources</label>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'wayback', label: 'Wayback Machine (CDX)', ready: true },
              { id: 'bluesky', label: 'Bluesky Public API', ready: true },
              { id: 'mastodon', label: 'Mastodon Federated', ready: true },
              { id: 'web_search', label: 'Web Page Metadata', ready: true },
              { id: 'youtube', label: 'YouTube API (Optional Key)', ready: false },
              { id: 'reddit', label: 'Reddit OAuth (Optional Key)', ready: false },
            ].map((p) => {
              const active = selectedPlatforms.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => togglePlatform(p.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-mono flex items-center gap-1.5 border transition ${
                    active
                      ? 'bg-sky-500/15 border-sky-500/40 text-sky-400 font-medium'
                      : 'bg-[#182235] border-[#1e293b] text-slate-500'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${p.ready ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing Evidence Pipeline...</span>
              </>
            ) : (
              <span>Launch Origin Inquiry</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
