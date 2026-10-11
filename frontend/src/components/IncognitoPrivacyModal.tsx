import React from 'react';
import { VenetianMask, Shield, Globe, Server, Laptop, X, Check } from 'lucide-react';

interface IncognitoPrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const IncognitoPrivacyModal: React.FC<IncognitoPrivacyModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white border border-purple-200 rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl relative text-slate-800"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-700 shrink-0">
              <VenetianMask className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Incognito Privacy Boundary</h3>
              <p className="text-xs text-slate-500 font-mono">Understanding OriginTrace AI's privacy scope</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* What Incognito Protects */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs uppercase font-mono font-bold text-purple-700">
            <Shield className="w-4 h-4" />
            <span>What Incognito Mode Does (Guaranteed)</span>
          </div>
          <ul className="space-y-2 text-xs text-slate-600 font-sans">
            <li className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-bold mt-0.5 shrink-0">✓</span>
              <span><strong>Zero database persistence:</strong> Search queries, uploaded assets, extracted metadata, OCR text, and matches are kept strictly in RAM (in-memory SQLite) and never committed to disk.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-bold mt-0.5 shrink-0">✓</span>
              <span><strong>Hidden from history:</strong> Incognito inquiries never appear in your dashboard history, recent inquiries, exported logs, or analytics.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-bold mt-0.5 shrink-0">✓</span>
              <span><strong>Immediate destruction:</strong> Closing the session or clicking "Exit Incognito" clears all in-memory records and wipes any temporary files completely.</span>
            </li>
          </ul>
        </div>

        {/* What Incognito Does NOT Guarantee */}
        <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 text-xs space-y-2.5">
          <div className="flex items-center gap-2 text-xs uppercase font-mono font-bold text-amber-900">
            <span>⚠️ What Incognito Mode Does NOT Guarantee</span>
          </div>
          <p className="text-amber-800 leading-relaxed font-sans">
            Incognito Mode prevents <em>this application</em> from recording your activity locally. It does <strong>not</strong> make you invisible or anonymous across the internet:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-[11px] text-amber-900/90 font-mono">
            <div className="p-2.5 rounded-lg bg-white/80 border border-amber-200/80">
              <Globe className="w-3.5 h-3.5 text-amber-700 mb-1" />
              <div className="font-bold">Network Providers</div>
              <div className="text-[10px] text-amber-800">Your ISP or corporate network can see outgoing server connections.</div>
            </div>
            <div className="p-2.5 rounded-lg bg-white/80 border border-amber-200/80">
              <Server className="w-3.5 h-3.5 text-amber-700 mb-1" />
              <div className="font-bold">External APIs</div>
              <div className="text-[10px] text-amber-800">Queried third-party endpoints (e.g. SerpApi, YouTube) log their incoming calls.</div>
            </div>
            <div className="p-2.5 rounded-lg bg-white/80 border border-amber-200/80">
              <Laptop className="w-3.5 h-3.5 text-amber-700 mb-1" />
              <div className="font-bold">System Monitors</div>
              <div className="text-[10px] text-amber-800">Local OS-level packet monitors or keyloggers can observe actions.</div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-bold bg-purple-700 hover:bg-purple-800 text-white transition flex items-center gap-1.5 shadow-sm"
          >
            <Check className="w-3.5 h-3.5" />
            <span>I Understand</span>
          </button>
        </div>
      </div>
    </div>
  );
};
