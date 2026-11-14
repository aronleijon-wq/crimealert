// Fråga CrimeAlert: answers a question about crime where you live, with Claude counting Polisen's
// events through two tools (_shared/ask.ts). For signed-in accounts: three questions a Swedish
// day without Pro, answered by Haiku; as many as you like with Pro (up to a hundred), the first
// five a day by Sonnet and the rest by Haiku. Body { messages } asks; { quota: true } only tells
// how many are left.
//
// ANTHROPIC_API_KEY is needed. ASK_MODEL and ASK_PRO_MODEL pick the models
// (claude-haiku-5-5 and claude-sonnet-5-5 unless set).
import Anthropic from 'npm:@anthropic-ai/sdk@^0.136.0';
import { createClient } from 'npm:@supabase/supabase-js@2.97.0';
import Stripe from 'https://esm.sh/stripe@18.5.0';
import {
  ASK_TOOLS, askSystem, betterLeft, cleanHistory, kommunEvents, kommunNamed, modelTier, questionsLeft, stockholmMidnight, swedenRanking, type AskEvent,
} from '../_shared/ask.ts';
import { isFreePremiumEmail, isFresh, lookupProUntil, proUntilActive, readProStatus, rememberProStatus } from '../_shared/premium.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const MODELS = {
  fast: Deno.env.get('ASK_MODEL') || 'claude-haiku-5-5',
  better: Deno.env.get('ASK_PRO_MODEL') || 'claude-sonnet-5-5',
};
const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
const anthropic = apiKey ? new Anthropic({ apiKey }) : null;
const DAY = 24 * 60 * 60 * 1000;
/** Rounds of tool use before the answer, at most */
const MAX_ROUNDS = 4;
const COLUMNS = 'id, title, area, time, original_type, description';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

/** Pro now: as check-subscription last stored it, or Stripe when that is old */
async function hasPro(userId: string, email: string | undefined, now: number): Promise<boolean> {
  if (email && isFreePremiumEmail(email)) return true;
  const row = (await readProStatus(db, [userId])).get(userId);
  if (row && isFresh(row, now)) return proUntilActive(row.pro_until, now);
  if (!email) return row ? proUntilActive(row.pro_until, now) : false;
  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: '2025-08-27.basil' }) : null;
    return proUntilActive(await rememberProStatus(db, userId, await lookupProUntil(stripe, email, now)), now);
  } catch {
    return row ? proUntilActive(row.pro_until, now) : false;
  }
}

