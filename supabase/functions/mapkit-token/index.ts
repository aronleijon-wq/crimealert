// A token for Apple Maps (MapKit JS) on CrimeAlert's own pages: see _shared/mapkit.ts.
import { signAppleJwt } from '../_shared/appleJwt.ts';
import { allowedMapOrigin, APPLE_TEAM_ID, mapkitClaims, MAPKIT_TOKEN_SECONDS } from '../_shared/mapkit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const origin = req.headers.get('Origin');
  if (!allowedMapOrigin(origin)) return json({ error: 'Inte tillåtet härifrån.' }, 403);

  const keyId = Deno.env.get('MAPKIT_KEY_ID');
  const privateKey = Deno.env.get('MAPKIT_PRIVATE_KEY');
  // Without the key the site keeps its own map
  if (!keyId || !privateKey) return json({ error: 'MAPKIT_KEY_ID eller MAPKIT_PRIVATE_KEY saknas.' }, 503);

  try {
    const now = Math.floor(Date.now() / 1000);
    const token = await signAppleJwt({ kid: keyId, typ: 'JWT' }, mapkitClaims(APPLE_TEAM_ID, origin!, now), privateKey);
    return json({ token, expiresAt: (now + MAPKIT_TOKEN_SECONDS) * 1000 });
  } catch (error) {
    console.error('[mapkit-token]', error instanceof Error ? error.message : error);
    return json({ error: 'Kunde inte skapa kartnyckeln.' }, 500);
  }
});
