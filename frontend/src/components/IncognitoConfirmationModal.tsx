import React from 'react';
import { VenetianMask, AlertTriangle, X, Trash2 } from 'lucide-react';

interface IncognitoConfirmationModalProps {
  isOpen: boolean;
  activeCasesCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export const IncognitoConfirmationModal: React.FC<IncognitoConfirmationModalProps> = ({
  isOpen,
  activeCasesCount,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div
      onClick={onCancel}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white border border-purple-200 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative text-slate-800"
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-700 shrink-0">
              <VenetianMask className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Exit Incognito Mode?</h3>
              <p className="text-xs text-slate-500 font-mono">Temporary in-memory workspace warning</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning Content */}
        <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200/90 text-amber-900 text-xs sm:text-sm space-y-2">
          <div className="flex items-center gap-2 font-bold text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Unsaved In-Memory Activity Will Be Destroyed</span>
          </div>
          <p className="text-xs text-amber-800/90 leading-relaxed font-sans">
            You currently have <strong>{activeCasesCount} active {activeCasesCount === 1 ? 'investigation' : 'investigations'}</strong> held in temporary memory.
            Because Incognito Mode guarantees zero database persistence, exiting will immediately wipe all temporary evidence, queries, and reports from RAM.
          </p>
        </div>

        <p className="text-xs text-slate-500 font-sans leading-relaxed">
          Your saved investigations in standard history will remain intact and unchanged. Once cleared, this Incognito session cannot be recovered.
        </p>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
          >
            Stay in Incognito
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition flex items-center gap-1.5 shadow-sm"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Exit & Clear In-Memory Data</span>
          </button>
        </div>
      </div>
    </div>
  );
};
