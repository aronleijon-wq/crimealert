// The e-mails a new account gets (lifecycle-emails, run every hour): a welcome straight away, what
// happened in your kommun on day 3, Pro on day 7, and a "this is what you missed" after two quiet
// weeks. Each is sent once (lifecycle_email_log), never two within a day, never to someone who
// said no (email_optouts). Pro members get neither the Pro offer nor the "you missed" nudge. Every e-mail has a link
// that stops them all. Prices, the trial and what Pro gives come from planFacts, so the e-mails
// change with the plans.
import { MONTHLY_KR, PRO_FEATURE_TEXTS, trialDays, YEARLY_KR } from './planFacts.ts';

export { trialDays };
/** 'pro_welcome' goes to everyone who starts Pro, once, whenever their account was made */
export type LifecycleKind = 'welcome' | 'day3' | 'day7' | 'comeback' | 'pro_welcome';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const SITE = 'https://crimealert.se';
export const APP_STORE_URL = 'https://apps.apple.com/se/app/crimealert-brottsplatskarta/id6826326029';

export interface Candidate {
  createdAt: number;
  /** The last time the account was used (a session refreshed), or null when unknown */
  lastUsedAt: number | null;
  pro: boolean;
  optedOut: boolean;
  /** What was sent before: the log's kinds ("comeback:3") and when */
  sent: { kind: string; at: number }[];
}

/** Each welcome step's window after the account was made: late ones are skipped, not sent late */
const WINDOWS: Record<'welcome' | 'day3' | 'day7', [number, number]> = {
  welcome: [0, 2 * DAY],
  day3: [3 * DAY, 5 * DAY],
  day7: [7 * DAY, 9 * DAY],
};
/** Quiet this long (and no longer than the end) brings the "you missed" e-mail */
export const COMEBACK_AFTER = 14 * DAY;
const COMEBACK_UNTIL = 21 * DAY;
/** At most one "you missed" in this time */
const COMEBACK_EVERY = 90 * DAY;
/** Never two e-mails closer than this */
const MIN_GAP = 20 * HOUR;

/** The log key for an e-mail: the comeback one by its 90-day period, so it can come again */
export const logKind = (kind: LifecycleKind, now: number) => (kind === 'comeback' ? `comeback:${Math.floor(now / COMEBACK_EVERY)}` : kind);

/** The e-mail an account should get now, if any */
export function dueEmail(c: Candidate, now: number): LifecycleKind | null {
  if (c.optedOut) return null;
  if (c.sent.some((s) => now - s.at < MIN_GAP)) return null;
  const had = (kind: string) => c.sent.some((s) => s.kind === kind);
  const age = now - c.createdAt;
  const inWindow = (k: keyof typeof WINDOWS) => age >= WINDOWS[k][0] && age < WINDOWS[k][1];
  if (inWindow('welcome') && !had('welcome')) return 'welcome';
  if (inWindow('day3') && !had('day3')) return 'day3';
  if (inWindow('day7') && !had('day7') && !c.pro) return 'day7';
  const quiet = now - (c.lastUsedAt ?? c.createdAt);
  const lastComeback = Math.max(0, ...c.sent.filter((s) => s.kind.startsWith('comeback')).map((s) => s.at));
  if (!c.pro && age >= COMEBACK_AFTER && quiet >= COMEBACK_AFTER && quiet < COMEBACK_UNTIL && now - lastComeback >= COMEBACK_EVERY) return 'comeback';
  return null;
}

// ── The link that stops them ──

const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function sign(userId: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(`lifecycle-optout:${userId}`))).slice(0, 32);
}

/** "<user id>.<signature>": only the server, with its secret, can make one */
export const optOutToken = async (userId: string, secret: string) => `${userId}.${await sign(userId, secret)}`;

