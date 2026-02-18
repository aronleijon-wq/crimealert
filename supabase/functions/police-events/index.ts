import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Known Swedish city/area centroids for quick lookup without external API
const KNOWN_CENTROIDS: Record<string, [number, number]> = {
  'stockholm': [59.3293, 18.0686],
  'göteborg': [57.7089, 11.9746],
  'malmö': [55.6050, 13.0038],
  'uppsala': [59.8586, 17.6389],
  'linköping': [58.4108, 15.6214],
  'västerås': [59.6099, 16.5448],
  'örebro': [59.2753, 15.2134],
  'norrköping': [58.5942, 16.1826],
  'helsingborg': [56.0465, 12.6945],
  'jönköping': [57.7826, 14.1618],
  'umeå': [63.8258, 20.2630],
  'lund': [55.7047, 13.1910],
  'borås': [57.7210, 12.9401],
  'sundsvall': [62.3908, 17.3069],
  'gävle': [60.6749, 17.1413],
  'eskilstuna': [59.3666, 16.5077],
  'karlstad': [59.3793, 13.5036],
  'växjö': [56.8777, 14.8091],
  'halmstad': [56.6745, 12.8578],
  'luleå': [65.5848, 22.1547],
  'trollhättan': [58.2837, 12.2886],
  'östersund': [63.1792, 14.6357],
  'borlänge': [60.4858, 15.4364],
  'falun': [60.6065, 15.6355],
  'kalmar': [56.6634, 16.3566],
  'skellefteå': [64.7507, 20.9528],
  'kristianstad': [56.0294, 14.1567],
  'karlskrona': [56.1612, 15.5869],
  'södermalm': [59.3150, 18.0710],
  'norrmalm': [59.3380, 18.0600],
  'kungsholmen': [59.3320, 18.0280],
  'östermalm': [59.3400, 18.0850],
  'gamla stan': [59.3250, 18.0710],
  'bromma': [59.3400, 17.9400],
  'sundbyberg': [59.3610, 17.9720],
  'solna': [59.3600, 18.0000],
  'nacka': [59.3100, 18.1650],
  'täby': [59.4440, 18.0690],
  'huddinge': [59.2370, 17.9810],
  'järfälla': [59.4130, 17.8300],
  'lidingö': [59.3670, 18.1500],
  'haninge': [59.1740, 18.1510],
  'botkyrka': [59.2000, 17.8200],
  'tyresö': [59.2440, 18.2270],
  'sollentuna': [59.4280, 17.9510],
  'norrtälje': [59.7570, 18.7040],
  'södertälje': [59.1950, 17.6260],
  'sigtuna': [59.6170, 17.7240],
  'vallentuna': [59.5340, 18.0780],
};

// Check if coordinates appear to be county-level centroids (imprecise)
function isLikelyCountyCentroid(lat: number, lng: number, locationName: string): boolean {
  // Known county centroids from Polisen.se that are imprecise
  const countyCentroids = [
    [59.33, 18.07],  // Stockholms län
    [57.71, 11.97],  // Västra Götalands län  
    [55.61, 13.00],  // Skåne län
    [59.86, 17.64],  // Uppsala län
    [58.41, 15.62],  // Östergötlands län
    [63.83, 20.26],  // Västerbottens län
    [62.39, 17.31],  // Västernorrlands län
    [60.67, 17.14],  // Gävleborgs län
    [59.38, 13.50],  // Värmlands län
    [63.18, 14.64],  // Jämtlands län
    [65.58, 22.15],  // Norrbottens län
    [56.88, 14.81],  // Kronobergs län
    [56.66, 16.36],  // Kalmar län
    [57.78, 14.16],  // Jönköpings län
    [56.05, 12.69],  // Hallands län
    [59.61, 16.54],  // Västmanlands län
    [59.27, 15.21],  // Örebro län
    [56.16, 15.59],  // Blekinge län
    [58.54, 13.47],  // Skaraborg
    [56.03, 14.16],  // Kristianstad
    [60.49, 15.44],  // Dalarnas län
    [58.75, 17.01],  // Södermanlands län
    [57.64, 18.29],  // Gotlands län
  ];
  
  for (const [clat, clng] of countyCentroids) {
    if (Math.abs(lat - clat) < 0.02 && Math.abs(lng - clng) < 0.02) {
      return true;
    }
  }
  
  // If location name contains "län" it's likely county-level
  if (locationName.toLowerCase().includes(' län')) return true;
  
  return false;
}

