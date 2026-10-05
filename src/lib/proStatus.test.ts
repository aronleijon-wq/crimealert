import { describe, it, expect } from 'vitest';
import { subscriptionFromProStatus } from './proStatus';

const now = Date.parse('2026-10-05T12:00:00Z');

describe('subscriptionFromProStatus', () => {
  it('is Pro until the remembered date, and for good on the free list', () => {
    expect(subscriptionFromProStatus('2026-11-05T12:00:00+00:00', now)).toMatchObject({ subscribed: true, subscriptionEnd: '2026-11-05T12:00:00+00:00' });
    expect(subscriptionFromProStatus('infinity', now)).toMatchObject({ subscribed: true, subscriptionEnd: 'lifetime' });
  });

  it('is free when Pro has run out, was never had, or nothing is remembered', () => {
    expect(subscriptionFromProStatus('2026-10-01T00:00:00+00:00', now).subscribed).toBe(false);
    expect(subscriptionFromProStatus(null, now).subscribed).toBe(false);
    expect(subscriptionFromProStatus(undefined, now).subscribed).toBe(false);
  });
});
