import React from 'react';
import { Shield, Sparkles, Plus, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Investigation } from '../types';

interface HeaderProps {
  investigations: Investigation[];
  selectedInvestigationId?: string;
  onSelectInvestigation: (id: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  investigations,
  selectedInvestigationId,
  onSelectInvestigation,
}) => {
  const currentInv = investigations.find((i) => i.id === selectedInvestigationId);

  return (
    <header className="h-16 bg-[#111827] border-b border-[#1e293b] px-6 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase font-mono tracking-wider text-slate-400">Target Investigation:</span>
          {investigations.length > 0 ? (
            <select
              value={selectedInvestigationId || ''}
              onChange={(e) => onSelectInvestigation(e.target.value)}
              className="bg-[#182235] border border-[#1e293b] text-sm text-white rounded-md px-3 py-1.5 focus:outline-none focus:border-sky-500 font-medium"
            >
              {investigations.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.id} — {inv.title.slice(0, 45)}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-xs text-slate-500 italic">No investigations recorded</span>
          )}
        </div>

        {currentInv?.is_synthetic && (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-mono font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <AlertCircle className="w-3 h-3" /> Synthetic Benchmark Case
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Link
          to="/benchmark"
          className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium bg-[#182235] hover:bg-[#1f2d47] text-slate-200 border border-[#1e293b] transition"
        >
          <Shield className="w-3.5 h-3.5 text-sky-400" />
          <span>Run Benchmark</span>
        </Link>

        <Link
          to="/new"
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-slate-950 transition shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Investigation</span>
        </Link>
      </div>
    </header>
  );
};
