import React from 'react';
import { Upload, Search, GitMerge } from 'lucide-react';

export const WorkflowSection: React.FC = () => {
  const steps = [
    {
      step: '01',
      title: 'Submit',
      desc: 'Start with an image or another supported digital artifact.',
      icon: Upload
    },
    {
      step: '02',
      title: 'Investigate',
      desc: 'Analyze available metadata and search configured sources for relevant evidence.',
      icon: Search
    },
    {
      step: '03',
      title: 'Connect the Evidence',
      desc: 'Review provenance findings and organize supported events into a timeline.',
      icon: GitMerge
    }
  ];

  return (
    <section id="how-it-works" className="py-20 bg-[#F8FAFC]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-16">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-[#356AE6] text-xs font-mono font-semibold">
            HOW IT WORKS
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#14243A] tracking-tight">
            How an investigation unfolds.
          </h2>
          <p className="text-[#64748B] text-base leading-relaxed">
            A structured three-phase pipeline from initial artifact intake to verifiable evidence timeline.
          </p>
        </div>

        {/* 3-Step Horizontal Process on Desktop / Stacked on Mobile */}
        <div className="relative">
          {/* Subtle Horizontal Connecting Line (Desktop) */}
          <div className="hidden md:block absolute top-14 left-[16%] right-[16%] h-[2px] bg-[#DFE6EF] -z-0" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-10 relative z-10">
            {steps.map((item, index) => {
              const Icon = item.icon;
              return (
                <div
                  key={index}
                  className="p-8 rounded-2xl bg-white border border-[#DFE6EF] shadow-xs space-y-4 text-center sm:text-left flex flex-col items-center sm:items-start"
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="w-12 h-12 rounded-xl bg-[#EEF3F8] border border-[#DFE6EF] flex items-center justify-center text-[#356AE6] shadow-xs">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-mono font-bold text-[#356AE6] bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200/50">
                      STEP {item.step}
                    </span>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <h3 className="text-xl font-bold text-[#14243A] tracking-tight">
                      {item.title}
                    </h3>
                    <p className="text-sm text-[#64748B] leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
