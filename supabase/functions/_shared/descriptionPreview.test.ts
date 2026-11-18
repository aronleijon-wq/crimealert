import { describe, expect, it } from 'vitest';
import { descriptionPreview, PREVIEW_MAX_CHARS } from './descriptionPreview';

describe('descriptionPreview', () => {
  it('shows whole sentences up to about half the text, and says there is more', () => {
    const text = 'Polis larmas till en bostad på Hageby efter larm om bråk. På plats finns två personer. Den ena förs till sjukhus. Utredning pågår.';
    expect(descriptionPreview(text)).toEqual({
      text: 'Polis larmas till en bostad på Hageby efter larm om bråk.',
      truncated: true,
    });
  });

  it('cuts a text of one sentence at a word, so even it has more to read', () => {
    const text = 'En personbil och en lastbil har kolliderat på E4 norr om trafikplats Sörmjöle, och räddningstjänst och ambulans är på väg.';
    const { text: preview, truncated } = descriptionPreview(text);
    expect(truncated).toBe(true);
    expect(preview.endsWith('…')).toBe(true);
    expect(text.startsWith(preview.slice(0, -1))).toBe(true);
    expect(preview.length).toBeLessThan(text.length * 0.6);
    expect(preview).not.toMatch(/[\s,]…$/);
  });

  it('shows a very short text whole, with nothing more to read', () => {
    expect(descriptionPreview('Brand i bil på parkering.')).toEqual({ text: 'Brand i bil på parkering.', truncated: false });
    expect(descriptionPreview('')).toEqual({ text: '', truncated: false });
    expect(descriptionPreview(null)).toEqual({ text: '', truncated: false });
  });

  it('does not end a sentence at an abbreviation', () => {
    const text = 'Kl. 14 larmas polis till centrum där ca. tio personer bråkar utanför en butik. Flera patruller skickas dit och personerna skingras efter en stund. Ingen är skadad enligt uppgift och ingen har gripits.';
    expect(descriptionPreview(text).text).toBe('Kl. 14 larmas polis till centrum där ca. tio personer bråkar utanför en butik.');
  });

  it('never shows more than the limit of a long text', () => {
    const sentence = 'Polisen har under kvällen genomfört en insats i området där flera personer greps. ';
    const { text, truncated } = descriptionPreview(sentence.repeat(12));
    expect(truncated).toBe(true);
    expect(text.length).toBeLessThanOrEqual(PREVIEW_MAX_CHARS + 1);
  });

  it('joins lines, so the preview reads as one paragraph', () => {
    expect(descriptionPreview('Brand i lägenhet på andra våningen.\nRäddningstjänsten är på plats.\nIngen skadad enligt uppgift.').text)
      .toBe('Brand i lägenhet på andra våningen.');
  });
});
