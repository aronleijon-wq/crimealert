// When the iPhone app asks for a rating, with Apple's own prompt (CrimeAlertStorePlugin.review).
// Only someone who keeps coming back is asked: on their third day with the app or later, after
// they have opened a few events, and at most every four months. iOS itself shows the prompt at
// most three times a year, and not at all to someone who turned it off.
import { nativeStore } from '@/lib/appStore';

const KEY = 'ca-review';
const DAY = 24 * 60 * 60 * 1000;
export const MIN_DAYS = 3;
export const MIN_MOMENTS = 3;
export const ASK_EVERY_MS = 120 * DAY;

export interface ReviewState {
  /** Days the app was used, "2026-11-07", the latest few */
  days: string[];
  /** Times something useful happened: an event or a kommun opened, a notification tapped */
  moments: number;
  askedAt: number | null;
}

const empty = (): ReviewState => ({ days: [], moments: 0, askedAt: null });
const today = (now: number) => new Date(now).toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });

function read(): ReviewState {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<ReviewState> | null;
    return saved ? { ...empty(), ...saved } : empty();
  } catch {
    return empty();
  }
}

function write(state: ReviewState) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* asked again another time */ }
}

export function withUse(state: ReviewState, now: number): ReviewState {
  const day = today(now);
  return state.days.includes(day) ? state : { ...state, days: [...state.days, day].slice(-10) };
}

export function shouldAsk(state: ReviewState, now: number): boolean {
  if (state.days.length < MIN_DAYS || state.moments < MIN_MOMENTS) return false;
  return state.askedAt === null || now - state.askedAt >= ASK_EVERY_MS;
}

/** Notes that the app was opened today */
export function recordUse(now = Date.now()) {
  write(withUse(read(), now));
}

/**
 * Notes a good moment, and asks for a rating if it is time. The prompt waits a moment, so it
 * comes after the page has opened rather than over the tap.
 */
export function recordMoment(now = Date.now()) {
  const state = withUse(read(), now);
  state.moments += 1;
  const ask = shouldAsk(state, now);
  if (ask) state.askedAt = now;
  write(state);
  if (!ask) return;
  setTimeout(() => {
    nativeStore()
      .then((store) => store?.review())
      // App versions without the prompt (before 1.2) answer that it isn't there
      .catch(() => {});
  }, 2500);
}
