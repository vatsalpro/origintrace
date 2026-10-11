import React from 'react';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { DetectiveScene } from '../DetectiveScene';

interface HeroSectionProps {
  onContinue: () => void;
  continueLabel: string;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onContinue, continueLabel }) => {
  const scrollToFeatures = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const el = document.getElementById('features');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="landing-hero relative pt-6 pb-12 sm:pt-10 sm:pb-16 lg:pt-16 lg:pb-20 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
          {/* Left Column: Eyebrow, Headline, Supporting Narrative & Action Hierarchy */}
          <div className="lg:col-span-7 space-y-6 sm:space-y-8">
            {/* Outlined Eyebrow Label with Teal Status Dot */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-[#DFE6EF] shadow-sm text-xs font-mono font-medium text-[#14243A]">
              <span className="w-2 h-2 rounded-full bg-[#0F9D87]" />
              <span className="tracking-wide">AI-POWERED DIGITAL INVESTIGATION</span>
            </div>

            {/* Main Headline */}
            <div className="space-y-4">
              <h1 className="text-4xl sm:text-5xl lg:text-[56px] font-extrabold text-[#14243A] tracking-tight leading-[1.12]">
                Uncover the{' '}
                <span className="text-[#356AE6]">
                  real story
                </span>{' '}
                <br className="hidden sm:inline" />
                behind any image.
              </h1>
              <p className="text-base sm:text-lg text-[#64748B] leading-relaxed max-w-2xl font-normal">
                Discover related visual sources, inspect digital evidence, analyze metadata, and investigate the provenance behind an image.
              </p>
            </div>

            {/* Primary & Secondary Call to Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-1">
              <button
                type="button"
                onClick={onContinue}
                className="px-8 py-4 rounded-xl bg-[#356AE6] hover:bg-[#2453C7] active:bg-[#1d42a2] text-white font-bold text-base transition-all shadow-lg shadow-[#356AE6]/25 hover:shadow-xl hover:shadow-[#356AE6]/35 flex items-center justify-center gap-3 transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#356AE6]"
              >
                <span>{continueLabel}</span>
                <ArrowRight className="w-5 h-5" />
              </button>

              <a
                href="#features"
                onClick={scrollToFeatures}
                className="px-6 py-4 rounded-xl bg-white hover:bg-slate-50 border border-[#DFE6EF] text-[#14243A] hover:text-[#356AE6] font-semibold text-base transition flex items-center justify-center gap-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#356AE6]"
              >
                <span>Explore Features</span>
                <ChevronRight className="w-4 h-4 text-[#64748B]" />
              </a>
            </div>

            {/* Compact Capability Note */}
            <div className="pt-4 border-t border-[#DFE6EF] text-xs font-mono text-[#64748B]">
              <span>Image Discovery · Metadata · Provenance · Timeline</span>
            </div>
          </div>

          {/* Right Column: Interactive 3D Detective Scene */}
          <div className="lg:col-span-5 relative flex items-center justify-center">
            <div className="w-full relative">
              <DetectiveScene />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
