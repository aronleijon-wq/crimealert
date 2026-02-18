import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Map Swedish police event types to our incident types
function classifyEvent(type: string): string {
  const lower = type.toLowerCase();
  if (lower.includes('brand') || lower.includes('rökutveckling')) return 'fire';
  if (lower.includes('trafik') || lower.includes('trafikolycka') || lower.includes('rattfylleri')) return 'traffic';
  if (lower.includes('sjukvård') || lower.includes('ambulans') || lower.includes('försvunnen')) return 'ambulance';
  if (lower.includes('stöld') || lower.includes('inbrott') || lower.includes('rån') || lower.includes('misshandel') || 
      lower.includes('skottlossning') || lower.includes('mord') || lower.includes('hot') || lower.includes('bedrägeri') ||
      lower.includes('narkotika') || lower.includes('vapenlag') || lower.includes('ordningslagen')) return 'police';
  return 'other';
}

function assessRisk(type: string): string {
  const lower = type.toLowerCase();
  if (lower.includes('skottlossning') || lower.includes('mord') || lower.includes('brand') || lower.includes('rån') || lower.includes('knivlag')) return 'high';
  if (lower.includes('misshandel') || lower.includes('trafikolycka') || lower.includes('inbrott') || lower.includes('hot')) return 'medium';
  return 'low';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const location = url.searchParams.get('location') || '';
    
    // Fetch from Polisen.se API
    let apiUrl = 'https://polisen.se/api/events';
    if (location) {
      apiUrl += `?locationname=${encodeURIComponent(location)}`;
    }

    console.log('Fetching police events from:', apiUrl);

    const response = await fetch(apiUrl, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Polisen API returned ${response.status}`);
    }

    const events = await response.json();
    console.log(`Received ${events.length} events from Polisen.se`);

    // Transform to our incident format
    const incidents = events.slice(0, 50).map((event: any) => ({
      id: `pol-${event.id}`,
      type: classifyEvent(event.type),
      title: event.name || event.type,
      description: event.summary || '',
      lat: event.location?.gps ? parseFloat(event.location.gps.split(',')[0]) : null,
      lng: event.location?.gps ? parseFloat(event.location.gps.split(',')[1]) : null,
      area: event.location?.name || 'Okänt område',
      time: event.datetime,
      status: 'active',
      risk: assessRisk(event.type),
      source: 'Polisen.se',
      originalType: event.type,
      url: event.url,
    })).filter((i: any) => i.lat && i.lng);

    return new Response(JSON.stringify({ success: true, data: incidents }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching police events:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
