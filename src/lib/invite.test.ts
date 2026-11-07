import { afterEach, describe, expect, it } from 'vitest';
import { daysLeftToEarn, forgetInvite, friendsLabel, invitePath, inviteUrl, normalizeInviteCode, pendingInvite, redeemIsFinal, redeemMessage, rememberInvite } from './invite';

afterEach(() => localStorage.clear());

describe('invite codes', () => {
  it('are read however they are typed', () => {
    expect(normalizeInviteCode('abcd2345')).toBe('ABCD2345');
    expect(normalizeInviteCode(' abcd-2345 ')).toBe('ABCD2345');
    // Letters and digits that are easy to mix up are never in a code
    expect(normalizeInviteCode('ABCD0123')).toBeNull();
    expect(normalizeInviteCode('ABCDI234')).toBeNull();
    expect(normalizeInviteCode('ABC')).toBeNull();
    expect(normalizeInviteCode(null)).toBeNull();
  });

  it('make a link', () => {
    expect(invitePath('ABCD2345')).toBe('/inbjudan/ABCD2345');
    expect(inviteUrl('ABCD2345')).toBe('https://crimealert.se/inbjudan/ABCD2345');
  });

  it('are remembered for 30 days', () => {
    const now = Date.UTC(2026, 10, 7);
    rememberInvite('ABCD2345', now);
    expect(pendingInvite(now + 29 * 86400000)).toBe('ABCD2345');
    expect(pendingInvite(now + 31 * 86400000)).toBeNull();
    forgetInvite();
    expect(pendingInvite(now)).toBeNull();
  });

  it('are tried again only when the answer was "not yet"', () => {
    expect(redeemIsFinal('ok')).toBe(true);
    expect(redeemIsFinal('already')).toBe(true);
    expect(redeemIsFinal('too_old')).toBe(true);
    expect(redeemIsFinal('unconfirmed')).toBe(false);
    expect(redeemIsFinal('signed_out')).toBe(false);
    expect(redeemIsFinal('error')).toBe(false);
    expect(redeemMessage('unconfirmed')).toMatch(/Bekräfta din e-post/);
  });

  it('count up to eight friends', () => {
    expect(friendsLabel(3)).toBe('3 av 8 vänner');
    expect(friendsLabel(9)).toBe('8 av 8 vänner');
    expect(daysLeftToEarn(0)).toBe(56);
    expect(daysLeftToEarn(5)).toBe(21);
    expect(daysLeftToEarn(8)).toBe(0);
  });
});
