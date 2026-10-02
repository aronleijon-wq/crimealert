import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useIsPremium } from '@/hooks/useIsPremium';
import { adsDecision, hideAds, showAds } from '@/lib/ads';

/** Turns AdSense on for free users and off for Pro. Renders nothing. */
const AdsController = () => {
  const { user, loading, subscriptionChecked } = useAuth();
  const { isPremium } = useIsPremium();
  const decision = adsDecision({ loading, signedIn: !!user, subscriptionChecked, isPremium });

  useEffect(() => {
    if (decision === 'show') showAds();
    else if (decision === 'hide') hideAds();
  }, [decision]);

  return null;
};

export default AdsController;
