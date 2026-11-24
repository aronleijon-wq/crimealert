import { describe, expect, it } from 'vitest';
import { isSummaryPart, kindOf, newParts, partTitle, placeKommunIndex, summaryBlocks, summaryParts, timeIn, type SummaryPlaces } from "../../supabase/functions/_shared/summaryEvents";

const STOCKHOLM = ['Botkyrka', 'Haninge', 'Huddinge', 'Nacka', 'Solna', 'Stockholm', 'Södertälje', 'Täby', 'Värmdö'];
const places: SummaryPlaces = {
  kommunerFor: (area) => (/stockholm/i.test(area) ? STOCKHOLM : /göteborg|västra götaland/i.test(area) ? ['Göteborg', 'Mölndal', 'Ale', 'Vara'] : []),
  placeKommun: (_area, name) => ({ Södermalm: 'Stockholm', Farsta: 'Stockholm', Hisingen: 'Göteborg', Fittja: 'Botkyrka' } as Record<string, string>)[name] ?? null,
  kommunOfArea: (area) => (/^göteborg$/i.test(area) ? 'Göteborg' : null),
};

const summary = (description: string, extra: Partial<{ title: string; time: string; area: string }> = {}) => ({
  id: 'pol-900',
  title: '22 november 06.00, Sammanfattning natt, Stockholms län',
  area: 'Stockholms län',
  time: '2026-11-22 6:00:00 +01:00',
  url: '/aktuellt/handelser/2026/november/22/sammanfattning-natt-stockholms-lan/',
  description,
  ...extra,
});

describe('summaryParts', () => {
  it('finds the events in a summary with a heading for each', () => {
    const parts = summaryParts(summary([
      'Ett urval av nattens händelser i Stockholms län.',
      '',
      'Nacka 02.10 Stöld',
      'En man greps misstänkt för stöld ur en bil på en parkering.',
      '',
      'Södertälje 23.40 Misshandel',
      'En man i 30-årsåldern misshandlades utanför en restaurang. Han fick föras till sjukhus.',
      '',
      'Brand i lägenhet, Södermalm, kl. 04.15',
      'Räddningstjänsten släckte en brand i ett kök. Ingen skadades.',
    ].join('\n')), places);
    expect(parts.map((p) => [p.id, p.kommun, p.type, p.time])).toEqual([
      ['pol-900-s1', 'Nacka', 'Stöld', '2026-11-22T02:10:00+01:00'],
      // Later than the summary was written: the evening before
      ['pol-900-s2', 'Södertälje', 'Misshandel', '2026-11-21T23:40:00+01:00'],
      // A district gives its kommun
      ['pol-900-s3', 'Stockholm', 'Brand', '2026-11-22T04:15:00+01:00'],
    ]);
    expect(parts[0].text).toBe('Nacka 02.10 Stöld – En man greps misstänkt för stöld ur en bil på en parkering.');
    expect(partTitle(parts[1])).toBe('21 november 23.40, Misshandel, Södertälje');
  });

  it('finds events written as paragraphs, and leaves out what is not one', () => {
    const parts = summaryParts(summary([
      'Sammanfattning av natten.',
      'Rån, Huddinge: Vid 01-tiden rånades en ung man på sin mobiltelefon i Flemingsberg.',
      'Klockan 03.05 stoppades en bilist i Täby som misstänks för rattfylleri.',
      'Natten var i övrigt lugn i länet.',
      'Kontakta polisen på 114 14 om du har tips.',
    ].join('\n')), places);
    expect(parts.map((p) => [p.kommun, p.type, p.time])).toEqual([
      ['Huddinge', 'Rån', '2026-11-22T01:00:00+01:00'],
      ['Täby', 'Rattfylleri', '2026-11-22T03:05:00+01:00'],
    ]);
  });

  it('uses the summary’s kommun when it is for one, and its time when the text has none', () => {
    const parts = summaryParts(summary('Hisingen – Inbrott\nInbrott i en villa under natten.\n\nSkadegörelse på en skola. Flera rutor krossades.', {
      title: '22 november 07.00, Sammanfattning natt, Göteborg', area: 'Göteborg', time: '2026-11-22 7:00:00 +01:00',
    }), places);
    expect(parts.map((p) => [p.kommun, p.type, p.time])).toEqual([
      ['Göteborg', 'Inbrott', '2026-11-22 7:00:00 +01:00'],
      ['Göteborg', 'Skadegörelse', '2026-11-22 7:00:00 +01:00'],
    ]);
  });

  it('keeps summer time in summer', () => {
    const [part] = summaryParts(summary('Nacka 01.30 Bråk\nBråk utanför en krog.', { time: '2026-07-12 6:00:00 +02:00' }), places);
    expect(part.time).toBe('2026-07-12T01:30:00+02:00');
  });

  it('does not take ordinary words for kommuner', () => {
    const parts = summaryParts(summary('Vara sig polis eller ambulans behövdes när en man stal en cykel.', {
      title: '22 november 06.00, Sammanfattning natt, Västra Götalands län', area: 'Västra Götalands län',
    }), places);
    expect(parts).toEqual([]);
  });
});

