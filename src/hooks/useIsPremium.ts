import { useAuth } from '@/hooks/useAuth';

const PREMIUM_PRODUCT_ID = 'prod_U0Hqae7g588978';

export function useIsPremium() {
  const { user, subscription } = useAuth();
  const isPremium = subscription.subscribed && subscription.productId === PREMIUM_PRODUCT_ID;
  const isLoggedIn = !!user;
  return { isPremium, isLoggedIn };
}
