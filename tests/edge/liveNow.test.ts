import { describe, expect, it } from 'vitest';
import { findLiveHappenings, happeningOf, liveMessage, type LiveReport } from '../../supabase/functions/_shared/liveNow';

const NOW = Date.parse('2026-11-25T20:00:00Z');
const min = (m: number) => NOW - m * 60_000;
const rep = (id: string, reporter: string, at: number, lat = 59.2950, lng = 18.2550, category = 'smoke_fire', area = 'Fisksätra, Nacka'): LiveReport =>
  ({ id, reporter, at, lat, lng, category, area });

describe('Pågår nu', () => {
  it('is nothing while only one person reports', () => {
    expect(findLiveHappenings([rep('a', 'u1', min(5)), rep('b', 'u1', min(3))], NOW)).toEqual([]);
  });

  it('becomes a happening when two people report from the same place', () => {
    const [h] = findLiveHappenings([rep('a', 'u1', min(12)), rep('b', 'u2', min(4), 59.2960, 18.2560, 'sirens')], NOW);
    expect(h).toMatchObject({ id: 'a', people: 2, place: 'Fisksätra' });
    expect(h.reports.map((r) => r.id)).toEqual(['a', 'b']);
    expect(liveMessage(h)).toEqual({ title: '🔴 Pågår nu i Fisksätra', body: '2 personer på plats · Rök eller brand. Se vad de ser.' });
  });

  it('keeps places apart, and leaves out what is over an hour old', () => {
    const found = findLiveHappenings([
      rep('a', 'u1', min(70)), rep('b', 'u2', min(10)),
      rep('c', 'u3', min(8), 59.33, 18.06, 'police_here', 'Sergels torg, Stockholm'), rep('d', 'u4', min(2), 59.331, 18.061, 'police_here', 'Stockholm'),
    ], NOW);
    expect(found.map((h) => [h.place, h.people])).toEqual([['Sergels torg', 2]]);
  });

  it('finds the happening a new report belongs to', () => {
    const found = findLiveHappenings([rep('a', 'u1', min(9)), rep('b', 'u2', min(1))], NOW);
    expect(happeningOf(found, 'b')?.id).toBe('a');
    expect(happeningOf(found, 'x')).toBeNull();
  });
});
