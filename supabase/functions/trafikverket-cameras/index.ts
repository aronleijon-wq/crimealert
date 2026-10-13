// The list of Trafikverket's road cameras for the map's camera layer. Cameras rarely change, so
// one fetch serves everyone for half an hour, and browsers keep the answer as well.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { TRAFIKVERKET_API_URL } from '../_shared/sources/trafikverket.ts';
import { apiError, cameraQuery, parseCameras, type TrafficCamera } from '../_shared/sources/trafikverketCameras.ts';

const CACHE_TTL = 30 * 60 * 1000;
let cache: { at: number; cameras: TrafficCamera[] } | null = null;

const json = (body: unknown, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extra } });

async function fetchCameras(key: string): Promise<TrafficCamera[]> {
  // Older API setups want the Camera query without a namespace; try with it first
  for (const namespace of ['road.infrastructure', null]) {
    const res = await fetch(TRAFIKVERKET_API_URL, { method: 'POST', headers: { 'Content-Type': 'text/xml' }, body: cameraQuery(key, namespace) });
    const body = await res.json().catch(() => null);
    const error = apiError(body);
    if (res.ok && !error) return parseCameras(body);
    console.error('Trafikverket cameras', namespace ?? 'no namespace', res.status, error ?? '');
  }
  throw new Error('Trafikverket did not return any cameras');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    if (!cache || Date.now() - cache.at > CACHE_TTL) {
      const key = Deno.env.get('TRAFIKVERKET_API_KEY');
      if (!key) return json({ success: false, error: 'Missing API key', data: [] });
      cache = { at: Date.now(), cameras: await fetchCameras(key) };
    }
    return json({ success: true, count: cache.cameras.length, data: cache.cameras }, { 'Cache-Control': 'public, max-age=1800' });
  } catch (err) {
    console.error('trafikverket-cameras failed:', err);
    // An older list beats none
    if (cache) return json({ success: true, stale: true, count: cache.cameras.length, data: cache.cameras });
    return json({ success: false, error: (err as Error).message, data: [] });
  }
});
