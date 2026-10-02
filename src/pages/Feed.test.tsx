import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Incident } from '@/data/mockIncidents';
import type { ExternalEvent } from '@/lib/externalEvents';

const minutesAgo = (m: number) => new Date(Date.now() - m * 60 * 1000).toISOString();

const police: Incident = {
  id: 'pol-1', type: 'fire', title: '18 februari 12.30, Brand, Uppsala', description: '', lat: 59.86, lng: 17.64,
  area: 'Uppsala', time: minutesAgo(60), status: 'active', risk: 'medium', source: 'Polisen.se',
};
const vma: ExternalEvent = {
  id: 'vma-1', source: 'sr-vma', kind: 'vma', title: 'VMA: Brand i Västerås', summary: 'Stäng dörrar och fönster.',
  url: 'https://www.sverigesradio.se/vma', area: 'Västerås kommun', lat: 59.61, lng: 16.54,
  published_at: minutesAgo(90), ends_at: minutesAgo(-120), severity: 'high', category: 'Brand',
};
const news: ExternalEvent = {
  id: 'news-svt-1', source: 'svt', kind: 'news', title: 'Rån mot butik i Lund', summary: '', url: 'https://www.svt.se/rån',
  area: 'Lund', lat: 55.7, lng: 13.19, published_at: minutesAgo(30), ends_at: null, severity: 'low', category: 'rån',
};

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/components/Header', () => ({ default: () => null }));
vi.mock('@/hooks/useSEO', () => ({ useSEO: () => {} }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/hooks/useIsPremium', () => ({ useIsPremium: () => ({ isPremium: false, isLoggedIn: false }) }));
vi.mock('@/hooks/usePoliceEvents', () => ({ usePoliceEvents: () => ({ incidents: [police], loading: false, error: null }) }));
vi.mock('@/hooks/useTrafikverketEvents', () => ({ useTrafikverketEvents: () => ({ incidents: [] }) }));
vi.mock('@/hooks/useExternalEvents', () => ({ useExternalEvents: () => ({ events: [vma, news], loading: false }) }));
vi.mock('@/hooks/useCommunityReports', () => ({ useCommunityReports: () => ({ reports: [] }) }));
vi.mock('@/hooks/useNotificationPreferences', () => ({ useNotificationPreferences: () => ({ kommuner: ['Lund'] }) }));

const renderFeed = async () => {
  const { default: Feed } = await import('./Feed');
  return render(<MemoryRouter><Feed /></MemoryRouter>);
};

beforeEach(() => vi.clearAllMocks());

describe('Feed page', () => {
  it('shows an active VMA first, then news and police events newest first', async () => {
    await renderFeed();
    const titles = screen.getAllByRole('article').map((a) => within(a).getByRole('heading').textContent);
    expect(titles).toEqual(['VMA: Brand i Västerås', 'Rån mot butik i Lund', 'Brand, Uppsala']);
    expect(screen.getByText('Viktigt meddelande till allmänheten')).toBeInTheDocument();
    expect(screen.getByText('Stäng dörrar och fönster.')).toBeInTheDocument();
  });

  it('shows news as a headline linking to the article in a new tab', async () => {
    await renderFeed();
    const link = screen.getByRole('link', { name: 'Rån mot butik i Lund' });
    expect(link).toHaveAttribute('href', 'https://www.svt.se/rån');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('marks the police description as Pro for free users and links to the map', async () => {
    await renderFeed();
    const policeCard = screen.getAllByRole('article')[2];
    expect(within(policeCard).getByText('Hela beskrivningen ingår i Pro')).toBeInTheDocument();
    expect(within(policeCard).getByRole('link', { name: /Visa på kartan/ })).toHaveAttribute('href', '/karta?incident=pol-1');
  });

  it('filters the feed', async () => {
    await renderFeed();
    fireEvent.click(screen.getByRole('tab', { name: 'Kris & VMA' }));
    expect(screen.getAllByRole('article')).toHaveLength(1);
    fireEvent.click(screen.getByRole('tab', { name: 'Mina kommuner' }));
    expect(screen.getAllByRole('article').map((a) => within(a).getByRole('heading').textContent)).toEqual(['Rån mot butik i Lund']);
  });

  it('asks logged-out users to sign in before reacting or commenting', async () => {
    await renderFeed();
    const card = screen.getAllByRole('article')[0];
    fireEvent.click(within(card).getByRole('button', { name: 'Reagera med 👍' }));
    expect(within(card).getByText(/för att reagera och kommentera/)).toBeInTheDocument();
    fireEvent.click(within(card).getByRole('button', { name: /Kommentera/ }));
    expect(within(card).getByText(/för att läsa och skriva kommentarer/)).toBeInTheDocument();
  });
});
