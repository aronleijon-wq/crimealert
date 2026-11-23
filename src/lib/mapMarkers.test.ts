import { describe, it, expect } from 'vitest';
import { getJitteredPositions, hitRadii, markerHtml, setHitArea } from './mapMarkers';
import type { Incident } from '@/data/mockIncidents';

const at = (id: string, source = 'Polisen.se') => ({ id, lat: 62.39, lng: 17.31, source }) as Incident;
const metres = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const r = Math.PI / 180;
  return 6371000 * Math.hypot((b.lng - a.lng) * r * Math.cos(a.lat * r), (b.lat - a.lat) * r);
};

describe('where markers are drawn', () => {
  it('draws every police event 60–300 m from its place, the same way every time', () => {
    const items = Array.from({ length: 50 }, (_, i) => at(`pol-${i}`));
    const first = getJitteredPositions(items);
    first.forEach((p) => {
      const m = metres({ lat: 62.39, lng: 17.31 }, p);
      expect(m).toBeGreaterThanOrEqual(59);
      expect(m).toBeLessThanOrEqual(301);
    });
    expect(getJitteredPositions(items)).toEqual(first);
    // Not on top of each other
    expect(new Set(first.map((p) => `${p.lat.toFixed(4)}:${p.lng.toFixed(4)}`)).size).toBe(50);
  });

  it('takes a position the server has spread already as it is', () => {
    expect(getJitteredPositions([{ ...at('pol-1'), spread: true }])).toEqual([{ lat: 62.39, lng: 17.31 }]);
  });

  it('leaves a citizen report where its sender put it', () => {
    expect(getJitteredPositions([at('rep-1', 'Medborgarrapport')])).toEqual([{ lat: 62.39, lng: 17.31 }]);
  });
});

describe('how far out a marker can be tapped', () => {
  it('gives a marker with room around it the full area', () => {
    expect(hitRadii([{ x: 0, y: 0 }, { x: 200, y: 0 }], [5, 5], 22)).toEqual([22, 22]);
  });

  it('shares the room between close markers, so they never claim the same tap', () => {
    const [a, b] = hitRadii([{ x: 0, y: 0 }, { x: 30, y: 0 }], [5, 5], 22);
    expect(a).toBe(15);
    expect(a + b).toBeLessThanOrEqual(30);
  });

  it('never makes the area smaller than the dot', () => {
    expect(hitRadii([{ x: 0, y: 0 }, { x: 4, y: 0 }], [8, 8], 22)).toEqual([8, 8]);
  });

  it('finds the nearest neighbour among thousands quickly', () => {
    const points = Array.from({ length: 5000 }, (_, i) => ({ x: (i % 100) * 50, y: Math.floor(i / 100) * 50 }));
    const t = performance.now();
    const radii = hitRadii(points, points.map(() => 5), 22);
    expect(performance.now() - t).toBeLessThan(200);
    expect(radii.every((r) => r === 22)).toBe(true);
  });

  it('sizes the invisible ring a marker carries', () => {
    const el = document.createElement('div');
    el.innerHTML = markerHtml({ ...at('pol-1'), type: 'police', time: new Date().toISOString() } as Incident, true).html;
    setHitArea(el, 22);
    expect((el.querySelector('.marker-hit') as HTMLElement).style.width).toBe('44px');
  });
});
