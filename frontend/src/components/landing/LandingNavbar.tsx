import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

interface LandingNavbarProps {
  onContinue: () => void;
  continueLabel: string;
}

export const LandingNavbar: React.FC<LandingNavbarProps> = ({ onContinue, continueLabel }) => {
  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="landing-navbar sticky top-0 z-50 bg-[#F8FAFC]/90 backdrop-blur-md border-b border-[#DFE6EF] transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
        {/* Left Side: Forensic Logo Mark & Brand Identity */}
        <Link to="/" className="flex items-center gap-3 group focus:outline-none focus:ring-2 focus:ring-[#356AE6] rounded-xl p-1 -m-1">
          {/* Custom Forensic Target + Image Frame + Magnifier Mark */}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#2453C7] to-[#356AE6] flex items-center justify-center shadow-md shadow-[#356AE6]/20 text-white font-black transition-transform group-hover:scale-105">
            <svg
              className="w-5 h-5 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* Outer frame target corners */}
              <path d="M3 7V5a2 2 0 0 1 2-2h2" />
              <path d="M17 3h2a2 2 0 0 1 2 2v2" />
              <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
              <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
              {/* Magnifier lens center */}
              <circle cx="11.5" cy="11.5" r="4.5" />
              <path d="m15 15 4 4" />
            </svg>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-tight text-[#14243A]">
                OriginTrace
              </span>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100/80 text-[#356AE6] border border-blue-200/60">
                AI
              </span>
            </div>
            <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[#64748B]">
              DIGITAL FORENSICS
            </p>
          </div>
        </Link>

        {/* Right Side: Links & Primary Action */}
        <div className="flex items-center gap-4 sm:gap-7">
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[#64748B]">
            <a
              href="#features"
              onClick={(e) => scrollToSection(e, 'features')}
              className="hover:text-[#356AE6] transition focus:outline-none focus:text-[#356AE6]"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              onClick={(e) => scrollToSection(e, 'how-it-works')}
              className="hover:text-[#356AE6] transition focus:outline-none focus:text-[#356AE6]"
            >
              How It Works
            </a>
            <Link
              to="/dashboard"
              className="hover:text-[#356AE6] transition focus:outline-none focus:text-[#356AE6]"
            >
              Workbench
            </Link>
          </nav>

          <button
            type="button"
            onClick={onContinue}
            className="px-5 py-2.5 rounded-xl bg-[#356AE6] hover:bg-[#2453C7] active:bg-[#1d42a2] text-white font-semibold text-xs sm:text-sm transition-all shadow-md shadow-[#356AE6]/20 hover:shadow-lg hover:shadow-[#356AE6]/30 flex items-center gap-2 transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#356AE6]"
          >
            <span>{continueLabel}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
