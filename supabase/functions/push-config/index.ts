const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') ?? null;

  return new Response(
    JSON.stringify({
      vapidPublicKey,
      hasPublicKey: Boolean(vapidPublicKey),
      hasPrivateKey: Boolean(Deno.env.get('VAPID_PRIVATE_KEY')),
      hasSupabaseUrl: Boolean(Deno.env.get('SUPABASE_URL')),
      hasServiceRoleKey: Boolean(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')),
    }),
    {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    }
  );
});
