import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const API_URL = 'https://api.trafikinfo.trafikverket.se/v2/data.json';
const CACHE_TTL = 5 * 60 * 1000; // 5 min

let cache: { at: number; payload: unknown } | null = null;

function parsePoint(wkt?: string): { lat: number; lng: number } | null {
  if (!wkt) return null;
  const m = wkt.match(/POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i);
  if (!m) return null;
  const lng = parseFloat(m[1]);
  const lat = parseFloat(m[2]);
  if (isNaN(lat) || isNaN(lng)) return null;
  // Sanity check: within Sweden
  if (lat < 54 || lat > 70 || lng < 10 || lng > 25) return null;
  return { lat, lng };
}

function riskFrom(severity?: string): 'low' | 'medium' | 'high' {
  const s = (severity || '').toLowerCase();
  if (s.includes('mycket stor') || s.includes('stor')) return 'high';
  if (s.includes('måttlig') || s.includes('medel')) return 'medium';
  return 'low';
}

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

    const query = `<REQUEST>
  <LOGIN authenticationkey="${key}" />
  <QUERY objecttype="Situation" schemaversion="1.5" limit="600">
    <FILTER>
      <GT name="Deviation.CreationTime" value="$dateadd(-3.00:00:00)" />
    </FILTER>
  </QUERY>
</REQUEST>`;

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body: query,
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('Trafikverket error', res.status, text.slice(0, 300));
      throw new Error(`Trafikverket HTTP ${res.status}`);
    }

    const json = await res.json();
    const situations = json?.RESPONSE?.RESULT?.[0]?.Situation ?? [];

    const events: unknown[] = [];
    for (const sit of situations) {
      const deviations = sit?.Deviation ?? [];
      for (const d of deviations) {
        const point =
          parsePoint(d?.Geometry?.WGS84) ||
          parsePoint(d?.Geometry?.Point?.WGS84) ||
          parsePoint(sit?.Deviation?.[0]?.Geometry?.WGS84);
        if (!point) continue;

        const time = d?.CreationTime || d?.StartTime || sit?.PublicationTime;
        if (!time) continue;

        const road = d?.RoadNumber ? `${d.RoadNumber} — ` : '';
        const title = `${road}${d?.MessageCodeValue || d?.MessageType || 'Trafikstörning'}`;

        events.push({
          id: `tv-${d?.Id || sit?.Id}`,
          type: 'trafikverket',
          title: String(title).slice(0, 160),
          description: String(d?.Message || d?.LocationDescriptor || '').slice(0, 600),
          lat: point.lat,
          lng: point.lng,
          area: String(d?.LocationDescriptor || d?.CountyNo?.join?.(', ') || 'Sverige').slice(0, 160),
          time,
          status: d?.EndTime && new Date(d.EndTime).getTime() < Date.now() ? 'resolved' : 'active',
          risk: riskFrom(d?.SeverityText),
          source: 'Trafikverket',
          originalType: d?.MessageType || null,
          location_precision: 'exact',
        });
      }
    }

    // Dedupe by id
    const seen = new Set<string>();
    const unique = events.filter((e: any) => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });

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
