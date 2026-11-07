// Notifications when someone writes in a thread you have written in: under an event, or in a
// kommun's discussion ("kommun:nacka"). send-push-notifications sends them (mode "reply").
import { SWEDISH_MUNICIPALITIES } from './data/municipalities.ts';
import { kommunSlug } from './kommunSlug.ts';

/** Threads that belong to a kommun's discussion rather than to one event */
export const KOMMUN_THREAD = 'kommun:';

export const kommunThreadId = (kommun: string) => `${KOMMUN_THREAD}${kommunSlug(kommun)}`;

export interface ThreadComment {
  id: string;
  user_id: string;
  created_at: string;
}

/**
 * Who to tell about a new comment: everyone else who has written in the thread, once per round.
 * Someone who has already heard of a comment since they last wrote is not told again until they
 * write again, so a busy thread doesn't buzz their phone for every message. Those who blocked
 * the author are left out.
 */
export function replyRecipients(thread: ThreadComment[], comment: ThreadComment, blockedAuthor: Set<string>, max = 50): string[] {
  const at = Date.parse(comment.created_at);
  const before = thread.filter((c) => c.id !== comment.id && Date.parse(c.created_at) <= at);
  const lastOwn = new Map<string, number>();
  for (const c of before) lastOwn.set(c.user_id, Math.max(lastOwn.get(c.user_id) ?? 0, Date.parse(c.created_at)));
  const recipients: string[] = [];
  for (const [userId, own] of lastOwn) {
    if (userId === comment.user_id || blockedAuthor.has(userId)) continue;
    const alreadyTold = before.some((c) => c.user_id !== userId && Date.parse(c.created_at) > own);
    if (!alreadyTold) recipients.push(userId);
  }
  return recipients.slice(0, max);
}

/** Where the notification opens: the event, or the kommun's discussion */
export function threadPath(threadId: string): string {
  if (threadId.startsWith(KOMMUN_THREAD)) return `/kommun/${threadId.slice(KOMMUN_THREAD.length)}?chatt=1`;
  return `/handelse/${encodeURIComponent(threadId)}?chatt=1`;
}

/** "diskussionen om Nacka", or "tråden om Inbrott, Malmö" from the event's title */
export function threadPlace(threadId: string, eventTitle: string | null): string {
  if (threadId.startsWith(KOMMUN_THREAD)) {
    const slug = threadId.slice(KOMMUN_THREAD.length);
    const name = SWEDISH_MUNICIPALITIES.find((m) => kommunSlug(m.name) === slug)?.name;
    return name ? `diskussionen om ${name}` : 'en diskussion';
  }
  if (!eventTitle) return 'en tråd du skrivit i';
  // Polisen's titles start with the date: "07 november 12.00, Inbrott, Malmö"
  const parts = eventTitle.split(',').map((p) => p.trim());
  return `tråden om ${parts.length >= 3 && /\d/.test(parts[0]) ? parts.slice(1).join(', ') : eventTitle}`;
}

export function replyMessage({ author, text, place }: { author: string; text: string; place: string }) {
  const clean = text.replace(/\s+/g, ' ').trim();
  return {
    title: `${author || 'Någon'} svarade i ${place}`,
    body: clean.length > 140 ? `${clean.slice(0, 139)}…` : clean,
  };
}
