import { useAuth } from '@/hooks/useAuth';

const PREMIUM_PRODUCT_ID = 'prod_U0Hqae7g588978';
const PREMIUM_PRODUCT_ID_YEARLY = 'prod_U0ILfpJlo9MMlW';

export function useIsPremium() {
  const { user, subscription } = useAuth();
  const isPremium = subscription.subscribed && 
    (subscription.productId === PREMIUM_PRODUCT_ID || subscription.productId === PREMIUM_PRODUCT_ID_YEARLY);
  const isLoggedIn = !!user;
  return { isPremium, isLoggedIn };
}
