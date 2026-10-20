import { describe, it, expect, afterEach, vi } from 'vitest';
import { canSellPro, isNativeApp } from './native';

afterEach(() => {
  vi.unstubAllGlobals();
  delete (window as Window & { Capacitor?: unknown }).Capacitor;
});

describe('the iPhone app', () => {
  it('is recognised by Capacitor or by its user agent', () => {
    expect(isNativeApp()).toBe(false);
    expect(canSellPro()).toBe(true);

    (window as Window & { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true };
    expect(isNativeApp()).toBe(true);
    expect(canSellPro()).toBe(false);
    delete (window as Window & { Capacitor?: unknown }).Capacitor;

    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Mobile/15E148 CrimeAlertApp' });
    expect(isNativeApp()).toBe(true);
  });

  it('is not the web build of Capacitor', () => {
    (window as Window & { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => false };
    expect(isNativeApp()).toBe(false);
  });
});
