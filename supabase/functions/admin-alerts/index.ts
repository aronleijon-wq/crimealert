// Mails the owner when someone makes an account or starts Pro (on the web through Stripe, or in
// the app through Apple). Run every 15 minutes by a schedule (migration 20261125110000_admin_alerts).
// Each account and subscription is told about once (admin_alert_log); the very first run only
// notes what is there. The address comes from the ADMIN_ALERT_EMAIL secret, the mail goes through
// Resend (RESEND_API_KEY) from ADMIN_ALERT_FROM, or CrimeAlert <notiser@crimealert.se>.
import { createClient } from "npm:@supabase/supabase-js@2.97.0";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { fetchAppleBilling, type AppStoreKey } from "../_shared/appStore.ts";
import { alertEmail, alertKey, proFromStripe, type NewAccount, type NewPro } from "../_shared/adminAlerts.ts";
import { RESEND_API } from "../_shared/newsletter.ts";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const STATE = "admin-alerts";
// Overlap with the run before, so nothing made during a run is missed (the log keeps it to once)
const OVERLAP_MS = 60 * 60 * 1000;

Deno.serve(async () => {
  const to = Deno.env.get("ADMIN_ALERT_EMAIL");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!to || !resendKey) return json({ sent: false, reason: "ADMIN_ALERT_EMAIL eller RESEND_API_KEY saknas" });
  const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });
  const now = Date.now();

  const { data: state } = await db.from("ingest_state").select("last_run_at").eq("key", STATE).maybeSingle();
  const firstRun = !state;
  const since = new Date((state ? Date.parse(state.last_run_at) : now) - OVERLAP_MS).toISOString();

  const emailOf = async (userId: string) => (await db.auth.admin.getUserById(userId)).data.user?.email ?? "(okänd e-post)";

  // New accounts
  const candidates: { key: string; account?: NewAccount; pro?: NewPro }[] = [];
  const { data: profiles } = await db.from("profiles").select("id, created_at").gt("created_at", since).order("created_at").limit(200);
  for (const p of profiles ?? []) candidates.push({ key: alertKey("account", p.id), account: { email: "", at: p.created_at } });

  // New subscriptions on the web
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (stripeKey) {
    try {
      const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
      const created = Math.floor(Date.parse(since) / 1000);
      for await (const sub of stripe.subscriptions.list({ status: "all", created: { gte: created }, limit: 100, expand: ["data.customer"] })) {
        const pro = proFromStripe(sub as unknown as Parameters<typeof proFromStripe>[0]);
        if (pro) candidates.push({ key: alertKey("stripe", sub.id), pro });
      }
    } catch (e) {
      console.warn("[admin-alerts] Stripe", e instanceof Error ? e.message : e);
    }
  }

  // Subscriptions in the app: every one Apple gives Pro now; the log keeps each to once
  const { data: apple } = await db.from("apple_subscriptions").select("original_transaction_id, user_id, product_id, expires_at, updated_at")
    .eq("environment", "production").gt("expires_at", new Date(now).toISOString());
  for (const a of apple ?? []) {
    // email holds the user id until the address is looked up below
    candidates.push({ key: alertKey("apple", a.original_transaction_id), pro: { email: a.user_id, at: a.updated_at, via: "Apple", kind: "Betalar", plan: /year/i.test(a.product_id) ? "År" : /month/i.test(a.product_id) ? "Månad" : null } });
  }

  // Only what has not been told before
  const keys = candidates.map((c) => c.key);
  const told = new Set<string>();
  for (let i = 0; i < keys.length; i += 200) {
    const { data } = await db.from("admin_alert_log").select("key").in("key", keys.slice(i, i + 200));
    for (const r of data ?? []) told.add(r.key);
  }
  const fresh = candidates.filter((c) => !told.has(c.key));

  if (!firstRun && fresh.length) {
    const accounts: NewAccount[] = [];
    const pros: NewPro[] = [];
    const appleKey: AppStoreKey | null = Deno.env.get("APPSTORE_ISSUER_ID") && Deno.env.get("APPSTORE_KEY_ID") && Deno.env.get("APPSTORE_PRIVATE_KEY")
      ? { issuerId: Deno.env.get("APPSTORE_ISSUER_ID")!, keyId: Deno.env.get("APPSTORE_KEY_ID")!, privateKey: Deno.env.get("APPSTORE_PRIVATE_KEY")! }
      : null;
    for (const c of fresh) {
      if (c.account) accounts.push({ ...c.account, email: await emailOf(c.key.slice("account:".length)) });
      if (c.pro?.via === "Apple") {
        const id = c.key.slice("apple:".length);
        const billing = appleKey ? await fetchAppleBilling(id, "production", appleKey, now).catch(() => null) : null;
        pros.push({ ...c.pro, email: await emailOf(c.pro.email), kind: billing?.freeTrial ? "Provperiod" : "Betalar", at: billing?.startedAt ?? c.pro.at });
      } else if (c.pro) pros.push(c.pro);
    }
    const mail = alertEmail(accounts, pros)!;
    const res = await fetch(`${RESEND_API}/emails`, {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: Deno.env.get("ADMIN_ALERT_FROM") || "CrimeAlert <notiser@crimealert.se>", to: [to], subject: mail.subject, html: mail.html, text: mail.text }),
    });
    if (!res.ok) {
      console.error("[admin-alerts] Resend", res.status, (await res.text()).slice(0, 300));
      return json({ sent: false, reason: "resend_failed" }, 502);
    }
  }

  if (fresh.length) await db.from("admin_alert_log").upsert(fresh.map((c) => ({ key: c.key })), { onConflict: "key", ignoreDuplicates: true });
  await db.from("ingest_state").upsert({ key: STATE, last_run_at: new Date(now).toISOString() }, { onConflict: "key" });
  return json({ sent: !firstRun && fresh.length > 0, new: fresh.length, firstRun });
});
