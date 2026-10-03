import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { Incident } from '@/data/mockIncidents';

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600e3).toISOString();
const event = (id: string, area: string, h: number, extra: Partial<Incident> = {}): Incident => ({
  id, type: 'police', title: `03 oktober 10.00, Stöld, ${area}`, description: '', lat: 55.6, lng: 13, area,
  time: hoursAgo(h), status: 'active', risk: 'low', source: 'Polisen.se', originalType: 'Stöld', ...extra,
});

const state = { incidents: [] as Incident[], loading: false, isPremium: false };
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/components/Header', () => ({ default: () => null }));
vi.mock('@/hooks/useSEO', () => ({ useSEO: () => {} }));
vi.mock('@/hooks/usePoliceEvents', () => ({ usePoliceEvents: () => ({ incidents: state.incidents, loading: state.loading }) }));
vi.mock('@/hooks/useIsPremium', () => ({ useIsPremium: () => ({ isPremium: state.isPremium, isLoggedIn: false }) }));

const { default: Kommun } = await import('./Kommun');
const { default: Kommuner } = await import('./Kommuner');

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/kommun" element={<Kommuner />} />
        <Route path="/kommun/:slug" element={<Kommun />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  Object.assign(state, {
    incidents: [
      event('a', 'Malmö', 1, { type: 'fire', title: '03 oktober 11.00, Brand, Malmö', originalType: 'Brand' }),
      event('b', 'Malmö', 3),
      event('c', 'Malmö', 40),
      event('d', 'Lund', 2),
    ],
    loading: false,
    isPremium: false,
  });
});

describe('Kommun page', () => {
  it('shows the kommun’s events, counts and links', () => {
    renderAt('/kommun/malmo');
    expect(screen.getByRole('heading', { level: 1, name: 'Malmö' })).toBeInTheDocument();
    expect(screen.getByText('Senaste dygnet').parentElement).toHaveTextContent('2');
    expect(screen.getByText('Senaste 7 dagarna').parentElement).toHaveTextContent('3');
    const list = screen.getByRole('heading', { name: 'Senaste händelserna i Malmö' }).nextElementSibling as HTMLElement;
    const links = within(list).getAllByRole('link');
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['/karta?incident=a', '/karta?incident=b', '/karta?incident=c']);
    expect(within(list).getByText('Brand, Malmö')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Visa Malmö på kartan/ })).toHaveAttribute('href', '/karta?kommun=Malm%C3%B6');
    expect(screen.getByRole('link', { name: /Bevaka Malmö/ })).toHaveAttribute('href', '/alerts?kommun=Malm%C3%B6');
    expect(screen.getByRole('link', { name: 'Lund' })).toHaveAttribute('href', '/kommun/lund');
    expect(screen.getByText(/Visas med 15 minuters fördröjning/)).toBeInTheDocument();
  });

  it('does not mention the delay to Pro', () => {
    state.isPremium = true;
    renderAt('/kommun/malmo');
    expect(screen.queryByText(/Visas med 15 minuters fördröjning/)).toBeNull();
  });

  it('says so when nothing has happened', () => {
    renderAt('/kommun/kiruna');
    expect(screen.getByText('Polisen har inte rapporterat något i Kiruna den senaste veckan.')).toBeInTheDocument();
  });

  it('handles an address that is not a kommun', () => {
    renderAt('/kommun/atlantis');
    expect(screen.getByText('Kommunen finns inte')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Visa alla kommuner' })).toHaveAttribute('href', '/kommun');
  });
});

describe('Kommuner page', () => {
  it('lists all kommuner and the busiest of the day', () => {
    renderAt('/kommun');
    expect(screen.getByRole('link', { name: 'Övertorneå' })).toHaveAttribute('href', '/kommun/overtornea');
    const busiest = screen.getByRole('heading', { name: 'Flest händelser senaste dygnet' }).nextElementSibling as HTMLElement;
    expect(within(busiest).getAllByRole('link').map((l) => l.textContent)).toEqual(['Malmö2 händelser', 'Lund1 händelse']);
  });
});
