import { describe, it, expect } from 'vitest';
import { getJitteredPositions } from './mapMarkers';
import type { Incident } from '@/data/mockIncidents';

const at = (id: string, source = 'Polisen.se') => ({ id, lat: 62.39, lng: 17.31, source }) as Incident;
const metres = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const r = Math.PI / 180;
  return 6371000 * Math.hypot((b.lng - a.lng) * r * Math.cos(a.lat * r), (b.lat - a.lat) * r);
};

describe('where markers are drawn', () => {
  it('draws every police event 100–600 m from its place, the same way every time', () => {
    const items = Array.from({ length: 50 }, (_, i) => at(`pol-${i}`));
    const first = getJitteredPositions(items);
    first.forEach((p) => {
      const m = metres({ lat: 62.39, lng: 17.31 }, p);
      expect(m).toBeGreaterThanOrEqual(99);
      expect(m).toBeLessThanOrEqual(601);
    });
    expect(getJitteredPositions(items)).toEqual(first);
    // Not on top of each other
    expect(new Set(first.map((p) => `${p.lat.toFixed(4)}:${p.lng.toFixed(4)}`)).size).toBe(50);
  });

  it('leaves a citizen report where its sender put it', () => {
    expect(getJitteredPositions([at('rep-1', 'Medborgarrapport')])).toEqual([{ lat: 62.39, lng: 17.31 }]);
  });
});
