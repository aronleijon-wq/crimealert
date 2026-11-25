import { describe, expect, it } from 'vitest';
import { alertEmail, alertKey, proFromStripe } from '../../supabase/functions/_shared/adminAlerts';

describe('owner mail about new accounts and Pro', () => {
  it('says nothing when nothing is new', () => {
    expect(alertEmail([], [])).toBeNull();
  });

  it('names what is new in the subject and lists each one', () => {
    const mail = alertEmail(
      [{ email: 'anna@example.com', at: '2026-11-25T08:10:00Z' }, { email: 'bo@example.com', at: '2026-11-25T08:12:00Z' }],
      [{ email: 'cia@example.com', at: '2026-11-25T08:11:00Z', via: 'Apple', kind: 'Provperiod', plan: 'Månad' }],
    )!;
    expect(mail.subject).toBe('CrimeAlert: 1 ny Pro, 2 nya konton');
    expect(mail.text).toContain('cia@example.com · Provperiod, månad · via Apple');
    expect(mail.text).toContain('anna@example.com');
    expect(mail.html).toContain('<li>bo@example.com');
  });

  it('keeps addresses from breaking the mail', () => {
    expect(alertEmail([{ email: '<b>x@example.com', at: '2026-11-25T08:10:00Z' }], [])!.html).toContain('&lt;b&gt;x@example.com');
  });

  it('reads a Stripe subscription that just began, and leaves out those without Pro', () => {
    const base = { created: 1764058200, customer: { email: 'dan@example.com' }, items: { data: [{ price: { recurring: { interval: 'year' } } }] } };
    expect(proFromStripe({ ...base, status: 'trialing' })).toMatchObject({ email: 'dan@example.com', kind: 'Provperiod', plan: 'År', via: 'Webben' });
    expect(proFromStripe({ ...base, status: 'incomplete' })).toBeNull();
    expect(alertKey('stripe', 'sub_1')).toBe('stripe:sub_1');
  });
});
