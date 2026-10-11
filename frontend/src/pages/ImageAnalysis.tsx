import React, { useState, useEffect } from 'react';
import {
  ScanEye,
  Hash,
  FileCode,
  Cpu,
  CheckCircle2,
  AlertCircle,
  Camera,
  MapPin,
  Image as ImageIcon,
  ShieldCheck,
  Info,
  Sparkles
} from 'lucide-react';
import { Investigation, InvestigationDiagnostics } from '../types';
import { api } from '../services/api';
import { SourceLinkActions } from '../components/SourceLinkActions';
import { safeOpenExternalUrl } from '../utils/url';
import { MediaPreviewModal } from '../components/MediaPreviewModal';

interface ImageAnalysisProps {
  investigation?: Investigation;
}

export const ImageAnalysis: React.FC<ImageAnalysisProps> = ({ investigation }) => {
  const [diagnostics, setDiagnostics] = useState<InvestigationDiagnostics | null>(null);
  const [previewMedia, setPreviewMedia] = useState<{ url: string; title: string } | null>(null);

  useEffect(() => {
    if (investigation?.id) {
      api.getInvestigationDiagnostics(investigation.id)
        .then((res) => setDiagnostics(res))
        .catch(() => {});
    }
  }, [investigation?.id]);

  const asset = investigation?.assets?.[0];
  const visualCandidates = (investigation?.evidence_records || []).filter(
    (ev) => ev.candidate_image_url || ev.candidate_thumbnail_path || (ev.visual_similarity !== undefined && ev.visual_similarity > 0)
  );

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Page Title */}
      <div className="border-b border-slate-200 pb-6">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Image & Media Forensics Analysis</h2>
        <p className="text-sm text-slate-500 font-mono mt-1">
          Cryptographic bitstream hashing, multi-algorithm perceptual fingerprints, EXIF hardware metadata, OCR extraction, and visual candidate comparisons
        </p>
      </div>

      {!asset ? (
        <div className="p-12 text-center bg-white border border-slate-200 rounded-xl text-slate-500 font-mono shadow-xs">
          No image or media asset attached to current investigation ({investigation?.id || 'None'}).
          Please launch an investigation with an uploaded image or screenshot to view fingerprint analysis.
        </div>
      ) : (
        <div className="space-y-8">
          {/* Top Section: Target Asset Image & Core Properties */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Target Media Preview */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center space-y-4 shadow-xs">
              <div className="w-full flex items-center justify-between border-b border-slate-200 pb-3 text-xs font-mono">
                <span className="font-bold text-blue-700 uppercase flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4" /> Target Evidence Asset
                </span>
                <span className="text-slate-500">ID: {asset.id.slice(0, 8)}</span>
              </div>

              <div
                onClick={() =>
                  investigation &&
                  setPreviewMedia({
                    url: api.getAssetFileUrl(investigation.id, asset.id),
                    title: asset.original_filename || 'Target Evidence Asset'
                  })
                }
                className="w-full relative rounded-lg overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center min-h-[220px] max-h-[320px] cursor-pointer hover:ring-2 hover:ring-blue-400 transition"
                title="Click to view full preview"
              >
                {investigation && (
                  <img
                    src={api.getAssetFileUrl(investigation.id, asset.id)}
                    alt={asset.original_filename || 'Evidence Asset'}
                    className="max-h-[300px] max-w-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                )}
              </div>

              <div className="w-full grid grid-cols-2 gap-2 text-xs font-mono text-slate-500 pt-1">
                <div>
                  <span className="block text-[10px] text-slate-400 uppercase">Dimensions</span>
                  <span className="text-slate-900 font-semibold">
                    {asset.image_width && asset.image_height ? `${asset.image_width} × ${asset.image_height} px` : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 uppercase">File Size</span>
                  <span className="text-slate-900 font-semibold">{(asset.file_size_bytes / 1024).toFixed(1)} KB</span>
                </div>
              </div>
            </div>

            {/* Hardware EXIF & Camera Provenance */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-xs">
              <div className="flex items-center gap-2 text-slate-900 font-semibold text-base border-b border-slate-200 pb-3">
                <Camera className="w-5 h-5 text-blue-600" />
                <span>EXIF & Hardware Metadata</span>
              </div>

              <div className="space-y-3 font-mono text-xs">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-[10px] uppercase text-slate-500 block mb-0.5">Camera Device</span>
                  <span className="text-slate-900 font-semibold text-sm">
                    {asset.camera_make || asset.camera_model
                      ? `${asset.camera_make || ''} ${asset.camera_model || ''}`.trim()
                      : 'None Detected (Stripped or Screenshot)'}
                  </span>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-[10px] uppercase text-slate-500 block mb-0.5">Software / Editing Tool</span>
                  <span className="text-slate-900 font-semibold">
                    {asset.software || 'None Recorded'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] uppercase text-slate-500 block mb-0.5">Capture Timestamp</span>
                    <span className="text-blue-700 font-semibold truncate block">
                      {asset.capture_time || 'None in EXIF'}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] uppercase text-slate-500 block mb-0.5">ICC Profile</span>
                    <span className="text-slate-700 truncate block">
                      {asset.icc_profile || 'Standard / Unspecified'}
                    </span>
                  </div>
                </div>

                {asset.gps_info && Object.keys(asset.gps_info).length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg flex items-center gap-2 text-blue-700">
                    <MapPin className="w-4 h-4 shrink-0" />
                    <div>
                      <span className="font-bold text-[11px] block">Embedded GPS Coordinates</span>
                      <span className="text-[11px]">
                        {asset.gps_info.latitude?.toFixed(5)}, {asset.gps_info.longitude?.toFixed(5)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Forensic Interpretation Rules */}
            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-5 space-y-3 text-xs leading-relaxed">
              <div className="flex items-center gap-2 text-amber-800 font-semibold font-mono">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                <span>Forensic Interpretation Rules</span>
              </div>
              <ul className="space-y-2 text-slate-700 list-disc list-inside">
                <li>
                  <strong>SHA-256:</strong> Confirms identical byte streams. Even 1-pixel change or JPEG recompression invalidates SHA-256.
                </li>
                <li>
                  <strong>Perceptual Hashing (pHash):</strong> Matches resized, watermarked, or re-saved images (Hamming distance ≤ 10 indicates strong visual match).
                </li>
                <li>
                  <strong>EXIF Provenance:</strong> EXIF metadata is stripped by most major platforms upon upload. Missing EXIF does not indicate synthetic content.
                </li>
              </ul>
            </div>
          </div>

          {/* Cryptographic and Perceptual Hashes Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-xs">
            <div className="flex items-center gap-2 text-slate-900 font-semibold text-base border-b border-slate-200 pb-3">
              <Hash className="w-5 h-5 text-blue-600" />
              <span>Extracted Cryptographic & Perceptual Fingerprints</span>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
                <div className="flex items-center justify-between text-slate-500 text-[11px]">
                  <span className="font-bold text-blue-700 uppercase">SHA-256 (Bitstream Identity)</span>
                  <span>Exact Match Filter</span>
                </div>
                <div className="text-slate-900 break-all select-all pt-1 font-semibold">
                  {asset.sha256 || 'N/A'}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
                  <span className="font-bold text-emerald-700 uppercase text-[11px] block">pHash (DCT)</span>
                  <span className="text-slate-900 select-all font-semibold block">{asset.perceptual_hash || 'N/A'}</span>
                  <span className="text-[10px] text-slate-500 block">Robust against resizing & compression</span>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
                  <span className="font-bold text-purple-700 uppercase text-[11px] block">dHash (Gradient)</span>
                  <span className="text-slate-900 select-all font-semibold block">{asset.difference_hash || 'N/A'}</span>
                  <span className="text-[10px] text-slate-500 block">Gradient luminance comparison</span>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
                  <span className="font-bold text-amber-700 uppercase text-[11px] block">aHash (Mean)</span>
                  <span className="text-slate-900 select-all font-semibold block">{asset.average_hash || 'N/A'}</span>
                  <span className="text-[10px] text-slate-500 block">Fast low-frequency spatial mean</span>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
                  <span className="font-bold text-cyan-700 uppercase text-[11px] block">wHash (Wavelet)</span>
                  <span className="text-slate-900 select-all font-semibold block">{asset.wavelet_hash || 'N/A'}</span>
                  <span className="text-[10px] text-slate-500 block">Discrete wavelet frequency domain</span>
                </div>
              </div>
            </div>
          </div>

          {/* C2PA Content Credentials Provenance Panel */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2 text-slate-900 font-semibold text-base">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                <span>C2PA Content Credentials Provenance Verification</span>
              </div>

              {/* C2PA Status Badge */}
              <div className="flex items-center gap-2">
                {asset.c2pa_status === 'verified' ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Cryptographically Verified (Trusted Signer)
                  </span>
                ) : asset.c2pa_status === 'untrusted' ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> Manifest Detected (Untrusted / Self-Signed Root)
                  </span>
                ) : asset.c2pa_status === 'invalid' ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600" /> Invalid Signature / Manifest Tampered
                  </span>
                ) : asset.c2pa_status === 'no_manifest' ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1">
                    <Info className="w-3.5 h-3.5" /> No C2PA Manifest Detected
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1">
                    <Info className="w-3.5 h-3.5" /> Verification Unavailable / Skipped
                  </span>
                )}
              </div>
            </div>

            {asset.c2pa_data?.has_manifest ? (
              <div className="space-y-4 font-mono text-xs">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <span className="text-[10px] uppercase text-slate-500 block mb-0.5">Claim Generator / Tool</span>
                    <span className="text-slate-900 font-semibold text-sm">
                      {asset.c2pa_data.claim_generator || 'Unknown Generator'}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <span className="text-[10px] uppercase text-slate-500 block mb-0.5">Signer / Certificate Authority</span>
                    <span className="text-emerald-700 font-semibold text-sm truncate block" title={asset.c2pa_data.issuer || ''}>
                      {asset.c2pa_data.issuer || 'Self-Signed / Unspecified CA'}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <span className="text-[10px] uppercase text-slate-500 block mb-0.5">Cryptographic Timestamp</span>
                    <span className="text-blue-700 font-semibold block truncate">
                      {asset.c2pa_data.signed_at ? new Date(asset.c2pa_data.signed_at).toUTCString() : 'None embedded'}
                    </span>
                  </div>
                </div>

                {asset.c2pa_data.is_ai_generated && (
                  <div className="p-3 rounded-lg bg-purple-50 border border-purple-200 flex items-center gap-2 text-purple-800">
                    <Sparkles className="w-4 h-4 shrink-0 text-purple-600" />
                    <div>
                      <span className="font-bold text-[11px] block">AI / Synthetic Media Marker Declared</span>
                      <span className="text-[11px] text-purple-900">
                        The manifest asserts this asset was generated or synthesized algorithmically (trainedAlgorithmicMedia / generative model).
                      </span>
                    </div>
                  </div>
                )}

                {asset.c2pa_data.actions && asset.c2pa_data.actions.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[11px] uppercase text-slate-500 block font-semibold">Provenance Action History</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {asset.c2pa_data.actions.map((act: any, idx: number) => (
                        <div key={idx} className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
                          <div>
                            <span className="text-slate-900 font-semibold block">{act.summary || act.action}</span>
                            <span className="text-[10px] text-slate-500">{act.action}</span>
                          </div>
                          {act.timestamp && (
                            <span className="text-[10px] text-slate-500">{new Date(act.timestamp).toLocaleDateString()}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Forensic Integrity Disclaimer */}
                <div className="p-3.5 rounded-lg bg-blue-50/70 border border-blue-200 text-slate-700 space-y-1">
                  <span className="text-[11px] font-bold text-blue-700 block">Forensic Integrity Notice:</span>
                  <p className="text-[11px] leading-relaxed">
                    {asset.c2pa_data.cryptographic_validity_note ||
                      "Cryptographic signature verification confirms that manifest assertions and image bitstream have not been tampered with since signing. It does not certify the underlying real-world factual truth of the image."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-slate-50 text-xs text-slate-600 font-mono space-y-2 border border-slate-200">
                <p>
                  No C2PA Content Credentials or JUMBF container detected in this media bitstream.
                </p>
                <div className="p-2.5 rounded bg-white border border-slate-200 text-[11px] text-slate-600 space-y-1">
                  <span className="text-amber-700 font-semibold block">Forensic Principle:</span>
                  <span>
                    Most social networks, chat applications, and content management systems strip metadata and manifests upon upload. The absence of C2PA credentials is standard for web images and does <strong>not</strong> indicate that the image is synthetic, manipulated, or fake.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* OCR Extracted Text & Entities */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2 text-slate-900 font-semibold text-base">
                <FileCode className="w-5 h-5 text-blue-600" />
                <span>OCR Text & Embedded Forensic Clue Extraction</span>
              </div>

              {/* OCR Status Badge */}
              <div className="flex items-center gap-2">
                {asset.ocr_status === 'detected' ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Text Detected ({((asset.ocr_confidence || 0) * 100).toFixed(0)}% conf)
                  </span>
                ) : asset.ocr_status === 'no_text_detected' ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> No Text Detected
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> OCR Unavailable / Skipped
                  </span>
                )}
              </div>
            </div>

            {asset.ocr_text ? (
              <div className="space-y-4">
                <div>
                  <span className="text-[11px] font-mono uppercase text-slate-500 block mb-1">
                    Raw Text Extracted from Image
                  </span>
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm text-slate-900 font-mono whitespace-pre-wrap leading-relaxed">
                    {asset.ocr_text}
                  </div>
                </div>

                {asset.extracted_entities && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-xs">
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <span className="text-slate-500 block mb-1 text-[11px]">Identified Handles:</span>
                      <div className="text-blue-700 font-semibold">
                        {asset.extracted_entities.handles?.join(', ') || '(None)'}
                      </div>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <span className="text-slate-500 block mb-1 text-[11px]">Detected Date Strings:</span>
                      <div className="text-emerald-700 font-semibold">
                        {asset.extracted_entities.dates?.join(', ') || '(None)'}
                      </div>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <span className="text-slate-500 block mb-1 text-[11px]">Extracted URLs / Domains:</span>
                      <div className="text-amber-700 font-semibold truncate">
                        {asset.extracted_entities.urls?.join(', ') || '(None)'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-slate-50 text-xs text-slate-500 font-mono border border-slate-200">
                {asset.ocr_status === 'no_text_detected'
                  ? 'Image inspected by OCR engine; no readable text characters detected.'
                  : 'Tesseract OCR binary was not detected on system PATH or image contains no legible text.'}
              </div>
            )}
          </div>

          {/* Investigation Discovery & Quota Diagnostics Panel */}
          {diagnostics && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2 text-slate-900 font-semibold text-base">
                  <Cpu className="w-5 h-5 text-blue-600" />
                  <span>Discovery & Quota Execution Diagnostics</span>
                </div>
                <span className="text-xs font-mono text-slate-500">
                  Case ID: {diagnostics.investigation_id}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono text-xs">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 uppercase block mb-1">SerpApi Reverse Image</span>
                  <span className="text-emerald-700 font-bold block">
                    {diagnostics.reverse_image_configured ? 'Active (Google Lens)' : 'Unconfigured'}
                  </span>
                  {diagnostics.masked_serpapi_key && (
                    <span className="text-[10px] text-slate-500 block">Key: {diagnostics.masked_serpapi_key}</span>
                  )}
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 uppercase block mb-1">Search Credits Consumed</span>
                  <span className="text-blue-700 font-bold text-sm block">
                    {diagnostics.credits_consumed ?? 0} Credit(s)
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    Cache Hits: <strong className="text-emerald-700">{diagnostics.cache_hits ?? 0}</strong>
                  </span>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 uppercase block mb-1">Candidates Discovered</span>
                  <span className="text-slate-900 font-bold text-sm block">
                    {diagnostics.total_candidates_found} Found
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    Compared: <strong className="text-blue-700">{diagnostics.visual_comparisons_completed}</strong>
                  </span>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 uppercase block mb-1">Connectors Queried</span>
                  <span className="text-slate-800 font-semibold block truncate">
                    {diagnostics.successful_connectors.length} / {diagnostics.connectors_attempted.length} Succeeded
                  </span>
                  <span className="text-[10px] text-slate-500 block truncate">
                    {diagnostics.connectors_attempted.join(', ') || 'None'}
                  </span>
                </div>
              </div>

              {diagnostics.reasons_for_limited_results && diagnostics.reasons_for_limited_results.length > 0 && (
                <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs font-mono space-y-1.5">
                  <div className="flex items-center gap-1.5 text-amber-800 font-semibold">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                    <span>Forensic Limitations & Discovery Coverage Notes:</span>
                  </div>
                  <ul className="list-disc list-inside text-slate-700 space-y-1 pl-1">
                    {diagnostics.reasons_for_limited_results.map((reason, idx) => (
                      <li key={idx}>{reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Visual Candidate Matches Side-by-Side Comparison */}
          {visualCandidates.length > 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2 text-slate-900 font-semibold text-base">
                  <ScanEye className="w-5 h-5 text-blue-600" />
                  <span>Visual Candidate Comparisons ({visualCandidates.length} Matched Assets)</span>
                </div>
                <span className="text-xs font-mono text-slate-500">
                  Side-by-side perceptual hash and structural verification
                </span>
              </div>

              <div className="grid grid-cols-1 gap-6">
                {visualCandidates.map((cand) => (
                  <div
                    key={cand.id}
                    className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold uppercase px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                          {cand.source_platform}
                        </span>
                        <span
                          onClick={() => cand.source_url && safeOpenExternalUrl(cand.source_url, cand.title_or_caption)}
                          className={`text-xs font-semibold text-slate-900 max-w-[240px] truncate ${
                            cand.source_url ? 'hover:text-blue-600 hover:underline cursor-pointer' : ''
                          }`}
                          title={cand.title_or_caption || cand.source_url}
                        >
                          {cand.title_or_caption || cand.source_url}
                        </span>
                        <SourceLinkActions
                          sourceUrl={cand.source_url}
                          sourceTitle={cand.title_or_caption}
                          sourcePlatform={cand.source_platform}
                          candidateImageUrl={cand.candidate_image_url}
                          candidateThumbnailUrl={cand.candidate_thumbnail_path}
                          sourceDomain={cand.source_domain}
                          fallbackSearchUrl={cand.fallback_search_url}
                          fallbackQuery={cand.fallback_query}
                          urlType={cand.url_type}
                          isDirectImage={cand.is_direct_image}
                          searchProvider={cand.search_provider}
                          discoveryMethod={cand.discovery_method}
                          accessStatus={cand.access_status}
                          compact={true}
                        />
                      </div>

                      <div className="flex items-center gap-3">
                        {cand.visual_similarity !== undefined && (
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border ${
                              cand.visual_similarity >= 0.85
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : cand.visual_similarity >= 0.65
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {(cand.visual_similarity * 100).toFixed(0)}% Visual Similarity
                          </span>
                        )}
                        <span className="text-xs font-mono text-slate-500">
                          Strength: <span className="text-slate-900 font-semibold">{cand.evidence_strength}</span>
                        </span>
                      </div>
                    </div>

                    {/* Side-by-side Image Previews */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Original Target Image */}
                      <div className="bg-white rounded-lg p-3 border border-slate-200 flex flex-col items-center">
                        <span className="text-[11px] font-mono uppercase text-slate-500 font-semibold mb-2">
                          Original Target Image
                        </span>
                        <div className="w-full h-44 flex items-center justify-center bg-slate-100 rounded border border-slate-200 overflow-hidden">
                          {investigation && (
                            <img
                              src={api.getAssetFileUrl(investigation.id, asset.id)}
                              alt="Target Asset"
                              className="max-h-full max-w-full object-contain"
                            />
                          )}
                        </div>
                        <div className="w-full mt-2 text-[10px] font-mono text-slate-500 flex justify-between">
                          <span>pHash: {asset.perceptual_hash?.slice(0, 10)}...</span>
                          <span>{asset.image_width}×{asset.image_height}</span>
                        </div>
                      </div>

                      {/* Discovered Candidate Image */}
                      <div className="bg-white rounded-lg p-3 border border-slate-200 flex flex-col items-center">
                        <span className="text-[11px] font-mono uppercase text-slate-500 font-semibold mb-2">
                          Discovered Candidate Image
                        </span>
                        <div
                          onClick={() => {
                            const url = investigation ? api.getCandidateImageUrl(investigation.id, cand.id) : cand.candidate_image_url;
                            if (url) {
                              setPreviewMedia({ url, title: cand.title_or_caption || 'Candidate Match' });
                            }
                          }}
                          className={`w-full h-44 flex items-center justify-center bg-slate-100 rounded border border-slate-200 overflow-hidden ${
                            cand.candidate_image_url ? 'cursor-pointer hover:ring-2 hover:ring-blue-400 transition' : ''
                          }`}
                          title={cand.candidate_image_url ? "Click to view full preview" : undefined}
                        >
                          {cand.candidate_image_url ? (
                            <img
                              src={
                                investigation
                                  ? api.getCandidateImageUrl(investigation.id, cand.id)
                                  : cand.candidate_image_url
                              }
                              alt="Candidate Match"
                              className="max-h-full max-w-full object-contain"
                              onError={(e) => {
                                if (cand.candidate_image_url) {
                                  (e.target as HTMLImageElement).src = cand.candidate_image_url;
                                }
                              }}
                            />
                          ) : (
                            <div className="text-slate-400 text-xs font-mono">No Candidate Image Cached</div>
                          )}
                        </div>
                        <div className="w-full mt-2 text-[10px] font-mono text-slate-500 flex justify-between">
                          <span>pHash: {cand.candidate_phash ? `${cand.candidate_phash.slice(0, 10)}...` : 'N/A'}</span>
                          <span>{cand.candidate_width && cand.candidate_height ? `${cand.candidate_width}×${cand.candidate_height}` : 'Remote'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Openverse Attribution & Creative Commons License */}
                    {cand.source_platform === 'openverse' && (
                      <div className="bg-white p-3 rounded-lg border border-blue-200 text-xs font-mono space-y-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-bold text-emerald-700">
                            {cand.match_signals?.cc_license || cand.match_signals?.license || 'Creative Commons / Public Domain'}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            Creator: <strong className="text-slate-800">{cand.author_name || 'Unknown'}</strong>
                          </span>
                        </div>
                        {cand.content_snippet && (
                          <p className="text-[11px] text-slate-700 italic pt-0.5">{cand.content_snippet}</p>
                        )}
                        <span className="text-[10px] text-blue-700 block pt-0.5">
                          Discovered via text/metadata query on Openverse catalog; verified via perceptual hashing.
                        </span>
                      </div>
                    )}

                    {/* Explanation */}
                    {cand.explanation && (
                      <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs font-mono text-slate-700">
                        <span className="font-bold text-blue-700 block mb-0.5">Forensic Comparison Notes:</span>
                        <span>{cand.explanation}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-6 text-center space-y-2 shadow-xs">
              <ScanEye className="w-8 h-8 text-slate-400 mx-auto" />
              <h3 className="text-sm font-semibold text-slate-900">No Visual Matches Discovered Across Queried Indexes</h3>
              <p className="text-xs text-slate-500 font-mono max-w-xl mx-auto">
                All selected connectors completed execution. No public visual duplicates or exact perceptual hash matches were located on the indexed web or social networks for this target image.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Media Lightbox Preview Modal */}
      <MediaPreviewModal
        mediaUrl={previewMedia?.url || null}
        title={previewMedia?.title}
        onClose={() => setPreviewMedia(null)}
      />
    </div>
  );
};
