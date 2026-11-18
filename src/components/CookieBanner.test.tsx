import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';

const ads = vi.hoisted(() => ({ enabled: false, required: true, saved: [] as string[], loads: 0 }));

vi.mock('@/lib/native', () => ({ isNativeApp: () => false }));
vi.mock('@/lib/googleAds', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/googleAds')>();
  return {
    ...real,
    get GOOGLE_ADS_ENABLED() { return ads.enabled; },
    isConsentRequiredRegion: async () => ads.required,
    loadGoogleAds: async () => { ads.loads++; },
    saveChoice: (d: string) => { ads.saved.push(d); localStorage.setItem(real.STORAGE_KEY, d); },
  };
});

const renderBanner = async () => {
  const { default: CookieBanner } = await import('./CookieBanner');
  render(<MemoryRouter><CookieBanner /></MemoryRouter>);
  await act(async () => { await Promise.resolve(); });
};

describe('CrimeAlert\'s own cookie box', () => {
  beforeEach(() => { localStorage.clear(); ads.enabled = false; ads.required = true; ads.saved = []; ads.loads = 0; });

  it('asks nothing while Google Ads is off', async () => {
    await renderBanner();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(ads.loads).toBe(0);
  });

  it('asks in the EU when Google Ads is on, with both choices one click away', async () => {
    ads.enabled = true;
    await renderBanner();
    expect(await screen.findByRole('dialog', { name: 'Cookies' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Endast nödvändiga' }));
    expect(ads.saved).toEqual(['denied']);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not ask again after a choice, or outside the EU, and opens again from the cookie page', async () => {
    ads.enabled = true;
    localStorage.setItem('cookie_consent', 'granted');
    await renderBanner();
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => { window.dispatchEvent(new Event('ca-open-cookie-settings')); });
    fireEvent.click(screen.getByRole('button', { name: 'Godkänn' }));
    expect(ads.saved).toEqual(['granted']);
  });

  it('is switched on in the same way in index.html and lib/googleAds', () => {
    const html = readFileSync('index.html', 'utf8');
    const ts = readFileSync('src/lib/googleAds.ts', 'utf8');
    const inHtml = html.match(/var CA_GOOGLE_ADS=(true|false);/)?.[1];
    const inTs = ts.match(/export const GOOGLE_ADS_ENABLED = (true|false);/)?.[1];
    expect(inHtml).toBeDefined();
    expect(inHtml).toBe(inTs);
  });
});
