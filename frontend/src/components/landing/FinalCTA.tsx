import React from 'react';
import { ArrowRight } from 'lucide-react';

interface FinalCTAProps {
  onContinue: () => void;
  continueLabel: string;
}

export const FinalCTA: React.FC<FinalCTAProps> = ({ onContinue, continueLabel }) => {
  return (
    <section className="py-20 bg-[#EEF3F8] border-t border-[#DFE6EF] relative overflow-hidden">
      {/* Subtle radial accent gradient */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none -z-0">
        <div className="w-[500px] h-[300px] bg-gradient-to-r from-blue-200/40 via-sky-200/30 to-indigo-100/40 blur-3xl rounded-full" />
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-8 relative z-10">
        <div className="space-y-3">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#14243A] tracking-tight">
            Every clue has a story. Start tracing yours.
          </h2>
          <p className="text-base sm:text-lg text-[#64748B] max-w-xl mx-auto">
            Bring your digital evidence into focus with OriginTrace AI.
          </p>
        </div>

        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={onContinue}
            className="px-8 py-4 rounded-xl bg-[#356AE6] hover:bg-[#2453C7] active:bg-[#1d42a2] text-white font-bold text-base transition-all shadow-lg shadow-[#356AE6]/25 hover:shadow-xl hover:shadow-[#356AE6]/35 flex items-center justify-center gap-3 transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#356AE6]"
          >
            <span>{continueLabel}</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </section>
  );
};
