/** Escape text for interpolation into HTML strings (map popups are built as HTML). */
export const sanitizeHTML = (str: string): string =>
  String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// Only allow images served from our own public storage bucket.
export const safeImageUrl = (value?: string | null): string | null => {
  if (!value) return null;
  try {
    const url = new URL(value, window.location.origin);
    if (url.protocol !== 'https:') return null;
    if (!url.pathname.includes('/storage/v1/object/public/community-reports/')) return null;
    return url.toString();
  } catch {
    return null;
  }
};
