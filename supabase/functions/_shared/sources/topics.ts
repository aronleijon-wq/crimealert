// Safety topics recognised in headlines and police event types. Used to keep only relevant
// news articles and to connect news to police events about the same thing.

export type Topic =
  | 'brand' | 'trafik' | 'skjutning' | 'explosion' | 'kniv' | 'rån' | 'mord' | 'misshandel'
  | 'våldtäkt' | 'inbrott' | 'stöld' | 'narkotika' | 'försvunnen' | 'drunkning' | 'hot' | 'polis' | 'räddning';

const TOPIC_PATTERNS: Record<Topic, RegExp> = {
  brand: /\b(brand|bränder|brann|brinner|brinnande|eldsvåda|lägenhetsbrand|skogsbrand|gräsbrand|bilbrand|anlagd|rökutveckling)/i,
  trafik: /\b(trafikolycka|krock|kollision|kolliderade|singelolycka|avåkning|frontalkrock|viltolycka|påkörd|körde av vägen|olycka på (e|rv|väg)\s?\d)/i,
  skjutning: /\b(skottlossning|skjuten|skjutning|skjutits|skott avlossade|skottskadad)/i,
  explosion: /\b(explosion|sprängning|detonation|sprängladdning)/i,
  // "kniv" but not the municipality Knivsta
  kniv: /\b(knivhuggen|knivskuren|knivdåd|knivattack|huggen|kniv(?!sta))/i,
  rån: /\b(rån|rånad|rånare|personrån|butiksrån)/i,
  mord: /\b(mord|mördad|dråp|dödligt våld|hittad död|avliden efter)/i,
  misshandel: /\b(misshandel|misshandlad|slagen|överfallen|våldsbrott)/i,
  våldtäkt: /\b(våldtäkt|sexuellt ofredande|sexbrott)/i,
  inbrott: /\b(inbrott|inbrottstjuv)/i,
  stöld: /\b(stöld|stulen|stulna|tillgrepp|bedrägeri)/i,
  narkotika: /\b(narkotika|knark|langning)/i,
  försvunnen: /\b(försvunnen|saknad|efterlyst|eftersökt|letas)/i,
  drunkning: /\b(drunkn|drunkning|vattenolycka)/i,
  hot: /\b(bombhot|hot mot|olaga hot|hotfull|beväpnad)/i,
  polis: /\b(polis|polisen|gripen|gripna|anhållen|häktad|insats|larm)/i,
  räddning: /\b(räddningstjänst|räddningsinsats|brandkår|ambulans|evakuer|vma|varning)/i,
};

/** Topics a text is about. "polis" and "räddning" are broad and only mark relevance. */
export function topicsOf(text: string): Topic[] {
  return (Object.keys(TOPIC_PATTERNS) as Topic[]).filter((topic) => TOPIC_PATTERNS[topic].test(text));
}

/** Specific topics (excludes the broad ones), used when matching news to an event. */
export function specificTopicsOf(text: string): Topic[] {
  return topicsOf(text).filter((t) => t !== 'polis' && t !== 'räddning');
}

/** Whether a news text is about crime, accidents or emergencies at all. */
export function isSafetyRelated(text: string): boolean {
  return topicsOf(text).length > 0;
}
