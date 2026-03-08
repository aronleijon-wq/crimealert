import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
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
    const FREE_PREMIUM_EMAILS = ["aronleijon@icloud.com", "oscaralvenius@outlook.com", "carlmrski@gmail.com", "stefanlasse67@gmail.com", "kristensson91@hotmail.com"];

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
    let userData: any = null;
    let userError: any = null;
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
    
    if (userError || !userData?.user?.email) {
      logStep("Auth failed, returning unsubscribed gracefully", {
        message: userError?.message || "No user/email",
      });
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    const user = userData.user;
    logStep("User authenticated", { email: user.email });

    // Check whitelist first
    if (FREE_PREMIUM_EMAILS.includes(user.email.toLowerCase())) {
      logStep("User is on free premium whitelist");
      return new Response(
        JSON.stringify({
          subscribed: true,
          product_id: "prod_U0dsMg8IZZKY7c",
          subscription_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 10 });

    if (customers.data.length === 0) {
      logStep("No customer found");
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Keep premium access until paid period truly ends, even if subscription is canceled
    const eligibleStatuses: Stripe.Subscription.Status[] = ['active', 'trialing', 'past_due', 'canceled'];
    const priorityOrder: Stripe.Subscription.Status[] = ['active', 'trialing', 'past_due', 'canceled'];
    const nowSec = Math.floor(Date.now() / 1000);
    let validSub: Stripe.Subscription | null = null;

    for (const customer of customers.data) {
      const subscriptions = await stripe.subscriptions.list({
        customer: customer.id,
        status: 'all',
        limit: 50,
      });

      const customerBest = subscriptions.data
        .filter((s) => eligibleStatuses.includes(s.status))
        .filter((s) => {
          const periodEndSec = Number(s.current_period_end);
          return Number.isFinite(periodEndSec) && periodEndSec > nowSec;
        })
        .sort((a, b) => {
          const byStatus = priorityOrder.indexOf(a.status) - priorityOrder.indexOf(b.status);
          if (byStatus !== 0) return byStatus;
          return Number(b.current_period_end) - Number(a.current_period_end);
        })[0];

      if (!customerBest) continue;

      if (!validSub || priorityOrder.indexOf(customerBest.status) < priorityOrder.indexOf(validSub.status)) {
        validSub = customerBest;
      }
    }

    const hasActiveSub = !!validSub;
    let productId: string | null = null;
    let subscriptionEnd: string | null = null;

    if (hasActiveSub && validSub) {
      const periodEndSec = Number(validSub.current_period_end);
      if (Number.isFinite(periodEndSec) && periodEndSec > 0) {
        const parsedEnd = new Date(periodEndSec * 1000);
        if (!Number.isNaN(parsedEnd.getTime())) {
          subscriptionEnd = parsedEnd.toISOString();
        } else {
          logStep("Invalid current_period_end date", { value: validSub.current_period_end });
        }
      } else {
        logStep("Missing or invalid current_period_end", { value: validSub.current_period_end });
      }

      const priceProduct = validSub.items?.data?.[0]?.price?.product;
      productId = typeof priceProduct === 'string' ? priceProduct : (priceProduct?.id ?? null);

      logStep("Active subscription window found", { status: validSub.status, productId, subscriptionEnd });
    }

    return new Response(
      JSON.stringify({
        subscribed: hasActiveSub,
        product_id: productId,
        subscription_end: subscriptionEnd,
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
