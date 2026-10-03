import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient, type AuthError, type User } from "npm:@supabase/supabase-js@2.97.0";
import { hadPro, proUntilFor, rememberProStatus } from "../_shared/premium.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// current_period_end is not on the typed Subscription for this API version
// (it lives on subscription items), so read it defensively.
type SubscriptionWithLegacyPeriodEnd = Stripe.Subscription & { current_period_end?: number | null };

const logStep = (step: string, details?: unknown) => {
  console.log(`[CHECK-SUBSCRIPTION] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    logStep("Function started");

    // Free premium whitelist
    const FREE_PREMIUM_EMAILS = ["aronleijon@icloud.com", "oscaralvenius@outlook.com", "carlmrski@gmail.com", "stefanlasse67@gmail.com", "kristensson91@hotmail.com", "mykhailo@inphiz.com", "kcleijon@gmail.com"];

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      logStep("No auth header, returning unsubscribed");
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const token = authHeader.replace("Bearer ", "");
    
    // Retry getUser up to 2 times on transient failures
    let userData: { user: User | null } | null = null;
    let userError: AuthError | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await supabaseClient.auth.getUser(token);
      userData = result.data;
      userError = result.error;
      if (!userError) break;
      logStep(`Auth attempt ${attempt + 1} failed`, { 
        message: userError?.message || JSON.stringify(userError),
        status: userError?.status 
      });
      if (attempt < 1) await new Promise(r => setTimeout(r, 1000));
    }
    
    const user = userData?.user;
    if (userError || !user?.email) {
      logStep("Auth failed, returning unsubscribed gracefully", {
        message: userError?.message || "No user/email",
      });
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    logStep("User authenticated", { email: user.email });

    // Check whitelist first
    if (FREE_PREMIUM_EMAILS.includes(user.email.toLowerCase())) {
      logStep("User is on free premium whitelist");
      await rememberProStatus(supabaseClient, user.id, "infinity");
      return new Response(
        JSON.stringify({
          subscribed: true,
          product_id: "prod_U0dsMg8IZZKY7c",
          subscription_end: "lifetime",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    logStep("Searching for Stripe customer", { email: user.email });
    const customers = await stripe.customers.list({ email: user.email, limit: 10 });
    logStep("Stripe customers found", { count: customers.data.length });

    if (customers.data.length === 0) {
      logStep("No customer found");
      await rememberProStatus(supabaseClient, user.id, null);
      return new Response(JSON.stringify({ subscribed: false, trial_eligible: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Keep premium access until paid period truly ends, even if subscription is canceled
    const eligibleStatuses: Stripe.Subscription.Status[] = ['active', 'trialing', 'past_due', 'canceled'];
    const priorityOrder: Stripe.Subscription.Status[] = ['active', 'trialing', 'past_due', 'canceled'];
    const nowSec = Math.floor(Date.now() / 1000);

    const getSubPeriodEndSec = (sub: Stripe.Subscription): number | null => {
      const rawPeriodEnd = (sub as SubscriptionWithLegacyPeriodEnd).current_period_end ?? sub.cancel_at ?? sub.trial_end;
      const periodEndSec = Number(rawPeriodEnd);
      return Number.isFinite(periodEndSec) && periodEndSec > 0 ? periodEndSec : null;
    };

    const isSubscriptionValidNow = (sub: Stripe.Subscription): boolean => {
      const periodEndSec = getSubPeriodEndSec(sub);
      if (periodEndSec !== null) return periodEndSec > nowSec;

      // Fallback: some Stripe list responses may omit period end fields; trust active-like statuses.
      return sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due';
    };

    let validSub: Stripe.Subscription | null = null;
    // A free trial is for accounts that never had Pro
    let usedTrial = false;

    for (const customer of customers.data) {
      logStep("Checking customer", { customerId: customer.id });
      const subscriptions = await stripe.subscriptions.list({
        customer: customer.id,
        status: 'all',
        limit: 20,
      });
      logStep("Subscriptions for customer", { customerId: customer.id, count: subscriptions.data.length, statuses: subscriptions.data.map((s: Stripe.Subscription) => s.status) });
      if (hadPro(subscriptions.data)) usedTrial = true;

      const customerBest = subscriptions.data
        .filter((s: Stripe.Subscription) => eligibleStatuses.includes(s.status))
        .filter((s: Stripe.Subscription) => {
          const periodEndSec = getSubPeriodEndSec(s);
          const valid = isSubscriptionValidNow(s);
          if (!valid) {
            logStep("Subscription filtered out", {
              id: s.id,
              status: s.status,
              periodEnd: periodEndSec,
              nowSec,
            });
          }
          return valid;
        })
        .sort((a: Stripe.Subscription, b: Stripe.Subscription) => {
          const byStatus = priorityOrder.indexOf(a.status) - priorityOrder.indexOf(b.status);
          if (byStatus !== 0) return byStatus;
          const aEnd = getSubPeriodEndSec(a) ?? 0;
          const bEnd = getSubPeriodEndSec(b) ?? 0;
          return bEnd - aEnd;
        })[0];

      if (!customerBest) { logStep("No valid sub for this customer"); continue; }

      if (!validSub || priorityOrder.indexOf(customerBest.status) < priorityOrder.indexOf(validSub.status)) {
        validSub = customerBest;
      }
    }

    const hasActiveSub = !!validSub;
    let productId: string | null = null;
    let subscriptionEnd: string | null = null;

    if (hasActiveSub && validSub) {
      const periodEndSec = getSubPeriodEndSec(validSub);
      if (periodEndSec !== null) {
        const parsedEnd = new Date(periodEndSec * 1000);
        if (!Number.isNaN(parsedEnd.getTime())) {
          subscriptionEnd = parsedEnd.toISOString();
        } else {
          logStep("Invalid derived subscription end date", { value: periodEndSec });
        }
      } else {
        logStep("No period_end/cancel_at/trial_end available on valid subscription", { id: validSub.id, status: validSub.status });
      }

      const priceProduct = validSub.items?.data?.[0]?.price?.product;
      productId = typeof priceProduct === 'string' ? priceProduct : (priceProduct?.id ?? null);

      logStep("Active subscription window found", { status: validSub.status, productId, subscriptionEnd });
    }

    // What the archive's access rule and the push sender go by
    await rememberProStatus(supabaseClient, user.id, proUntilFor(validSub, Date.now()));

    return new Response(
      JSON.stringify({
        subscribed: hasActiveSub,
        product_id: productId,
        subscription_end: subscriptionEnd,
        trialing: validSub?.status === "trialing",
        trial_eligible: !usedTrial,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    const isAuthError =
      msg.includes("Authentication") || msg.includes("authorization") || msg.includes("not authenticated");
    return new Response(JSON.stringify({ error: msg, subscribed: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: isAuthError ? 401 : 500,
    });
  }
});
