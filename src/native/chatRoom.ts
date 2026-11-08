// How the chat room (NativeChatRoom) groups messages: a day heading when the day changes, and
// one name and one time for a run of messages from the same person within a few minutes.

export interface ChatMessage {
  id: string;
  user_id: string;
  text: string;
  created_at: string;
}

export interface ChatItem<T extends ChatMessage> {
  message: T;
  /** "Idag", "Igår", "lördag 7 nov", when the day changes before this message */
  day: string | null;
  /** The first of a run: show the name */
  first: boolean;
  /** The last of a run: show the avatar and time */
  last: boolean;
}

const RUN_MS = 5 * 60 * 1000;
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
    const sameAsPrev = !!prev && !newDay && prev.user_id === message.user_id && at - prevAt! < RUN_MS;
    const sameAsNext = !!next && dayKey(nextAt!) === dayKey(at) && next.user_id === message.user_id && nextAt! - at < RUN_MS;
    return { message, day: newDay ? dayLabel(at, now) : null, first: !sameAsPrev, last: !sameAsNext };
  });
}

/** A steady colour per person, for their initial */
const COLORS = ['#ff453a', '#ff9f0a', '#30d158', '#0a84ff', '#bf5af2', '#ff375f', '#64d2ff', '#5e5ce6'];
export function personColor(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0;
  return COLORS[Math.abs(h) % COLORS.length];
}
