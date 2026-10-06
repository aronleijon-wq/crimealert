import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { kommunFromSlug } from '@/lib/kommunPages';
import { GUIDES, guideBySlug, guideJsonLd, parseLinks, plainText } from './guides';

const APP_PATHS = new Set(['/karta', '/kommun', '/alerts', '/prisplan', '/flode']);

describe('guides', () => {
  it('each has its own plain address, a short description and is in the sitemap', () => {
    const sitemap = readFileSync('public/sitemap.xml', 'utf8');
    expect(new Set(GUIDES.map((g) => g.slug)).size).toBe(GUIDES.length);
    for (const g of GUIDES) {
      expect(g.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(g.description.length).toBeLessThanOrEqual(160);
      expect(sitemap).toContain(`<loc>https://crimealert.se/guider/${g.slug}</loc>`);
    }
    expect(sitemap).toContain('<loc>https://crimealert.se/guider</loc>');
  });

  it('links only to pages that exist', () => {
    for (const g of GUIDES) {
      const texts = [g.intro, ...g.sections.flatMap((s) => [...(s.text ?? []), ...(s.list ?? [])])];
      for (const part of texts.flatMap(parseLinks)) {
        if (typeof part === 'string' || !part.href.startsWith('/')) continue;
        const kommun = part.href.match(/^\/kommun\/([^/]+)$/);
        expect(kommun ? kommunFromSlug(kommun[1]) : APP_PATHS.has(part.href) ? true : null, part.href).toBeTruthy();
      }
    }
  });

  it('turns link markup into links and plain text', () => {
    expect(parseLinks('Se [kartan](/karta) nu.')).toEqual(['Se ', { label: 'kartan', href: '/karta' }, ' nu.']);
    expect(plainText('Läs på [bra.se](https://bra.se).')).toBe('Läs på bra.se.');
  });

  it('describes each guide to search engines as an article', () => {
    const guide = guideBySlug('skydda-hemmet-mot-inbrott')!;
    const [crumbs, article] = JSON.parse(guideJsonLd(guide));
    expect(crumbs.itemListElement[1].item).toBe('https://crimealert.se/guider/skydda-hemmet-mot-inbrott');
    expect(article).toMatchObject({ '@type': 'Article', headline: 'Så skyddar du hemmet mot inbrott', inLanguage: 'sv-SE' });
    expect(guideBySlug('finns-inte')).toBeNull();
  });
});
