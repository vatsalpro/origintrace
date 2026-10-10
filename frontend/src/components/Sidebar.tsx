import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  PlusCircle,
  GitCommitHorizontal,
  Share2,
  ScanEye,
  Globe2,
  Archive,
  FileText,
  Settings,
  ShieldCheck,
  Activity
} from 'lucide-react';

interface SidebarProps {
  activeInvestigationId?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeInvestigationId }) => {
  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/new', label: 'New Investigation', icon: PlusCircle },
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
    <aside className="w-64 bg-[#111827] border-r border-[#1e293b] flex flex-col shrink-0 min-h-screen">
      {/* Brand Header */}
      <div className="p-5 border-b border-[#1e293b] flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-[#0284c7] to-[#38bdf8] flex items-center justify-center shadow-lg shadow-sky-500/20 text-[#0B1020] font-black text-lg">
          OT
        </div>
        <div>
          <h1 className="font-bold text-base tracking-wide text-white flex items-center gap-1.5">
            OriginTrace <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 font-mono">AI</span>
          </h1>
          <p className="text-[11px] text-slate-400 font-mono">Digital Forensics Platform</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="px-3 py-2 text-[11px] font-semibold tracking-wider text-slate-500 uppercase font-mono">
          Workbench Navigation
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30 shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-[#182235]'
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
      <div className="p-4 border-t border-[#1e293b] bg-[#0B1020]/50">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Zero-Cost Mode
          </span>
          <span className="text-[11px] font-mono text-emerald-400">100% Free</span>
        </div>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          Local perceptual hashing, public Wayback CDX, Bluesky & Mastodon APIs active.
        </p>
      </div>
    </aside>
  );
};
