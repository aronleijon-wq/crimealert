// The e-mails to new accounts (_shared/lifecycleEmails): run every hour by the schedule in the
// migration lifecycle_emails. Each due e-mail is claimed in lifecycle_email_log before it is sent,
// so two runs never send the same one; a failed send gives the claim back for the next run.
// ?optout=<token> (the link in every e-mail, and the one-click List-Unsubscribe) stops them all.
//
// Needs RESEND_API_KEY (as admin-alerts); LIFECYCLE_FROM picks the sender, else
// CrimeAlert <hej@crimealert.se>. Without the key it does nothing.
import { createClient } from 'npm:@supabase/supabase-js@2.97.0';
import { RESEND_API } from '../_shared/newsletter.ts';
import { proUntilActive } from '../_shared/premium.ts';
import { kommunSlug } from '../_shared/kommunSlug.ts';
import { summarizeKommun, type SummaryEvent } from '../_shared/weeklySummary.ts';
import {
  dueEmail, lifecycleEmail, logKind, optOutToken, readOptOutToken, type Candidate, type KommunWeekLite, type LifecycleKind,
} from '../_shared/lifecycleEmails.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SECRET = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db = createClient(SUPABASE_URL, SECRET);
const FN_URL = `${SUPABASE_URL}/functions/v1/lifecycle-emails`;
const DAY = 24 * 60 * 60 * 1000;
/** Resend takes a couple of requests a second; a run sends at most this many */
const MAX_PER_RUN = 150;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const page = (title: string, text: string, status = 200) => new Response(
  `<!doctype html><html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;background:#0B0B0C;color:#fff;font:16px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px;box-sizing:border-box">
<div style="max-width:420px;text-align:center"><h1 style="font-size:24px;margin:0 0 10px">${title}</h1><p style="color:#C9C9D1;margin:0 0 22px">${text}</p>
<a href="https://crimealert.se" style="display:inline-block;background:#E5302A;color:#fff;text-decoration:none;font-weight:700;padding:13px 26px;border-radius:999px">Till CrimeAlert</a></div></body></html>`,
  { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
);

async function readAll<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await fetchPage(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}

const chunks = <T,>(list: T[], size = 200) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size));

async function optOut(token: string | null): Promise<boolean> {
  const userId = await readOptOutToken(token, SECRET);
  if (!userId) return false;
  const { error } = await db.from('email_optouts').upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true });
  if (error) throw new Error(error.message);
  return true;
}

