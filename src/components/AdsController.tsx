import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useIsPremium } from '@/hooks/useIsPremium';
import { adsAllowedOn, adsDecision, hideAds, showAds } from '@/lib/ads';
import { isNativeApp } from '@/lib/native';

/** Turns AdSense on for free users on pages with our own content, and off for Pro. Renders nothing. */
const AdsController = () => {
  const { pathname } = useLocation();
  const { user, loading, subscriptionChecked } = useAuth();
  const { isPremium } = useIsPremium();
  const decision = !isNativeApp() && adsAllowedOn(pathname) ? adsDecision({ loading, signedIn: !!user, subscriptionChecked, isPremium }) : 'hide';

  useEffect(() => {
    if (decision === 'show') showAds();
    else if (decision === 'hide') hideAds();
  }, [decision]);

  return null;
};

export default AdsController;
