import React from 'react';
import { Link } from 'react-router-dom';

interface LandingFooterProps {
  onContinue: () => void;
  continueLabel: string;
}

export const LandingFooter: React.FC<LandingFooterProps> = ({ onContinue, continueLabel }) => {
  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <footer className="landing-footer bg-white border-t border-[#DFE6EF] py-12 text-[#64748B] text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Brand & Tagline */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#356AE6] flex items-center justify-center text-white font-bold text-xs shadow-xs">
              OT
            </div>
            <div>
              <div className="font-extrabold text-sm text-[#14243A]">OriginTrace AI</div>
              <p className="text-[11px] text-[#64748B]">
                Trace the content. Reconstruct the timeline. Verify the evidence.
              </p>
            </div>
          </div>

          {/* Links & CTA */}
          <div className="flex items-center gap-6 text-sm font-medium">
            <a
              href="#features"
              onClick={(e) => scrollToSection(e, 'features')}
              className="hover:text-[#356AE6] transition"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              onClick={(e) => scrollToSection(e, 'how-it-works')}
              className="hover:text-[#356AE6] transition"
            >
              How It Works
            </a>
            <button
              type="button"
              onClick={onContinue}
              className="text-[#356AE6] hover:underline font-semibold"
            >
              {continueLabel}
            </button>
          </div>
        </div>

        {/* Forensic Integrity Disclosure */}
        <div className="pt-6 border-t border-[#DFE6EF]/70 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-[#64748B]">
          <p>
            Forensic findings depend on available sources, metadata integrity, and verifiable cryptographic assertions.
          </p>
          <p className="font-mono text-[10px]">
            OriginTrace AI Forensic Suite
          </p>
        </div>
      </div>
    </footer>
  );
};
