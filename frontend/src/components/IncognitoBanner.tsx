import React from 'react';
import { VenetianMask, Shield, Info, LogOut, Trash2 } from 'lucide-react';
import { useIncognito } from '../context/IncognitoContext';

export const IncognitoBanner: React.FC = () => {
  const {
    isIncognito,
    incognitoInvestigations,
    requestExitIncognito,
    clearIncognitoSession,
    setShowPrivacyModal,
  } = useIncognito();

  if (!isIncognito) return null;

  return (
    <div className="bg-gradient-to-r from-purple-50 via-indigo-50/70 to-purple-50 border-b border-purple-200/90 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs select-none shadow-2xs">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
          <VenetianMask className="w-4 h-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-purple-950 font-sans tracking-tight">
              Incognito Mode Active
            </span>
            <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-purple-200/80 text-purple-900 border border-purple-300/80">
              RAM Only — Zero Disk Persistence
            </span>
            {incognitoInvestigations.length > 0 && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-100 text-purple-800">
                {incognitoInvestigations.length} active in-memory {incognitoInvestigations.length === 1 ? 'case' : 'cases'}
              </span>
            )}
          </div>
          <p className="text-[11px] text-purple-800/80 font-sans hidden sm:block">
            Inquiries, search queries, visited sources, and forensic reports will <strong>not</strong> be logged to your database history or normal recovery.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowPrivacyModal(true)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold text-purple-800 hover:text-purple-950 hover:bg-purple-100/80 border border-purple-200 transition"
          title="Inspect privacy boundary limitations"
        >
          <Info className="w-3.5 h-3.5 text-purple-700" />
          <span>Privacy Scope</span>
        </button>

        {incognitoInvestigations.length > 0 && (
          <button
            type="button"
            onClick={clearIncognitoSession}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold text-rose-700 hover:text-rose-900 hover:bg-rose-50 border border-rose-200 transition"
            title="Wipe current in-memory cases"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
            <span className="hidden md:inline">Clear RAM</span>
          </button>
        )}

        <button
          type="button"
          onClick={requestExitIncognito}
          className="flex items-center gap-1 px-3 py-1 rounded-md text-[11px] font-mono font-bold bg-purple-700 hover:bg-purple-800 text-white transition shadow-2xs"
          title="Exit Incognito Mode and return to Standard Mode"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Exit Incognito</span>
        </button>
      </div>
    </div>
  );
};
