// Everything the admin dashboard shows, in one answer: revenue from Stripe and Apple (MRR), users,
// app and web devices, engagement, visits, the AI chat's cost and who invites friends. Only for
// admins. Personal details only in the invite list (e-mail of those who invited and were invited)
// and in Pro-medlemmar (everyone with Pro now: how, since when, days left; _shared/members.ts).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.97.0";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { fetchAppleBilling, type AppStoreKey } from "../_shared/appStore.ts";
import { fromApple, fromStripe, lifeFromStripe, payingByMonth, summarize, type RevenueSub, type SubLife } from "../_shared/revenue.ts";
import { summarizeAi } from "../_shared/aiCost.ts";
import { freeMember, memberFromApple, memberFromInvite, memberFromStripe, mergeMembers, summarizeMembers, type AppleMemberInput, type ProMember, type StripeMemberLike } from "../_shared/members.ts";
import { FREE_PREMIUM_EMAILS } from "../_shared/premium.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const DAY = 86_400_000;
const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
    auth: { persistSession: false },
  });
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const { data: userData } = await admin.auth.getUser(token);
  const caller = userData?.user;
  if (!caller) return json({ error: "Inte inloggad" }, 401);
  const { data: role } = await admin.from("user_roles").select("role").eq("user_id", caller.id).eq("role", "admin").maybeSingle();
  if (!role) return json({ error: "Bara för admin" }, 403);

  const now = Date.now();
  const since = (days: number) => new Date(now - days * DAY).toISOString();
  const notes: string[] = [];

  // ---- Revenue: Stripe ----
  const subs: RevenueSub[] = [];
  // Every subscription's life, for the paying customers month by month
  const lives: SubLife[] = [];
  let cancelledLast30 = 0;
  // The subscriptions that give Pro now, for Pro-medlemmar once the accounts are read
  const stripeNow: StripeMemberLike[] = [];
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (stripeKey) {
    try {
      const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
      // Every subscription, of every status: the current ones give revenue, all give the history
      for await (const sub of stripe.subscriptions.list({ status: "all", limit: 100, expand: ["data.discounts", "data.customer"] })) {
        const like = sub as unknown as Parameters<typeof lifeFromStripe>[0];
        const r = fromStripe(like);
        if (r) subs.push(r);
        const life = lifeFromStripe(like);
        if (life) lives.push(life);
        if (["trialing", "active", "past_due"].includes(sub.status)) stripeNow.push(sub as unknown as StripeMemberLike);
        if (sub.status === "canceled" && sub.ended_at && sub.ended_at * 1000 > now - 30 * DAY) cancelledLast30 += 1;
      }
    } catch (e) {
      console.error("admin-dashboard stripe:", e instanceof Error ? e.message : e);
      notes.push("Kunde inte läsa Stripe just nu.");
    }
  } else notes.push("Stripe-nyckeln saknas.");

  // ---- Revenue: Apple ----
  const { data: appleRows } = await admin
    .from("apple_subscriptions").select("original_transaction_id, environment, product_id, user_id, expires_at").gt("expires_at", new Date(now).toISOString());
  const appleTest = (appleRows ?? []).filter((r) => r.environment !== "production").length;
  // Apple subscribers for Pro-medlemmar: what Apple says, once the accounts are read
  const appleNow: (Omit<AppleMemberInput, "email" | "joined"> & { userId: string })[] = [];
  const issuerId = Deno.env.get("APPSTORE_ISSUER_ID");
  const keyId = Deno.env.get("APPSTORE_KEY_ID");
  const privateKey = Deno.env.get("APPSTORE_PRIVATE_KEY");
  if (issuerId && keyId && privateKey) {
    const key: AppStoreKey = { issuerId, keyId, privateKey };
    const production = (appleRows ?? []).filter((r) => r.environment === "production");
    const results = await Promise.allSettled(production.map((r) => fetchAppleBilling(r.original_transaction_id, "production", key, now)));
    let failed = 0;
    results.forEach((r, i) => {
      if (r.status !== "fulfilled" || !r.value) return;
      const row = production[i];
      appleNow.push({
        userId: row.user_id, productId: r.value.productId || row.product_id, expiresAt: r.value.expiresAt ?? row.expires_at,
        startedAt: r.value.startedAt, freeTrial: r.value.freeTrial, autoRenew: r.value.autoRenew,
      });
    });
    for (const r of results) {
      if (r.status === "rejected") { failed += 1; continue; }
      const sub = r.value && fromApple(r.value);
      if (sub) subs.push(sub);
      // Apple keeps only today's subscriptions here: those that ended are not in the history
      if (sub && r.value?.startedAt) {
        lives.push({
          source: "apple", plan: sub.plan, start: Date.parse(r.value.startedAt), end: null,
          trialEnd: r.value.freeTrial && r.value.expiresAt ? Date.parse(r.value.expiresAt) : null,
        });
      }
    }
    if (failed) notes.push(`${failed} Apple-prenumerationer kunde inte läsas just nu.`);
  } else if (appleRows?.length) notes.push("Apples nycklar saknas, så köp i appen räknas inte.");

  const revenue = summarize(subs, now);

  // ---- Users ----
  const created: number[] = [];
  const emails = new Map<string, string>();
  const joinedById = new Map<string, string>();
  const joinedByEmail = new Map<string, string>();
  let activeLast30 = 0;
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const u of data.users) {
      created.push(Date.parse(u.created_at));
      emails.set(u.id, u.email ?? "(utan e-post)");
      joinedById.set(u.id, u.created_at);
      if (u.email) joinedByEmail.set(u.email.toLowerCase(), u.created_at);
      if (u.last_sign_in_at && Date.parse(u.last_sign_in_at) > now - 30 * DAY) activeLast30 += 1;
    }
    if (data.users.length < 1000) break;
  }
  const signupsByDay: { day: string; count: number; total: number }[] = [];
  for (let i = 59; i >= 0; i--) {
    const start = now - (i + 1) * DAY, end = now - i * DAY;
    signupsByDay.push({ day: dayKey(end), count: created.filter((t) => t > start && t <= end).length, total: created.filter((t) => t <= end).length });
  }

  // ---- Counts ----
  const count = async (query: PromiseLike<{ count: number | null; error: unknown }>) => {
    const { count: n, error } = await query;
    return error ? null : n ?? 0;
  };
  const rows = (table: string) => admin.from(table).select("*", { count: "exact", head: true });
  const [appDevices, webDevices, ask7, ask30, push7, places, reports30, freePro, invited, events24h, eventsTotal] = await Promise.all([
    count(rows("push_subscriptions").like("endpoint", "apns:production:%")),
    count(rows("push_subscriptions").not("endpoint", "like", "apns:%")),
    count(rows("ask_log").gte("created_at", since(7))),
    count(rows("ask_log").gte("created_at", since(30))),
    count(rows("sent_push_log").gte("sent_at", since(7))),
    count(rows("watch_places")),
    count(rows("community_reports").gte("created_at", since(30))),
    count(rows("pro_status").eq("pro_until", "infinity")),
    count(rows("invites").eq("rewarded", true)),
    count(rows("police_events_archive").gte("time", since(1))),
    count(rows("police_events_archive")),
  ]);

  // ---- Visits (page_stats, per day and device) ----
  const { data: views } = await admin.from("page_stats").select("day, device, views").gte("day", dayKey(now - 30 * DAY)).limit(20000);
  const viewsByDay = new Map<string, { mobile: number; desktop: number }>();
  for (const v of views ?? []) {
    const d = viewsByDay.get(v.day) ?? { mobile: 0, desktop: 0 };
    if (v.device === "mobile") d.mobile += v.views; else d.desktop += v.views;
    viewsByDay.set(v.day, d);
  }

  // ---- The AI chat's cost (ai_usage) ----
  const aiRows: Parameters<typeof summarizeAi>[0] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from("ai_usage")
      .select("model, created_at, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens")
      .order("created_at", { ascending: true }).range(from, from + 999);
    if (error) { notes.push("AI-kostnaden kunde inte läsas (finns tabellen ai_usage?)."); break; }
    aiRows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const ai = summarizeAi(aiRows, now);

  // ---- Invites: who invited, how many friends it gave, and their Pro from it ----
  const [{ data: codes }, { data: invites }] = await Promise.all([
    admin.from("invite_codes").select("user_id, code, rewarded, pro_until, created_at"),
    admin.from("invites").select("invitee_id, inviter_id, rewarded, created_at").order("created_at", { ascending: false }),
  ]);
  const invitedBy = new Map<string, { invited: number; last: string | null }>();
  for (const i of invites ?? []) {
    const e = invitedBy.get(i.inviter_id) ?? { invited: 0, last: null };
    e.invited += 1;
    e.last = e.last && e.last > i.created_at ? e.last : i.created_at;
    invitedBy.set(i.inviter_id, e);
  }
  const nowIso = new Date(now).toISOString();
  const inviters = (codes ?? [])
    .filter((c) => invitedBy.has(c.user_id) || c.rewarded > 0)
    .map((c) => ({
      email: emails.get(c.user_id) ?? "(raderat konto)",
      code: c.code,
      invited: invitedBy.get(c.user_id)?.invited ?? 0,
      rewarded: c.rewarded,
      pro_until: c.pro_until,
      pro_active: Boolean(c.pro_until && c.pro_until > nowIso),
      last_invite: invitedBy.get(c.user_id)?.last ?? null,
    }))
    .sort((a, b) => b.invited - a.invited || b.rewarded - a.rewarded)
    .slice(0, 100);
  const inviteSummary = {
    links: codes?.length ?? 0,
    inviters: invitedBy.size,
    invited: invites?.length ?? 0,
    rewarded: (invites ?? []).filter((i) => i.rewarded).length,
    proActive: (codes ?? []).filter((c) => c.pro_until && c.pro_until > nowIso).length,
    list: inviters,
    recent: (invites ?? []).slice(0, 20).map((i) => ({
      at: i.created_at,
      inviter: emails.get(i.inviter_id) ?? "(raderat konto)",
      invitee: emails.get(i.invitee_id) ?? "(raderat konto)",
      rewarded: i.rewarded,
    })),
  };

  // ---- The command centre: the last day, who uses it, the way from a visit to paying ----
  const [visits24, signups24, reports24, push24, ask24, reports7] = await Promise.all([
    admin.from("page_stats").select("views").eq("day", dayKey(now)).then(({ data }) => (data ?? []).reduce((a, r) => a + (r.views ?? 0), 0)),
    Promise.resolve(created.filter((t) => t > now - DAY).length),
    count(rows("community_reports").gte("created_at", since(1))),
    count(rows("sent_push_log").gte("sent_at", since(1))),
    count(rows("ask_log").gte("created_at", since(1))),
    count(rows("community_reports").gte("created_at", since(7))),
  ]);
  const { data: activity, error: activityError } = await admin.rpc("admin_activity");
  if (activityError) notes.push("Aktiva användare kunde inte räknas (är migrationen admin_activity körd?).");
  const { data: sourceRows } = await admin.from("traffic_sources").select("source, visits").gte("day", dayKey(now - 30 * DAY)).limit(20000);
  const bySource = new Map<string, number>();
  for (const r of sourceRows ?? []) bySource.set(r.source, (bySource.get(r.source) ?? 0) + (r.visits ?? 0));
  const visits30 = [...viewsByDay.values()].reduce((a, v) => a + v.mobile + v.desktop, 0);
  const weekBefore = created.filter((t) => t > now - 14 * DAY && t <= now - 7 * DAY).length;

  // ---- Pro-medlemmar: everyone with Pro now ----
  const memberRows: ProMember[] = stripeNow.flatMap((sub) => memberFromStripe(sub, joinedByEmail, now) ?? []);
  for (const a of appleNow) {
    memberRows.push(memberFromApple({ ...a, email: emails.get(a.userId) ?? "(raderat konto)", joined: joinedById.get(a.userId) ?? null }, now));
  }
  for (const c of codes ?? []) {
    if (c.pro_until && Date.parse(c.pro_until) > now) {
      memberRows.push(memberFromInvite(emails.get(c.user_id) ?? "(raderat konto)", joinedById.get(c.user_id) ?? null, c.pro_until, null, now));
    }
  }
  const { data: freeRows } = await admin.from("pro_status").select("user_id").eq("pro_until", "infinity");
  for (const f of freeRows ?? []) memberRows.push(freeMember(emails.get(f.user_id) ?? "(raderat konto)", joinedById.get(f.user_id) ?? null));
  for (const email of FREE_PREMIUM_EMAILS) memberRows.push(freeMember(email, joinedByEmail.get(email) ?? null));
  // Free Pro only for accounts that exist
  const members = mergeMembers(memberRows).filter((m) => m.source !== "free" || joinedByEmail.has(m.email.toLowerCase()));

  return json({
    generated_at: new Date(now).toISOString(),
    notes,
    revenue: { ...revenue, cancelledLast30, appleTest, history: payingByMonth(lives, now, 12) },
    users: {
      total: created.length,
      new7: created.filter((t) => t > now - 7 * DAY).length,
      new30: created.filter((t) => t > now - 30 * DAY).length,
      active30: activeLast30,
      byDay: signupsByDay,
    },
    devices: { app: appDevices, web: webDevices },
    engagement: { ask7, ask30, push7, places, reports30, freePro, invited },
    data: { events24h, eventsTotal },
    ai,
    invites: inviteSummary,
    members: { summary: summarizeMembers(members), list: members },
    visits: [...viewsByDay].sort(([a], [b]) => a.localeCompare(b)).map(([day, v]) => ({ day, ...v })),
    pulse: {
      last24: { visits: visits24, signups: signups24, reports: reports24, push: push24, ask: ask24, events: events24h },
      reports7,
      activity: activityError ? null : activity,
      growth: { thisWeek: created.filter((t) => t > now - 7 * DAY).length, weekBefore },
      funnel30: {
        visits: visits30,
        signups: created.filter((t) => t > now - 30 * DAY).length,
        proStarts: members.filter((m) => (m.kind === "trial" || m.kind === "paying") && m.proSince && Date.parse(m.proSince) > now - 30 * DAY).length,
        paying: members.filter((m) => m.kind === "paying").length,
      },
      sources: [...bySource].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([source, visits]) => ({ source, visits })),
    },
  });
});