/** Every event since then, page by page (PostgREST gives at most 1000 at a time) */
async function eventsSince(since: string, filter?: (q: any) => any): Promise<AskEvent[]> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const rows: AskEvent[] = [];
  for (let page = 0; page < 6; page++) {
    let query = db.from('police_events_archive').select(COLUMNS).gte('time', since);
    if (filter) query = filter(query);
    const { data, error } = await query.order('time', { ascending: false }).range(page * 1000, page * 1000 + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  return rows;
}

/** One tool call: its result for the model, as text */
async function runTool(name: string, input: Record<string, unknown>, now: number): Promise<string> {
  if (name === 'kommun_events') {
    const kommun = kommunNamed(String(input.kommun ?? ''));
    if (!kommun) return JSON.stringify(kommunEvents(input, [], now));
    const days = Math.min(60, Math.max(1, Math.round(Number(input.days) || 7)));
    const since = new Date(now - 2 * days * DAY).toISOString();
    // In the kommun by area, and by the town at the end of the title (the area is often the län)
    const [byArea, byTitle] = await Promise.all([
      eventsSince(since, (q) => q.ilike('area', `%${kommun}%`)),
      eventsSince(since, (q) => q.ilike('title', `%, ${kommun}`)),
    ]);
    const unique = new Map<string, AskEvent>();
    for (const e of [...byArea, ...byTitle]) unique.set(e.id ?? `${e.time}|${e.title}`, e);
    return JSON.stringify(kommunEvents(input, [...unique.values()], now));
  }
  if (name === 'sweden_ranking') {
    const days = Math.min(30, Math.max(1, Math.round(Number(input.days) || 7)));
    return JSON.stringify(swedenRanking(input, await eventsSince(new Date(now - days * DAY).toISOString()), now));
  }
  return JSON.stringify({ error: `Okänt verktyg: ${name}` });
}

/** Claude's answer, using the tools as often as it needs to (up to MAX_ROUNDS) */
async function answer(history: { role: 'user' | 'assistant'; content: string }[], now: number, model: string): Promise<string | null> {
  if (!anthropic) return null;
  const messages: Anthropic.Beta.BetaMessageParam[] = history.map((t) => ({ role: t.role, content: t.content }));
  for (let round = 0; round <= MAX_ROUNDS; round++) {
    const response = await anthropic.beta.messages.create({
      model,
      max_tokens: 8000,
      system: askSystem(now),
      tools: ASK_TOOLS,
      // After the last round of tools it must answer with what it has
      tool_choice: round === MAX_ROUNDS ? { type: 'none' } : { type: 'auto' },
      output_config: { effort: 'medium' },
      // A declined request is run again on a fallback model where the model has one (Haiku has none)
      ...(model.startsWith('claude-haiku') ? {} : { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }),
      messages,
    });
    if (response.stop_reason === 'refusal') return 'Den frågan kan jag inte svara på. Fråga gärna om händelser i en kommun eller i Sverige.';
    if (response.stop_reason !== 'tool_use') {
      const text = response.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim();
      return text || null;
    }
    messages.push({ role: 'assistant', content: response.content });
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== 'tool_use') continue;
      try {
        results.push({ type: 'tool_result', tool_use_id: block.id, content: await runTool(block.name, block.input as Record<string, unknown>, now) });
      } catch (error) {
        console.error('Tool failed', block.name, error);
        results.push({ type: 'tool_result', tool_use_id: block.id, content: 'Kunde inte hämta uppgifterna just nu.', is_error: true });
      }
    }
    messages.push({ role: 'user', content: results });
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
    const { data: auth } = token ? await db.auth.getUser(token) : { data: { user: null } };
    const user = auth?.user;
    if (!user) return json({ error: 'login' }, 401);

    const now = Date.now();
    const body = await req.json().catch(() => ({}));
    const dayStart = new Date(stockholmMidnight(now)).toISOString();
    const [{ count }, pro] = await Promise.all([
      db.from('ask_log').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', dayStart),
      hasPro(user.id, user.email, now),
    ]);
    const used = count ?? 0;
    const left = questionsLeft(used, pro);
    if (body?.quota) return json({ left, pro, better: betterLeft(used, pro) });
    if (left === 0) return json({ error: 'limit', left: 0, pro }, 429);

    const history = cleanHistory(body?.messages);
    if (!history) return json({ error: 'Frågan saknas.' }, 400);
    if (!anthropic) return json({ error: 'Fråga CrimeAlert är inte igång än.' }, 503);

    const text = await answer(history, now, MODELS[modelTier(used, pro)]);
    if (!text) return json({ error: 'Kunde inte svara just nu. Försök igen om en stund.' }, 502);

    // Counted only when answered; a month of rows is plenty to count a day
    await db.from('ask_log').insert({ user_id: user.id });
    await db.from('ask_log').delete().lt('created_at', new Date(now - 31 * DAY).toISOString());
    return json({ answer: text, left: questionsLeft(used + 1, pro), pro, better: betterLeft(used + 1, pro) });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return json({ error: 'Många frågar just nu. Försök igen om en minut.' }, 429);
    if (error instanceof Anthropic.APIError) console.error(`Fråga CrimeAlert API error ${error.status}:`, error.message);
    else console.error('ask-crimealert error:', error);
    return json({ error: 'Kunde inte svara just nu. Försök igen om en stund.' }, 500);
  }
});
