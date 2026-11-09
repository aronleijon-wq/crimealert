import { describe, it, expect } from 'vitest';
import { FEEDBACK_AGAIN_MS, INVITE_AGAIN_MS, NEVER, pickNudge, type NudgeState } from './nudges';

const NOW = Date.UTC(2026, 10, 9);
const fresh: NudgeState = { inviteClosedAt: null, feedbackClosedAt: null, feedbackSentAt: null };

describe('cards in Flöde', () => {
  it('shows nothing on the first day', () => {
    expect(pickNudge({ days: 1, isPremium: false, state: fresh, now: NOW })).toBeNull();
  });

  it('offers free Pro for friends from the second day, to those without Pro', () => {
    expect(pickNudge({ days: 2, isPremium: false, state: fresh, now: NOW })).toBe('invite');
    expect(pickNudge({ days: 2, isPremium: true, state: fresh, now: NOW })).toBeNull();
  });

  it('asks about the app from the fourth day, once the invite card is closed', () => {
    const closed = { ...fresh, inviteClosedAt: NOW - 1000 };
    expect(pickNudge({ days: 3, isPremium: false, state: closed, now: NOW })).toBeNull();
    expect(pickNudge({ days: 4, isPremium: false, state: closed, now: NOW })).toBe('feedback');
    expect(pickNudge({ days: 4, isPremium: true, state: fresh, now: NOW })).toBe('feedback');
  });

  it('stays away for weeks after closing, and never asks again after an answer', () => {
    const closed = { ...fresh, inviteClosedAt: NOW - 1000, feedbackClosedAt: NOW - 1000 };
    expect(pickNudge({ days: 9, isPremium: false, state: closed, now: NOW })).toBeNull();
    expect(pickNudge({ days: 9, isPremium: false, state: closed, now: NOW + INVITE_AGAIN_MS })).toBe('invite');
    expect(pickNudge({ days: 9, isPremium: true, state: closed, now: NOW + FEEDBACK_AGAIN_MS })).toBe('feedback');
    expect(pickNudge({ days: 9, isPremium: true, state: { ...fresh, feedbackSentAt: NOW - 1000 }, now: NOW + FEEDBACK_AGAIN_MS * 3 })).toBeNull();
  });

  it('never offers free Pro again once every friend has counted', () => {
    const state = { ...fresh, inviteClosedAt: NEVER, feedbackSentAt: NOW };
    expect(pickNudge({ days: 10, isPremium: false, state, now: NOW + 10 * INVITE_AGAIN_MS })).toBeNull();
  });
});
