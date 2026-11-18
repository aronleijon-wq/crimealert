# Project rules

- Google Ads is off (`GOOGLE_ADS_ENABLED` in src/lib/googleAds.ts and `CA_GOOGLE_ADS` in index.html, kept equal by a test). When on, the tag loads only after the visitor's yes in CrimeAlert's own cookie box (components/CookieBanner) or outside the regions that need consent: from the inline script at the top of index.html head for a stored yes, so Google's tag check finds it, otherwise from loadGoogleAds(); the `data-google-ads` attribute keeps it from loading twice. Never in the iPhone app. There is no AdSense and no Google cookie box.
