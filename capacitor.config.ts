import type { CapacitorConfig } from '@capacitor/cli';

// The iPhone app (ios/): a native shell that opens crimealert.se, so the app is always as new
// as the site and needs no new App Store version for each change. The site sees the app by
// "CrimeAlertApp" in the user agent and Capacitor's bridge (src/lib/native.ts). Links to
// other sites open in Safari. native/www holds the page shown when there is no connection.
const config: CapacitorConfig = {
  appId: 'se.crimealert.app',
  appName: 'CrimeAlert',
  webDir: 'native/www',
  backgroundColor: '#05080b',
  appendUserAgent: 'CrimeAlertApp',
  server: {
    url: 'https://crimealert.se/karta',
    errorPath: 'index.html',
  },
  ios: {
    // The site already keeps clear of the notch and home bar (viewport-fit=cover)
    contentInset: 'never',
    backgroundColor: '#05080b',
  },
};

export default config;
