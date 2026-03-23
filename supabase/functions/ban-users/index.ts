import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BLOCKED_EMAILS = [
  "info.teknik.ab@gmail.com",
  "thephotographers.ab@gmail.com",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const results: { email: string; status: string }[] = [];

    // Find and ban each blocked user
    for (const email of BLOCKED_EMAILS) {
      // List users to find by email
      const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      if (listError) throw listError;

      const user = users?.find(u => u.email === email);
      if (!user) {
        results.push({ email, status: "not_found" });
        continue;
      }

      // Ban until year 2099
      const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
        ban_duration: "876000h", // ~100 years
      });

      if (banError) {
        results.push({ email, status: `error: ${banError.message}` });
      } else {
        results.push({ email, status: "banned" });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
