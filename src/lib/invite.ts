// Invite a friend (migration 20261107090000_invites.sql): every account has a link of its own.
// A friend who makes a new account through it, and confirms their e-mail, gives the one who
// invited 7 days of Pro, for up to 8 friends. The rules are kept by the database; this is the
// site's side: the link, remembering a code until the friend has an account, and the words.
import { supabase } from '@/integrations/supabase/client';

export const INVITE_DAYS = 7;
export const INVITE_MAX_FRIENDS = 8;

const CODE = /^[A-HJ-NP-Z2-9]{8}$/;
const PENDING_KEY = 'ca-invite';
// A code is kept this long while the friend gets round to making an account
const PENDING_MS = 30 * 24 * 60 * 60 * 1000;

/** "abcd-2345" as typed or pasted, as the code it is ("ABCD2345"), or null if it can't be one */
export function normalizeInviteCode(input: string | null | undefined): string | null {
  const code = (input ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return CODE.test(code) ? code : null;
}

export const invitePath = (code: string) => `/inbjudan/${code}`;
export const inviteUrl = (code: string) => `https://crimealert.se${invitePath(code)}`;

/** Remembers a friend's code on this device until there is an account to use it with */
export function rememberInvite(code: string, now = Date.now()): void {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify({ code, at: now })); } catch { /* the code can be typed in later */ }
}

export function pendingInvite(now = Date.now()): string | null {
  try {
    const saved = JSON.parse(localStorage.getItem(PENDING_KEY) ?? 'null') as { code?: string; at?: number } | null;
    if (!saved?.code || typeof saved.at !== 'number' || now - saved.at > PENDING_MS) return null;
    return normalizeInviteCode(saved.code);
  } catch {
    return null;
  }
}

export function forgetInvite(): void {
  try { localStorage.removeItem(PENDING_KEY); } catch { /* nothing kept */ }
}

export type RedeemResult = 'ok' | 'invalid' | 'self' | 'already' | 'too_old' | 'unconfirmed' | 'signed_out' | 'error';

/** Whether to stop trying a remembered code: everything but "not yet" answers */
export const redeemIsFinal = (result: RedeemResult) => result !== 'unconfirmed' && result !== 'signed_out' && result !== 'error';

/** What to say about an answer, to the friend using the code */
export function redeemMessage(result: RedeemResult): string {
  switch (result) {
    case 'ok': return 'Klart! Din vän fick 7 dagar Pro. Nu har du en egen länk att bjuda in med.';
    case 'invalid': return 'Den koden finns inte. Kolla att den är rätt skriven.';
    case 'self': return 'Du kan inte använda din egen kod, eller koden från någon du själv bjudit in.';
    case 'already': return 'Ditt konto har redan använt en inbjudan.';
    case 'too_old': return 'Inbjudningar gäller nya konton, de första 7 dagarna.';
    case 'unconfirmed': return 'Bekräfta din e-post först, så räknas inbjudan.';
    case 'signed_out': return 'Logga in eller skapa ett konto först.';
    default: return 'Det gick inte just nu. Försök igen om en stund.';
  }
}

export async function redeemInvite(code: string): Promise<RedeemResult> {
  const { data, error } = await supabase.rpc('redeem_invite' as never, { _code: code } as never);
  if (error) return 'error';
  return (typeof data === 'string' ? data : 'error') as RedeemResult;
}

export interface MyInvite {
  code: string;
  /** Friends that gave Pro, at most INVITE_MAX_FRIENDS */
  rewarded: number;
  /** Pro from invites until then, or null */
  proUntil: string | null;
  /** Whether this account is new enough, and not invited, to use a friend's code */
  canRedeem: boolean;
}

export async function loadMyInvite(): Promise<MyInvite | null> {
  const { data, error } = await supabase.rpc('my_invite' as never);
  const rows = data as unknown;
  const row = (Array.isArray(rows) ? rows[0] : rows) as { code: string; rewarded: number; pro_until: string | null; can_redeem: boolean } | null;
  if (error || !row?.code) return null;
  return { code: row.code, rewarded: row.rewarded ?? 0, proUntil: row.pro_until, canRedeem: row.can_redeem === true };
}

/** Whose code it is, for "Anna bjöd in dig"; valid false when there is no such code */
export async function inviteFrom(code: string): Promise<{ valid: boolean; name: string | null } | null> {
  const { data, error } = await supabase.rpc('invite_from' as never, { _code: code } as never);
  if (error) return null;
  const rows = data as unknown;
  const row = (Array.isArray(rows) ? rows[0] : rows) as { valid: boolean; inviter_name: string | null } | undefined;
  return row ? { valid: true, name: row.inviter_name } : { valid: false, name: null };
}

/** "3 av 8 vänner" */
export const friendsLabel = (rewarded: number) => `${Math.min(rewarded, INVITE_MAX_FRIENDS)} av ${INVITE_MAX_FRIENDS} vänner`;

/** Pro days still to earn */
export const daysLeftToEarn = (rewarded: number) => Math.max(0, INVITE_MAX_FRIENDS - rewarded) * INVITE_DAYS;

/** The words that go with the link when it is shared */
export const inviteShareText = 'Jag använder CrimeAlert för att se vad som händer där jag bor. Skapa ett gratis konto via min länk:';
