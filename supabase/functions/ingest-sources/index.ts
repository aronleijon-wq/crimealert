// Collects every non-police source into public.external_events. Run by pg_cron every 5 minutes
// (see migration 20261002160100), so the work and cost don't grow with the number of visitors.
// It also calls police-events, which archives new police events and sends push notifications,
// so those keep running when nobody has the site open.

import { createClient } from 'npm:@supabase/supabase-js@2.57.2';
import {
  parseSituations,
  situationQuery,
  TRAFIKVERKET_API_URL,
  trafikverketToExternal,
} from '../_shared/sources/trafikverket.ts';
import {
  KRISINFORMATION_NEWS_URL,
  parseKrisinformationNews,
  parseVmaAlerts,
  VMA_ALERTS_URL,
} from '../_shared/sources/krisinformation.ts';
import { enabledNewsFeeds, newsItemsToEvents } from '../_shared/sources/news.ts';
import { parseFeed } from '../_shared/sources/rss.ts';
import type { ExternalEvent } from '../_shared/sources/types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MIN_INTERVAL_MS = 4 * 60 * 1000;
const FETCH_TIMEOUT_MS = 15_000;
const POLICE_TIMEOUT_MS = 90_000;
const USER_AGENT = 'CrimeAlert/1.0 (+https://crimealert.se)';
const NEWS_RETENTION_DAYS = 14;
const OTHER_RETENTION_DAYS = 60;

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
  auth: { persistSession: false },
});

// What this isolate last wrote per id, so unchanged rows aren't rewritten every run
const written = new Map<string, string>();

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      headers: { 'User-Agent': USER_AGENT, ...(init.headers ?? {}) },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetchWithTimeout(url, { ...init, headers: { Accept: 'application/json', ...(init?.headers ?? {}) } });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
  return res.json();
}

async function collectTrafikverket(): Promise<ExternalEvent[]> {
  const key = Deno.env.get('TRAFIKVERKET_API_KEY');
  if (!key) throw new Error('TRAFIKVERKET_API_KEY is not set');
  const data = await fetchJson(TRAFIKVERKET_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml' },
    body: situationQuery(key),
  });
  // Only acute disruptions are kept as history; roadworks stay on the live map layer
  return parseSituations(data).filter((e) => e.acute).map(trafikverketToExternal);
}

async function collectNews(): Promise<ExternalEvent[]> {
  const feeds = enabledNewsFeeds(Deno.env.get('NEWS_EXTRA_SOURCES'));
  const results = await Promise.allSettled(feeds.map(async (feed) => {
    const res = await fetchWithTimeout(feed.url, { headers: { Accept: 'application/rss+xml, application/xml, text/xml' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return newsItemsToEvents(feed, parseFeed(await res.text()));
  }));
  const failed = results.filter((r) => r.status === 'rejected').length;
  if (failed > 0) console.warn(`[ingest-sources] ${failed}/${feeds.length} news feeds failed`);
  if (failed === feeds.length) throw new Error('All news feeds failed');
  return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
}

/** Calls police-events so it archives new events and sends push notifications. */
async function runPoliceEvents(): Promise<number> {
  const res = await fetchWithTimeout(`${supabaseUrl}/functions/v1/police-events`, {
    headers: { Authorization: `Bearer ${Deno.env.get('SUPABASE_ANON_KEY') ?? ''}` },
  }, POLICE_TIMEOUT_MS);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  return Array.isArray(body?.data) ? body.data.length : 0;
}

/** Inserts or updates rows that are new or changed since this isolate last wrote them. */
async function saveEvents(events: ExternalEvent[]): Promise<number> {
  const unique = [...new Map(events.map((e) => [e.id, e])).values()];
  const changed = unique.filter((e) => written.get(e.id) !== JSON.stringify(e));
  const now = new Date().toISOString();
  for (let i = 0; i < changed.length; i += 200) {
    const batch = changed.slice(i, i + 200);
    const { error } = await supabase
      .from('external_events')
      .upsert(batch.map((e) => ({ ...e, updated_at: now })), { onConflict: 'id' });
    if (error) throw new Error(`Saving events failed: ${error.message}`);
    batch.forEach((e) => written.set(e.id, JSON.stringify(e)));
  }
  return changed.length;
}

// Cancelled VMA ids this isolate has already ended
const ended = new Set<string>();

async function endCancelledAlerts(cancelledIds: string[]): Promise<void> {
  const ids = cancelledIds.filter((id) => !ended.has(id));
  if (ids.length === 0) return;
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('external_events')
    .update({ ends_at: now, updated_at: now })
    .in('id', ids)
    .or(`ends_at.is.null,ends_at.gt.${now}`);
  if (error) {
    console.warn('[ingest-sources] ending cancelled VMA failed:', error.message);
    return;
  }
  ids.forEach((id) => {
    ended.add(id);
    written.delete(id);
  });
}

/** Removes old rows once an hour (the first run after the full hour). */
async function pruneOldEvents(): Promise<void> {
  if (new Date().getUTCMinutes() >= 5) return;
  const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from('external_events').delete().eq('kind', 'news').lt('published_at', daysAgo(NEWS_RETENTION_DAYS));
  await supabase.from('external_events').delete().neq('kind', 'news').lt('published_at', daysAgo(OTHER_RETENTION_DAYS));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Claim this run; skip if another run started less than 4 minutes ago
    const cutoff = new Date(Date.now() - MIN_INTERVAL_MS).toISOString();
    const { data: claimed, error: claimError } = await supabase
      .from('ingest_state')
      .update({ last_run_at: new Date().toISOString() })
      .eq('key', 'sources')
      .lt('last_run_at', cutoff)
      .select('key');
    if (claimError) throw new Error(`Claiming run failed: ${claimError.message}`);
    if (!claimed || claimed.length === 0) return json({ skipped: true, reason: 'ran less than 4 minutes ago' });

    const [police, traffic, crisis, vma, news] = await Promise.allSettled([
      runPoliceEvents(),
      collectTrafikverket(),
      fetchJson(KRISINFORMATION_NEWS_URL).then(parseKrisinformationNews),
      fetchJson(VMA_ALERTS_URL).then(parseVmaAlerts),
      collectNews(),
    ]);

    const summary: Record<string, number | string> = {};
    const report = (name: string, result: PromiseSettledResult<unknown>, count: (value: never) => number) => {
      summary[name] = result.status === 'fulfilled' ? count(result.value as never) : `error: ${String(result.reason?.message ?? result.reason)}`;
      if (result.status === 'rejected') console.warn(`[ingest-sources] ${name} failed:`, result.reason);
    };
    report('police', police, (n: number) => n);
    report('traffic', traffic, (events: ExternalEvent[]) => events.length);
    report('crisis', crisis, (events: ExternalEvent[]) => events.length);
    report('vma', vma, (result: { events: ExternalEvent[] }) => result.events.length);
    report('news', news, (events: ExternalEvent[]) => events.length);

    const events = [
      ...(traffic.status === 'fulfilled' ? traffic.value : []),
      ...(crisis.status === 'fulfilled' ? crisis.value : []),
      ...(vma.status === 'fulfilled' ? vma.value.events : []),
      ...(news.status === 'fulfilled' ? news.value : []),
    ];
    summary.written = await saveEvents(events);
    if (vma.status === 'fulfilled') await endCancelledAlerts(vma.value.cancelledIds);
    await pruneOldEvents();

    console.log('[ingest-sources]', JSON.stringify(summary));
    return json({ success: true, ...summary });
  } catch (err) {
    console.error('[ingest-sources] failed:', err);
    return json({ success: false, error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
