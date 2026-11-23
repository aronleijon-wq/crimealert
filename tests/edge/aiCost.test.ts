import { describe, it, expect } from 'vitest';
import { addUsage, costUsd, NO_USAGE, summarizeAi } from "../../supabase/functions/_shared/aiCost";

const NOW = Date.UTC(2026, 10, 15, 12);
const DAY = 86_400_000;
const u = (input: number, output: number, read = 0, write = 0) => ({ input_tokens: input, output_tokens: output, cache_read_tokens: read, cache_write_tokens: write });

describe('cost of the AI chat', () => {
  it('prices each model per million tokens, cache writes at 1.25 times input', () => {
    expect(costUsd('claude-haiku-5-5', u(1_000_000, 1_000_000))).toBeCloseTo(0.6);
    expect(costUsd('claude-sonnet-5-5', u(10_000, 2_000, 50_000, 4_000))).toBeCloseTo(0.02 + 0.02 + 0.005 + 0.01);
    // An unknown model is priced as Sonnet, never as free
    expect(costUsd('claude-something-new', u(1_000_000, 0))).toBe(2);
  });

  it('adds up the rounds of one answer', () => {
    const total = addUsage(addUsage(NO_USAGE, { input_tokens: 100, output_tokens: 10, cache_read_input_tokens: 5 }), { input_tokens: 50, output_tokens: 20, cache_creation_input_tokens: 7 });
    expect(total).toEqual(u(150, 30, 5, 7));
  });

  it('sums 7 and 30 days, per model and per day', () => {
    const at = (daysAgo: number) => new Date(NOW - daysAgo * DAY).toISOString();
    const s = summarizeAi([
      { model: 'claude-haiku-5-5', created_at: at(1), ...u(1_000_000, 0) },
      { model: 'claude-sonnet-5-5', created_at: at(10), ...u(1_000_000, 0) },
      { model: 'claude-sonnet-5-5', created_at: at(40), ...u(1_000_000, 0) },
    ], NOW);
    expect(s).toMatchObject({ answers7: 1, answers30: 2, cost7: 0.1, cost30: 2.1, costAll: 4.1, costPerAnswer: 1.05 });
    expect(s.byModel.map((m) => m.model)).toEqual(['claude-sonnet-5-5', 'claude-haiku-5-5']);
    expect(s.byDay).toHaveLength(30);
    expect(s.byDay.reduce((n, d) => n + d.answers, 0)).toBe(2);
  });
});
