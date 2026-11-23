import { createClient } from "npm:@supabase/supabase-js@2.97.0";
import { eventIdOf, isReportCategory, REPORT_CATEGORY_LABELS, REPORTS_PER_DAY } from "../_shared/reportCategories.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const stripHtml = (value: unknown) =>
  String(value ?? "").replace(/<[^>]*>/g, "").trim();

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

    // Everyone signed in may report (no longer only Pro), up to REPORTS_PER_DAY a day
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: sentToday } = await supabase
      .from("community_reports").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", since);
    if ((sentToday ?? 0) >= REPORTS_PER_DAY) {
      return json({ error: `Du har skickat ${REPORTS_PER_DAY} rapporter det senaste dygnet. Försök igen senare.` }, 429);
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return json({ error: "Ogiltig förfrågan." }, 400);
    }

    const category = String(body.category ?? "");
    const typedTitle = stripHtml(body.title).slice(0, 200);
    const description = stripHtml(body.description).slice(0, 1000);
    const area = stripHtml(body.area).slice(0, 200) || null;

    if (!isReportCategory(category)) return json({ error: "Ogiltig kategori." }, 400);
    // The police event it is about, when sent from an event ("Är du på plats?")
    const event_id = eventIdOf(body.event_id);
    // A report from the spot can be just what it is and where: the category names it, and a few
    // words are welcome but not needed
    const title = typedTitle || REPORT_CATEGORY_LABELS[category];

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
        event_id,
      })
      .select("id")
      .single();

    // The database refuses slurs and writers shut out by an admin (migration 20261020200000_moderation)
    if (error?.message?.includes("blocked_words")) {
      return json({ error: "Texten innehåller ord som inte är tillåtna på CrimeAlert." }, 400);
    }
    if (error?.message?.includes("posting_banned")) {
      return json({ error: "Ditt konto kan inte längre skriva på CrimeAlert, efter en anmälan som vi har granskat." }, 403);
    }
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
