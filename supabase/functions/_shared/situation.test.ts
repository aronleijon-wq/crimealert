import { describe, expect, it } from 'vitest';
import { cleanSummary, numbersFromFacts, plainText, situationFacts, situationPrompt, tooQuiet, type SituationEvent } from './situation';

const NOW = Date.parse('2026-11-14T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const at = (daysAgo: number) => new Date(NOW - daysAgo * DAY).toISOString();
const ev = (daysAgo: number, type: string, place: string, area: string | null = place, description = ''): SituationEvent =>
  ({ title: `x november, ${type}, ${place}`, area, time: at(daysAgo), original_type: type, description });

describe('situationFacts', () => {
  const events = [
    ev(1, 'Inbrott', 'Uppsala', 'Uppsala', 'Inbrott i villa i Gottsunda. En man i 40-årsåldern greps.'),
    ev(2, 'Inbrott', 'Uppsala', 'Uppsala län', 'Inbrott i radhus i Gottsunda.'),
    ev(3, 'Trafikolycka', 'Uppsala'),
    ev(9, 'Inbrott', 'Uppsala'),
    ev(10, 'Misshandel', 'Uppsala'),
    ev(1, 'Sammanfattning natt', 'Uppsala'),
    ev(1, 'Rån', 'Sala'),
    ev(20, 'Rån', 'Uppsala'),
  ];
  const facts = situationFacts(events, 'Uppsala', NOW);

  it('counts this week and the one before, in the kommun only', () => {
    expect(facts.thisWeek).toBe(3);
    expect(facts.lastWeek).toBe(2);
  });

  it('finds the kommun in the title when the area is the whole län', () => {
    expect(facts.recent.map((e) => e.text)).toContain('Inbrott i radhus i Gottsunda.');
  });

  it('counts the kinds of crime, most this week first', () => {
    expect(facts.themes).toEqual([
      { label: 'Inbrott', now: 2, before: 1 },
      { label: 'Trafikolyckor', now: 1, before: 0 },
      { label: 'Misshandel', now: 0, before: 1 },
    ]);
  });

  it('lists this week newest first, and gives it to the model', () => {
    expect(facts.recent.map((e) => e.kind)).toEqual(['Inbrott', 'Inbrott', 'Trafikolycka']);
    const prompt = situationPrompt(facts);
    expect(prompt).toContain('Händelser senaste 7 dagarna: 3 (veckan innan: 2)');
    expect(prompt).toContain('- Inbrott: 2 (veckan innan 1)');
    expect(prompt).toContain('Inbrott i villa i Gottsunda.');
    expect(prompt).not.toContain('Sala');
  });
});

describe('plainText', () => {
  it('says what was counted, without AI', () => {
    const facts = situationFacts([ev(1, 'Inbrott', 'Lund'), ev(2, 'Inbrott', 'Lund'), ev(3, 'Brand', 'Lund'), ev(8, 'Brand', 'Lund')], 'Lund', NOW);
    expect(plainText(facts)).toBe('Polisen har rapporterat 3 händelser i Lund den senaste veckan, fler än veckan innan (1). Vanligast var inbrott (2) och bränder (1).');
    expect(tooQuiet(facts)).toBe(false);
  });

  it('says when it has been quiet', () => {
    const facts = situationFacts([], 'Bjurholm', NOW);
    expect(plainText(facts)).toBe('Polisen har inte rapporterat några händelser i Bjurholm den senaste veckan.');
    expect(tooQuiet(facts)).toBe(true);
  });
});

describe('cleanSummary', () => {
  it('keeps one plain paragraph', () => {
    expect(cleanSummary('**Lägesbild**\n\nPolisen har rapporterat 12 händelser.\n- Flest inbrott.')).toBe('Lägesbild Polisen har rapporterat 12 händelser. Flest inbrott.');
    expect(cleanSummary('# Rubrik\nPolisen har rapporterat 3 händelser i Lund.')).toBe('Polisen har rapporterat 3 händelser i Lund.');
    expect(cleanSummary('  ')).toBeNull();
  });
});

describe('numbersFromFacts', () => {
  const prompt = 'Händelser senaste 7 dagarna: 38 (veckan innan: 31)\n- Trafikolyckor: 12 (veckan innan 8)\n- tis 11 nov, Trafikolycka: Olycka på E4 vid väg 55.';
  it('accepts a text whose numbers were all given', () => {
    expect(numbersFromFacts('Polisen har rapporterat 38 händelser, fler än veckan innan (31). Tolv trafikolyckor, flera på E4 och väg 55.', prompt)).toBe(true);
  });
  it('rejects a number that was not given, such as one from the example', () => {
    expect(numbersFromFacts('Polisen har rapporterat 24 händelser i Uppsala.', prompt)).toBe(false);
    expect(numbersFromFacts('Det var 13 trafikolyckor.', prompt)).toBe(false);
  });
  it('leaves numbers inside words alone', () => {
    expect(numbersFromFacts('Flera olyckor på E6 och E20.', prompt)).toBe(true);
  });
});