async function run(now: number) {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) return { sent: 0, reason: 'RESEND_API_KEY saknas' };

  const { data: rows, error } = await db.rpc('lifecycle_candidates');
  if (error) return { sent: 0, reason: `lifecycle_candidates: ${error.message}` };
  // Apple's private relay addresses only take mail from senders registered with Apple
  const accounts = ((rows ?? []) as { id: string; email: string; created_at: string; last_used: string | null }[])
    .filter((r) => r.email && !/@privaterelay\.appleid\.com$/i.test(r.email));
  if (!accounts.length) return { sent: 0, reason: 'nothing_due' };
  const ids = accounts.map((a) => a.id);

  const [logs, optouts, pros, prefs] = await Promise.all([
    Promise.all(chunks(ids).map((part) => readAll<{ user_id: string; kind: string; sent_at: string }>((f, t) => db.from('lifecycle_email_log').select('user_id, kind, sent_at').in('user_id', part).range(f, t)))).then((p) => p.flat()),
    Promise.all(chunks(ids).map((part) => readAll<{ user_id: string }>((f, t) => db.from('email_optouts').select('user_id').in('user_id', part).range(f, t)))).then((p) => p.flat()),
    Promise.all(chunks(ids).map((part) => readAll<{ user_id: string; pro_until: string | null }>((f, t) => db.from('pro_status').select('user_id, pro_until').in('user_id', part).range(f, t)))).then((p) => p.flat()),
    Promise.all(chunks(ids).map((part) => readAll<{ user_id: string; kommun: string; created_at: string }>((f, t) => db.from('notification_preferences').select('user_id, kommun, created_at').in('user_id', part).order('created_at').range(f, t)))).then((p) => p.flat()),
  ]);
  const sentOf = new Map<string, { kind: string; at: number }[]>();
  for (const l of logs) sentOf.set(l.user_id, [...(sentOf.get(l.user_id) ?? []), { kind: l.kind, at: Date.parse(l.sent_at) }]);
  const opted = new Set(optouts.map((o) => o.user_id));
  const pro = new Set(pros.filter((p) => proUntilActive(p.pro_until, now)).map((p) => p.user_id));
  const kommunOf = new Map<string, string>();
  for (const p of prefs) if (!kommunOf.has(p.user_id)) kommunOf.set(p.user_id, p.kommun);

  const due: { id: string; email: string; kind: LifecycleKind }[] = [];
  for (const a of accounts) {
    const c: Candidate = {
      createdAt: Date.parse(a.created_at),
      lastUsedAt: a.last_used ? Date.parse(a.last_used) : null,
      pro: pro.has(a.id),
      optedOut: opted.has(a.id),
      sent: sentOf.get(a.id) ?? [],
    };
    const kind = dueEmail(c, now);
    if (kind) due.push({ id: a.id, email: a.email, kind });
  }
  if (!due.length) return { sent: 0, reason: 'nothing_due' };

  // Polisen's last two weeks, for the e-mails that tell what happened in a kommun
  const needsWeek = due.some((d) => (d.kind === 'day3' || d.kind === 'comeback') && kommunOf.has(d.id));
  const events = needsWeek
    ? await readAll<SummaryEvent>((f, t) => db.from('police_events_archive').select('area, original_type, time').gte('time', new Date(now - 14 * DAY).toISOString()).order('time', { ascending: false }).range(f, t))
    : [];
  const weeks = new Map<string, KommunWeekLite>();
  const weekOf = (kommun: string | undefined): KommunWeekLite | null => {
    if (!kommun) return null;
    if (!weeks.has(kommun)) weeks.set(kommun, { ...summarizeKommun(events, kommun, now), slug: kommunSlug(kommun) });
    return weeks.get(kommun)!;
  };

  const from = Deno.env.get('LIFECYCLE_FROM') || 'CrimeAlert <hej@crimealert.se>';
  let sent = 0;
  const failed: string[] = [];
  for (const d of due.slice(0, MAX_PER_RUN)) {
    const key = logKind(d.kind, now);
    const { data: claimed, error: claimError } = await db.from('lifecycle_email_log')
      .upsert({ user_id: d.id, kind: key }, { onConflict: 'user_id,kind', ignoreDuplicates: true }).select('user_id');
    if (claimError) throw new Error(claimError.message);
    if (!claimed?.length) continue;

    const unsubscribeUrl = `${FN_URL}?optout=${encodeURIComponent(await optOutToken(d.id, SECRET))}`;
    const mail = lifecycleEmail(d.kind, { now, week: weekOf(kommunOf.get(d.id)), unsubscribeUrl });
    const res = await fetch(`${RESEND_API}/emails`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from, to: [d.email], reply_to: 'kontakt@crimealert.se', subject: mail.subject, html: mail.html, text: mail.text,
        headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
        tags: [{ name: 'lifecycle', value: d.kind }],
      }),
    });
    if (res.ok) {
      sent++;
    } else {
      console.error('[lifecycle-emails] Resend', res.status, (await res.text()).slice(0, 300));
      failed.push(d.kind);
      await db.from('lifecycle_email_log').delete().eq('user_id', d.id).eq('kind', key);
    }
    await new Promise((r) => setTimeout(r, 550));
  }
  const byKind = due.reduce<Record<string, number>>((acc, d) => ({ ...acc, [d.kind]: (acc[d.kind] ?? 0) + 1 }), {});
  return { sent, due: byKind, failed: failed.length };
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('optout');
    if (token !== null) {
      const ok = await optOut(token);
      // Mail apps' one-click unsubscribe posts here and only needs the status
      if (req.method === 'POST') return new Response(null, { status: ok ? 200 : 400 });
      return ok
        ? page('Du är avregistrerad', 'Du får inga fler mejl av det här slaget från CrimeAlert. Ditt konto och dina notiser fungerar som vanligt.')
        : page('Länken fungerar inte', 'Den här länken är ogiltig. Skriv till kontakt@crimealert.se så hjälper vi dig.', 400);
    }
    if (req.method !== 'POST') return json({ error: 'POST' }, 405);
    return json(await run(Date.now()));
  } catch (e) {
    console.error('[lifecycle-emails]', e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
