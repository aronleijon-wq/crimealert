import { describe, expect, it } from 'vitest';
import { ALL_EXTRAS, allOn, chatLogKey, chatMessage, DEFAULT_EXTRAS, extrasFromRow, extrasToRow, reportMessage, reportPath } from '../../supabase/functions/_shared/notifyExtras';

describe('wider notification choices', () => {
  it('gives reports but not all of Sweden or chat to those who never chose', () => {
    expect(extrasFromRow(null)).toEqual(DEFAULT_EXTRAS);
    expect(extrasFromRow({ all_sweden: true, kommun_chat: null, nearby_reports: false })).toEqual({ allSweden: true, kommunChat: false, reports: false });
    expect(extrasFromRow(extrasToRow(ALL_EXTRAS))).toEqual(ALL_EXTRAS);
    expect(allOn(ALL_EXTRAS)).toBe(true);
    expect(allOn(DEFAULT_EXTRAS)).toBe(false);
  });

  it('buzzes a busy kommun chat at most once per ten minutes', () => {
    const t = Date.parse('2026-11-25T12:00:00Z');
    expect(chatLogKey('kommun:nacka', t)).toBe(chatLogKey('kommun:nacka', t + 9 * 60_000));
    expect(chatLogKey('kommun:nacka', t)).not.toBe(chatLogKey('kommun:nacka', t + 10 * 60_000));
    expect(chatLogKey('kommun:nacka', t)).not.toBe(chatLogKey('kommun:solna', t));
  });

  it('says who wrote in which kommun, shortened', () => {
    const m = chatMessage({ author: 'Anna', text: 'Massor av   polis vid centrum '.repeat(10), kommun: 'Nacka' });
    expect(m.title).toBe('Nytt i chatten för Nacka');
    expect(m.body.startsWith('Anna: Massor av polis vid centrum')).toBe(true);
    expect(m.body.length).toBeLessThanOrEqual(126);
  });

  it('tells of a report by kind and place, never by its own words', () => {
    expect(reportMessage({ category: 'smoke_fire', area: 'Brand, Uppsala' })).toEqual({
      title: 'På plats: Rök eller brand', body: 'Någon i Uppsala rapporterar just nu. Tryck för att se.',
    });
    expect(reportMessage({ category: 'nope', area: null }).body).toMatch(/nära dig/);
    expect(reportPath('123-abc')).toBe('/handelse/123-abc');
    expect(reportPath(null)).toBe('/flode');
  });
});
