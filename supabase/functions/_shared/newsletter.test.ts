import { describe, expect, it, vi } from 'vitest';

vi.stubGlobal('Deno', { env: { get: () => undefined } });
const { addContact, contactsUrl, listable, removeContact, syncNewsletterContact } = await import('./newsletter');

const env = { apiKey: 're_test', audienceId: 'aud_1' };
const reply = (status: number, body = '{}') => vi.fn(async () => new Response(body, { status }));

function fakeDb(existing: boolean) {
  const upserts: unknown[] = [];
  const db = {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: existing ? { user_id: 'u1' } : null, error: null }) }) }),
      upsert: async (row: unknown) => { upserts.push(row); return { error: null }; },
    }),
  };
  return { db, upserts };
}

const user = { id: 'u1', email: 'Anna@Example.se', email_confirmed_at: '2026-11-07T10:00:00Z' };

describe('the newsletter list', () => {
  it('goes to the audience when there is one', () => {
    expect(contactsUrl('aud_1')).toBe('https://api.resend.com/audiences/aud_1/contacts');
    expect(contactsUrl()).toBe('https://api.resend.com/contacts');
  });

  it('takes confirmed addresses only', () => {
    expect(listable(user)).toBe(true);
    expect(listable({ ...user, email_confirmed_at: null })).toBe(false);
    expect(listable({ ...user, email: 'inte-en-adress' })).toBe(false);
  });

  it('adds an address once, without touching whether it was unsubscribed', async () => {
    const fetcher = reply(200);
    expect(await addContact(env, 'Anna@Example.se', fetcher)).toBe('added');
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/audiences/aud_1/contacts');
    expect(JSON.parse(init.body as string)).toEqual({ email: 'anna@example.se' });
    expect(await addContact(env, 'a@b.se', reply(409))).toBe('exists');
    expect(await addContact(env, 'a@b.se', reply(422, '{"message":"Contact already exists"}'))).toBe('exists');
    expect(await addContact(env, 'a@b.se', reply(500))).toBe('failed');
    expect(await addContact({ apiKey: undefined, audienceId: undefined }, 'a@b.se', reply(200))).toBe('failed');
  });

  it('remembers who was added, and asks Resend only for new accounts', async () => {
    const fresh = fakeDb(false);
    const fetcher = reply(200);
    expect(await syncNewsletterContact(fresh.db, user, env, fetcher)).toBe('added');
    expect(fresh.upserts).toEqual([expect.objectContaining({ user_id: 'u1', email: 'anna@example.se' })]);

    const known = fakeDb(true);
    const again = reply(200);
    expect(await syncNewsletterContact(known.db, user, env, again)).toBe('skipped');
    expect(again).not.toHaveBeenCalled();

    // Not remembered when Resend failed, so the next sign-in tries again
    const failing = fakeDb(false);
    expect(await syncNewsletterContact(failing.db, user, env, reply(500))).toBe('failed');
    expect(failing.upserts).toEqual([]);
  });

  it('removes the contact when the account is deleted', async () => {
    const fetcher = reply(200);
    expect(await removeContact(env, 'Anna@Example.se', fetcher)).toBe(true);
    expect((fetcher.mock.calls[0] as unknown as [string])[0]).toBe('https://api.resend.com/audiences/aud_1/contacts/anna%40example.se');
    expect(await removeContact(env, 'a@b.se', reply(404))).toBe(true);
  });
});
