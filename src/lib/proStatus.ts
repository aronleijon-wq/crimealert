// pro_status holds what check-subscription last found for each user (see migration
// 20261003090000_pro_status.sql). The app reads its own row when check-subscription can't answer,
// so a free account still gets its ads and a Pro account its Pro features.

import type { SubscriptionState } from '@/hooks/useAuth';

const PRO_PRODUCT_ID = 'prod_U0dsMg8IZZKY7c';

/** The subscription a remembered pro_until stands for: Pro until then ('infinity': for good), else free. */
export function subscriptionFromProStatus(proUntil: string | null | undefined, now = Date.now()): SubscriptionState {
  if (proUntil === 'infinity') return { subscribed: true, productId: PRO_PRODUCT_ID, subscriptionEnd: 'lifetime' };
  if (proUntil && Date.parse(proUntil) > now) return { subscribed: true, productId: PRO_PRODUCT_ID, subscriptionEnd: proUntil };
  return { subscribed: false, productId: null, subscriptionEnd: null };
}
