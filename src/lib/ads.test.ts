import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { adsDecision, hideAds, showAds } from './ads';

type AdsWindow = Window & { adsbygoogle?: unknown[] & { pauseAdRequests?: number } };
const scripts = () => document.querySelectorAll('script[src*="adsbygoogle.js"]');

// The script is added once the page is idle
const settle = () => vi.advanceTimersByTime(6000);

beforeEach(() => {
  vi.useFakeTimers();
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  document.documentElement.className = '';
  delete (window as AdsWindow).adsbygoogle;
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

describe('adsDecision', () => {
  const base = { loading: false, signedIn: true, subscriptionChecked: true, isPremium: false };

  it('shows ads to visitors and free users', () => {
    expect(adsDecision({ ...base, signedIn: false, subscriptionChecked: false })).toBe('show');
    expect(adsDecision(base)).toBe('show');
  });

  it('hides ads from Pro', () => {
    expect(adsDecision({ ...base, isPremium: true })).toBe('hide');
  });

  it('waits until it is known whether a signed-in user has Pro', () => {
    expect(adsDecision({ ...base, loading: true, signedIn: false })).toBe('wait');
    expect(adsDecision({ ...base, subscriptionChecked: false })).toBe('wait');
  });
});

describe('showAds / hideAds', () => {
  it('adds the AdSense script once, after the page has settled', () => {
    showAds();
    showAds();
    expect(scripts()).toHaveLength(0);
    settle();
    expect(scripts()).toHaveLength(1);
    expect(scripts()[0].getAttribute('src')).toContain('client=ca-pub-3945855440160391');
    expect((window as AdsWindow).adsbygoogle?.pauseAdRequests).toBe(0);
  });

  it('pauses and removes ads that are already on the page', () => {
    showAds();
    settle();
    document.body.innerHTML = '<ins class="adsbygoogle"></ins><div class="google-auto-placed"></div><p>Innehåll</p>';
    hideAds();
    expect((window as AdsWindow).adsbygoogle?.pauseAdRequests).toBe(1);
    expect(document.documentElement.classList.contains('no-ads')).toBe(true);
    expect(document.body.innerHTML).toBe('<p>Innehåll</p>');
  });

  it('never loads the script for Pro', () => {
    hideAds();
    settle();
    expect(scripts()).toHaveLength(0);
  });

  it('drops a pending load when Pro is known before the page settles', () => {
    showAds();
    hideAds();
    settle();
    expect(scripts()).toHaveLength(0);
  });

  it('resumes ads after Pro ends', () => {
    hideAds();
    showAds();
    settle();
    expect(document.documentElement.classList.contains('no-ads')).toBe(false);
    expect((window as AdsWindow).adsbygoogle?.pauseAdRequests).toBe(0);
    expect(scripts()).toHaveLength(1);
  });
});
