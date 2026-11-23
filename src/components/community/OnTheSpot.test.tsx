import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Incident } from '@/data/mockIncidents';

const auth: { user: { id: string } | null } = { user: { id: 'u1' } };
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => auth }));
const state: { reports: Partial<Incident>[] } = { reports: [] };
vi.mock('@/hooks/useCommunityReports', () => ({ useCommunityReports: () => ({ reports: state.reports }) }));

const { default: OnTheSpot } = await import('./OnTheSpot');

const NOW = Date.parse('2026-11-23T22:00:00+01:00');
const event = { id: 'pol-612345', title: 'Brand, Malmö', area: 'Malmö', lat: 55.6, lng: 13.0, time: '2026-11-23T21:10:00+01:00' };
const show = (e = event) => render(<MemoryRouter><OnTheSpot event={e} now={NOW} /></MemoryRouter>);

beforeEach(() => { auth.user = { id: 'u1' }; state.reports = []; });

describe('Från platsen', () => {
  it('asks those on the spot of a recent event, with the event filled in', () => {
    show();
    const link = screen.getByRole('link', { name: /Är du på plats\?/ });
    expect(link.getAttribute('href')).toContain('/rapportera?handelse=pol-612345');
  });

  it('shows the reports about this event, and not those about others', () => {
    state.reports = [
      { id: 'cr-1', title: 'Rök eller brand', description: 'Svart rök från taket', time: '2026-11-23T21:20:00+01:00', eventId: 'pol-612345' },
      { id: 'cr-2', title: 'Avspärrning', description: '', time: '2026-11-23T21:25:00+01:00', eventId: 'pol-999' },
    ];
    show();
    expect(screen.getByText('Svart rök från taket')).toBeInTheDocument();
    expect(screen.queryByText('Avspärrning')).toBeNull();
  });

  it('leaves an old event without reports alone', () => {
    const { container } = show({ ...event, time: '2026-11-21T10:00:00+01:00' });
    expect(container).toBeEmptyDOMElement();
  });
});
