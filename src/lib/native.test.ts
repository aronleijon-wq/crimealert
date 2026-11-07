import { describe, it, expect, afterEach, vi } from 'vitest';
import { appVersionAtLeast, canSellPro, hasAppDesign13, isNativeApp, nativeAppVersion } from './native';

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

  it('knows its version from version 1.3 on', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone) Mobile/15E148 CrimeAlertApp' });
    expect(nativeAppVersion()).toBeNull();
    expect(hasAppDesign13()).toBe(false);

    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone) Mobile/15E148 CrimeAlertApp/1.3' });
    expect(isNativeApp()).toBe(true);
    expect(nativeAppVersion()).toEqual([1, 3]);
    expect(appVersionAtLeast('1.3')).toBe(true);
    expect(appVersionAtLeast('1.2.9')).toBe(true);
    expect(appVersionAtLeast('1.4')).toBe(false);
    expect(hasAppDesign13()).toBe(true);

    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone) Mobile/15E148 CrimeAlertApp/1.10' });
    expect(appVersionAtLeast('1.3')).toBe(true);
    expect(appVersionAtLeast('2')).toBe(false);
  });

  it('has no version on the web', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone) Safari/604.1' });
    expect(nativeAppVersion()).toBeNull();
    expect(hasAppDesign13()).toBe(false);
  });
});
