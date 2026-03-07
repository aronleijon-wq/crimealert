import { useAuth } from '@/hooks/useAuth';

const PREMIUM_PRODUCT_ID_MONTHLY = 'prod_U0dsMg8IZZKY7c';
const PREMIUM_PRODUCT_ID_YEARLY = 'prod_U0duDYNoEp8JXS';

export function useIsPremium() {
  const { user, subscription } = useAuth();
  const isPremium = subscription.subscribed && 
    (subscription.productId === PREMIUM_PRODUCT_ID || subscription.productId === PREMIUM_PRODUCT_ID_YEARLY);
  const isLoggedIn = !!user;
  return { isPremium, isLoggedIn };
}