/** The user id in a token, or null when it is not one the server made */
export async function readOptOutToken(token: string | null, secret: string): Promise<string | null> {
  const [userId, sig] = (token ?? '').split('.');
  if (!userId || !sig || !/^[0-9a-f-]{36}$/i.test(userId)) return null;
  const want = await sign(userId, secret);
  if (want.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0 ? userId : null;
}

// ── The e-mails ──

export interface KommunWeekLite {
  kommun: string;
  slug: string;
  thisWeek: number;
  lastWeek: number;
  top: { name: string; count: number } | null;
}

export interface EmailContext {
  now: number;
  /** The first kommun the account watches, with its last week; null when none is chosen */
  week: KommunWeekLite | null;
  unsubscribeUrl: string;
}

export interface Email {
  subject: string;
  /** The line after the subject in the inbox */
  preheader: string;
  html: string;
  text: string;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const nf = (n: number) => n.toLocaleString('sv-SE');
const events = (n: number) => `${nf(n)} ${n === 1 ? 'händelse' : 'händelser'}`;
/** A link back to the site, marked so the admin page counts it as e-mail */
const url = (path: string, kind: LifecycleKind) => `${SITE}${path}${path.includes('?') ? '&' : '?'}utm_source=mejl&utm_campaign=${kind}`;

type Block =
  | { p: string }
  | { steps: { title: string; text: string }[] }
  | { checks: string[] }
  | { stat: { value: string; label: string; note?: string } }
  | { small: string };

interface Content {
  subject: string;
  preheader: string;
  kicker: string;
  title: string;
  blocks: Block[];
  cta: { label: string; href: string };
  after?: Block[];
}

const RED = '#E5302A';
const INK = '#0B0B0C';
const TEXT = '#2B2B30';
const MUTED = '#6B6B73';
const LINE = '#ECECEF';
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,Helvetica,Arial,sans-serif";

function blockHtml(b: Block): string {
  if ('p' in b) return `<p style="margin:0 0 16px;font:16px/1.6 ${FONT};color:${TEXT}">${b.p}</p>`;
  if ('small' in b) return `<p style="margin:0 0 12px;font:13px/1.5 ${FONT};color:${MUTED}">${b.small}</p>`;
  if ('stat' in b) {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;border-collapse:separate;background:${INK};border-radius:14px"><tr><td style="padding:22px 24px">
<div style="font:600 11px/1 ${FONT};letter-spacing:.14em;text-transform:uppercase;color:#FF6B63">${esc(b.stat.label)}</div>
<div style="margin-top:10px;font:800 40px/1 ${FONT};color:#FFFFFF;letter-spacing:-.02em">${esc(b.stat.value)}</div>
${b.stat.note ? `<div style="margin-top:10px;font:14px/1.5 ${FONT};color:#C9C9D1">${b.stat.note}</div>` : ''}
</td></tr></table>`;
  }
  if ('steps' in b) {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px">${b.steps.map((s, i) => `<tr>
<td width="40" valign="top" style="padding:0 0 16px"><div style="width:28px;height:28px;border-radius:14px;background:${RED};color:#fff;font:700 14px/28px ${FONT};text-align:center">${i + 1}</div></td>
<td valign="top" style="padding:2px 0 16px"><div style="font:600 16px/1.4 ${FONT};color:${INK}">${esc(s.title)}</div><div style="margin-top:2px;font:15px/1.5 ${FONT};color:${MUTED}">${s.text}</div></td>
</tr>`).join('')}</table>`;
  }
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px">${b.checks.map((c) => `<tr>
<td width="30" valign="top" style="padding:0 0 10px;font:700 16px/1.5 ${FONT};color:#1FA463">✓</td>
<td valign="top" style="padding:0 0 10px;font:16px/1.5 ${FONT};color:${TEXT}">${esc(c)}</td>
</tr>`).join('')}</table>`;
}

function blockText(b: Block): string {
  const strip = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ');
  if ('p' in b) return strip(b.p);
  if ('small' in b) return strip(b.small);
  if ('stat' in b) return `${b.stat.label}: ${b.stat.value}${b.stat.note ? `\n${strip(b.stat.note)}` : ''}`;
  if ('steps' in b) return b.steps.map((s, i) => `${i + 1}. ${s.title}: ${strip(s.text)}`).join('\n');
  return b.checks.map((c) => `✓ ${c}`).join('\n');
}

function layout(c: Content, unsubscribeUrl: string): Pick<Email, 'html' | 'text'> {
  const html = `<!doctype html>
<html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(c.subject)}</title></head>
<body style="margin:0;padding:0;background:#F4F4F6">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(c.preheader)}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F4F6"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td style="background:${INK};border-radius:18px 18px 0 0;padding:22px 28px">
<a href="${SITE}" style="text-decoration:none"><img src="${SITE}/logo-mark.png" width="30" height="30" alt="" style="vertical-align:middle;border-radius:7px;border:0">
<span style="vertical-align:middle;margin-left:10px;font:800 16px/1 ${FONT};letter-spacing:.06em;color:#FFFFFF">CRIME<span style="color:${RED}">ALERT</span></span></a>
</td></tr>
<tr><td style="background:#FFFFFF;padding:34px 28px 30px;border-radius:0 0 18px 18px">
<div style="font:700 12px/1 ${FONT};letter-spacing:.14em;text-transform:uppercase;color:${RED}">${esc(c.kicker)}</div>
<h1 style="margin:10px 0 18px;font:800 27px/1.2 ${FONT};letter-spacing:-.01em;color:${INK}">${esc(c.title)}</h1>
${c.blocks.map(blockHtml).join('\n')}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 22px"><tr><td style="border-radius:999px;background:${RED}">
<a href="${esc(c.cta.href)}" style="display:inline-block;padding:15px 30px;font:700 16px/1 ${FONT};color:#FFFFFF;text-decoration:none;border-radius:999px">${esc(c.cta.label)} &rarr;</a>
</td></tr></table>
${(c.after ?? []).map(blockHtml).join('\n')}
<p style="margin:22px 0 0;padding-top:18px;border-top:1px solid ${LINE};font:15px/1.5 ${FONT};color:${TEXT}">Hälsningar,<br>CrimeAlert</p>
</td></tr>
<tr><td style="padding:20px 28px 0;text-align:center;font:12px/1.6 ${FONT};color:${MUTED}">
Du får det här mejlet för att du har ett konto på <a href="${SITE}" style="color:${MUTED}">crimealert.se</a>.<br>
<a href="${esc(unsubscribeUrl)}" style="color:${MUTED};text-decoration:underline">Avregistrera dig</a>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
  const text = [
    c.title,
    '',
    ...c.blocks.map(blockText).flatMap((t) => [t, '']),
    `${c.cta.label}: ${c.cta.href}`,
    '',
    ...(c.after ?? []).map(blockText).flatMap((t) => [t, '']),
    'Hälsningar,',
    'CrimeAlert',
    '',
    '—',
    `Du får det här mejlet för att du har ett konto på crimealert.se. Avregistrera dig: ${unsubscribeUrl}`,
  ].join('\n');
  return { html, text };
}

/** Pro in the day 7 e-mail: what the plans say Pro gives, the five that matter most */
const EMAIL_PRO_FEATURES = (['live', 'push', 'description', 'analysis', 'ask'] as const)
  .map((key) => PRO_FEATURE_TEXTS.find((f) => f.key === key))
  .filter((f): f is (typeof PRO_FEATURE_TEXTS)[number] => !!f)
  .map((f) => f.text.replace(/ \(.*\)$/, ''));

/** Everything Pro gives, as the plans say it, for the welcome to Pro ("(3 frågor per dag utan Pro)" left out) */
export const PRO_WELCOME_FEATURES = PRO_FEATURE_TEXTS.map((f) => f.text.replace(/ \(.*\)$/, ''));

function content(kind: LifecycleKind, ctx: EmailContext): Content {
  if (kind === 'pro_welcome') {
    return {
      subject: 'Välkommen till CrimeAlert Pro',
      preheader: 'Det här har du tillgång till nu.',
      kicker: 'CrimeAlert Pro',
      title: 'Välkommen till Pro!',
      blocks: [
        { p: 'Tack för att du valde Pro. Det här har du tillgång till nu:' },
        { checks: PRO_WELCOME_FEATURES },
        { p: 'Tips: slå på notiser för dina kommuner, så får du veta direkt när något händer.' },
      ],
      cta: { label: 'Öppna CrimeAlert', href: url('/karta', kind) },
      after: [{ small: 'Du hanterar ditt abonnemang under Profil i appen eller på crimealert.se.' }],
    };
  }
  const w = ctx.week;
  if (kind === 'welcome') {
    return {
      subject: 'Välkommen till CrimeAlert',
      preheader: 'Tre saker som gör CrimeAlert till ditt eget, på två minuter.',
      kicker: 'Välkommen',
      title: 'Kul att du är här!',
      blocks: [
        { p: 'CrimeAlert samlar Polisens händelser, olyckor och räddningsinsatser i hela Sverige på en karta, och placerar dem där de hände. Så här får du ut mest av det:' },
        { steps: [
          { title: 'Välj din kommun', text: 'Då ser du direkt vad som händer där du bor, och kan få en sammanfattning varje vecka.' },
          { title: 'Slå på notiser', text: 'Få veta när något händer nära dig, med en kort beskrivning direkt på låsskärmen.' },
          { title: 'Hämta appen', text: `Allt finns också i <a href="${APP_STORE_URL}" style="color:${RED};font-weight:600">CrimeAlert för iPhone</a>, med widgets på hemskärmen.` },
        ] },
      ],
      cta: { label: 'Välj din kommun', href: url('/alerts', kind) },
      after: [{ small: 'Har du frågor eller idéer? Svara på det här mejlet eller skriv till kontakt@crimealert.se. Vi läser allt.' }],
    };
  }
  if (kind === 'day3') {
    if (w) {
      const change = w.lastWeek > 0 ? Math.round(((w.thisWeek - w.lastWeek) / w.lastWeek) * 100) : null;
      const note = [
        change === null ? '' : change === 0 ? 'Lika många som veckan innan.' : `${change > 0 ? '+' : '−'}${Math.abs(change)} % mot veckan innan (${nf(w.lastWeek)}).`,
        w.top ? `Vanligast: <strong style="color:#FFFFFF">${esc(w.top.name)}</strong> (${nf(w.top.count)}).` : '',
      ].filter(Boolean).join(' ');
      return {
        subject: w.thisWeek ? `${events(w.thisWeek)} i ${w.kommun} senaste veckan` : `Lugn vecka i ${w.kommun}`,
        preheader: `Så ser det ut där du bor, enligt Polisens händelser.`,
        kicker: `Veckan i ${w.kommun}`,
        title: w.thisWeek ? `Det här har hänt i ${w.kommun}` : `En lugn vecka i ${w.kommun}`,
        blocks: [
          { stat: { label: 'Senaste 7 dagarna', value: events(w.thisWeek), note: note || undefined } },
          { p: `På kommunsidan ser du varje händelse på kartan, vad som är vanligast i ${esc(w.kommun)} jämfört med resten av Sverige, och hur det har förändrats.` },
        ],
        cta: { label: `Se allt i ${w.kommun}`, href: url(`/kommun/${w.slug}`, kind) },
        after: [{ small: `Siffrorna är Polisens publicerade händelser, inte alla anmälda brott. I <a href="${url('/brottsatlas', kind)}" style="color:${MUTED}">Brottsatlasen</a> kan du jämföra alla 290 kommuner.` }],
      };
    }
    return {
      subject: 'Vad händer där du bor?',
      preheader: 'Välj din kommun så visar CrimeAlert läget där du bor.',
      kicker: 'Tips',
      title: 'Vad händer där du bor?',
      blocks: [
        { p: 'Du har inte valt någon kommun än. Gör det så får du en egen lägesbild: vad som har hänt den senaste veckan, vad som är vanligast och om det ökar eller minskar.' },
        { checks: ['Veckans händelser i din kommun', 'Jämförelse med resten av Sverige', 'Notiser när något händer nära dig'] },
      ],
      cta: { label: 'Välj din kommun', href: url('/alerts', kind) },
    };
  }
  if (kind === 'day7') {
    const days = trialDays(ctx.now);
    return {
      subject: `Prova Pro gratis i ${days} dagar`,
      preheader: 'Händelserna direkt, hela beskrivningen och Fråga AI utan gräns.',
      kicker: 'CrimeAlert Pro',
      title: 'Se allt, direkt när det händer',
      blocks: [
        { p: `Du har haft CrimeAlert i en vecka. Med Pro får du hela bilden, och de första ${days} dagarna kostar ingenting:` },
        { checks: EMAIL_PRO_FEATURES },
        { p: `Efter provperioden kostar Pro <strong>${MONTHLY_KR} kr i månaden</strong> eller <strong>${YEARLY_KR} kr om året</strong>. Du avslutar när du vill.` },
      ],
      cta: { label: 'Prova Pro gratis', href: url('/prisplan', kind) },
      after: [{ small: 'Provperioden gäller om du inte har haft Pro tidigare.' }],
    };
  }
  // comeback
  return w && w.thisWeek > 0
    ? {
      subject: `${events(w.thisWeek)} i ${w.kommun} den senaste veckan`,
      preheader: 'Här är vad som har hänt sedan du var inne senast.',
      kicker: 'Sedan sist',
      title: `Det här har du missat i ${w.kommun}`,
      blocks: [
        { stat: { label: 'Senaste 7 dagarna', value: events(w.thisWeek), note: w.top ? `Vanligast: <strong style="color:#FFFFFF">${esc(w.top.name)}</strong> (${nf(w.top.count)}).` : undefined } },
        { p: 'Slå på notiser så får du veta direkt när något händer nära dig, utan att behöva leta.' },
      ],
      cta: { label: `Se vad som hänt i ${w.kommun}`, href: url(`/kommun/${w.slug}`, kind) },
    }
    : {
      subject: 'Det har hänt mycket sedan du var här',
      preheader: 'Polisens händelser i hela Sverige, på kartan, just nu.',
      kicker: 'Sedan sist',
      title: 'Det har hänt mycket sedan du var här',
      blocks: [
        { p: 'Kartan uppdateras hela tiden med Polisens händelser, olyckor och räddningsinsatser i hela Sverige.' },
        { checks: ['Se vad som händer just nu, där det händer', 'Välj din kommun och få en lägesbild', 'Notiser när något händer nära dig'] },
      ],
      cta: { label: 'Öppna kartan', href: url('/karta', kind) },
    };
}

/** The finished e-mail */
export function lifecycleEmail(kind: LifecycleKind, ctx: EmailContext): Email {
  const c = content(kind, ctx);
  return { subject: c.subject, preheader: c.preheader, ...layout(c, ctx.unsubscribeUrl) };
}
