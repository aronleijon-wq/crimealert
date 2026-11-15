// What Fråga CrimeAlert costs: tokens per answer (ai_usage) times Anthropic's price per model.
// Prices in US dollars per million tokens (Anthropic bills in dollars). Writing to the prompt
// cache costs 1.25 times the input price. Update when the prices or the models change.

export interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
}

interface Price { input: number; output: number; cacheRead: number }

export const PRICES: Record<string, Price> = {
  'claude-haiku-5-5': { input: 0.1, output: 0.5, cacheRead: 0.01 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.1 },
  // Claude Sonnet 5.5's fallback when it declines
  'claude-sonnet-5': { input: 2, output: 10, cacheRead: 0.2 },
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2 },
};
/** For a model not in the list: the dearest of the chat's own models, so the cost is not understated */
const UNKNOWN: Price = PRICES['claude-sonnet-5-5'];

/** What one answer cost, in dollars */
export function costUsd(model: string, u: Usage): number {
  const p = PRICES[model] ?? UNKNOWN;
  return (u.input_tokens * p.input + u.output_tokens * p.output + u.cache_read_tokens * p.cacheRead + u.cache_write_tokens * p.input * 1.25) / 1_000_000;
}

/** Adds a response's usage (the API's field names) to a running total */
export function addUsage(total: Usage, usage: {
  input_tokens?: number | null; output_tokens?: number | null; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null;
}): Usage {
  return {
    input_tokens: total.input_tokens + (usage.input_tokens ?? 0),
    output_tokens: total.output_tokens + (usage.output_tokens ?? 0),
    cache_read_tokens: total.cache_read_tokens + (usage.cache_read_input_tokens ?? 0),
    cache_write_tokens: total.cache_write_tokens + (usage.cache_creation_input_tokens ?? 0),
  };
}

export const NO_USAGE: Usage = { input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0 };

export interface AiCostSummary {
  answers7: number;
  answers30: number;
  cost7: number;
  cost30: number;
  costAll: number;
  /** Per answer, over the last 30 days */
  costPerAnswer: number;
  byModel: { model: string; answers: number; cost: number }[];
  byDay: { day: string; cost: number; answers: number }[];
}

/** Totals over the last 7 and 30 days and all time, per model and per day (30 days) */
export function summarizeAi(rows: (Usage & { model: string; created_at: string })[], now: number): AiCostSummary {
  const DAY = 86_400_000;
  const s: AiCostSummary = { answers7: 0, answers30: 0, cost7: 0, cost30: 0, costAll: 0, costPerAnswer: 0, byModel: [], byDay: [] };
  const models = new Map<string, { answers: number; cost: number }>();
  const days = new Map<string, { cost: number; answers: number }>();
  for (let i = 29; i >= 0; i--) days.set(new Date(now - i * DAY).toISOString().slice(0, 10), { cost: 0, answers: 0 });
  for (const r of rows) {
    const cost = costUsd(r.model, r);
    const age = now - Date.parse(r.created_at);
    s.costAll += cost;
    if (age < 30 * DAY) {
      s.answers30 += 1;
      s.cost30 += cost;
      const m = models.get(r.model) ?? { answers: 0, cost: 0 };
      m.answers += 1;
      m.cost += cost;
      models.set(r.model, m);
      const d = days.get(r.created_at.slice(0, 10));
      if (d) { d.cost += cost; d.answers += 1; }
    }
    if (age < 7 * DAY) { s.answers7 += 1; s.cost7 += cost; }
  }
  s.costPerAnswer = s.answers30 ? s.cost30 / s.answers30 : 0;
  s.byModel = [...models].map(([model, m]) => ({ model, ...m })).sort((a, b) => b.cost - a.cost);
  s.byDay = [...days].map(([day, d]) => ({ day, ...d }));
  return s;
}
