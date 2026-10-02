import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { parseSituations, situationQuery, TRAFIKVERKET_API_URL } from '../_shared/sources/trafikverket.ts';

const CACHE_TTL = 5 * 60 * 1000; // 5 min

let cache: { at: number; payload: unknown } | null = null;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (cache && Date.now() - cache.at < CACHE_TTL) {
      return new Response(JSON.stringify(cache.payload), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const key = Deno.env.get('TRAFIKVERKET_API_KEY');
    if (!key) {
      return new Response(JSON.stringify({ success: false, error: 'Missing API key' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const res = await fetch(TRAFIKVERKET_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body: situationQuery(key),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('Trafikverket error', res.status, text.slice(0, 300));
      throw new Error(`Trafikverket HTTP ${res.status}`);
    }

    const json = await res.json();
    const unique = parseSituations(json);

    const payload = { success: true, count: unique.length, data: unique };
    cache = { at: Date.now(), payload };

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('trafikverket-events failed:', err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message, data: [] }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