describe('newParts', () => {
  const parts = summaryParts(summary('Nacka 02.10 Stöld\nStöld ur bil.\n\nSolna 03.00 Misshandel\nEn man misshandlades.'), places);
  it('leaves out events Polisen also published on their own', () => {
    const own = [
      { id: 'pol-1', area: 'Stockholms län', title: '22 november 02.25, Stöld, Nacka', time: '2026-11-22 2:25:00 +01:00', originalType: 'Stöld' },
      // Another kind, or hours apart, is another event
      { id: 'pol-2', area: 'Solna', title: '22 november 03.10, Bråk, Solna', time: '2026-11-22 3:10:00 +01:00', originalType: 'Bråk' },
      // A part already archived is not an event of its own
      { id: 'pol-900-s2', area: 'Solna', title: '22 november 03.00, Misshandel, Solna', time: '2026-11-22T03:00:00+01:00', originalType: 'Misshandel' },
    ];
    expect(newParts(parts, own).map((p) => p.id)).toEqual(['pol-900-s2']);
  });
});

describe('the pieces', () => {
  it('reads times', () => {
    expect(timeIn('kl. 02.10 i natt')).toEqual({ h: 2, m: 10 });
    expect(timeIn('vid 03-tiden')).toEqual({ h: 3, m: 0 });
    expect(timeIn('den 22.11 greps')).toBeNull();
    expect(timeIn('22.11 Nacka', true)).toEqual({ h: 22, m: 11 });
  });
  it('names the kinds as Polisen does', () => {
    expect(kindOf('Ett personrån inträffade')).toBe('Rån');
    expect(kindOf('Inbrott och stöld i förråd')).toBe('Inbrott');
    expect(kindOf('Våld mot tjänsteman vid gripande')).toBe('Våld/hot mot tjänsteman');
    expect(kindOf('Bränd bil i Rinkeby')).toBe('Brand');
    expect(kindOf('Lugn natt')).toBeNull();
  });
  it('splits headings from paragraphs', () => {
    expect(summaryBlocks('Nacka 02.10 Stöld\nText.\nMer text om samma.\n\nSolna, kl 03: Bråk. Två män bråkade.')).toEqual([
      { heading: 'Nacka 02.10 Stöld', body: 'Text. Mer text om samma.' },
      { heading: '', body: 'Solna, kl 03: Bråk. Två män bråkade.' },
    ]);
  });
  it('knows a part by its id', () => {
    expect(isSummaryPart('pol-900-s3')).toBe(true);
    expect(isSummaryPart('pol-900')).toBe(false);
  });
});

