// Deletes the signed-in user's account, as Apple requires of apps where accounts can be made
// (and as anyone may ask under GDPR). Payments stop first, so a deleted account is never
// charged again; then the user's own rows and report images go, and finally the account,
// which takes every table with a foreign key to auth.users along with it.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.97.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Tables with a user_id but no foreign key to auth.users
const LOOSE_TABLES = ["push_subscriptions", "sent_push_log", "reviews"];
const LIVE_SUBSCRIPTION = new Set(["active", "trialing", "past_due", "unpaid", "incomplete"]);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
      auth: { persistSession: false },
    });
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user) return json({ error: "Inte inloggad" }, 401);

    // Stop payments. If that fails, keep the account so nobody pays for one that is gone.
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (stripeKey && user.email) {
      const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
      const customers = await stripe.customers.list({ email: user.email, limit: 10 });
      for (const customer of customers.data) {
        const subscriptions = await stripe.subscriptions.list({ customer: customer.id, status: "all", limit: 100 });
        for (const s of subscriptions.data) {
          if (LIVE_SUBSCRIPTION.has(s.status)) await stripe.subscriptions.cancel(s.id);
        }
      }
    }

    for (const table of LOOSE_TABLES) {
      const { error } = await admin.from(table).delete().eq("user_id", user.id);
      if (error) console.error("delete-account:", table, error.message);
    }

    // Images the user attached to citizen reports (community-reports/<user id>/...)
    const { data: files } = await admin.storage.from("community-reports").list(user.id, { limit: 1000 });
    if (files?.length) {
      const { error } = await admin.storage.from("community-reports").remove(files.map((f) => `${user.id}/${f.name}`));
      if (error) console.error("delete-account: images", error.message);
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;

    console.log("delete-account: deleted", user.id);
    return json({ deleted: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("delete-account failed:", msg);
    return json({ error: "Kontot kunde inte raderas just nu. Försök igen eller mejla crimealert.swe@gmail.com." }, 500);
  }
});
