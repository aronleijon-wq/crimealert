import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { Incident } from '@/data/mockIncidents';

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600e3).toISOString();
const event = (id: string, area: string, h: number, extra: Partial<Incident> = {}): Incident => ({
  id, type: 'fire', title: `03 oktober 10.00, Brand, ${area}`, description: 'Brand i flerfamiljshus, räddningstjänsten på plats.',
  lat: 55.6, lng: 13, area, time: hoursAgo(h), status: 'active', risk: 'high', source: 'Polisen.se', originalType: 'Brand',
  url: '/aktuellt/handelser/2026/oktober/3/brand-malmo/', ...extra,
});

const state = { incidents: [] as Incident[], loading: false, isPremium: false };
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/components/Header', () => ({ default: () => null }));
vi.mock('@/hooks/useSEO', () => ({ useSEO: () => {} }));
vi.mock('@/hooks/usePoliceEvents', () => ({ usePoliceEvents: () => ({ incidents: state.incidents, loading: state.loading }) }));
vi.mock('@/hooks/useIsPremium', () => ({ useIsPremium: () => ({ isPremium: state.isPremium, isLoggedIn: false }) }));

const { default: Handelse } = await import('./Handelse');
const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes><Route path="/handelse/:id" element={<Handelse />} /></Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  Object.assign(state, { incidents: [event('e1', 'Malmö', 1), event('e2', 'Malmö', 3, { type: 'police', title: '03 oktober 08.00, Rån, Malmö' }), event('e3', 'Lund', 2)], loading: false, isPremium: false });
});

describe('event page', () => {
  it('shows the event with its kommun, the map and sharing', async () => {
    renderAt('/handelse/e1');
    expect(screen.getByRole('heading', { level: 1, name: 'Brand, Malmö' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Malmö' })).toHaveAttribute('href', '/kommun/malmo');
    expect(screen.getByRole('link', { name: /Visa på kartan/ })).toHaveAttribute('href', '/karta?incident=e1');
    expect(screen.getByRole('link', { name: 'Rån, Malmö 3 tim sedan' })).toHaveAttribute('href', '/handelse/e2');
    expect(screen.queryByText('Brand, Lund')).toBeNull();

    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    fireEvent.click(screen.getByRole('button', { name: /Dela/ }));
    expect(await screen.findByText('Länken är kopierad')).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/handelse/e1`);
  });

  it('keeps the description for Pro', () => {
    renderAt('/handelse/e1');
    expect(screen.queryByText(/Brand i flerfamiljshus/)).toBeNull();
    expect(screen.getByText(/Polisens beskrivning av händelsen finns med Pro/)).toBeInTheDocument();
  });

  it('shows Pro the description', () => {
    state.isPremium = true;
    renderAt('/handelse/e1');
    expect(screen.getByText(/Brand i flerfamiljshus/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Polisen.se/ })).toHaveAttribute('href', 'https://polisen.se/aktuellt/handelser/2026/oktober/3/brand-malmo/');
  });

  it('explains when the event is not in the data', () => {
    renderAt('/handelse/gammal');
    expect(screen.getByText('Händelsen visas inte')).toBeInTheDocument();
    expect(screen.getByText(/utan Pro syns Polisens händelser efter 15 minuter/)).toBeInTheDocument();
  });
});
