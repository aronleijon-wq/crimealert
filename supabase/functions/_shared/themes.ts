// Polisen's categories ("Skottlossning", "Inbrott, försök") grouped as people talk about them:
// the Statistik tab's trends (src/native/stats.ts) and the choice of what to get notifications
// about (notifications.ts) use the same groups.

export interface Theme {
  id: string;
  label: string;
  /** "skjutningar" in a sentence */
  plural: string;
  match: RegExp;
  /** "en skjutning", for kinds where "days since the last one" says something */
  one?: string;
}

/** Polisen's categories grouped as people talk about them; the first match wins */
export const THEMES: Theme[] = [
  { id: 'skjutning', label: 'Skjutningar', plural: 'skjutningar', match: /skottlossning/i, one: 'en skjutning' },
  { id: 'sprangning', label: 'Sprängningar', plural: 'sprängningar', match: /detonation|explosion|sprängning/i, one: 'en sprängning' },
  { id: 'mord', label: 'Mord och dråp', plural: 'mord och dråp', match: /mord|dråp/i, one: 'mord eller dråp' },
  { id: 'ran', label: 'Rån', plural: 'rån', match: /^rån/i, one: 'ett rån' },
  { id: 'misshandel', label: 'Misshandel', plural: 'misshandelsfall', match: /misshandel/i },
  { id: 'inbrott', label: 'Inbrott', plural: 'inbrott', match: /inbrott/i },
  { id: 'stold', label: 'Stölder', plural: 'stölder', match: /stöld/i },
  { id: 'hot', label: 'Olaga hot', plural: 'fall av olaga hot', match: /olaga hot/i },
  { id: 'bedrageri', label: 'Bedrägerier', plural: 'bedrägerier', match: /bedrägeri/i },
  { id: 'narkotika', label: 'Narkotikabrott', plural: 'narkotikabrott', match: /narkotika/i },
  { id: 'rattfylleri', label: 'Rattfylleri', plural: 'rattfyllerier', match: /rattfylleri/i },
  { id: 'brand', label: 'Bränder', plural: 'bränder', match: /brand/i },
  { id: 'trafik', label: 'Trafikolyckor', plural: 'trafikolyckor', match: /trafikolycka/i },
];

const themeCache = new Map<string, Theme | null>();

export function themeOf(category: string): Theme | null {
  let theme = themeCache.get(category);
  if (theme === undefined) themeCache.set(category, (theme = THEMES.find((t) => t.match.test(category)) ?? null));
  return theme;
}
