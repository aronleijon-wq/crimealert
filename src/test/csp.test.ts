import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// The CSP lives in a meta tag in index.html. AdSense is gone; Google Ads (off for now, lib/googleAds) keeps the
// hosts its tag and conversions use, so turning it on needs no change here.
const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf8');
const policy = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1] ?? '';
const directive = (name: string) =>
  policy.split(';').map((d) => d.trim().split(/\s+/)).find(([n]) => n === name)?.slice(1) ?? [];

const allows = (name: string, url: string) => {
  const { protocol, host } = new URL(url);
  return directive(name).some((source) => {
    if (!source.startsWith('https://')) return false;
    const allowed = source.slice('https://'.length);
    return protocol === 'https:' && (allowed === host || (allowed.startsWith('*.') && host.endsWith(allowed.slice(1))));
  });
};

describe('Content-Security-Policy', () => {
  it('lets the Google Ads tag load and report conversions', () => {
    expect(allows('script-src', 'https://www.googletagmanager.com/gtag/js?id=AW-18563415709')).toBe(true);
    expect(allows('script-src', 'https://www.googleadservices.com/pagead/conversion_async.js')).toBe(true);
    for (const url of ['https://www.google.com/pagead/1p-conversion/x', 'https://googleads.g.doubleclick.net/pagead/viewthroughconversion/x']) {
      expect(allows('connect-src', url), url).toBe(true);
    }
  });

  it('no longer allows AdSense or its cookie box', () => {
    for (const url of [
      'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js',
      'https://fundingchoicesmessages.google.com/i/pub-3945855440160391',
      'https://ep2.adtrafficquality.google/sodar/sodar2.js',
    ]) expect(allows('script-src', url), url).toBe(false);
    expect(allows('frame-src', 'https://fundingchoicesmessages.google.com/f/x')).toBe(false);
    expect(html).not.toContain('google-adsense-account');
  });

  it('still keeps everything else locked down', () => {
    expect(allows('script-src', 'https://evil.example/x.js')).toBe(false);
    expect(directive('object-src')).toEqual(["'none'"]);
    expect(directive('default-src')).toEqual(["'self'"]);
  });
});
