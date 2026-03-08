import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PORTAL_CONFIG_ID = "bpc_1T2dGPC5T1wZbLBJmDrlVaQv";

const rankByStatus = (status: Stripe.Subscription.Status): number => {
  switch (status) {
    case "active":
      return 0;
    case "trialing":
      return 1;
    case "past_due":
      return 2;
    case "unpaid":
      return 3;
    case "incomplete":
      return 4;
    case "incomplete_expired":
      return 5;
    case "paused":
      return 6;
    case "canceled":
      return 7;
    default:
      return 99;
  }
};

const pickBestCustomerId = async (
  stripe: Stripe,
  userId: string,
  email: string,
): Promise<string> => {
  const customers = await stripe.customers.list({ email, limit: 100 });

  if (customers.data.length === 0) {
    const created = await stripe.customers.create({
      email,
      metadata: { user_id: userId },
    });
    return created.id;
  }

  const scoredCustomers: Array<{
    customerId: string;
    metadataMatch: boolean;
    hasSubscriptions: boolean;
    bestStatusRank: number;
    latestSubscriptionCreated: number;
    customerCreated: number;
  }> = [];

  for (const customer of customers.data) {
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: "all",
      limit: 50,
    });

    const hasSubscriptions = subscriptions.data.length > 0;
    const bestStatusRank = hasSubscriptions
      ? Math.min(...subscriptions.data.map((s) => rankByStatus(s.status)))
      : 99;
    const latestSubscriptionCreated = hasSubscriptions
      ? Math.max(...subscriptions.data.map((s) => s.created))
      : 0;

    scoredCustomers.push({
      customerId: customer.id,
      metadataMatch: customer.metadata?.user_id === userId,
      hasSubscriptions,
      bestStatusRank,
      latestSubscriptionCreated,
      customerCreated: customer.created,
    });
  }

  scoredCustomers.sort((a, b) => {
    // Most important: choose customer with the best (most active) subscription state
    if (a.bestStatusRank !== b.bestStatusRank) return a.bestStatusRank - b.bestStatusRank;
    if (a.hasSubscriptions !== b.hasSubscriptions) return a.hasSubscriptions ? -1 : 1;

    // Secondary: prefer user_id metadata matches
    if (a.metadataMatch !== b.metadataMatch) return a.metadataMatch ? -1 : 1;

    // Then newest subscription activity, then newest customer record
    if (a.latestSubscriptionCreated !== b.latestSubscriptionCreated) {
      return b.latestSubscriptionCreated - a.latestSubscriptionCreated;
    }
    return b.customerCreated - a.customerCreated;
  });

  return scoredCustomers[0].customerId;
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
      { auth: { persistSession: false } },
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);

    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customerId = await pickBestCustomerId(stripe, user.id, user.email);

    const origin = req.headers.get("origin") || "http://localhost:3000";
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
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
