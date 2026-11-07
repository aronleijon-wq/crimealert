// The newsletter list in Resend: every account with a confirmed e-mail is added once, at its first
// sign-in after this (check-subscription), or by the backfill on the admin page
// (newsletter-backfill). newsletter_contacts remembers who has been added, so Resend is asked once
// per account. Adding never re-subscribes someone who unsubscribed: Resend keeps that, and an
// existing contact is left as it is. Deleting the account removes the contact (delete-account).
//
// RESEND_API_KEY is needed; RESEND_AUDIENCE_ID picks the list (Resend's audience). Without an
// audience the contact goes to Resend's contacts as a whole. Without the key, nothing happens.

export const RESEND_API = 'https://api.resend.com';

type Fetch = typeof fetch;

export interface NewsletterEnv {
  apiKey: string | undefined;
  audienceId: string | undefined;
}

export const newsletterEnv = (): NewsletterEnv => ({
  apiKey: Deno.env.get('RESEND_API_KEY') || undefined,
  audienceId: Deno.env.get('RESEND_AUDIENCE_ID') || undefined,
});

export const contactsUrl = (audienceId?: string) =>
  audienceId ? `${RESEND_API}/audiences/${encodeURIComponent(audienceId)}/contacts` : `${RESEND_API}/contacts`;

/** Whether an account's address should be on the list: confirmed, and a real address */
export function listable(user: { email?: string | null; email_confirmed_at?: string | null }): boolean {
  return !!user.email && !!user.email_confirmed_at && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(user.email);
}

export type AddResult = 'added' | 'exists' | 'failed';

/** Adds one address. A contact that is already there (subscribed or not) counts as done */
export async function addContact(env: NewsletterEnv, email: string, fetcher: Fetch = fetch): Promise<AddResult> {
  if (!env.apiKey) return 'failed';
  try {
    const res = await fetcher(contactsUrl(env.audienceId), {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.toLowerCase() }),
    });
    if (res.ok) return 'added';
    const text = await res.text().catch(() => '');
    if (res.status === 409 || /already exist/i.test(text)) return 'exists';
    console.warn('[newsletter] Resend said', res.status, text.slice(0, 200));
    return 'failed';
  } catch (error) {
    console.warn('[newsletter] could not reach Resend:', error instanceof Error ? error.message : error);
    return 'failed';
  }
}

export async function removeContact(env: NewsletterEnv, email: string, fetcher: Fetch = fetch): Promise<boolean> {
  if (!env.apiKey) return false;
  try {
    const res = await fetcher(`${contactsUrl(env.audienceId)}/${encodeURIComponent(email.toLowerCase())}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${env.apiKey}` },
    });
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ServiceClient = { from(table: string): any };

/** Adds the signed-in account to the list if it isn't there yet. Never throws */
export async function syncNewsletterContact(
  db: ServiceClient,
  user: { id: string; email?: string | null; email_confirmed_at?: string | null },
  env: NewsletterEnv = newsletterEnv(),
  fetcher: Fetch = fetch,
): Promise<AddResult | 'skipped'> {
  try {
    if (!env.apiKey || !listable(user)) return 'skipped';
    const { data, error } = await db.from('newsletter_contacts').select('user_id').eq('user_id', user.id).maybeSingle();
    // Before the migration has run, or when it can't be read: try another time
    if (error || data) return 'skipped';
    const result = await addContact(env, user.email!, fetcher);
    if (result !== 'failed') {
      await db.from('newsletter_contacts').upsert({ user_id: user.id, email: user.email!.toLowerCase(), synced_at: new Date().toISOString() }, { onConflict: 'user_id' });
    }
    return result;
  } catch (error) {
    console.warn('[newsletter] sync failed:', error instanceof Error ? error.message : error);
    return 'failed';
  }
}
