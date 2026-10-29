// Pro bought in the iPhone app, through Apple (CrimeAlertStorePlugin in ios/App/App/AppDelegate.swift).
// The phone buys and holds the subscription; the server (apple-subscription) asks Apple what it
// gives and stores it with the account, so Pro works on the website too.
import { supabase } from '@/integrations/supabase/client';
import { nativePlugin } from '@/lib/nativeApp';

/** Must match the subscriptions in App Store Connect (and supabase/functions/_shared/appStore.ts) */
export const APPLE_PRO_PRODUCTS = { monthly: 'crimealert.pro.monthly', yearly: 'crimealert.pro.yearly' } as const;

export interface StoreProduct {
  id: string;
  title: string;
  description: string;
  /** In the user's own currency, as Apple shows it ("19,00 kr") */
  price: string;
  amount: number;
  /** ISO 4217, "SEK" */
  currency: string;
  /** "1 month", "1 year" */
  period?: string;
  /** A free trial this Apple ID can still get, e.g. "1 week" */
  trial?: string;
}

interface StorePlugin {
  products(options: { ids: string[] }): Promise<{ products: StoreProduct[] }>;
  purchase(options: { productId: string; accountId: string }): Promise<{ transactionId?: string; pending?: boolean }>;
  entitlements(): Promise<{ transactionIds: string[] }>;
  restore(): Promise<{ transactionIds: string[] }>;
  manage(): Promise<void>;
  addListener(event: 'transaction', listener: (data: { transactionId: string }) => void): Promise<{ remove: () => Promise<void> }>;
}

export const nativeStore = () => nativePlugin<StorePlugin>('CrimeAlertStore');

const UNITS: Record<string, [string, string]> = {
  day: ['dag', 'dagar'],
  week: ['vecka', 'veckor'],
  month: ['månad', 'månader'],
  year: ['år', 'år'],
};

/** "1 month" → "månad", "3 month" → "3 månader", "1 week" → "1 vecka" (for trials, with the number) */
export function periodLabel(period: string | undefined, withOne = false): string {
  const [count, unit] = (period ?? '').split(' ');
  const words = UNITS[unit];
  if (!words) return '';
  const n = Number(count);
  if (n === 1) return withOne ? `1 ${words[0]}` : words[0];
  return `${n} ${words[1]}`;
}

export interface SyncResult {
  pro: boolean;
  /** The subscription belongs to another CrimeAlert account */
  otherAccount: boolean;
}

/** Has the server ask Apple about these transactions and store what they give the account. */
export async function syncApplePurchases(transactionIds: string[]): Promise<SyncResult> {
  if (!transactionIds.length) return { pro: false, otherAccount: false };
  const { data, error } = await supabase.functions.invoke<{ pro?: boolean; other_account?: boolean; error?: string }>('apple-subscription', {
    body: { transactionIds },
  });
  if (error || !data || data.error) throw new Error(data?.error ?? 'Kunde inte kontrollera köpet just nu.');
  return { pro: data.pro === true, otherAccount: data.other_account === true };
}

export type PurchaseOutcome = 'pro' | 'pending' | 'cancelled' | 'other_account';

/** Buys a Pro subscription for the signed-in account and has the server check it with Apple. */
export async function buyPro(productId: string, accountId: string): Promise<PurchaseOutcome> {
  const store = await nativeStore();
  if (!store) throw new Error('Uppdatera appen för att köpa Pro.');
  let result: { transactionId?: string; pending?: boolean };
  try {
    result = await store.purchase({ productId, accountId });
  } catch (error) {
    if ((error as { code?: string }).code === 'CANCELLED') return 'cancelled';
    throw error;
  }
  if (result.pending || !result.transactionId) return 'pending';
  const { pro, otherAccount } = await syncApplePurchases([result.transactionId]);
  if (otherAccount) return 'other_account';
  if (!pro) throw new Error('Köpet är gjort, men Pro syns inte än. Tryck på Återställ köp om en stund.');
  return 'pro';
}

/** "Återställ köp": what this Apple ID has bought, given to the signed-in account. */
export async function restorePro(): Promise<SyncResult & { found: boolean }> {
  const store = await nativeStore();
  if (!store) throw new Error('Uppdatera appen för att återställa köp.');
  const { transactionIds } = await store.restore();
  if (!transactionIds.length) return { pro: false, otherAccount: false, found: false };
  return { ...(await syncApplePurchases(transactionIds)), found: true };
}