describe('placeKommunIndex', () => {
  it('knows which kommun a district is in, and leaves out names in more than one', () => {
    const index = placeKommunIndex([
      ['Stockholm', [['Södermalm', 59.31, 18.07, 's'], ['Skogås', 59.2, 18.1, 'h']]],
      ['Huddinge', [['Skogås', 59.22, 18.15, 'c'], ['Flemingsberg', 59.22, 17.95, 's']]],
      ['Nacka', [['Björknäs', 59.31, 18.2, 's'], ['Fisksätra', 59.29, 18.25, 's']]],
      ['Värmdö', [['Björknäs', 59.3, 18.4, 'h']]],
    ]);
    expect(index.get('södermalm')).toBe('Stockholm');
    // The town of the name, not a hamlet elsewhere
    expect(index.get('skogås')).toBe('Huddinge');
    expect(index.has('björknäs')).toBe(false);
  });
});

describe('summaryParts, from the audit of real summaries (November 2026)', () => {
  const vg: SummaryPlaces = {
    kommunerFor: () => ['Göteborg', 'Strömstad', 'Mölndal'],
    // A place in Strömstad that is also a word for a kind of event
    placeKommun: (_a, name) => ({ Brand: 'Strömstad', Långedrag: 'Göteborg' } as Record<string, string>)[name] ?? null,
  };
  const at = { title: '22 november 06.00, Sammanfattning natt, Västra Götalands län', area: 'Västra Götalands län' };

  it('puts "02:38 Brand, Göteborg" in Göteborg, not in a place called Brand elsewhere', () => {
    const parts = summaryParts(summary('02:38 Brand, Göteborg\nRäddningstjänsten larmas till en villabrand i Långedrag.', at), vg);
    expect(parts.map((p) => [p.kommun, p.type])).toEqual([['Göteborg', 'Brand']]);
  });

  it('finds a kommun written in lower case in the heading, and decodes &amp;ndash;', () => {
    const norr: SummaryPlaces = { kommunerFor: () => ['Örebro', 'Östersund', 'Lund'] };
    const parts = summaryParts(summary([
      '01:03, rattfylleri, örebro',
      'När polis kontrollerar ett fordon på Väster i örebro misstänks föraren för rattfylleri.',
      '04:41, narkotikabrott &amp;ndash; örebro – Väktare larmar polisen om en utslagen man.',
      'Kl 00:51, östersund',
      'Polis beordras till en restaurang i centrum med anledning av bråk.',
    ].join('\n'), at), norr);
    expect(parts.map((p) => [p.kommun, p.type])).toEqual([['Örebro', 'Rattfylleri'], ['Örebro', 'Narkotikabrott'], ['Östersund', 'Bråk']]);
  });

  it('leaves out overviews and tallies, and does not read "Jönköpings län" as Jönköping', () => {
    const nb: SummaryPlaces = { kommunerFor: () => ['Kalix', 'Luleå', 'Piteå', 'Jönköping'] };
    const parts = summaryParts(summary([
      'Kl 00:00-07:00, åtta personer har omhändertagits för fylleri och polisen har hanterat anmälningar gällande misshandel.',
      'Fyra viltolyckor har inträffat under natten (på E4 i Kalix, Luleå och Piteå).',
      'Polisens regionledningscentral har mellan klockan 22.00-07.00 hanterat ett 50-tal ärenden som rör Jönköpings län. Exempelvis fylleri.',
      'Kl 02:15, Luleå – Inbrott i en butik på Storgatan.',
    ].join('\n'), at), nb);
    expect(parts.map((p) => [p.kommun, p.type])).toEqual([['Luleå', 'Inbrott']]);
  });

  it('knows olaga tvång, våldsamt motstånd, traffic stops and ordningslagen', () => {
    expect(kindOf('Mannen grips, misstänkt för olaga tvång')).toBe('Olaga tvång');
    expect(kindOf('00:39, Våldsamt motstånd, Umeå')).toBe('Våldsamt motstånd');
    expect(kindOf('En bilist stoppas för kontroll. Föraren har kört mot rött ljus')).toBe('Trafikkontroll');
    expect(kindOf('En man ses urinera offentligt i Stenstan')).toBe('Ordningslagen');
  });
});
