import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Incident } from '@/data/mockIncidents';

const minutesAgo = (m: number) => new Date(Date.now() - m * 60 * 1000).toISOString();
const incident = (id: string, area: string, lat: number, lng: number, originalType: string, m: number): Incident => ({
  id, type: 'police', title: `02 oktober, ${originalType}, ${area}`, description: '', lat, lng, area,
  time: minutesAgo(m), status: 'active', risk: 'high', source: 'Polisen.se', originalType,
});

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/hooks/useSEO', () => ({ useSEO: () => {} }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null, loading: false }) }));
vi.mock('@/hooks/usePoliceEvents', () => ({
  usePoliceEvents: () => ({
    incidents: [
      incident('p1', 'Malmö', 55.6, 13.0, 'Rån', 30),
      incident('p2', 'Uppsala', 59.86, 17.64, 'Brand', 90),
      incident('p3', 'Helsingfors', 60.17, 24.94, 'Stöld', 10), // outside Sweden: left out
      incident('p4', 'Stockholms län', 59.33, 18.07, 'Sammanfattning natt', 5), // summaries left out
    ],
    loading: false,
    error: null,
    updatedAt: Date.now(),
  }),
}));

// jsdom has no canvas; the map art draws nothing there
HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;

const renderLanding = async () => {
  const { default: Landing } = await import('./Landing');
  return render(<MemoryRouter><Landing /></MemoryRouter>);
};

describe('Landing page', () => {
  it('shows the headline and the live log of real events', async () => {
    await renderLanding();
    expect(screen.getByRole('heading', { level: 1, name: 'Aktuell lägesbild, direkt på karta.' })).toBeInTheDocument();
    const rows = screen.getAllByText(/MALMÖ|UPPSALA/i);
    expect(rows.length).toBeGreaterThan(0);
    expect(screen.queryByText(/HELSINGFORS/i)).toBeNull();
    expect(screen.queryByText(/Sammanfattning natt/i)).toBeNull();
  });

  it('links to the live map', async () => {
    await renderLanding();
    const hero = screen.getByRole('heading', { level: 1 }).closest('section')!;
    expect(within(hero).getByRole('link', { name: /Öppna livekartan/ })).toHaveAttribute('href', '/karta');
  });

  it('answers common questions, with links to the right pages', async () => {
    const { container } = await renderLanding();
    const faq = screen.getByRole('heading', { level: 2, name: 'Vanliga frågor' }).closest('section')!;
    expect(within(faq).getByText('Kostar det något?')).toBeInTheDocument();
    expect(within(faq).getByRole('link', { name: 'Konto' })).toHaveAttribute('href', '/account');
    expect(within(faq).getByRole('link', { name: 'crimealert.swe@gmail.com' })).toHaveAttribute('href', 'mailto:crimealert.swe@gmail.com');
    const ld = container.querySelector('#vanliga-fragor script[type="application/ld+json"]');
    expect(JSON.parse(ld!.textContent!)['@type']).toBe('FAQPage');
    expect(screen.getByRole('link', { name: 'Vanliga frågor' })).toHaveAttribute('href', '#vanliga-fragor');
  });
});
