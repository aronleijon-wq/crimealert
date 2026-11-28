import { describe, expect, it } from 'vitest';
import { dueEmail, lifecycleEmail, logKind, optOutToken, readOptOutToken, trialDays, type Candidate } from '../../supabase/functions/_shared/lifecycleEmails';

const H = 3_600_000;
const D = 24 * H;
const NOW = Date.parse('2026-12-10T12:00:00Z');
const account = (over: Partial<Candidate> = {}): Candidate => ({ createdAt: NOW, lastUsedAt: NOW, pro: false, optedOut: false, sent: [], ...over });

describe('which e-mail is due', () => {
  it('welcomes a new account once', () => {
    expect(dueEmail(account({ createdAt: NOW - H }), NOW)).toBe('welcome');
    expect(dueEmail(account({ createdAt: NOW - H, sent: [{ kind: 'welcome', at: NOW - 30 * 60_000 }] }), NOW)).toBeNull();
  });

  it('skips a step whose time has passed instead of sending it late', () => {
    expect(dueEmail(account({ createdAt: NOW - 2.5 * D }), NOW)).toBeNull();
    expect(dueEmail(account({ createdAt: NOW - 3.5 * D, sent: [{ kind: 'welcome', at: NOW - 3.5 * D }] }), NOW)).toBe('day3');
    expect(dueEmail(account({ createdAt: NOW - 6 * D, sent: [{ kind: 'welcome', at: NOW - 6 * D }] }), NOW)).toBeNull();
  });

  it('offers Pro on day 7, but not to someone who has it', () => {
    const sent = [{ kind: 'welcome', at: NOW - 7.5 * D }, { kind: 'day3', at: NOW - 4 * D }];
    expect(dueEmail(account({ createdAt: NOW - 7.5 * D, sent }), NOW)).toBe('day7');
    expect(dueEmail(account({ createdAt: NOW - 7.5 * D, sent, pro: true }), NOW)).toBeNull();
  });

  it('never sends two within a day, or anything to someone who said no', () => {
    expect(dueEmail(account({ createdAt: NOW - 3.5 * D, sent: [{ kind: 'welcome', at: NOW - 5 * H }] }), NOW)).toBeNull();
    expect(dueEmail(account({ createdAt: NOW - H, optedOut: true }), NOW)).toBeNull();
  });

  it('writes to someone quiet for two weeks, at most once in 90 days', () => {
    const quiet = account({ createdAt: NOW - 60 * D, lastUsedAt: NOW - 15 * D });
    expect(dueEmail(quiet, NOW)).toBe('comeback');
    expect(dueEmail({ ...quiet, sent: [{ kind: logKind('comeback', NOW - 40 * D), at: NOW - 40 * D }] }, NOW)).toBeNull();
    expect(dueEmail(account({ createdAt: NOW - 60 * D, lastUsedAt: NOW - 40 * D }), NOW)).toBeNull();
    expect(dueEmail(account({ createdAt: NOW - 60 * D, lastUsedAt: NOW - 2 * D }), NOW)).toBeNull();
    expect(dueEmail({ ...quiet, pro: true }, NOW)).toBeNull();
  });
});

describe('the link that stops them', () => {
  const id = '6f1c2b0e-8a3d-4c55-9b1e-2d7f00a1c9e4';
  it('works only as the server made it', async () => {
    const token = await optOutToken(id, 'secret');
    expect(await readOptOutToken(token, 'secret')).toBe(id);
    expect(await readOptOutToken(token, 'other')).toBeNull();
    expect(await readOptOutToken(`${id}.${'0'.repeat(32)}`, 'secret')).toBeNull();
    expect(await readOptOutToken('nonsense', 'secret')).toBeNull();
  });
});

describe('the e-mails', () => {
  const base = { now: NOW, unsubscribeUrl: 'https://x.test/optout?t=1', week: null };
  const week = { kommun: 'Nacka', slug: 'nacka', thisWeek: 42, lastWeek: 30, top: { name: 'Stöld', count: 9 } };

  it('tells what happened in your kommun on day 3', () => {
    const mail = lifecycleEmail('day3', { ...base, week });
    expect(mail.subject).toBe('42 händelser i Nacka senaste veckan');
    expect(mail.html).toContain('+40 %');
    expect(mail.html).toContain('https://crimealert.se/kommun/nacka?utm_source=mejl&amp;utm_campaign=day3');
    expect(mail.text).toContain('Stöld (9)');
  });

  it('asks you to choose a kommun when you have none', () => {
    expect(lifecycleEmail('day3', base).subject).toBe('Vad händer där du bor?');
  });

  it('offers the trial that is on, at the real prices', () => {
    expect(trialDays(Date.parse('2026-11-29T12:00:00Z'))).toBe(30);
    const mail = lifecycleEmail('day7', base);
    expect(mail.subject).toBe('Prova Pro gratis i 7 dagar');
    expect(mail.text).toContain('19 kr i månaden');
  });

  it('always has the way out', () => {
    for (const kind of ['welcome', 'day3', 'day7', 'comeback'] as const) {
      const mail = lifecycleEmail(kind, base);
      expect(mail.html).toContain('https://x.test/optout?t=1');
      expect(mail.text).toContain('Avregistrera dig: https://x.test/optout?t=1');
    }
  });

  it('escapes what comes from the data', () => {
    const mail = lifecycleEmail('comeback', { ...base, week: { ...week, top: { name: '<b>x</b>', count: 1 } } });
    expect(mail.html).not.toContain('<b>x</b>');
  });
});

describe('the e-mails follow the plans', () => {
  it('take prices and what Pro gives from planFacts', async () => {
    const facts = await import('../../supabase/functions/_shared/planFacts');
    const mail = lifecycleEmail('day7', { now: NOW, unsubscribeUrl: 'https://x.test/u', week: null });
    expect(mail.text).toContain(`${facts.MONTHLY_KR} kr i månaden`);
    expect(mail.text).toContain(`${facts.YEARLY_KR} kr om året`);
    expect(mail.subject).toBe(`Prova Pro gratis i ${facts.trialDays(NOW)} dagar`);
    for (const key of ['live', 'push', 'description', 'analysis'] as const) {
      expect(mail.text).toContain(facts.PRO_FEATURE_TEXTS.find((f) => f.key === key)!.text);
    }
  });
});

describe('the welcome to Pro', () => {
  it('lists everything Pro gives, as the plans say it', async () => {
    const facts = await import('../../supabase/functions/_shared/planFacts');
    const mail = lifecycleEmail('pro_welcome', { now: NOW, unsubscribeUrl: 'https://x.test/u', week: null });
    expect(mail.subject).toBe('Välkommen till CrimeAlert Pro');
    for (const f of facts.PRO_FEATURE_TEXTS) expect(mail.text).toContain(f.text.replace(/ \(.*\)$/, ''));
    expect(mail.text).not.toContain('frågor per dag utan Pro');
    expect(mail.text).toContain('Avregistrera dig: https://x.test/u');
  });
});
