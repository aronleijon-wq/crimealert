import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const rows = [
  { area: 'Nacka', category: 'Inbrott', now_count: 30, before_count: 20 },
  { area: 'Nacka', category: 'Stöld', now_count: 5, before_count: 4 },
  { area: 'Stockholm', category: 'Inbrott', now_count: 60, before_count: 70 },
  { area: 'Stockholm', category: 'Rån', now_count: 12, before_count: 6 },
  { area: 'Bjurholm', category: 'Inbrott', now_count: 3, before_count: 0 },
];
const rpc = vi.fn();
const range = vi.fn((from: number) => Promise.resolve({ data: from === 0 ? rows : [], error: null }));
const query = { order: () => query, range };
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => { rpc(...a); return query; } } }));
vi.mock('@/hooks/useNotificationPreferences', () => ({ useNotificationPreferences: () => ({ kommuner: ['Nacka'] }) }));
vi.mock('@/lib/shareCard', () => ({ drawHistoryCard: vi.fn(), shareCard: vi.fn() }));

import CrimeAtlas from './CrimeAtlas';

const show = () => render(<MemoryRouter><CrimeAtlas /></MemoryRouter>);

describe('Brottsatlas', () => {
  it('starts with your kommun, what is most common there and how it compares with Sweden', async () => {
    show();
    expect(await screen.findByText(/^Stölder är [\d,]+× vanligare i Nacka än i Sverige$/)).toBeInTheDocument();
    expect(rpc).toHaveBeenCalledWith('crime_atlas', { _days: 30 });
    expect(screen.getByText('Vanligast i Nacka')).toBeInTheDocument();
    expect(screen.getByText('Jämfört med grannarna')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Chatten/ })).toHaveAttribute('href', '/chatt/nacka');
  });

  it('finds another kommun by search', async () => {
    show();
    await screen.findByText('Vanligast i Nacka');
    fireEvent.change(screen.getByLabelText('Sök kommun'), { target: { value: 'stockh' } });
    fireEvent.click(screen.getByRole('option', { name: 'Stockholm' }));
    expect(await screen.findByText('Vanligast i Stockholm')).toBeInTheDocument();
  });

  it('shows where a crime is most common per inhabitant, and goes to a kommun from the list', async () => {
    show();
    await screen.findByText('Vanligast i Nacka');
    fireEvent.click(screen.getByRole('tab', { name: 'Brott' }));
    expect(screen.getByText('Inbrott i Sverige · 30 dagar')).toBeInTheDocument();
    const list = screen.getByText('Vanligast per invånare').parentElement!;
    const names = [...list.querySelectorAll('button')].map((b) => b.textContent);
    expect(names[0]).toContain('Bjurholm');
    fireEvent.click(screen.getByRole('tab', { name: 'Rån' }));
    await waitFor(() => expect(screen.getByText('Rån i Sverige · 30 dagar')).toBeInTheDocument());
    fireEvent.click(screen.getAllByRole('button', { name: /Stockholm/ })[0]);
    expect(await screen.findByText('Vanligast i Stockholm')).toBeInTheDocument();
  });
});
