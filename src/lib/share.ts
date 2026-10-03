// Sharing one event: its own address, the device's share sheet, and our own share menu where
// the browser has no share sheet (most desktop browsers outside Safari and Edge, Firefox,
// and pages inside a frame such as Lovable's preview).

import { cleanPoliceTitle } from '@/lib/feed';

/** The event's own page, on the site the visitor is on. */
export const eventPath = (id: string) => `/handelse/${encodeURIComponent(id)}`;
export const eventUrl = (id: string, origin = window.location.origin) => `${origin}${eventPath(id)}`;

export type ShareResult = 'shared' | 'cancelled' | 'unsupported';

export interface ShareContent {
  title: string;
  text: string;
  url: string;
}

/** What a shared event says: its readable title, and a line for messages. */
export function shareContent(event: { id: string; title: string }, origin?: string): ShareContent {
  const title = cleanPoliceTitle(event.title);
  return { title, text: `${title} – på CrimeAlert`, url: eventUrl(event.id, origin) };
}

/**
 * Opens the device's share sheet (Meddelanden, AirDrop, WhatsApp …). 'unsupported' when there is
 * none, or the browser refused it, so the caller shows its own menu instead.
 */
export async function shareEvent(event: { id: string; title: string }): Promise<ShareResult> {
  const content = shareContent(event);
  if (typeof navigator.share !== 'function') return 'unsupported';
  if (typeof navigator.canShare === 'function' && !navigator.canShare(content)) return 'unsupported';
  try {
    await navigator.share(content);
    return 'shared';
  } catch (error) {
    // Closing the sheet is a choice, not a failure
    if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    return 'unsupported';
  }
}

export interface ShareTarget {
  id: 'sms' | 'whatsapp' | 'messenger' | 'telegram' | 'mail' | 'facebook' | 'x';
  label: string;
  href: string;
}

/** Where our own menu can send the event. Messages and Messenger only where there is an app for them. */
export function shareTargets({ title, text, url }: ShareContent, { mobile }: { mobile: boolean }): ShareTarget[] {
  const e = encodeURIComponent;
  const message = `${text} ${url}`;
  const targets: (ShareTarget | false)[] = [
    mobile && { id: 'sms', label: 'Meddelanden', href: `sms:?&body=${e(message)}` },
    { id: 'whatsapp', label: 'WhatsApp', href: `https://wa.me/?text=${e(message)}` },
    mobile && { id: 'messenger', label: 'Messenger', href: `fb-messenger://share/?link=${e(url)}` },
    { id: 'telegram', label: 'Telegram', href: `https://t.me/share/url?url=${e(url)}&text=${e(text)}` },
    { id: 'mail', label: 'Mail', href: `mailto:?subject=${e(title)}&body=${e(message)}` },
    { id: 'facebook', label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${e(url)}` },
    { id: 'x', label: 'X', href: `https://x.com/intent/post?text=${e(text)}&url=${e(url)}` },
  ];
  return targets.filter((t): t is ShareTarget => !!t);
}

/** Copies the link; falls back to the old copy command where the clipboard API is blocked. */
export async function copyLink(url: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    try {
      const field = document.createElement('textarea');
      field.value = url;
      field.setAttribute('readonly', '');
      field.style.position = 'fixed';
      field.style.opacity = '0';
      document.body.appendChild(field);
      field.select();
      const ok = document.execCommand('copy');
      field.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/** Police events have a page of their own; Trafikverket, crisis messages and citizen reports don't. */
export const isPoliceEvent = (incident: { type: string; source?: string }) =>
  incident.type !== 'trafikverket' && incident.type !== 'crisis' && incident.source !== 'Medborgarrapport';
