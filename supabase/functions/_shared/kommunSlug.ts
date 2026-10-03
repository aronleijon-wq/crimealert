// The address of a kommun's page on crimealert.se (/kommun/malmo). Shared by the app's kommun
// pages and the weekly summary notification, which links to them.

// Habo and Håbo would both be "habo"; Håbo takes the Nordic spelling of å
const SLUG_OVERRIDES: Record<string, string> = { Håbo: 'haabo' };

/** "Malmö" → "malmo", "Upplands Väsby" → "upplands-vasby", "Dals-Ed" → "dals-ed". */
export function kommunSlug(name: string): string {
  if (SLUG_OVERRIDES[name]) return SLUG_OVERRIDES[name];
  return name
    .toLocaleLowerCase('sv-SE')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
