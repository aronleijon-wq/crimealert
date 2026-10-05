import { describe, it, expect } from 'vitest';
import { PRICES, TRIAL_DAYS } from '@/components/account/plans';
import { FAQ_ITEMS, faqAnswerText, faqJsonLd } from './faqItems';

const answer = (question: string) => faqAnswerText(FAQ_ITEMS.find((i) => i.q === question)!.a);

describe('FAQ', () => {
  it('states the prices and trial the account page charges', () => {
    const text = answer('Vad ingår i Pro och vad kostar det?');
    expect(text).toContain(`${PRICES.monthly.price} i månaden`);
    expect(text).toContain(`${PRICES.yearly.price} om året`);
    expect(text).toContain(`${TRIAL_DAYS} dagar`);
  });

  it('turns links into their words for plain text', () => {
    expect(faqAnswerText(['Gå till ', { to: '/prisplan', label: 'Prisplan' }, '.'])).toBe('Gå till Prisplan.');
  });

  it('has no duplicate questions and no empty answers', () => {
    expect(new Set(FAQ_ITEMS.map((i) => i.q)).size).toBe(FAQ_ITEMS.length);
    for (const { a } of FAQ_ITEMS) expect(faqAnswerText(a).trim().length).toBeGreaterThan(20);
  });

  it('describes every question as FAQPage structured data', () => {
    const data = JSON.parse(faqJsonLd());
    expect(data['@type']).toBe('FAQPage');
    expect(data.mainEntity).toHaveLength(FAQ_ITEMS.length);
    expect(data.mainEntity[0]).toEqual({
      '@type': 'Question',
      name: FAQ_ITEMS[0].q,
      acceptedAnswer: { '@type': 'Answer', text: faqAnswerText(FAQ_ITEMS[0].a) },
    });
  });

  it('cannot close the script tag it is placed in', () => {
    const json = faqJsonLd([{ q: 'Fråga', a: ['</script><b>'] }]);
    expect(json).not.toContain('<');
    expect(JSON.parse(json).mainEntity[0].acceptedAnswer.text).toBe('</script><b>');
  });
});
