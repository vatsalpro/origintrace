import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  PlusCircle,
  Layers,
  GitCommitHorizontal,
  Share2,
  ScanEye,
  Globe2,
  Archive,
  FileText,
  Settings,
  ShieldCheck,
  VenetianMask,
  X
} from 'lucide-react';
import { useIncognito } from '../context/IncognitoContext';

interface SidebarProps {
  activeInvestigationId?: string;
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeInvestigationId,
  isOpen = true,
  onClose
}) => {
  const { isIncognito } = useIncognito();
  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/new', label: 'New Investigation', icon: PlusCircle },
    { to: '/evidence', label: 'Evidence Explorer', icon: Layers },
    { to: '/timeline', label: 'Evidence Timeline', icon: GitCommitHorizontal },
    { to: '/graph', label: 'Origin Graph', icon: Share2 },
    { to: '/analysis', label: 'Image Analysis', icon: ScanEye },
    { to: '/social-explorer', label: 'Social Explorer', icon: Globe2 },
    { to: '/archive-explorer', label: 'Archive Explorer', icon: Archive },
    { to: '/reports', label: 'Forensic Reports', icon: FileText },
    { to: '/settings', label: 'Source Connectors', icon: Settings },
    { to: '/benchmark', label: 'Benchmark Suite', icon: ShieldCheck },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-xs md:hidden"
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-[#E2E8F0] flex flex-col shrink-0 min-h-screen select-none transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-[#E2E8F0] flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-[#2563EB] to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/20 text-white font-black text-lg">
              OT
            </div>
            <div>
              <h1 className="font-bold text-base tracking-wide text-[#17243A] flex items-center gap-1.5">
                OriginTrace <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-50 text-[#2563EB] font-mono font-bold border border-blue-200">AI</span>
              </h1>
              <p className="text-[11px] text-[#64748B] font-mono">Forensic Workbench</p>
            </div>
          </div>

          {/* Close button on mobile */}
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 md:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Incognito Notice Banner in Sidebar */}
        {isIncognito && (
          <div className="mx-3 mt-3 p-2.5 rounded-lg bg-purple-50 border border-purple-200">
            <div className="flex items-center gap-2 text-xs font-bold text-purple-900">
              <VenetianMask className="w-4 h-4 text-purple-600 shrink-0" />
              <span>Incognito Active</span>
            </div>
            <p className="text-[10px] text-purple-700 mt-0.5 leading-snug">
              RAM-only session. Zero disk persistence.
            </p>
          </div>
        )}

        {/* Navigation Links */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <div className="px-3 py-2 text-[10px] font-semibold tracking-wider text-[#64748B] uppercase font-mono">
            Workbench Views
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => {
                  if (onClose) onClose();
                }}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? isIncognito
                        ? 'bg-purple-100 text-purple-800 border border-purple-300 shadow-xs font-semibold'
                        : 'bg-blue-50 text-[#2563EB] border border-blue-200 shadow-xs font-semibold'
                      : 'text-[#64748B] hover:text-[#17243A] hover:bg-[#F8FAFD]'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Live System Status Pill */}
        <div className={`p-4 border-t border-[#E2E8F0] ${isIncognito ? 'bg-purple-50/60' : 'bg-[#F8FAFD]'}`}>
          {isIncognito ? (
            <>
              <div className="flex items-center justify-between text-xs text-purple-950 mb-1.5">
                <span className="flex items-center gap-1.5 font-bold">
                  <span className="w-2 h-2 rounded-full bg-purple-600 animate-pulse" />
                  Incognito Memory
                </span>
                <span className="text-[10px] font-mono font-bold text-purple-800 bg-purple-100 px-1.5 py-0.5 rounded border border-purple-300">
                  RAM Only
                </span>
              </div>
              <p className="text-[11px] text-purple-700 leading-relaxed">
                Temporary investigation sandbox. Not recorded to disk history.
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs text-[#17243A] mb-1.5">
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="w-2 h-2 rounded-full bg-[#0F9D78] animate-pulse" />
                  Zero-Cost Engine
                </span>
                <span className="text-[10px] font-mono font-bold text-[#0F9D78] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                  Active
                </span>
              </div>
              <p className="text-[11px] text-[#64748B] leading-relaxed">
                Local hashing, Wayback CDX, Bluesky & Mastodon zero-key discovery active.
              </p>
            </>
          )}
        </div>
      </aside>
    </>
  );
};
