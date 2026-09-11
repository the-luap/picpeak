/**
 * Admin draft preview (#1386).
 *
 * The gallery tab is opened with `?admin_preview=1`, and the axios interceptor
 * forwards that flag on every gallery API call. Anything that does NOT go
 * through axios — a native `fetch`, a `<video src>`, an `<a href>` download —
 * has to put the flag on its own URL, or `verifyGalleryAccess` filters the
 * unpublished event out and answers 404.
 *
 * The flag is an intent signal only: the admin's HttpOnly `admin_token` cookie
 * is what actually authenticates it, and it rides along on its own because all
 * of these are same-origin. No credential is ever placed in a URL.
 */
export function withAdminPreview(url: string | null | undefined): string {
  if (!url) return url || '';
  // Relative (app-owned) URLs only. Never append to an absolute URL: that
  // could point at any origin, and the flag would be a hint to a third party
  // about what the admin is doing.
  if (!url.startsWith('/')) return url;
  if (typeof window === 'undefined') return url;
  if (new URLSearchParams(window.location.search).get('admin_preview') !== '1') return url;
  return `${url}${url.includes('?') ? '&' : '?'}admin_preview=1`;
}
