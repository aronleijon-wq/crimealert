import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Incident } from '@/data/mockIncidents';

// Safari has DOMPoint, jsdom doesn't
if (typeof DOMPoint === 'undefined') vi.stubGlobal('DOMPoint', class { constructor(public x = 0, public y = 0) {} });

vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: vi.fn() } } }));

/** Enough of MapKit JS to see what the map is given */
function fakeMapKit() {
  const state = { maps: [] as FakeMap[], errorListeners: [] as ((e: { status: string }) => void)[] };
  class FakeMap {
    annotations: unknown[] = [];
    listeners: Record<string, (e: unknown) => void> = {};
    mapType = 'standard';
    selectedAnnotation: unknown = null;
    region: unknown = null;
    constructor(public el: HTMLElement, public options: Record<string, unknown>) { state.maps.push(this); }
    addAnnotations(a: unknown[]) { this.annotations.push(...a); }
    removeAnnotations(a: unknown[]) { this.annotations = this.annotations.filter((x) => !a.includes(x)); }
    addEventListener(name: string, fn: (e: unknown) => void) { this.listeners[name] = fn; }
    setRegionAnimated(region: unknown) { this.region = region; }
    destroy() {}
  }
  class Annotation {
    static DisplayPriority = { Required: 'required' };
    constructor(public coordinate: { latitude: number; longitude: number }, public factory: () => HTMLElement, public options: Record<string, unknown>) {}
    get data() { return this.options.data as { id: string; pulse: boolean }; }
  }
  const mapkit = {
    Map: Object.assign(FakeMap, { ColorSchemes: { Dark: 'dark' }, MapTypes: { Standard: 'standard', Satellite: 'satellite', Hybrid: 'hybrid' } }),
    FeatureVisibility: { Adaptive: 'adaptive', Hidden: 'hidden' },
    Annotation,
    Coordinate: class { constructor(public latitude: number, public longitude: number) {} },
    CoordinateSpan: class { constructor(public latitudeDelta: number, public longitudeDelta: number) {} },
    CoordinateRegion: class { constructor(public center: unknown, public span: unknown) {} },
    Padding: class { constructor(...v: number[]) { Object.assign(this, { v }); } },
    addEventListener: (_: string, fn: (e: { status: string }) => void) => state.errorListeners.push(fn),
    removeEventListener: () => {},
  };
  return { mapkit, state };
}

const event = (id: string, extra: Partial<Incident> = {}): Incident => ({
  id, type: 'fire', title: '07 november 12.00, Brand, Malmö', description: '', lat: 55.6, lng: 13, area: 'Malmö', time: new Date().toISOString(),
  status: 'active', risk: 'high', source: 'Polisen.se', ...extra,
});

const { default: AppleMap } = await import('./AppleMap');

afterEach(() => { delete (window as { mapkit?: unknown }).mapkit; });


describe('Apple Maps in the app', () => {
  it('shows the events as Apple markers, and only changes those that came or went', async () => {
    const { mapkit, state } = fakeMapKit();
    window.mapkit = mapkit;
    const onSelect = vi.fn();
    // Older than a week: not on the map, as on the website
    const old = event('old', { time: new Date(Date.now() - 9 * 86400000).toISOString() });
    const props = { selectedId: null, onSelectIncident: onSelect, flyToLocation: null, mapType: 'standard' as const, onUnavailable: vi.fn() };
    const { rerender } = render(<MemoryRouter><AppleMap incidents={[event('a'), event('b', { type: 'police' }), old]} {...props} /></MemoryRouter>);
    await waitFor(() => expect(state.maps[0]?.annotations).toHaveLength(2));
    const map = state.maps[0];
    const first = map.annotations[0] as { options: Record<string, unknown>; factory: () => HTMLElement };
    // The website's own dots, the newest pulsing, every one shown however crowded
    expect(first.options).toMatchObject({ title: 'Brand, Malmö', displayPriority: 'required', data: { id: 'a', pulse: true } });
    expect(first.factory().innerHTML).toContain('marker-pulse');
    expect(document.getElementById('ca-marker-pulse')?.textContent).toContain('@keyframes marker-pulse-anim');
    expect(map.options).toMatchObject({ colorScheme: 'dark', showsZoomControl: false });

    rerender(<MemoryRouter><AppleMap incidents={[event('b', { type: 'police' }), event('c')]} {...props} mapType="hybrid" /></MemoryRouter>);
    await waitFor(() => expect((map.annotations as { data: { id: string } }[]).map((a) => a.data.id).sort()).toEqual(['b', 'c']));
    expect(map.mapType).toBe('hybrid');

    map.listeners.select({ annotation: map.annotations[0] });
    expect(onSelect).toHaveBeenCalledWith('b');
  });

  it('gives way to the site’s own map when Apple refuses the token', async () => {
    const { mapkit, state } = fakeMapKit();
    window.mapkit = mapkit;
    const onUnavailable = vi.fn();
    render(<MemoryRouter><AppleMap incidents={[]} selectedId={null} onSelectIncident={vi.fn()} mapType="standard" onUnavailable={onUnavailable} /></MemoryRouter>);
    await waitFor(() => expect(state.errorListeners.length).toBeGreaterThan(0));
    state.errorListeners[0]({ status: 'Unauthorized' });
    expect(onUnavailable).toHaveBeenCalled();
  });
});
