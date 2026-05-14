/**
 * vscodeIconsCdnResolver.ts — CDN failure-cache utility
 *
 * Tracks CDN URLs that have failed so subsequent renders skip the network
 * request and jump straight to the inline fallback. Resets on app restart.
 */

const failedUrls = new Set<string>()

/** Mark a CDN URL as permanently failed for this session */
export function notifyCdnFailed(cdnUrl: string): void {
  if (cdnUrl) failedUrls.add(cdnUrl)
}

/** Return cdnUrl unless it has previously failed, in which case return fallbackUrl */
export function selectIconSrc(cdnUrl: string, fallbackUrl: string): string {
  return failedUrls.has(cdnUrl) ? fallbackUrl : cdnUrl
}
