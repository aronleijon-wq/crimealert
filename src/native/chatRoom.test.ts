import { describe, expect, it } from 'vitest';
import { chatItems, dayLabel, personColor } from './chatRoom';

const now = Date.UTC(2026, 10, 8, 12);
const msg = (id: string, user: string, minutesAgo: number) => ({ id, user_id: user, text: id, created_at: new Date(now - minutesAgo * 60000).toISOString() });

describe('the chat room', () => {
  it('groups runs of messages and heads each day', () => {
    const items = chatItems([msg('a', 'u1', 1500), msg('b', 'u1', 30), msg('c', 'u1', 28), msg('d', 'u2', 20), msg('e', 'u1', 5)], now);
    expect(items.map((i) => [i.message.id, i.day, i.first, i.last])).toEqual([
      ['a', 'Igår', true, true],
      ['b', 'Idag', true, false],
      ['c', null, false, true],
      ['d', null, true, true],
      ['e', null, true, true],
    ]);
  });

  it('names the days', () => {
    expect(dayLabel(now, now)).toBe('Idag');
    expect(dayLabel(now - 86400000, now)).toBe('Igår');
    expect(dayLabel(now - 3 * 86400000, now)).toMatch(/^torsdag 5 nov/);
  });

  it('gives each person the same colour every time', () => {
    expect(personColor('abc')).toBe(personColor('abc'));
  });
});
