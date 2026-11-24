// Everyone with Pro now, one row each, for the admin dashboard's "Pro-medlemmar": how they have
// Pro (a free trial, paying monthly or yearly, through Apple, from inviting friends, or free Pro
// given by us), when the account and the Pro began, and how many days are left until the trial
// ends, the next payment, or the Pro runs out. Only for admins (admin-dashboard).

const DAY = 86_400_000;

export type MemberKind = 'trial' | 'paying' | 'past_due' | 'invite' | 'free';
export type MemberSource = 'stripe' | 'apple' | 'invite' | 'free';

export interface ProMember {
  email: string;
  source: MemberSource;
  kind: MemberKind;
  plan: 'monthly' | 'yearly' | null;
  /** When the account was made (ISO), if known */
  joined: string | null;
  /** When this Pro began (ISO): the subscription's start, or the first invite reward */
  proSince: string | null;
  /** When the trial ends, the period ends or the Pro runs out (ISO); null for free Pro without end */
  until: string | null;
  /** Whole days to `until`, rounded up; null without an end */
  daysLeft: number | null;
  /** Whether it goes on by itself after `until` (a subscription that renews); false when cancelled */
  renews: boolean | null;
}

export interface StripeMemberLike {
  status: string;
  start_date?: number | null;
  created?: number | null;
  trial_end?: number | null;
  cancel_at_period_end?: boolean | null;
  cancel_at?: number | null;
  current_period_end?: number | null;
  customer?: string | { email?: string | null; deleted?: boolean } | null;
  items: { data: { current_period_end?: number | null; price: { recurring?: { interval: string } | null } }[] };
}

const iso = (ms: number | null | undefined) => (ms && Number.isFinite(ms) ? new Date(ms).toISOString() : null);
export const daysUntil = (until: string | null, now: number) =>
  until ? Math.max(0, Math.ceil((Date.parse(until) - now) / DAY)) : null;

const planOf = (interval: string | undefined) => (interval === 'month' ? 'monthly' : interval === 'year' ? 'yearly' : null);

/** A Stripe subscription that gives Pro now, as a member; null otherwise */
export function memberFromStripe(sub: StripeMemberLike, joinedByEmail: Map<string, string>, now: number): ProMember | null {
  const kind: MemberKind | undefined = ({ trialing: 'trial', active: 'paying', past_due: 'past_due' } as Record<string, MemberKind>)[sub.status];
  if (!kind) return null;
  const email = typeof sub.customer === 'object' && sub.customer && !sub.customer.deleted ? sub.customer.email?.toLowerCase() ?? '' : '';
  const item = sub.items.data[0];
  const periodEnd = item?.current_period_end ?? sub.current_period_end ?? null;
  const endSec = kind === 'trial' ? sub.trial_end ?? periodEnd : sub.cancel_at ?? periodEnd;
  const until = iso(endSec ? endSec * 1000 : null);
  return {
    email: email || '(okänd e-post)',
    source: 'stripe',
    kind,
    plan: planOf(item?.price.recurring?.interval),
    joined: joinedByEmail.get(email) ?? null,
    proSince: iso(((sub.start_date ?? sub.created) ?? 0) * 1000),
    until,
    daysLeft: daysUntil(until, now),
    renews: !(sub.cancel_at_period_end || sub.cancel_at),
  };
}

export interface AppleMemberInput {
  email: string;
  joined: string | null;
  productId: string;
  expiresAt: string | null;
  startedAt: string | null;
  freeTrial: boolean;
  autoRenew: boolean;
}

export function memberFromApple(a: AppleMemberInput, now: number): ProMember {
  return {
    email: a.email,
    source: 'apple',
    kind: a.freeTrial ? 'trial' : 'paying',
    plan: /year/i.test(a.productId) ? 'yearly' : /month/i.test(a.productId) ? 'monthly' : null,
    joined: a.joined,
    proSince: a.startedAt,
    until: a.expiresAt,
    daysLeft: daysUntil(a.expiresAt, now),
    renews: a.autoRenew,
  };
}

export function memberFromInvite(email: string, joined: string | null, proUntil: string, firstReward: string | null, now: number): ProMember {
  return { email, source: 'invite', kind: 'invite', plan: null, joined, proSince: firstReward, until: proUntil, daysLeft: daysUntil(proUntil, now), renews: false };
}

export function freeMember(email: string, joined: string | null): ProMember {
  return { email, source: 'free', kind: 'free', plan: null, joined, proSince: null, until: null, daysLeft: null, renews: null };
}

const RANK: Record<MemberSource, number> = { stripe: 0, apple: 1, invite: 2, free: 3 };

/**
 * One row per person (by e-mail): a subscription before invite Pro before free Pro, as that is
 * what they pay or will pay for. Sorted with the trials ending soonest first, then the rest by
 * days left.
 */
export function mergeMembers(rows: ProMember[]): ProMember[] {
  const best = new Map<string, ProMember>();
  for (const r of rows) {
    const key = r.email.toLowerCase();
    const had = best.get(key);
    if (!had || RANK[r.source] < RANK[had.source]) best.set(key, r);
  }
  const order = (m: ProMember) => (m.kind === 'trial' ? 0 : 1);
  return [...best.values()].sort((a, b) =>
    order(a) - order(b) || (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity) || a.email.localeCompare(b.email));
}

export interface MemberSummary {
  total: number;
  trials: number;
  /** Trials that end within 3 days and will become paying (not cancelled) */
  trialsEndingSoon: number;
  /** Trials that are cancelled: they end without paying */
  trialsCancelled: number;
  paying: number;
  pastDue: number;
  invite: number;
  free: number;
}

export function summarizeMembers(members: ProMember[]): MemberSummary {
  const trials = members.filter((m) => m.kind === 'trial');
  return {
    total: members.length,
    trials: trials.length,
    trialsEndingSoon: trials.filter((m) => m.daysLeft !== null && m.daysLeft <= 3 && m.renews !== false).length,
    trialsCancelled: trials.filter((m) => m.renews === false).length,
    paying: members.filter((m) => m.kind === 'paying').length,
    pastDue: members.filter((m) => m.kind === 'past_due').length,
    invite: members.filter((m) => m.kind === 'invite').length,
    free: members.filter((m) => m.kind === 'free').length,
  };
}
