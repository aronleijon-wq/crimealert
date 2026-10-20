import { describe, it, expect } from 'vitest';
import { screenFor, TABS } from './screens';

describe('app screens', () => {
  it('has the five tabs, with no way back from them', () => {
    expect(TABS.map((t) => t.label)).toEqual(['Karta', 'Flöde', 'Statistik', 'Notiser', 'Profil']);
    expect(screenFor('/karta')).toEqual({ title: 'CrimeAlert', tab: true, tabBar: true });
    expect(screenFor('/alerts/')).toEqual({ title: 'Notiser', tab: true, tabBar: true });
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
});
