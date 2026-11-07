import { describe, it, expect } from 'vitest';
import { screenFor, TABS, TABS_13 } from './screens';

describe('app screens', () => {
  it('has the five tabs, with no way back from them', () => {
    expect(TABS.map((t) => t.label)).toEqual(['Karta', 'Flöde', 'Statistik', 'Notiser', 'Profil']);
    expect(screenFor('/karta')).toEqual({ title: 'CrimeAlert', tab: true, tabBar: true });
    expect(screenFor('/alerts/')).toEqual({ title: 'Notiser', tab: true, tabBar: true, largeTitle: true });
  });

  it('names other pages and lets you go back', () => {
    expect(screenFor('/kommun/malmo')).toEqual({ title: 'Kommun', tab: false, tabBar: true });
    expect(screenFor('/kommun/malmo/2026-09').title).toBe('Månadsrapport');
    expect(screenFor('/handelse/abc').title).toBe('Händelse');
    expect(screenFor('/okand-sida').title).toBe('CrimeAlert');
  });

  it('hides the tabs while signing in or buying Pro', () => {
    expect(screenFor('/prisplan').tabBar).toBe(false);
    expect(screenFor('/auth').tabBar).toBe(false);
    expect(screenFor('/villkor').tabBar).toBe(true);
  });

  it('gives Bjud in vänner its own large title, with a way back', () => {
    expect(screenFor('/bjud-in')).toEqual({ title: 'CrimeAlert', tab: false, tabBar: true, largeTitle: true });
    expect(screenFor('/inbjudan/ABCD2345').title).toBe('Inbjudan');
  });

  it('has Rapportera as a tab of its own from 1.3, and Notiser under Profil', () => {
    expect(TABS_13.map((t) => t.label)).toEqual(['Karta', 'Flöde', 'Rapportera', 'Statistik', 'Profil']);
    expect(TABS_13.find((t) => t.prominent)?.to).toBe('/rapportera');
    expect(screenFor('/rapportera', TABS_13)).toEqual({ title: 'Rapportera', tab: true, tabBar: true, largeTitle: true });
    // Notiser opened from Profil: a way back, and still its large title
    expect(screenFor('/alerts', TABS_13)).toEqual({ title: 'CrimeAlert', tab: false, tabBar: true, largeTitle: true });
  });
});
