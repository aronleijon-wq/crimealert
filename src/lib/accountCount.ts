// "Gör som över 500 andra nöjda användare" on Skapa konto: the number of accounts in whole hundreds, from
// account_count. Asked for at most every six hours per browser.
import { supabase } from '@/integrations/supabase/client';

const KEY = 'crimealert-account-count';
const MAX_AGE = 6 * 60 * 60 * 1000;
/** Below this the number says more about how new the service is than about who uses it */
export const ACCOUNT_COUNT_MIN = 100;

/** The number this browser was given less than six hours ago, if any. */
export const rememberedAccountCount = (now = Date.now()): number | null => {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { count: number; at: number } | null;
    return saved && now - saved.at < MAX_AGE && Number.isInteger(saved.count) ? saved.count : null;
  } catch {
    return null;
  }
};

/** The whole hundreds below the number of accounts, or null if it can't be had right now. */
export async function loadAccountCount(now = Date.now()): Promise<number | null> {
  const saved = rememberedAccountCount(now);
  if (saved !== null) return saved;
  const { data, error } = await supabase.rpc('account_count');
  if (error || typeof data !== 'number') return null;
  try {
    localStorage.setItem(KEY, JSON.stringify({ count: data, at: now }));
  } catch {
    // Private mode: ask again next time
  }
  return data;
}

/** "över 1 200", or null while there are too few to mention. */
export const accountCountLabel = (count: number | null) =>
  count !== null && count >= ACCOUNT_COUNT_MIN ? `över ${count.toLocaleString('sv-SE')}` : null;
