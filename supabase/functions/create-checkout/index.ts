import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient, type AuthError, type User } from "npm:@supabase/supabase-js@2.97.0";
import { PLANS, pickPrice, planFromRequest } from "../_shared/stripePlans.ts";
import { TRIAL_DAYS, trialEligible } from "../_shared/premium.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: unknown) => {
  console.log(`[CREATE-CHECKOUT] ${step}${details ? ` - ${JSON.stringify(details)}` : ''}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const isTransientAuthError = (err: unknown) => {
      const e = (err ?? {}) as { message?: string; msg?: string; status?: number };
      const message = String(e.message || e.msg || "").toLowerCase();
      const status = e.status;
      return (
        status === 503 ||
        status === 504 ||
        message.includes("timeout") ||
        message.includes("upstream connect error") ||
        message.includes("failed to fetch") ||
        message.includes("unexpected token '<'")
      );
    };

    const token = authHeader.replace("Bearer ", "");

    let user: User | null = null;
    let userError: AuthError | null = null;

    for (let attempt = 0; attempt < 4; attempt++) {
      const result = await supabaseClient.auth.getUser(token);
      user = result.data?.user;
      userError = result.error;
      if (!userError) break;

      logStep(`Auth attempt ${attempt + 1} failed`, {
        message: userError?.message || JSON.stringify(userError),
        status: userError?.status,
      });

      if (!isTransientAuthError(userError) || attempt === 3) break;
      await sleep(700 * (attempt + 1));
    }

    if (userError || !user?.email) {
      if (isTransientAuthError(userError)) {
        throw new Error("TRANSIENT_AUTH_ERROR");
      }
      throw new Error("User not authenticated");
    }

    const email = user.email;
    logStep("User authenticated", { email });

    // The app names the plan; the price comes from Stripe, so only our own plans can be bought
    const plan = planFromRequest(await req.json().catch(() => null));
    if (!plan) throw new Error("Unknown plan");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });

    const { data: prices } = await stripe.prices.list({ product: PLANS[plan].product, active: true, type: "recurring", limit: 100 });
    const price = pickPrice(prices, plan);
    if (!price) throw new Error(`No active ${plan} price in Stripe`);
    logStep("Price chosen", { plan, priceId: price.id, amount: price.unit_amount, currency: price.currency });

    const customers = await stripe.customers.list({ email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    // First-time subscribers start with a free trial; the card is taken now and charged after it
    const trial = await trialEligible(stripe, email);
    logStep("Trial", { eligible: trial });

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : email,
      line_items: [{ price: price.id, quantity: 1 }],
      mode: "subscription",
      ...(trial ? { subscription_data: { trial_period_days: TRIAL_DAYS } } : {}),
      success_url: `${req.headers.get("origin")}/account?success=true`,
      cancel_url: `${req.headers.get("origin")}/account?canceled=true`,
    });

    logStep("Checkout session created", { sessionId: session.id });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });

    const isTransient = msg.includes("TRANSIENT_AUTH_ERROR");
    return new Response(JSON.stringify({ error: isTransient ? "Temporary authentication backend timeout" : msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: isTransient ? 503 : 500,
    });
  }
});
