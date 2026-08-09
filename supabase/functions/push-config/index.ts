const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') ?? null;

  // Only expose the public VAPID key. Internal secret-configuration state
  // must never be disclosed to unauthenticated callers.
  return new Response(
    JSON.stringify({
      vapidPublicKey,
      hasPublicKey: Boolean(vapidPublicKey),
    }),
    {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    }
  );
});
