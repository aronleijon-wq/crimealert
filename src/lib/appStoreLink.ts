/** CrimeAlert's page in the Swedish App Store (app id 6826326029). */
export const APP_STORE_ID = '6826326029';
export const APP_STORE_URL = `https://apps.apple.com/se/app/crimealert-brottsplatskarta/id${APP_STORE_ID}`;

/**
 * Black Week in the app for Apple IDs that have had their free trial: a custom offer code in App
 * Store Connect (CrimeAlert Pro, Offer Codes: this code, free for 1 month, for new and expired
 * subscribers, through 30 November). The App Store redeems it; the app's transaction listener
 * (NativeAppBridge) then gives the account Pro.
 */
export const BLACK_WEEK_OFFER_CODE = 'BLACKWEEK';
export const offerCodeUrl = (code: string) =>
  `https://apps.apple.com/redeem?ctx=offercodes&id=${APP_STORE_ID}&code=${encodeURIComponent(code)}`;
