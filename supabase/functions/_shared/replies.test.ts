import { describe, it, expect } from 'vitest';
import { kommunThreadId, replyMessage, replyRecipients, threadPath, threadPlace } from './replies';
import { safeAppPath } from './notifications';

const c = (id: string, user: string, minute: number) => ({ id, user_id: user, created_at: new Date(Date.UTC(2026, 10, 7, 12, minute)).toISOString() });

describe('reply notifications', () => {
  it('tells everyone else in the thread, once per round', () => {
    const thread = [c('1', 'anna', 0), c('2', 'bo', 1), c('3', 'cia', 2)];
    // Anna writes again: Cia hears of it; Bo already heard of Cia's comment and hasn't written since
    expect(replyRecipients([...thread, c('4', 'anna', 3)], c('4', 'anna', 3), new Set())).toEqual(['cia']);
    // Then Bo writes: Anna hears; Cia was told of Anna's comment and hasn't written since
    const later = [...thread, c('4', 'anna', 3), c('5', 'bo', 4)];
    expect(replyRecipients(later, c('5', 'bo', 4), new Set())).toEqual(['anna']);
  });

  it('leaves out the author and those who blocked them', () => {
    const thread = [c('1', 'anna', 0), c('2', 'bo', 1)];
    expect(replyRecipients(thread, c('2', 'bo', 1), new Set())).toEqual(['anna']);
    expect(replyRecipients(thread, c('2', 'bo', 1), new Set(['anna']))).toEqual([]);
    expect(replyRecipients([c('1', 'anna', 0)], c('1', 'anna', 0), new Set())).toEqual([]);
  });

  it('opens the event or the kommun discussion, at an address notifications may open', () => {
    expect(kommunThreadId('Upplands Väsby')).toBe('kommun:upplands-vasby');
    expect(threadPath('kommun:nacka')).toBe('/kommun/nacka?chatt=1');
    expect(threadPath('612345')).toBe('/handelse/612345?chatt=1');
    expect(safeAppPath(threadPath('kommun:nacka'))).toBe('/kommun/nacka?chatt=1');
  });

  it('names the thread', () => {
    expect(threadPlace('kommun:malmo', null)).toBe('diskussionen om Malmö');
    expect(threadPlace('612345', '07 november 12.00, Inbrott, Malmö')).toBe('tråden om Inbrott, Malmö');
    expect(threadPlace('612345', null)).toBe('en tråd du skrivit i');
  });

  it('writes a short message', () => {
    expect(replyMessage({ author: 'Anna', text: 'Hörde smällarna   också', place: 'Nacka' })).toEqual({ title: 'Anna svarade i Nacka', body: 'Hörde smällarna också' });
    expect(replyMessage({ author: '', text: 'x'.repeat(200), place: 'tråden' }).body).toHaveLength(140);
  });
});
