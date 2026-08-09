import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FREE_PREMIUM_EMAILS = [
  "aronleijon@icloud.com",
  "oscaralvenius@outlook.com",
  "carlmrski@gmail.com",
  "stefanlasse67@gmail.com",
  "kristensson91@hotmail.com",
  "mykhailo@inphiz.com",
];

const CATEGORIES = [
  "broken_lighting",
  "vandalism",
  "unsafe_area",
  "suspicious_activity",
  "other",
];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const stripHtml = (value: unknown) =>
  String(value ?? "").replace(/<[^>]*>/g, "").trim();

const isPremiumUser = async (email: string): Promise<boolean> => {
  if (FREE_PREMIUM_EMAILS.includes(email.toLowerCase())) return true;

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) return false;

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
  const customers = await stripe.customers.list({ email, limit: 10 });
  const nowSec = Math.floor(Date.now() / 1000);

  for (const customer of customers.data) {
    const subs = await stripe.subscriptions.list({
      customer: customer.id,
      status: "all",
      limit: 20,
    });
    for (const sub of subs.data) {
      if (!["active", "trialing", "past_due", "canceled"].includes(sub.status)) continue;
      const rawEnd = (sub as any).current_period_end ?? (sub as any).cancel_at ?? (sub as any).trial_end;
      const endSec = Number(rawEnd);
      if (Number.isFinite(endSec) && endSec > 0) {
        if (endSec > nowSec) return true;
      } else if (["active", "trialing", "past_due"].includes(sub.status)) {
        return true;
      }
    }
  }
  return false;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Du måste vara inloggad." }, 401);
    }
    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user?.email) {
      return json({ error: "Ogiltig session." }, 401);
    }

    if (!(await isPremiumUser(user.email))) {
      return json({ error: "Community-rapporter kräver Pro." }, 403);
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return json({ error: "Ogiltig förfrågan." }, 400);
    }

    const category = String(body.category ?? "");
    const title = stripHtml(body.title).slice(0, 200);
    const description = stripHtml(body.description).slice(0, 1000);
    const area = stripHtml(body.area).slice(0, 200) || null;

    if (!CATEGORIES.includes(category)) return json({ error: "Ogiltig kategori." }, 400);
    if (!title) return json({ error: "Titel saknas." }, 400);
    if (!description) return json({ error: "Beskrivning saknas." }, 400);

    const lat = body.lat === null || body.lat === undefined ? null : Number(body.lat);
    const lng = body.lng === null || body.lng === undefined ? null : Number(body.lng);
    if (lat !== null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) {
      return json({ error: "Ogiltig latitud." }, 400);
    }
    if (lng !== null && (!Number.isFinite(lng) || lng < -180 || lng > 180)) {
      return json({ error: "Ogiltig longitud." }, 400);
    }

    // Only accept images stored in our own public bucket, owned by this user.
    let image_url: string | null = null;
    if (body.image_url) {
      const expectedPrefix = `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/community-reports/${user.id}/`;
      const candidate = String(body.image_url);
      if (!candidate.startsWith(expectedPrefix)) {
        return json({ error: "Ogiltig bildlänk." }, 400);
      }
      image_url = candidate;
    }

    const { data, error } = await supabase
      .from("community_reports")
      .insert({
        user_id: user.id,
        category,
        title,
        description,
        area,
        lat,
        lng,
        status: "open",
        image_url,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[submit-community-report] insert failed", error.message);
      return json({ error: "Kunde inte spara rapporten." }, 500);
    }

    return json({ id: data.id });
  } catch (error) {
    console.error("[submit-community-report] error", error instanceof Error ? error.message : error);
    return json({ error: "Något gick fel." }, 500);
  }
});
