import React from 'react';
import {
  ScanEye,
  Hash,
  FileCode,
  Maximize2,
  Cpu,
  Info,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { Investigation } from '../types';

interface ImageAnalysisProps {
  investigation?: Investigation;
}

export const ImageAnalysis: React.FC<ImageAnalysisProps> = ({ investigation }) => {
  const asset = investigation?.assets?.[0];

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Page Title */}
      <div className="border-b border-[#1e293b] pb-6">
        <h2 className="text-2xl font-bold text-white tracking-tight">Image & Media Forensics Analysis</h2>
        <p className="text-sm text-slate-400 font-mono mt-1">
          Cryptographic bitstream hashing, multi-algorithm perceptual fingerprints, EXIF metadata, and OCR extraction
        </p>
      </div>

      {!asset ? (
        <div className="p-12 text-center bg-[#111827] border border-[#1e293b] rounded-xl text-slate-400 font-mono">
          No image or media asset attached to current investigation ({investigation?.id || 'None'}).
          Please launch an investigation with an uploaded image or screenshot to view fingerprint analysis.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Asset Identity & Hashes */}
          <div className="lg:col-span-2 space-y-6">
            {/* Cryptographic and Perceptual Hashes Card */}
            <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-6 space-y-4">
              <div className="flex items-center gap-2 text-white font-semibold text-base border-b border-[#1e293b] pb-3">
                <Hash className="w-5 h-5 text-sky-400" />
                <span>Extracted Cryptographic & Perceptual Fingerprints</span>
              </div>

              <div className="space-y-3 font-mono text-xs">
                <div className="bg-[#182235] p-3 rounded-lg border border-[#1e293b] space-y-1">
                  <div className="flex items-center justify-between text-slate-400 text-[11px]">
                    <span className="font-bold text-sky-400 uppercase">SHA-256 (Bitstream Identity)</span>
                    <span>Exact Match Filter</span>
                  </div>
                  <div className="text-slate-200 break-all select-all pt-1 font-semibold">
                    {asset.sha256 || 'N/A'}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-[#182235] p-3 rounded-lg border border-[#1e293b] space-y-1">
                    <span className="font-bold text-emerald-400 uppercase text-[11px] block">pHash (Perceptual DCT)</span>
                    <span className="text-slate-200 select-all font-semibold block">{asset.perceptual_hash || 'N/A'}</span>
                    <span className="text-[10px] text-slate-500 block">Robust against resizing & recompression</span>
                  </div>

                  <div className="bg-[#182235] p-3 rounded-lg border border-[#1e293b] space-y-1">
                    <span className="font-bold text-purple-400 uppercase text-[11px] block">dHash (Difference Gradient)</span>
                    <span className="text-slate-200 select-all font-semibold block">{asset.difference_hash || 'N/A'}</span>
                    <span className="text-[10px] text-slate-500 block">Gradient luminance comparison</span>
                  </div>

                  <div className="bg-[#182235] p-3 rounded-lg border border-[#1e293b] space-y-1">
                    <span className="font-bold text-amber-400 uppercase text-[11px] block">aHash (Average Luminance)</span>
                    <span className="text-slate-200 select-all font-semibold block">{asset.average_hash || 'N/A'}</span>
                    <span className="text-[10px] text-slate-500 block">Fast low-frequency spatial mean</span>
                  </div>

                  <div className="bg-[#182235] p-3 rounded-lg border border-[#1e293b] space-y-1">
                    <span className="font-bold text-cyan-400 uppercase text-[11px] block">wHash (Wavelet Transform)</span>
                    <span className="text-slate-200 select-all font-semibold block">{asset.wavelet_hash || 'N/A'}</span>
                    <span className="text-[10px] text-slate-500 block">Discrete wavelet frequency domain</span>
                  </div>
                </div>
              </div>
            </div>

            {/* OCR Extracted Text & Entities */}
            <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-6 space-y-4">
              <div className="flex items-center gap-2 text-white font-semibold text-base border-b border-[#1e293b] pb-3">
                <FileCode className="w-5 h-5 text-sky-400" />
                <span>OCR Text & Embedded Clue Extraction</span>
              </div>

              {asset.ocr_text ? (
                <div className="space-y-4">
                  <div>
                    <span className="text-[11px] font-mono uppercase text-slate-400 block mb-1">
                      Raw Text Extracted from Image
                    </span>
                    <div className="bg-[#182235] p-4 rounded-lg border border-[#1e293b] text-sm text-slate-200 font-mono whitespace-pre-wrap leading-relaxed">
                      {asset.ocr_text}
                    </div>
                  </div>

                  {asset.extracted_entities && (
                    <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                      <div className="bg-[#182235] p-3 rounded-lg border border-[#1e293b]">
                        <span className="text-slate-400 block mb-1 text-[11px]">Identified Handles:</span>
                        <div className="text-sky-300 font-semibold">
                          {asset.extracted_entities.handles?.join(', ') || '(None)'}
                        </div>
                      </div>
                      <div className="bg-[#182235] p-3 rounded-lg border border-[#1e293b]">
                        <span className="text-slate-400 block mb-1 text-[11px]">Detected Date Strings:</span>
                        <div className="text-emerald-300 font-semibold">
                          {asset.extracted_entities.dates?.join(', ') || '(None)'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-[#182235] text-xs text-slate-400 font-mono">
                  No visible text characters were detected inside the asset, or Tesseract binary was not reachable.
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Dimensions, EXIF & Methodology */}
          <div className="space-y-6">
            {/* Dimensions & Asset Metadata */}
            <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-6 space-y-4">
              <div className="flex items-center gap-2 text-white font-semibold text-base border-b border-[#1e293b] pb-3">
                <Maximize2 className="w-5 h-5 text-sky-400" />
                <span>Geometry & Format</span>
              </div>

              <div className="space-y-2.5 font-mono text-xs">
                <div className="flex justify-between py-1 border-b border-[#1e293b]">
                  <span className="text-slate-400">Resolution:</span>
                  <span className="text-white font-semibold">
                    {asset.image_width} × {asset.image_height} px
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#1e293b]">
                  <span className="text-slate-400">File Format:</span>
                  <span className="text-white font-semibold">{asset.image_format || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#1e293b]">
                  <span className="text-slate-400">File Size:</span>
                  <span className="text-white font-semibold">
                    {(asset.file_size_bytes / 1024).toFixed(1)} KB
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Original Filename:</span>
                  <span className="text-white truncate max-w-[150px]">{asset.original_filename || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Methodological Guidance Notice */}
            <div className="bg-[#182235] border border-[#1e293b] rounded-xl p-5 space-y-3 text-xs leading-relaxed">
              <div className="flex items-center gap-2 text-amber-400 font-semibold font-mono">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Forensic Interpretation Rules</span>
              </div>
              <ul className="space-y-2 text-slate-300 list-disc list-inside">
                <li>
                  <strong>SHA-256:</strong> Confirms identical byte streams. Even 1-pixel change or JPEG recompression invalidates SHA-256.
                </li>
                <li>
                  <strong>Perceptual Hashing (pHash):</strong> Matches resized, watermarked, or re-saved images (Hamming distance ≤ 6 indicates strong visual match).
                </li>
                <li>
                  <strong>EXIF Provenance:</strong> EXIF metadata can be easily stripped or modified; treated as supportive context rather than infallible proof.
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
