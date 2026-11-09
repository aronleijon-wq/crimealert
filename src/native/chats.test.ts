import { describe, expect, it } from 'vitest';
import { chatOverview, chatPath } from './chats';

const now = Date.UTC(2026, 10, 8, 12);
const row = (thread: string, minutesAgo: number, text = 'Hej') => ({ incident_id: thread, user_id: 'u', text, created_at: new Date(now - minutesAgo * 60000).toISOString() });

describe('the kommun discussions at a glance', () => {
  it('shows the latest message in each kommun you watch, quiet ones too', () => {
    const rows = [row('kommun:nacka', 5, 'Helikopter över Fisksätra'), row('kommun:nacka', 50), row('kommun:malmo', 30), row('12345', 1)];
    const { mine } = chatOverview(rows, ['Nacka', 'Uppsala'], now);
    expect(mine.map((m) => [m.kommun, m.last?.text ?? null, m.today])).toEqual([['Nacka', 'Helikopter över Fisksätra', 2], ['Uppsala', null, 0]]);
  });

  it('lists the liveliest other discussions of the last day', () => {
    const rows = [row('kommun:malmo', 10), row('kommun:malmo', 20), row('kommun:goteborg', 15), row('kommun:lund', 2000), row('kommun:nacka', 1)];
    const { active } = chatOverview(rows, ['Nacka'], now);
    expect(active.map((a) => a.kommun)).toEqual(['Malmö', 'Göteborg']);
  });

  it('opens the chat room', () => {
    expect(chatPath('Malmö')).toBe('/chatt/malmo');
  });
});
