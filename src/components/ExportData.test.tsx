import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ExportData from './ExportData';
import type { Incident } from '@/data/mockIncidents';

const state = vi.hoisted(() => ({ premium: true, admin: false, archive: vi.fn() }));

vi.mock('@/hooks/useIsPremium', () => ({ useIsPremium: () => ({ isPremium: state.premium, isLoggedIn: true }) }));
vi.mock('@/hooks/useIsAdmin', () => ({ useIsAdmin: () => state.admin }));
vi.mock('@/hooks/useArchiveEvents', () => ({
  useArchiveEvents: (days: number | null, enabled: boolean) => { state.archive(days, enabled); return { incidents: [], loading: false, error: null }; },
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

describe('ExportData', () => {
  beforeEach(() => { state.premium = true; state.admin = false; state.archive.mockClear(); vi.restoreAllMocks(); });

  it('offers Pro users up to 60 days, without the whole archive', () => {
    render(<ExportData liveIncidents={[]} />);
    expect(screen.getByRole('button', { name: /60 dagar/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sedan start/ })).not.toBeInTheDocument();
  });

  it('lets an admin export the whole archive', () => {
    state.admin = true;
    render(<ExportData liveIncidents={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /Sedan start/ }));
    expect(state.archive).toHaveBeenLastCalledWith(null, true);
  });

  it('shows the export to an admin without Pro', () => {
    state.premium = false;
    state.admin = true;
    render(<ExportData liveIncidents={[]} />);
    expect(screen.getByText('Ladda ner händelserna')).toBeInTheDocument();
  });

  const incident = {
    id: 'a', type: 'police', title: '14 november 13.31, Misshandel, Umeå', description: 'Polis åker till en adress på Ålidhem.',
    lat: 63.8, lng: 20.3, area: 'Umeå', time: new Date().toISOString(), status: 'resolved', risk: 'medium', source: 'Polisen.se',
    url: '/aktuellt/handelser/2026/november/14/a', originalType: 'Misshandel', locationPrecision: 'district',
  } as unknown as Incident;

  const csvFor = async () => {
    let blob: Blob | null = null;
    // jsdom has no object URLs
    Object.assign(URL, { createObjectURL: (b: Blob) => { blob = b; return 'blob:x'; }, revokeObjectURL: () => {} });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<ExportData liveIncidents={[incident]} />);
    fireEvent.click(screen.getByRole('button', { name: /CSV/ }));
    return new Promise<string>((resolve) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.readAsText(blob as unknown as Blob); });
  };

  it('gives admins the kind, precision and link in the CSV, with the full text', async () => {
    state.admin = true;
    const csv = await csvFor();
    expect(csv.split('\n')[0]).toContain('"Polisens sort","Platsnoggrannhet","Länk"');
    expect(csv).toContain('"Polis åker till en adress på Ålidhem."');
    expect(csv).toContain('"Stadsdel","https://polisen.se/aktuellt/handelser/2026/november/14/a"');
  });

  it('keeps the CSV as before for Pro users', async () => {
    const csv = await csvFor();
    expect(csv.split('\n')[0]).not.toContain('Länk');
    expect(csv).toContain('"Polis åker till en adress på Ålidhem."');
  });

  it("puts Polisen's full text in an admin's PDF", () => {
    state.admin = true;
    const write = vi.fn();
    vi.spyOn(window, 'open').mockReturnValue({ document: { write, close: vi.fn() }, print: vi.fn() } as unknown as Window);
    render(<ExportData liveIncidents={[incident]} />);
    fireEvent.click(screen.getByRole('button', { name: /PDF/ }));
    expect(write.mock.calls[0][0]).toContain('Polis åker till en adress på Ålidhem.');
  });

  it('shows nothing without Pro or admin', () => {
    state.premium = false;
    const { container } = render(<ExportData liveIncidents={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('exported events and the night summaries', () => {
  it('leaves out a summary that was split into its events, and keeps one that was not', async () => {
    const { withoutSplitSummaries } = await import('@/lib/summaries');
    const base = { type: 'other', description: '', lat: 59, lng: 18, area: 'Stockholms län', time: '2026-11-24 07:00:00 +01:00', status: 'resolved', risk: 'low', source: 'Polisen.se' } as const;
    const rows = [
      { ...base, id: 'pol-1', title: 'Sammanfattning natt, Stockholms län', originalType: 'Sammanfattning natt' },
      { ...base, id: 'pol-1-s1', title: 'Stöld, Nacka', originalType: 'Stöld', area: 'Nacka' },
      { ...base, id: 'pol-2', title: 'Sammanfattning natt, Uppsala län', originalType: 'Sammanfattning natt' },
      { ...base, id: 'pol-3', title: 'Misshandel, Solna', originalType: 'Misshandel', area: 'Solna' },
    ];
    expect(withoutSplitSummaries(rows).map((r) => r.id)).toEqual(['pol-1-s1', 'pol-2', 'pol-3']);
  });
});
