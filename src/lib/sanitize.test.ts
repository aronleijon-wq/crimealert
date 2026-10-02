import { describe, it, expect } from 'vitest';
import { sanitizeHTML, safeImageUrl } from './sanitize';

describe('sanitizeHTML', () => {
  it('escapes markup so it cannot break out of popup HTML', () => {
    expect(sanitizeHTML('<img src=x onerror="alert(1)">')).toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
    expect(sanitizeHTML("it's & <b>")).toBe('it&#39;s &amp; &lt;b&gt;');
  });

  it('turns null and undefined into an empty string', () => {
    expect(sanitizeHTML(null as unknown as string)).toBe('');
    expect(sanitizeHTML(undefined as unknown as string)).toBe('');
  });
});

describe('safeImageUrl', () => {
  const bucketUrl = 'https://abc.supabase.co/storage/v1/object/public/community-reports/user-1/photo.jpg';

  it('accepts images from the community-reports bucket', () => {
    expect(safeImageUrl(bucketUrl)).toBe(bucketUrl);
  });

  it('rejects other paths, non-https and script URLs', () => {
    expect(safeImageUrl('https://abc.supabase.co/storage/v1/object/public/avatars/a.jpg')).toBeNull();
    expect(safeImageUrl(bucketUrl.replace('https:', 'http:'))).toBeNull();
    expect(safeImageUrl('javascript:alert(1)')).toBeNull();
    expect(safeImageUrl('')).toBeNull();
    expect(safeImageUrl(null)).toBeNull();
  });
});
