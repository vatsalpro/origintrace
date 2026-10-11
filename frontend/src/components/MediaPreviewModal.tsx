import React from 'react';
import { X, ExternalLink, Image as ImageIcon, Download } from 'lucide-react';
import { cleanAndNormalizeUrl, safeOpenExternalUrl } from '../utils/url';

interface MediaPreviewModalProps {
  mediaUrl: string | null;
  title?: string;
  onClose: () => void;
}

export const MediaPreviewModal: React.FC<MediaPreviewModalProps> = ({
  mediaUrl,
  title,
  onClose
}) => {
  if (!mediaUrl) return null;

  const cleanUrl = cleanAndNormalizeUrl(mediaUrl) || mediaUrl;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full p-6 space-y-4 shadow-2xl relative text-slate-800"
      >
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900 truncate max-w-md">
              {title || 'Media Asset Preview'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Media Preview Container */}
        <div className="w-full min-h-[280px] max-h-[500px] flex items-center justify-center bg-slate-50 rounded-xl border border-slate-200 overflow-hidden p-2">
          <img
            src={cleanUrl}
            alt={title || 'Media preview'}
            className="max-h-[480px] max-w-full object-contain rounded"
            onError={(e) => {
              (e.target as HTMLImageElement).alt = 'Media preview failed to load from provider.';
            }}
          />
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs font-mono">
          <span className="text-slate-500 break-all truncate max-w-md text-[11px]">
            {cleanUrl}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={(e) => safeOpenExternalUrl(cleanUrl, e)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition shadow-xs"
            >
              <span>Open Direct Media File</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
