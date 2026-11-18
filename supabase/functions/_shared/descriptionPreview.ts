// What a visitor without Pro reads of Polisen's description: about the first half, then "Läs mer
// med Pro". Cut on the server (police-events), so the rest of the text never reaches them.
//
// Most of Polisen's texts are one or two sentences (about 170 characters), so "the first two
// sentences" would show most of them whole. Half the text, in whole sentences where possible,
// leaves something to read with Pro in nearly every event.

/** Texts this short are shown whole: there is nothing to hold back in "Brand i bil." */
export const PREVIEW_MIN_CHARS = 60;
/** About this share of the text is shown */
export const PREVIEW_SHARE = 0.5;
/** And never more than about this many characters */
export const PREVIEW_MAX_CHARS = 240;

// A sentence ends at . ! or ? followed by space and a capital letter or digit, but not after the
// abbreviations Polisen writes ("Kl. 14", "ca. tio", "t.ex. Hageby")
const SENTENCE_END = /[.!?]\s+(?=[A-ZÅÄÖÉ0-9"'(–-])/gu;
const ABBREVIATIONS = new Set(['kl', 'ca', 'nr', 'st', 'resp', 'jfr', 'bl.a', 't.ex', 'm.fl', 'm.m', 'p.g.a', 's.k', 'o.s.v', 'f.d', 'dvs', 'tel']);

function sentencesOf(text: string): string[] {
  const out: string[] = [];
  let start = 0;
  for (const m of text.matchAll(SENTENCE_END)) {
    const end = (m.index ?? 0) + 1;
    const word = text.slice(start, end - 1).split(/\s/).pop()?.toLowerCase() ?? '';
    if (m[0][0] === '.' && ABBREVIATIONS.has(word)) continue;
    out.push(text.slice(start, end).trim());
    start = (m.index ?? 0) + m[0].length;
  }
  out.push(text.slice(start).trim());
  return out.filter(Boolean);
}

/** The text cut at a word before `limit` characters, ending with "…" */
function cutAtWord(text: string, limit: number): string {
  const cut = text.slice(0, limit);
  const space = cut.lastIndexOf(' ');
  const atWord = space > limit * 0.5 ? cut.slice(0, space) : cut;
  return `${atWord.replace(/[\s,;:–-]+$/, '')}…`;
}

/**
 * The start of a description for a visitor without Pro: whole sentences up to about half the
 * text (at most PREVIEW_MAX_CHARS), or, when the first sentence is longer than that, the first
 * sentence cut at a word with "…". truncated says whether there is more to read with Pro.
 */
export function descriptionPreview(text: string | null | undefined): { text: string; truncated: boolean } {
  const full = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!full) return { text: '', truncated: false };
  if (full.length <= PREVIEW_MIN_CHARS) return { text: full, truncated: false };

  const target = Math.min(PREVIEW_MAX_CHARS, Math.max(PREVIEW_MIN_CHARS, Math.round(full.length * PREVIEW_SHARE)));
  let preview = '';
  for (const sentence of sentencesOf(full)) {
    const next = preview ? `${preview} ${sentence}` : sentence;
    if (next.length > target) break;
    preview = next;
  }
  if (!preview) preview = cutAtWord(full, target);
  return { text: preview, truncated: preview.length < full.length };
}
