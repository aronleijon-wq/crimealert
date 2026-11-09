// How the chat room (NativeChatRoom) groups messages, as Messages does: a small time heading when
// the day changes or after a quiet hour, and one name and one avatar for a run of messages from
// the same person within a few minutes.

export interface ChatMessage {
  id: string;
  user_id: string;
  text: string;
  created_at: string;
}

export interface ChatItem<T extends ChatMessage> {
  message: T;
  /** "Idag 14:32", "Igår 09:10", "lördag 7 nov 21:03": when the day changes or after a quiet hour */
  day: string | null;
  /** The first of a run: show the name */
  first: boolean;
  /** The last of a run: show the avatar and time */
  last: boolean;
}

const RUN_MS = 5 * 60 * 1000;
const QUIET_MS = 60 * 60 * 1000;
const dayKey = (ms: number) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ms);

export function dayLabel(ms: number, now = Date.now()): string {
  if (dayKey(ms) === dayKey(now)) return 'Idag';
  if (dayKey(ms) === dayKey(now - 86400000)) return 'Igår';
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', weekday: 'long', day: 'numeric', month: 'short' }).format(ms);
}

export const clock = (ms: number) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', hour: '2-digit', minute: '2-digit' }).format(ms);

/** Messages oldest first, as the room shows them */
export function chatItems<T extends ChatMessage>(messages: T[], now = Date.now()): ChatItem<T>[] {
  return messages.map((message, i) => {
    const at = Date.parse(message.created_at);
    const prev = messages[i - 1];
    const next = messages[i + 1];
    const prevAt = prev ? Date.parse(prev.created_at) : null;
    const nextAt = next ? Date.parse(next.created_at) : null;
    const newDay = prevAt === null || dayKey(prevAt) !== dayKey(at);
    const heading = newDay || at - prevAt! >= QUIET_MS;
    const sameAsPrev = !!prev && !heading && prev.user_id === message.user_id && at - prevAt! < RUN_MS;
    const sameAsNext = !!next && dayKey(nextAt!) === dayKey(at) && next.user_id === message.user_id && nextAt! - at < RUN_MS;
    return { message, day: heading ? `${dayLabel(at, now)} ${clock(at)}` : null, first: !sameAsPrev, last: !sameAsNext };
  });
}

/** A steady, quiet colour per person, for the avatar behind their initial */
const COLORS = ['#8e8e93', '#7d7a8c', '#6e8597', '#8a7f72', '#728a7a', '#8f7680', '#6f7690', '#86826a'];
export function personColor(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0;
  return COLORS[Math.abs(h) % COLORS.length];
}
