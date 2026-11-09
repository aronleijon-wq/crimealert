// The quiet cards in Flöde that ask for feedback or remind about free Pro for inviting friends.
// At most one at a time, never on the first day, and once closed it stays away for weeks.
// Days of use come from review.ts, which notes each day the app is opened.

const KEY = 'ca-nudges';
const DAY = 24 * 60 * 60 * 1000;
export const INVITE_FROM_DAY = 2;
export const FEEDBACK_FROM_DAY = 4;
export const INVITE_AGAIN_MS = 21 * DAY;
export const FEEDBACK_AGAIN_MS = 45 * DAY;

/** A closing that never ends: every friend has already counted */
export const NEVER = 8.64e15;

export type Nudge = 'invite' | 'feedback';

export interface NudgeState {
  inviteClosedAt: number | null;
  feedbackClosedAt: number | null;
  /** Feedback sent: not asked again */
  feedbackSentAt: number | null;
}

const empty = (): NudgeState => ({ inviteClosedAt: null, feedbackClosedAt: null, feedbackSentAt: null });

export function readNudges(): NudgeState {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<NudgeState> | null;
    return saved ? { ...empty(), ...saved } : empty();
  } catch {
    return empty();
  }
}

export function saveNudges(state: NudgeState) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* shown again next time */ }
}

/** How many different days the app has been used (review.ts keeps the latest ten) */
export function usageDays(): number {
  try {
    const saved = JSON.parse(localStorage.getItem('ca-review') ?? 'null') as { days?: unknown } | null;
    return Array.isArray(saved?.days) ? saved.days.length : 0;
  } catch {
    return 0;
  }
}

const rested = (closedAt: number | null, wait: number, now: number) => closedAt === null || now - closedAt >= wait;

/**
 * Which card to show, if any: free Pro for friends to those without Pro from their second day,
 * and the question about the app from the fourth day to those who haven't answered.
 */
export function pickNudge({ days, isPremium, state, now }: { days: number; isPremium: boolean; state: NudgeState; now: number }): Nudge | null {
  if (!isPremium && days >= INVITE_FROM_DAY && rested(state.inviteClosedAt, INVITE_AGAIN_MS, now)) return 'invite';
  if (days >= FEEDBACK_FROM_DAY && state.feedbackSentAt === null && rested(state.feedbackClosedAt, FEEDBACK_AGAIN_MS, now)) return 'feedback';
  return null;
}
