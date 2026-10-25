// Why a notification to the iPhone app didn't arrive, in words the owner can act on. The test
// notification (send-push-notifications, mode "test") answers per device with Apple's reason.

interface TestResult {
  endpoint?: string;
  ok?: boolean;
  error?: string;
}

export interface TestAnswer {
  sent?: number;
  error?: string;
  results?: TestResult[];
}

const REASONS: [RegExp, string][] = [
  [/\.p8\) gick inte att läsa|decode base64/, 'Apple-nyckeln är fel inklistrad i Lovable. Öppna .p8-filen, kopiera allt och klistra in det på nytt i APNS_PRIVATE_KEY.'],
  [/APNS_KEY_ID|APNS_TEAM_ID|APNS_PRIVATE_KEY/, 'Apple-nyckeln saknas på servern. Lägg in APNS_KEY_ID, APNS_TEAM_ID och APNS_PRIVATE_KEY som secrets i Lovable.'],
  [/InvalidProviderToken|ExpiredProviderToken|MissingProviderToken/, 'Apple godkänner inte nyckeln. Kontrollera Key ID, Team ID och att hela .p8-filen är inklistrad.'],
  [/TopicDisallowed|DeviceTokenNotForTopic|BadTopic/, 'Nyckeln eller adressen hör inte till appen se.crimealert.app.'],
  [/BadDeviceToken|Unregistered/, 'Telefonens adress hos Apple gäller inte längre. Stäng av och slå på notiser igen.'],
  [/Ingen sparad push subscription/, 'Telefonen är inte registrerad hos servern. Stäng av och slå på notiser igen.'],
];

/** The reason for a failed test notification, or null when it was sent */
export function testFailureReason(answer: TestAnswer | null | undefined): string | null {
  if (answer?.sent) return null;
  const apns = (answer?.results ?? []).filter((r) => r.endpoint?.startsWith('apns:'));
  if (answer?.results && !apns.length) return 'Telefonen är inte registrerad hos servern. Stäng av och slå på notiser igen.';
  const text = [answer?.error, ...apns.map((r) => r.error)].filter(Boolean).join(' ');
  const known = REASONS.find(([pattern]) => pattern.test(text));
  if (known) return known[1];
  return text ? `Apple svarade: ${text}` : 'Testnotisen kom inte fram.';
}

/** Why the phone couldn't turn notifications on, from iOS's own message */
export function registerFailureReason(message: string | null | undefined): string | null {
  if (!message) return null;
  if (/aps-environment/i.test(message)) return 'Det här bygget saknar notisbehörighet (Push Notifications). Bygg om appen med Push Notifications påslaget för appen.';
  return message;
}