// Try to geocode using location name with known centroids
function geocodeFromKnown(locationName: string): [number, number] | null {
  const lower = locationName.toLowerCase().trim();
  
  // Direct match
  if (KNOWN_CENTROIDS[lower]) return KNOWN_CENTROIDS[lower];
  
  // Try to find the city/area within the location string
  for (const [key, coords] of Object.entries(KNOWN_CENTROIDS)) {
    if (lower.includes(key) || key.includes(lower)) {
      return coords;
    }
  }
  
  return null;
}

// Geocode using Nominatim (OpenStreetMap) as fallback
async function geocodeWithNominatim(locationName: string): Promise<[number, number] | null> {
  try {
    const query = `${locationName}, Sverige`;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=se`;
    
    const response = await fetch(url, {
      headers: { 'User-Agent': 'CrimeRadar/1.0' },
    });
    
    if (!response.ok) return null;
    
    const results = await response.json();
    if (results.length > 0) {
      return [parseFloat(results[0].lat), parseFloat(results[0].lon)];
    }
  } catch (e) {
    console.error('Nominatim geocoding failed:', e);
  }
  return null;
}

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

    // Process events with geocoding
    const incidents = [];
    const geocodePromises: Promise<void>[] = [];
    
    for (const event of events.slice(0, 50)) {
      const rawLat = event.location?.gps ? parseFloat(event.location.gps.split(',')[0]) : null;
      const rawLng = event.location?.gps ? parseFloat(event.location.gps.split(',')[1]) : null;
      const locationName = event.location?.name || '';
      
      const incident: any = {
        id: `pol-${event.id}`,
        type: classifyEvent(event.type),
        title: event.name || event.type,
        description: event.summary || '',
        lat: rawLat,
        lng: rawLng,
        area: locationName || 'Okänt område',
        time: event.datetime,
        status: 'active',
        risk: assessRisk(event.type),
        source: 'Polisen.se',
        originalType: event.type,
        url: event.url,
        approximate: false,
      };

      // Check if the GPS coordinates are county-level centroids
      if (rawLat && rawLng && isLikelyCountyCentroid(rawLat, rawLng, locationName)) {
        // Try to get better coordinates from the location name
        const betterCoords = geocodeFromKnown(locationName);
        if (betterCoords) {
          incident.lat = betterCoords[0];
          incident.lng = betterCoords[1];
          incident.approximate = true;
          console.log(`Improved coordinates for "${locationName}" using known centroids`);
        } else {
          // Queue for Nominatim geocoding
          const promise = geocodeWithNominatim(locationName).then(coords => {
            if (coords) {
              incident.lat = coords[0];
              incident.lng = coords[1];
              incident.approximate = true;
              console.log(`Geocoded "${locationName}" via Nominatim`);
            } else {
              incident.approximate = true; // Mark as approximate even with original coords
            }
          });
          geocodePromises.push(promise);
        }
      } else if (!rawLat || !rawLng) {
        // No GPS at all — try geocoding
        const betterCoords = geocodeFromKnown(locationName);
        if (betterCoords) {
          incident.lat = betterCoords[0];
          incident.lng = betterCoords[1];
          incident.approximate = true;
        } else {
          const promise = geocodeWithNominatim(locationName).then(coords => {
            if (coords) {
              incident.lat = coords[0];
              incident.lng = coords[1];
              incident.approximate = true;
            }
          });
          geocodePromises.push(promise);
        }
      }
      
      incidents.push(incident);
    }

    // Wait for all geocoding to complete (with timeout)
    if (geocodePromises.length > 0) {
      console.log(`Geocoding ${geocodePromises.length} events...`);
      await Promise.race([
        Promise.all(geocodePromises),
        new Promise(resolve => setTimeout(resolve, 5000)), // 5s timeout
      ]);
    }

    // Filter out events with no coordinates
    const validIncidents = incidents.filter((i: any) => i.lat && i.lng);
    
    const exactCount = validIncidents.filter((i: any) => !i.approximate).length;
    const approxCount = validIncidents.filter((i: any) => i.approximate).length;
    console.log(`Returning ${validIncidents.length} incidents (${exactCount} exact, ${approxCount} approximate)`);

    return new Response(JSON.stringify({ success: true, data: validIncidents }), {
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
