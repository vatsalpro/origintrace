import React, { useState } from 'react';
import {
  ExternalLink,
  Search,
  Image as ImageIcon,
  ShieldAlert,
  Info,
  Copy,
  Check,
  Globe,
  Activity,
  AlertTriangle,
  Archive,
  X
} from 'lucide-react';
import { api } from '../services/api';
import { UrlAccessDiagnostics } from '../types';
import {
  cleanAndNormalizeUrl,
  classifyUrlType,
  extractDomain,
  safeOpenExternalUrl,
  buildFallbackSearchUrl
} from '../utils/url';

export interface SourceLinkActionsProps {
  sourceUrl?: string;
  sourceTitle?: string;
  sourcePlatform?: string;
  candidateImageUrl?: string;
  candidateThumbnailUrl?: string;
  searchProvider?: string;
  discoveryMethod?: string;
  accessStatus?: string;
  sourceDomain?: string;
  fallbackSearchUrl?: string;
  fallbackQuery?: string;
  urlType?: string;
  isDirectImage?: boolean;
  compact?: boolean;
  onPreviewMedia?: (mediaUrl: string) => void;
}

export const SourceLinkActions: React.FC<SourceLinkActionsProps> = ({
  sourceUrl,
  sourceTitle,
  sourcePlatform = 'web',
  candidateImageUrl,
  candidateThumbnailUrl,
  searchProvider,
  discoveryMethod,
  accessStatus = 'accessible',
  sourceDomain,
  fallbackSearchUrl,
  fallbackQuery,
  isDirectImage = false,
  compact = false,
  onPreviewMedia
}) => {
  const [showDiagModal, setShowDiagModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const [diagResult, setDiagResult] = useState<UrlAccessDiagnostics | null>(null);

  // Normalize URLs using centralized utility
  const cleanWebUrl = cleanAndNormalizeUrl(sourceUrl);
  const cleanMediaUrl = cleanAndNormalizeUrl(candidateImageUrl);
  const cleanThumbUrl = cleanAndNormalizeUrl(candidateThumbnailUrl);

  const determinedUrlType = classifyUrlType(cleanWebUrl);
  const isArchiveSnapshot =
    sourcePlatform === 'wayback' || determinedUrlType === 'archive_snapshot';

  // Extract clean domain
  const domain = sourceDomain || extractDomain(cleanWebUrl, sourcePlatform);

  // Compute fallback Google search URL
  const computedSearchUrl =
    fallbackSearchUrl ||
    buildFallbackSearchUrl(sourceTitle, domain, sourcePlatform);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const targetToCopy = cleanWebUrl || cleanMediaUrl || sourceUrl || '';
    if (targetToCopy) {
      navigator.clipboard.writeText(targetToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCheckUrl = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const probeTarget = cleanWebUrl || cleanMediaUrl || sourceUrl;
    if (!probeTarget || checking) return;

    setChecking(true);
    try {
      const res = await api.verifyUrl(probeTarget);
      setDiagResult(res);
    } catch {
      setDiagResult({
        checked_url: probeTarget,
        status_code: null,
        access_status: 'error',
        category: 'unreachable',
        is_accessible: false,
        explanation: 'Could not contact backend verification probe or request timed out.'
      });
    } finally {
      setChecking(false);
    }
  };

  const handleOpenSource = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (cleanWebUrl) {
      safeOpenExternalUrl(cleanWebUrl, e);
    } else if (cleanMediaUrl) {
      safeOpenExternalUrl(cleanMediaUrl, e);
    }
  };

  const handleOpenMedia = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onPreviewMedia && cleanMediaUrl) {
      onPreviewMedia(cleanMediaUrl);
    } else if (cleanMediaUrl) {
      safeOpenExternalUrl(cleanMediaUrl, e);
    }
  };

  const hasDistinctMedia = Boolean(
    cleanMediaUrl &&
    cleanMediaUrl !== cleanWebUrl
  );

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex flex-wrap items-center gap-1.5 font-mono text-xs select-none ${
        compact ? 'text-[11px]' : ''
      }`}
    >
      {/* 1. Primary Action: Open Source Webpage / Archive Snapshot */}
      {cleanWebUrl ? (
        <a
          href={cleanWebUrl}
          target="_blank"
          rel="noopener noreferrer"
          referrerPolicy="no-referrer"
          onClick={(e) => {
            e.stopPropagation();
          }}
          title={
            isArchiveSnapshot
              ? `Open Internet Archive historical capture in new tab`
              : `Open source webpage on ${domain || 'external site'} in a new tab`
          }
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition border shadow-xs ${
            accessStatus === 'forbidden' || accessStatus === 'restricted'
              ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-300'
              : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 hover:border-blue-300'
          }`}
        >
          {isArchiveSnapshot ? (
            <>
              <Archive className="w-3.5 h-3.5 shrink-0 text-amber-600" />
              <span>Wayback Snapshot</span>
            </>
          ) : isDirectImage ? (
            <>
              <ImageIcon className="w-3.5 h-3.5 shrink-0 text-blue-600" />
              <span>Open Media Link</span>
            </>
          ) : (
            <>
              <span>Open Source</span>
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            </>
          )}
        </a>
      ) : cleanMediaUrl ? (
        /* Webpage URL unavailable, but candidate media exists */
        <a
          href={cleanMediaUrl}
          target="_blank"
          rel="noopener noreferrer"
          referrerPolicy="no-referrer"
          onClick={(e) => {
            e.stopPropagation();
          }}
          title="Source webpage unavailable. Click to open discovered direct media file in a new tab."
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-semibold transition shadow-xs"
        >
          <ImageIcon className="w-3.5 h-3.5 shrink-0 text-blue-600" />
          <span>Direct Media File</span>
        </a>
      ) : (
        /* Neither webpage nor media URL is available */
        <span
          title="Discovered record does not contain an accessible web URL."
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed text-[11px]"
        >
          <span>Source Unavailable</span>
        </span>
      )}

      {/* 2. Direct Media Link (when distinct from source webpage) */}
      {hasDistinctMedia && (
        <a
          href={cleanMediaUrl!}
          target="_blank"
          rel="noopener noreferrer"
          referrerPolicy="no-referrer"
          onClick={(e) => {
            e.stopPropagation();
          }}
          title="Open discovered candidate image asset directly in a new tab"
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-300 transition"
        >
          <ImageIcon className="w-3 h-3 text-blue-600 shrink-0" />
          <span>Direct Media</span>
        </a>
      )}

      {/* 3. Fallback Search Action */}
      {computedSearchUrl && (
        <a
          href={computedSearchUrl}
          target="_blank"
          rel="noopener noreferrer"
          referrerPolicy="no-referrer"
          onClick={(e) => {
            e.stopPropagation();
          }}
          title={`Google search fallback for title & domain: ${fallbackQuery || domain}`}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 border border-slate-300 transition"
        >
          <Search className="w-3 h-3 text-slate-500 shrink-0" />
          <span>Search Fallback</span>
        </a>
      )}

      {/* 4. Diagnostics & Access Status Probe Trigger */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setShowDiagModal(true);
        }}
        title="Inspect URL reachability diagnostics, raw values, and HTTP probe notes"
        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-blue-600 border border-slate-300 transition"
      >
        <Info className="w-3.5 h-3.5" />
      </button>

      {/* Diagnostics Modal */}
      {showDiagModal && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 space-y-5 text-xs font-mono shadow-2xl relative text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <Globe className="w-4 h-4 text-blue-600" />
                <span>Discovered Source Link Diagnostics</span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDiagModal(false);
                }}
                className="text-slate-400 hover:text-slate-700 p-1 rounded transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Destination Metadata */}
            <div className="space-y-3 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
              <div>
                <span className="text-[10px] uppercase text-slate-500 block mb-0.5">
                  Source Title / Caption
                </span>
                <span className="text-slate-900 font-semibold block line-clamp-2">
                  {sourceTitle || '(No title recorded)'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200">
                <div>
                  <span className="text-[10px] uppercase text-slate-500 block">
                    Source Platform / Domain
                  </span>
                  <span className="text-blue-600 font-semibold truncate block">
                    {domain || sourcePlatform}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-slate-500 block">
                    Discovery Provider
                  </span>
                  <span className="text-slate-700 truncate block">
                    {searchProvider || (sourcePlatform === 'reverse_image' ? 'Google Lens (SerpApi)' : sourcePlatform)}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase text-slate-500 block mb-1">
                  Validated Destination URL
                </span>
                <div className="flex items-center gap-2 bg-white p-2 rounded border border-slate-300">
                  <span className="text-slate-700 break-all select-all flex-1 text-[11px] max-h-16 overflow-y-auto">
                    {cleanWebUrl || cleanMediaUrl || sourceUrl || 'No URL stored'}
                  </span>
                  {(cleanWebUrl || cleanMediaUrl || sourceUrl) && (
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition shrink-0"
                      title="Copy URL"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              </div>

              {sourceUrl && cleanWebUrl && sourceUrl !== cleanWebUrl && (
                <div className="text-[10px] text-slate-500">
                  <span className="block font-semibold">Raw Original Input:</span>
                  <span className="break-all">{sourceUrl}</span>
                </div>
              )}
            </div>

            {/* Forensic Transparency Note on 403 / Firewalls */}
            <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 space-y-1.5 text-slate-700 text-[11px] leading-relaxed">
              <div className="flex items-center gap-1.5 text-amber-800 font-bold">
                <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600" />
                <span>External Access & Firewall Note</span>
              </div>
              <p>
                Remote web services (Cloudflare, bot firewalls, or paywalled media) frequently challenge or block automated probes.
              </p>
              <p className="text-slate-500">
                A <strong>403 Forbidden</strong> or <strong>401 Unauthorized</strong> HTTP status indicates the destination server denied unauthenticated bot access. It does <strong>not</strong> invalidate the recorded forensic match or historical capture.
              </p>
            </div>

            {/* On-Demand Reachability Probe */}
            <div className="space-y-2 border-t border-slate-200 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 text-[11px]">
                  Server Reachability Probe (Safe HEAD request, zero proxy bypass):
                </span>
                <button
                  type="button"
                  onClick={handleCheckUrl}
                  disabled={checking || (!cleanWebUrl && !cleanMediaUrl && !sourceUrl)}
                  className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-[10px] flex items-center gap-1 transition shadow-xs"
                >
                  <Activity className={`w-3 h-3 ${checking ? 'animate-spin' : ''}`} />
                  <span>{checking ? 'Probing...' : 'Check Status'}</span>
                </button>
              </div>

              {diagResult && (
                <div
                  className={`p-3 rounded-lg border text-[11px] space-y-1 ${
                    diagResult.status_code === 200
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : diagResult.status_code === 403 || diagResult.status_code === 401
                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span>
                      Response: {diagResult.status_code ? `HTTP ${diagResult.status_code}` : 'No HTTP Response'}
                    </span>
                    <span className="uppercase text-[10px] px-1.5 py-0.5 rounded bg-black/10">
                      {diagResult.access_status}
                    </span>
                  </div>
                  <p className="text-slate-600">{diagResult.explanation}</p>
                  {diagResult.server_header && (
                    <span className="text-[10px] text-slate-500 block pt-0.5">
                      Edge / Server Header: {diagResult.server_header}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-3">
              {computedSearchUrl && (
                <a
                  href={computedSearchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  referrerPolicy="no-referrer"
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 transition"
                >
                  <Search className="w-3.5 h-3.5 text-slate-500" />
                  <span>Google Fallback Search</span>
                </a>
              )}

              {(cleanWebUrl || cleanMediaUrl) && (
                <a
                  href={(cleanWebUrl || cleanMediaUrl)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  referrerPolicy="no-referrer"
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1 transition shadow-xs"
                >
                  <span>Open URL Anyway</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
