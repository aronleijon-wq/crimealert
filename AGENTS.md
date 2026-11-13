# Project rules

- The Google Ads tag is loaded by the inline script at the top of index.html head (skipped in the iPhone app by its user agent); loadGoogleAds() only backs it up, so Google's tag check finds the tag and it is never loaded twice.
