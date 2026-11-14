// Lägesbild: a few sentences on the last week in a kommun, written by Claude from Polisen's
// events and kept for twelve hours (situation_reports), so each kommun costs at most two texts a
// day whoever asks. Quiet weeks, and any trouble reaching the model, get the plain count instead.
//
// ANTHROPIC_API_KEY enables the text; SITUATION_MODEL picks the model (claude-opus-5-5 unless set).
import Anthropic from 'npm:@anthropic-ai/sdk@^0.136.0';
import { createClient } from 'npm:@supabase/supabase-js@2.97.0';
import { SWEDISH_MUNICIPALITIES } from '../_shared/data/municipalities.ts';
import {
  cleanSummary, plainText, situationFacts, situationPrompt, SITUATION_SYSTEM, tooQuiet, type SituationEvent,
} from '../_shared/situation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const KEEP_MS = 12 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;
const KOMMUNER = new Set(SWEDISH_MUNICIPALITIES.map((m) => m.name));
const MODEL = Deno.env.get('SITUATION_MODEL') || 'claude-opus-5-5';
const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
const anthropic = apiKey ? new Anthropic({ apiKey }) : null;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

interface Report {
  kommun: string;
  summary: string;
  this_week: number;
  last_week: number;
  model: string | null;
  generated_at: string;
}

const shape = (r: Report) => ({
  kommun: r.kommun, summary: r.summary, thisWeek: r.this_week, lastWeek: r.last_week, ai: r.model !== null, generatedAt: r.generated_at,
});

/** Claude's lägesbild from the facts, or null when it can't be had */
async function writeSummary(prompt: string): Promise<string | null> {
  if (!anthropic) return null;
  try {
    const response = await anthropic.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: SITUATION_SYSTEM,
      messages: [{ role: 'user', content: prompt }],
      output_config: { effort: 'low' },
      // A declined request is run again on a fallback model; Haiku has none
      ...(MODEL.startsWith('claude-haiku') ? {} : { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }),
    });
    if (response.stop_reason === 'refusal') {
      console.warn('Lägesbild declined', JSON.stringify(response.stop_details ?? null));
      return null;
    }
    const text = response.content.map((block) => (block.type === 'text' ? block.text : '')).join('');
    return cleanSummary(text);
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) console.warn('Lägesbild rate limited');
    else if (error instanceof Anthropic.APIError) console.error(`Lägesbild API error ${error.status}:`, error.message);
    else console.error('Lägesbild failed:', error);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const kommun = String(body?.kommun ?? new URL(req.url).searchParams.get('kommun') ?? '').trim();
    if (!KOMMUNER.has(kommun)) return json({ error: 'Okänd kommun' }, 400);

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const now = Date.now();

    const { data: kept } = await supabase.from('situation_reports').select('*').eq('kommun', kommun).maybeSingle();
    if (kept && now - Date.parse(kept.generated_at) < KEEP_MS) return json(shape(kept as Report));

    // The last two weeks: events placed in the kommun, and those whose title ends with it
    // (Polisen often puts the whole län as the area). PostgREST returns at most 1000 of each.
    const since = new Date(now - 14 * DAY).toISOString();
    const columns = 'id, title, area, time, original_type, description';
    const [byArea, byTitle] = await Promise.all([
      supabase.from('police_events_archive').select(columns).gte('time', since).ilike('area', `%${kommun}%`).order('time', { ascending: false }).limit(1000),
      supabase.from('police_events_archive').select(columns).gte('time', since).ilike('title', `%, ${kommun}`).order('time', { ascending: false }).limit(1000),
    ]);
    if (byArea.error) throw byArea.error;
    const rows = new Map<string, SituationEvent>();
    for (const row of [...(byArea.data ?? []), ...(byTitle.data ?? [])]) rows.set(row.id, row);

    const facts = situationFacts([...rows.values()], kommun, now);
    const written = tooQuiet(facts) ? null : await writeSummary(situationPrompt(facts));
    const report: Report = {
      kommun,
      summary: written ?? plainText(facts),
      this_week: facts.thisWeek,
      last_week: facts.lastWeek,
      model: written ? MODEL : null,
      generated_at: new Date(now).toISOString(),
    };
    // The plain count is kept too, unless the model should have written it and failed: then the
    // next visitor tries again
    if (written || tooQuiet(facts) || !anthropic) {
      const { error } = await supabase.from('situation_reports').upsert(report);
      if (error) console.warn('Could not keep the lägesbild', error.message);
    }
    return json(shape(report));
  } catch (error) {
    console.error('situation-report error:', error);
    return json({ error: 'Kunde inte ta fram lägesbilden' }, 500);
  }
});
