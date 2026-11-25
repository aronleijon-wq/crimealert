// An e-mail to the owner when someone makes an account or starts Pro (admin-alerts, run every
// 15 minutes). Each account and subscription is told about once (admin_alert_log); the first run
// only notes what is there, so the owner is not sent the whole history.

export interface NewAccount {
  email: string;
  at: string;
}

export interface NewPro {
  email: string;
  at: string | null;
  via: 'Webben' | 'Apple';
  /** "Provperiod" or "Betalar" */
  kind: 'Provperiod' | 'Betalar';
  plan: 'Månad' | 'År' | null;
}

/** The key in admin_alert_log for an account or a subscription */
export const alertKey = (kind: 'account' | 'stripe' | 'apple', id: string) => `${kind}:${id}`;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const time = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** The e-mail, or null when there is nothing new */
export function alertEmail(accounts: NewAccount[], pros: NewPro[]): { subject: string; text: string; html: string } | null {
  if (!accounts.length && !pros.length) return null;
  const parts = [
    pros.length ? plural(pros.length, 'ny Pro', 'nya Pro') : '',
    accounts.length ? plural(accounts.length, 'nytt konto', 'nya konton') : '',
  ].filter(Boolean);
  const subject = `CrimeAlert: ${parts.join(', ')}`;
  const proLine = (p: NewPro) => `${p.email} · ${p.kind}${p.plan ? `, ${p.plan.toLowerCase()}` : ''} · via ${p.via}${p.at ? ` · ${time(p.at)}` : ''}`;
  const accountLine = (a: NewAccount) => `${a.email} · ${time(a.at)}`;
  const text = [
    pros.length ? `Ny Pro:\n${pros.map((p) => `- ${proLine(p)}`).join('\n')}` : '',
    accounts.length ? `Nya konton:\n${accounts.map((a) => `- ${accountLine(a)}`).join('\n')}` : '',
    'Alla siffror finns på crimealert.se/admin.',
  ].filter(Boolean).join('\n\n');
  const list = (title: string, lines: string[]) =>
    `<h3 style="margin:20px 0 8px;font:600 15px Inter,Arial,sans-serif">${title}</h3><ul style="margin:0;padding-left:18px;font:14px/1.6 Inter,Arial,sans-serif">${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`;
  const html = `<div style="color:#111">${pros.length ? list('Ny Pro', pros.map(proLine)) : ''}${accounts.length ? list('Nya konton', accounts.map(accountLine)) : ''}<p style="margin-top:24px;font:13px Inter,Arial,sans-serif;color:#666">Alla siffror finns på <a href="https://crimealert.se/admin">crimealert.se/admin</a>.</p></div>`;
  return { subject, text, html };
}

/** How a Stripe subscription that just began is described; null when it gives no Pro */
export function proFromStripe(sub: {
  status: string;
  created?: number | null;
  customer?: string | { email?: string | null; deleted?: boolean } | null;
  items: { data: { price: { recurring?: { interval: string } | null } }[] };
}): NewPro | null {
  const kind = sub.status === 'trialing' ? 'Provperiod' : sub.status === 'active' ? 'Betalar' : null;
  if (!kind) return null;
  const email = typeof sub.customer === 'object' && sub.customer && !sub.customer.deleted ? sub.customer.email ?? '' : '';
  const interval = sub.items.data[0]?.price.recurring?.interval;
  return {
    email: email || '(okänd e-post)',
    at: sub.created ? new Date(sub.created * 1000).toISOString() : null,
    via: 'Webben',
    kind,
    plan: interval === 'month' ? 'Månad' : interval === 'year' ? 'År' : null,
  };
}
