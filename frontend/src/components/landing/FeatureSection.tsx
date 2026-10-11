import React from 'react';
import { Search, Fingerprint, ShieldCheck, Clock, ArrowUpRight } from 'lucide-react';

export const FeatureSection: React.FC = () => {
  const features = [
    {
      id: 'discovery',
      icon: Search,
      title: 'Image Discovery',
      badge: 'Visual Search',
      description: 'Find related visual content and discover potentially relevant sources.',
      accentColor: 'text-[#356AE6]',
      badgeBg: 'bg-blue-50 text-[#356AE6] border-blue-200/60'
    },
    {
      id: 'metadata',
      icon: Fingerprint,
      title: 'Metadata Analysis',
      badge: 'Hardware EXIF',
      description: 'Inspect available file properties, metadata, and digital fingerprints.',
      accentColor: 'text-[#D99A32]',
      badgeBg: 'bg-amber-50 text-[#D99A32] border-amber-200/60'
    },
    {
      id: 'provenance',
      icon: ShieldCheck,
      title: 'Provenance Verification',
      badge: 'C2PA Manifest',
      description: 'Examine available content credentials and provenance evidence.',
      accentColor: 'text-[#0F9D87]',
      badgeBg: 'bg-teal-50 text-[#0F9D87] border-teal-200/60'
    },
    {
      id: 'timeline',
      icon: Clock,
      title: 'Evidence Timeline',
      badge: 'Chronology',
      description: 'Organize supported events and timestamps into a clear investigative timeline.',
      accentColor: 'text-[#7C3AED]',
      badgeBg: 'bg-purple-50 text-[#7C3AED] border-purple-200/60'
    }
  ];

  return (
    <section id="features" className="py-20 bg-white border-b border-[#DFE6EF]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-14">
        {/* Section Header */}
        <div className="max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-[#356AE6] text-xs font-mono font-semibold">
            CAPABILITIES
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#14243A] tracking-tight">
            Built for forensic clarity and digital verification.
          </h2>
          <p className="text-[#64748B] text-base leading-relaxed">
            Examine digital evidence across visual, metadata, cryptographic, and chronological dimensions with complete transparency.
          </p>
        </div>

        {/* 4-Column Feature Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                className="p-7 rounded-2xl bg-[#F8FAFC] border border-[#DFE6EF] hover:border-[#356AE6]/40 hover:bg-white hover:shadow-md transition-all duration-200 space-y-4 group flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className={`w-11 h-11 rounded-xl bg-white border border-[#DFE6EF] flex items-center justify-center ${item.accentColor} group-hover:bg-[#356AE6] group-hover:text-white transition-colors shadow-xs`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className={`text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-md border ${item.badgeBg}`}>
                      {item.badge}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-lg font-bold text-[#14243A] tracking-tight">
                      {item.title}
                    </h3>
                    <p className="text-sm text-[#64748B] leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#DFE6EF]/70 flex items-center justify-between text-xs font-mono font-semibold text-[#356AE6]">
                  <span>Explore Module</span>
                  <ArrowUpRight className="w-3.5 h-3.5 transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
