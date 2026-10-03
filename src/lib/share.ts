// Sharing one event: its own address, and the phone's share sheet or a copied link.

import { cleanPoliceTitle } from '@/lib/feed';

/** The event's own page, on the site the visitor is on. */
export const eventPath = (id: string) => `/handelse/${encodeURIComponent(id)}`;
export const eventUrl = (id: string, origin = window.location.origin) => `${origin}${eventPath(id)}`;

export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed';

/** Opens the share sheet where there is one (phones), else copies the link. */
export async function shareEvent(event: { id: string; title: string; area?: string }): Promise<ShareResult> {
  const url = eventUrl(event.id);
  const title = cleanPoliceTitle(event.title);
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text: `${title} – på CrimeAlert`, url });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      // Some browsers refuse share() outside a direct tap; fall back to copying
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'failed';
  }
}

/** Police events have a page of their own; Trafikverket, crisis messages and citizen reports don't. */
export const isPoliceEvent = (incident: { type: string; source?: string }) =>
  incident.type !== 'trafikverket' && incident.type !== 'crisis' && incident.source !== 'Medborgarrapport';
