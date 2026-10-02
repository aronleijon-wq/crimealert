import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// The CSP lives in a meta tag in index.html. AdSense needs more than its loader script:
// ad frames, Google's invalid-traffic checks and the consent message all come from other hosts.
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
  it('lets AdSense load its scripts', () => {
    for (const url of [
      'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js',
      'https://ep2.adtrafficquality.google/sodar/sodar2.js',
      'https://adservice.google.com/adsid/integrator.js',
      'https://fundingchoicesmessages.google.com/i/pub-3945855440160391',
    ]) expect(allows('script-src', url), url).toBe(true);
  });

  it('lets AdSense show ads, its traffic checks and the consent message in frames', () => {
    for (const url of [
      'https://googleads.g.doubleclick.net/pagead/ads',
      'https://tpc.googlesyndication.com/sodar/sodar2/232/runner.html',
      'https://ep2.adtrafficquality.google/sodar/sodar2/232/runner.html',
      'https://www.google.com/recaptcha/api2/aframe',
      'https://fundingchoicesmessages.google.com/f/x',
    ]) expect(allows('frame-src', url), url).toBe(true);
  });

  it('lets AdSense make its requests', () => {
    for (const url of [
      'https://pagead2.googlesyndication.com/getconfig/sodar',
      'https://ep1.adtrafficquality.google/getconfig/sodar',
      'https://fundingchoicesmessages.google.com/el/x',
      'https://csi.gstatic.com/csi',
    ]) expect(allows('connect-src', url), url).toBe(true);
  });

  it('still keeps everything else locked down', () => {
    expect(allows('script-src', 'https://evil.example/x.js')).toBe(false);
    expect(directive('object-src')).toEqual(["'none'"]);
    expect(directive('default-src')).toEqual(["'self'"]);
  });
});
