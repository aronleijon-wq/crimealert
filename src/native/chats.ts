// The kommun discussions at a glance (NativeChats): the latest message in each kommun you watch,
// and the discussions most alive right now, from the newest comments in kommun threads.
import { kommunFromSlug, kommunSlug } from '@/lib/kommunPages';
import { KOMMUN_THREAD } from '../../supabase/functions/_shared/replies';

export interface ThreadRow {
  incident_id: string;
  user_id: string;
  text: string;
  created_at: string;
}

export interface ChatSummary {
  kommun: string;
  last: ThreadRow | null;
  /** Messages in the last 24 hours */
  today: number;
}

const DAY = 24 * 60 * 60 * 1000;

/** Rows newest first. Your kommuner in your order; the most active others, up to `max` */
export function chatOverview(rows: ThreadRow[], watched: string[], now = Date.now(), max = 5): { mine: ChatSummary[]; active: ChatSummary[] } {
  const byKommun = new Map<string, ChatSummary>();
  for (const row of rows) {
    if (!row.incident_id.startsWith(KOMMUN_THREAD)) continue;
    const kommun = kommunFromSlug(row.incident_id.slice(KOMMUN_THREAD.length));
    if (!kommun) continue;
    const summary = byKommun.get(kommun) ?? { kommun, last: null, today: 0 };
    if (!summary.last || summary.last.created_at < row.created_at) summary.last = row;
    if (now - Date.parse(row.created_at) < DAY) summary.today++;
    byKommun.set(kommun, summary);
  }
  const mine = watched.map((k) => byKommun.get(k) ?? { kommun: k, last: null, today: 0 });
  const active = [...byKommun.values()]
    .filter((s) => !watched.includes(s.kommun) && s.today > 0)
    .sort((a, b) => b.today - a.today || (b.last?.created_at ?? '').localeCompare(a.last?.created_at ?? ''))
    .slice(0, max);
  return { mine, active };
}

/** The kommun's chat room in the app (NativeChatRoom) */
export const chatPath = (kommun: string) => `/chatt/${kommunSlug(kommun)}`;
