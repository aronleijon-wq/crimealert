import { useEffect } from "react";
import { isNativeApp } from "@/lib/native";
import { loadGoogleAds } from "@/lib/googleAds";

/** Loads the Google Ads tag. Consent comes from Google's own cookie box (Funding Choices), which updates Consent Mode. */
const CookieBanner = () => {
  useEffect(() => { if (!isNativeApp()) void loadGoogleAds(); }, []);
  return null;
};
export default CookieBanner;
