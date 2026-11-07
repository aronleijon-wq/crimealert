// Puts every existing account with a confirmed e-mail on the newsletter list in Resend, for the
// admin page's button (_shared/newsletter.ts). Resend takes a couple of requests a second, so a
// run adds what fits in about a minute and says how many are left; the button runs it again.
import { createClient } from "npm:@supabase/supabase-js@2.97.0";
import { addContact, listable, newsletterEnv } from "../_shared/newsletter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const RUN_MS = 60_000;
const GAP_MS = 550;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const { data: { user: caller } } = await admin.auth.getUser(token);
  if (!caller) return json({ error: "Inte inloggad" }, 401);
  const { data: role } = await admin.from("user_roles").select("role").eq("user_id", caller.id).eq("role", "admin").maybeSingle();
  if (!role) return json({ error: "Bara för admin" }, 403);

  const env = newsletterEnv();
  if (!env.apiKey) return json({ error: "RESEND_API_KEY saknas. Lägg in den bland secrets i Lovable." }, 503);

  const { data: done, error: doneError } = await admin.from("newsletter_contacts").select("user_id");
  if (doneError) return json({ error: "Tabellen newsletter_contacts saknas. Kör migreringen först." }, 503);
  const known = new Set((done ?? []).map((r: { user_id: string }) => r.user_id));

  const waiting: { id: string; email: string }[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return json({ error: error.message }, 500);
    for (const u of data.users) if (!known.has(u.id) && listable(u)) waiting.push({ id: u.id, email: u.email! });
    if (data.users.length < 1000) break;
  }

  const started = Date.now();
  const counts = { added: 0, exists: 0, failed: 0 };
  let handled = 0;
  for (const u of waiting) {
    if (Date.now() - started > RUN_MS) break;
    const result = await addContact(env, u.email);
    counts[result]++;
    handled++;
    if (result !== "failed") {
      await admin.from("newsletter_contacts").upsert({ user_id: u.id, email: u.email.toLowerCase(), synced_at: new Date().toISOString() }, { onConflict: "user_id" });
    }
    await new Promise((r) => setTimeout(r, GAP_MS));
  }

  return json({ ...counts, remaining: waiting.length - handled, total: known.size + counts.added + counts.exists });
});
