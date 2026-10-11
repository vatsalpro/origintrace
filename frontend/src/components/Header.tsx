import React from 'react';
import { Shield, Plus, AlertCircle, Menu, VenetianMask, EyeOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Investigation } from '../types';
import { useIncognito } from '../context/IncognitoContext';

interface HeaderProps {
  investigations: Investigation[];
  selectedInvestigationId?: string;
  activeInvestigation?: Investigation | null;
  onSelectInvestigation: (id: string) => void;
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  investigations,
  selectedInvestigationId,
  activeInvestigation,
  onSelectInvestigation,
  onToggleSidebar,
}) => {
  const {
    isIncognito,
    toggleIncognito,
    incognitoInvestigations,
    activeIncognitoId,
    setActiveIncognitoId,
  } = useIncognito();

  // In Incognito mode, scope active case to in-memory incognito cases
  const displayedCases = isIncognito ? incognitoInvestigations : investigations;
  const currentInv = isIncognito
    ? incognitoInvestigations.find((i) => i.id === (activeIncognitoId || selectedInvestigationId)) || activeInvestigation
    : activeInvestigation || investigations.find((i) => i.id === selectedInvestigationId);

  const handleSelectCase = (id: string) => {
    if (isIncognito) {
      setActiveIncognitoId(id);
    }
    onSelectInvestigation(id);
  };

  return (
    <header className="h-16 bg-white border-b border-[#E2E8F0] px-4 md:px-6 flex items-center justify-between shrink-0 shadow-xs select-none">
      <div className="flex items-center gap-3">
        {/* Mobile menu trigger */}
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 md:hidden"
            title="Toggle navigation sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {/* Target Investigation Selector */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase font-mono tracking-wider text-[#64748B] font-semibold hidden sm:inline">
            {isIncognito ? 'Incognito Case:' : 'Active Case:'}
          </span>
          {displayedCases.length > 0 || currentInv ? (
            <select
              value={isIncognito ? (activeIncognitoId || selectedInvestigationId || '') : (selectedInvestigationId || '')}
              onChange={(e) => handleSelectCase(e.target.value)}
              className={`border text-xs sm:text-sm rounded-lg px-2.5 py-1.5 focus:outline-none font-medium shadow-xs transition max-w-[200px] sm:max-w-xs md:max-w-md truncate ${
                isIncognito
                  ? 'bg-purple-50/70 border-purple-200 text-purple-900 focus:border-purple-600 focus:bg-white'
                  : 'bg-[#F8FAFD] border-[#E2E8F0] text-[#17243A] focus:border-[#2563EB] focus:bg-white'
              }`}
            >
              {displayedCases.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {isIncognito ? '🕵️ ' : ''}{inv.id} — {inv.title.slice(0, 42)}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-xs text-[#64748B] italic">
              {isIncognito ? 'No in-memory cases yet' : 'No active case'}
            </span>
          )}
        </div>

        {/* Incognito Pill Indicator */}
        {isIncognito ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono font-bold bg-purple-100 text-purple-800 border border-purple-300 shadow-2xs">
            <VenetianMask className="w-3.5 h-3.5 text-purple-700" />
            <span className="hidden xs:inline">Incognito Active</span>
            <span className="xs:hidden">Incognito</span>
          </span>
        ) : currentInv?.is_incognito ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono font-bold bg-purple-50 text-purple-700 border border-purple-200">
            <EyeOff className="w-3.5 h-3.5 text-purple-600" /> Incognito
          </span>
        ) : null}

        {currentInv?.is_synthetic && (
          <span className="hidden lg:inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-mono font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <AlertCircle className="w-3 h-3 text-amber-600" /> Synthetic Test
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Incognito Mode Toggle Button */}
        <button
          type="button"
          onClick={toggleIncognito}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-xs ${
            isIncognito
              ? 'bg-purple-700 hover:bg-purple-800 text-white border border-purple-800 ring-2 ring-purple-300/60'
              : 'bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200'
          }`}
          title={isIncognito ? 'Click to exit Incognito Mode' : 'Switch to Incognito Mode (RAM-only unrecorded searches)'}
        >
          <VenetianMask className="w-4 h-4 shrink-0" />
          <span className="hidden sm:inline">
            {isIncognito ? 'Exit Incognito' : 'Incognito Mode'}
          </span>
          <span className="sm:hidden">
            {isIncognito ? 'Exit' : 'Incognito'}
          </span>
        </button>

        <Link
          to="/benchmark"
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#F8FAFD] hover:bg-slate-100 text-[#17243A] border border-[#E2E8F0] transition shadow-xs"
        >
          <Shield className="w-3.5 h-3.5 text-[#2563EB]" />
          <span>Benchmark</span>
        </Link>

        <Link
          to="/new"
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white transition shadow-sm ${
            isIncognito ? 'bg-purple-600 hover:bg-purple-700' : 'bg-[#2563EB] hover:bg-blue-700'
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden xs:inline">
            {isIncognito ? 'New Incognito Case' : 'New Case'}
          </span>
        </Link>
      </div>
    </header>
  );
};
