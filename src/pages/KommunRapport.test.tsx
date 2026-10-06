import { afterAll, beforeAll, describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const calls: { _kommun: string; _month: string }[] = [];
const rows: Record<string, unknown[]> = {
  '2026-09-01': [
    { area: 'Malmö', type: 'police', original_type: 'Stöld', day: '2026-09-04', events: 6 },
    { area: 'Malmö', type: 'traffic', original_type: 'Trafikolycka', day: '2026-09-05', events: 4 },
    { area: 'Malmöhus', type: 'police', original_type: 'Stöld', day: '2026-09-05', events: 50 },
  ],
};
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (_name: string, args: { _kommun: string; _month: string }) => {
      calls.push(args);
      return Promise.resolve({ data: rows[args._month] ?? [], error: null });
    },
  },
}));
vi.mock('@/components/Header', () => ({ default: () => null }));
vi.mock('@/hooks/useSEO', () => ({ useSEO: () => {} }));

const { default: KommunRapport } = await import('./KommunRapport');

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes><Route path="/kommun/:slug/:month" element={<KommunRapport />} /></Routes>
    </MemoryRouter>,
  );

beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-06T10:00:00Z')); });
afterAll(() => { vi.useRealTimers(); });

describe('Monthly report', () => {
  it('sums up the kommun’s month from the counts, leaving out other places', async () => {
    const { container } = renderAt('/kommun/malmo/2026-09');
    expect(screen.getByRole('heading', { level: 1, name: 'Polisens händelser i Malmö i september 2026' })).toBeInTheDocument();
    expect(await screen.findByText(/I september 2026 rapporterade Polisen 10 händelser i Malmö/)).toBeInTheDocument();
    expect(calls).toContainEqual({ _kommun: 'Malmö', _month: '2026-09-01' });
    const ld = JSON.parse(container.querySelector('script[type="application/ld+json"]')!.textContent!);
    expect(ld[1]).toMatchObject({ '@type': 'Article', headline: 'Polisens händelser i Malmö i september 2026', datePublished: '2026-10-01' });
    expect(screen.getByRole('link', { name: /oktober 2026/ })).toHaveAttribute('href', '/kommun/malmo/2026-10');
  });

  it('has no report before the archive starts or for months to come', () => {
    renderAt('/kommun/malmo/2026-08');
    expect(screen.getByRole('heading', { level: 1, name: 'Rapporten finns inte' })).toBeInTheDocument();
  });
});
