import React from 'react';
import { ShieldCheck, Archive, Eye, Layers } from 'lucide-react';

export const TrustStrip: React.FC = () => {
  const capabilities = [
    {
      icon: Eye,
      title: 'Zero-Cost First',
      desc: 'Local perceptual hashing and public APIs run free without mandatory paid keys.'
    },
    {
      icon: ShieldCheck,
      title: 'C2PA Local Verification',
      desc: 'Cryptographic validation of embedded JUMBF manifests & signer credentials.'
    },
    {
      icon: Archive,
      title: 'Wayback CDX API',
      desc: 'Public historical snapshot matching across internet archive chronologies.'
    },
    {
      icon: Layers,
      title: 'Perceptual Invariance',
      desc: 'Multi-algorithm hashing (pHash, dHash, wHash) resilient against visual edits.'
    }
  ];

  return (
    <div className="border-y border-[#DFE6EF] bg-[#EEF3F8]/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {capabilities.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div key={idx} className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-lg bg-white border border-[#DFE6EF] flex items-center justify-center text-[#356AE6] shrink-0 shadow-xs">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold font-mono text-[#14243A] uppercase tracking-wide">
                    {item.title}
                  </h4>
                  <p className="text-xs text-[#64748B] leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
