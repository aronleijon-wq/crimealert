import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Incident } from '@/data/mockIncidents';

vi.mock('@/hooks/usePoliceEvents', () => ({ usePoliceSourceStatus: () => ({ fetchedAt: Date.now(), stale: false }) }));
vi.mock('./haptics', () => ({ haptics: { impact: vi.fn(), selection: vi.fn(), success: vi.fn(), warning: vi.fn(), error: vi.fn() } }));

const { default: MapChrome } = await import('./MapChrome');

const event = (id: string, title: string, extra: Partial<Incident> = {}): Incident => ({
  id, type: 'police', title, description: '', lat: 59.3, lng: 18, area: 'Södermalm, Stockholm', time: new Date().toISOString(),
  status: 'active', risk: 'medium', source: 'Polisen.se', ...extra,
});

const setup = (overrides: Partial<Parameters<typeof MapChrome>[0]> = {}) => {
  const props = {
    incidents: [event('e1', '07 november 12.00, Inbrott, Stockholm'), event('e2', 'Brand i villa', { type: 'fire', status: 'resolved' })],
    activeCount: 1, loading: false, status: '15 min fördröjning', live: false, selectedId: null,
    onSelect: vi.fn(), activeFilters: ['police', 'fire'] as Incident['type'][], onToggleFilter: vi.fn(), isPremium: false,
    showCommunityReports: false, onToggleCommunityReports: vi.fn(), onSearch: vi.fn(), onTimeline: vi.fn(), timelineOpen: false, timeline: null,
    ...overrides,
  };
  render(<MemoryRouter><MapChrome {...props} /></MemoryRouter>);
  return props;
};

describe("the app's map from 1.3", () => {
  it('has the events in a sheet, opened with a tap on its header', () => {
    const props = setup();
    expect(screen.getByRole('heading', { name: '2 händelser' })).toBeInTheDocument();
    expect(screen.getByText(/15 min fördröjning · 1 pågår/)).toBeInTheDocument();
    const header = screen.getByRole('button', { name: 'Visa händelserna' });
    fireEvent.pointerDown(header, { clientY: 600, pointerId: 1 });
    fireEvent.pointerUp(header, { clientY: 600, pointerId: 1 });
    expect(screen.getByRole('button', { name: 'Dölj händelserna' })).toHaveAttribute('aria-expanded', 'true');

    const sheet = screen.getByRole('region', { name: 'Händelser' });
    fireEvent.click(within(sheet).getByRole('button', { name: /Inbrott, Stockholm/ }));
    expect(props.onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'e1' }));
    // Picking an event shows the map again
    expect(screen.getByRole('button', { name: 'Visa händelserna' })).toBeInTheDocument();
  });

  it('searches for a kommun and flies there', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: /Sök kommun/ }));
    fireEvent.change(screen.getByPlaceholderText('Sök kommun'), { target: { value: 'malm' } });
    fireEvent.click(screen.getByRole('button', { name: /^Malmö$/ }));
    expect(props.onSearch).toHaveBeenCalledWith(expect.objectContaining({ name: 'Malmö' }));
    expect(screen.queryByRole('dialog', { name: 'Sök kommun' })).toBeNull();
  });

  it('turns kinds of event on and off in a sheet of switches', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Visa på kartan' }));
    const sheet = screen.getByRole('dialog', { name: 'Visa på kartan' });
    expect(within(sheet).getByRole('switch', { name: 'Polisinsats' })).toHaveAttribute('aria-checked', 'true');
    expect(within(sheet).getByRole('switch', { name: 'Ambulans' })).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(within(sheet).getByRole('switch', { name: 'Ambulans' }));
    expect(props.onToggleFilter).toHaveBeenCalledWith('ambulance');
    fireEvent.click(within(sheet).getByRole('button', { name: 'Klar' }));
    expect(screen.queryByRole('dialog', { name: 'Visa på kartan' })).toBeNull();
  });

  it('opens the timeline', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Tidslinje' }));
    expect(props.onTimeline).toHaveBeenCalled();
  });
});
