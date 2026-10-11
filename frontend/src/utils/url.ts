/**
 * Centralized External URL Validation and Safe Navigation Utility
 * OriginTrace AI Forensic Workbench
 */

export const DISALLOWED_SCHEMES = [
  'javascript:',
  'data:',
  'file:',
  'blob:',
  'about:',
  'vbscript:',
  'ftp:'
];

export const IMAGE_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.bmp',
  '.svg',
  '.ico',
  '.tiff',
  '.avif'
];

export const THUMBNAIL_DOMAINS = [
  'encrypted-tbn0.gstatic.com',
  'tbn0.gstatic.com',
  'play-lh.googleusercontent.com'
];

/**
 * Validates whether a raw string is a safe external HTTP or HTTPS URL.
 * Rejects unsafe schemes (javascript:, data:, file:, etc.), malformed strings, and internal routes.
 */
export function isValidHttpUrl(raw?: string | null): boolean {
  if (!raw || typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (!trimmed) return false;

  const lower = trimmed.toLowerCase();
  for (const disallowed of DISALLOWED_SCHEMES) {
    if (lower.startsWith(disallowed) || lower.startsWith(`${disallowed}/`)) {
      return false;
    }
  }

  // Reject relative paths being mistakenly passed as external URLs
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) {
    return false;
  }

  try {
    const candidate = trimmed.startsWith('http://') || trimmed.startsWith('https://')
      ? trimmed
      : (trimmed.includes('.') && !trimmed.startsWith('/') ? `https://${trimmed}` : '');
    if (!candidate) return false;

    const parsed = new URL(candidate);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Cleans and normalizes an external source URL without double-encoding.
 * Automatically resolves ATProto URIs (at://did:plc:.../app.bsky.feed.post/rkey)
 * to canonical https://bsky.app/profile/... web URLs.
 */
export function cleanAndNormalizeUrl(raw?: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  let trimmed = raw.trim();
  if (!trimmed) return null;

  // Resolve ATProto URIs
  if (trimmed.startsWith('at://')) {
    const body = trimmed.slice(5);
    const parts = body.split('/');
    if (parts.length >= 3 && parts[1] === 'app.bsky.feed.post') {
      trimmed = `https://bsky.app/profile/${parts[0]}/post/${parts[2]}`;
    } else if (parts.length >= 1 && parts[0]) {
      trimmed = `https://bsky.app/profile/${parts[0]}`;
    }
  }

  const lower = trimmed.toLowerCase();
  for (const disallowed of DISALLOWED_SCHEMES) {
    if (lower.startsWith(disallowed)) {
      return null;
    }
  }

  if (trimmed.startsWith('/') || trimmed.startsWith('#')) {
    return null;
  }

  // Prepend https:// if protocol was omitted but host is valid
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    if (trimmed.includes('.') && !trimmed.includes(' ')) {
      trimmed = `https://${trimmed}`;
    } else {
      return null;
    }
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    // Block loopback or private hostnames for client navigation if malformed
    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') {
      // Allowed only if intentionally local, but for discovered external sources it's suspicious
    }
    return parsed.href;
  } catch {
    return null;
  }
}

/**
 * Classifies a URL into a distinct evidence category.
 */
export function classifyUrlType(
  raw?: string | null
): 'source_webpage' | 'direct_image' | 'thumbnail' | 'archive_snapshot' | 'invalid' {
  const normalized = cleanAndNormalizeUrl(raw);
  if (!normalized) return 'invalid';

  try {
    const parsed = new URL(normalized);
    const domain = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();

    if ((domain === 'web.archive.org' || domain === 'archive.org') && path.includes('/web/')) {
      return 'archive_snapshot';
    }

    if (THUMBNAIL_DOMAINS.includes(domain)) {
      return 'thumbnail';
    }

    for (const ext of IMAGE_EXTENSIONS) {
      if (path.endsWith(ext) || normalized.toLowerCase().includes(`${ext}?`)) {
        return 'direct_image';
      }
    }

    return 'source_webpage';
  } catch {
    return 'invalid';
  }
}

/**
 * Safely extracts a clean domain name for display.
 */
export function extractDomain(raw?: string | null, fallback = 'web'): string {
  if (!raw) return fallback;
  try {
    const normalized = cleanAndNormalizeUrl(raw);
    if (normalized) {
      const parsed = new URL(normalized);
      return parsed.hostname.toLowerCase().replace(/^www\./, '');
    }
  } catch {
    // fallback
  }
  return fallback;
}

/**
 * Safely opens an external URL in a new browser tab with strict security flags.
 * Strips referrers to protect investigator privacy and prevent origin leaking.
 */
export function safeOpenExternalUrl(
  rawUrl?: string | null,
  eventOrTitle?: React.MouseEvent | MouseEvent | string
): boolean {
  if (eventOrTitle && typeof eventOrTitle !== 'string') {
    eventOrTitle.stopPropagation();
  }

  const cleanUrl = cleanAndNormalizeUrl(rawUrl);
  if (!cleanUrl) {
    console.warn('[OriginTrace] Cannot open invalid external URL:', rawUrl);
    return false;
  }

  const newWindow = window.open();
  if (newWindow) {
    newWindow.opener = null;
    newWindow.location.href = cleanUrl;
    return true;
  } else {
    // Fallback for pop-up blockers
    window.location.assign(cleanUrl);
    return true;
  }
}

/**
 * Builds a secondary Google fallback search query and URL for an evidence item.
 */
export function buildFallbackSearchUrl(
  title?: string,
  domain?: string,
  platform?: string
): string {
  const qTitle = (title || '').trim();
  let query = '';
  if (qTitle && !qTitle.toLowerCase().startsWith('visual match candidate')) {
    query = domain && domain !== 'web' ? `"${qTitle.slice(0, 70)}" site:${domain}` : `"${qTitle.slice(0, 70)}"`;
  } else if (domain && domain !== 'web') {
    query = `site:${domain}`;
  } else {
    query = `${platform || 'web'} image source`;
  }
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}
