import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const PORTAL_CONFIG_ID = "bpc_1T2dGPC5T1wZbLBJmDrlVaQv";
    const PORTAL_LOGIN_URL = "https://billing.stripe.com/p/login/7sY28q57o6Vlduz8It1wY00";

    const customers = await stripe.customers.list({ email: user.email, limit: 10 });

    // Prioritera kund som faktiskt har en aktiv/trialing/past_due prenumeration
    const priorityOrder = ["active", "trialing", "past_due"] as const;
    let chosenCustomerId: string | null = null;
    let bestPriority = Number.POSITIVE_INFINITY;

    for (const customer of customers.data) {
      const subscriptions = await stripe.subscriptions.list({ customer: customer.id, limit: 20 });
      const bestForCustomer = subscriptions.data
        .filter((s) => priorityOrder.includes(s.status as (typeof priorityOrder)[number]))
        .sort((a, b) => priorityOrder.indexOf(a.status as (typeof priorityOrder)[number]) - priorityOrder.indexOf(b.status as (typeof priorityOrder)[number]))[0];

      if (!bestForCustomer) continue;
      const p = priorityOrder.indexOf(bestForCustomer.status as (typeof priorityOrder)[number]);
      if (p < bestPriority) {
        bestPriority = p;
        chosenCustomerId = customer.id;
      }
    }

    // Om ingen passande kund med prenumeration hittas, skicka till Stripe login-länk
    if (!chosenCustomerId) {
      return new Response(JSON.stringify({ url: PORTAL_LOGIN_URL }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const origin = req.headers.get("origin") || "http://localhost:3000";
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: chosenCustomerId,
      configuration: PORTAL_CONFIG_ID,
      return_url: `${origin}/account`,
    });

    return new Response(JSON.stringify({ url: portalSession.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
