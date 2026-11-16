import { describe, it, expect } from 'vitest';
import {
  areaAnchor, distanceKm, gazetteerIndex, gazetteerInText, lanGazetteerIndex, withinArea, type PlaceCandidate, gazetteerLookup, geocodeQuery, keepBest, pickHit, placeCandidates, placeKey, precisionOf, sameKommun, spreadPoint,
  type GazetteerPlace,
  SPREAD_MAX_M, SPREAD_MIN_M,
} from './geoPlace';

const names = (text: string, kommun?: string) => placeCandidates(text, kommun).map((c) => `${c.kind}:${c.name}`);

describe('places in Polisen\'s texts', () => {
  it('finds crossings first, also with å, ä and ö in lower case', () => {
    expect(names('I korsningen Sätragatan och årsundavägen i Sandviken har en person blivit påkörd.', 'Sandviken')[0])
      .toBe('crossing:Sätragatan/Årsundavägen');
    expect(names('Larm om en olycka vid Korsgatan/ångermanlandsgatan.', 'Örnsköldsvik')[0]).toBe('crossing:Korsgatan/Ångermanlandsgatan');
  });

  it('finds streets with several words and with numbers', () => {
    expect(names('I korsningen Vaksalagatan och Tycho Hedéns väg kör en bil in i en annan.', 'Uppsala')).toContain('street:Tycho Hedéns väg');
    expect(names('Brand i lägenhet på Storgatan 15 i Umeå.', 'Umeå')[0]).toBe('street:Storgatan 15');
    expect(names('En personbil och en buss har krockat på Hertig Johans Allé.', 'Linköping')).toContain('street:Hertig Johans Allé');
  });

  it('finds areas after many kinds of words, and a place written first', () => {
    expect(names('Polis larmas till Rosengård om en olycka.', 'Malmö')).toEqual(['area:Rosengård']);
    expect(names('Två bilar har krockat på väg 632 nära Vikingstad.', 'Linköping')).toEqual(['area:Vikingstad', 'road:väg 632']);
    expect(names('Vallrun, fyrhjulingsstöld strax söder om Åkersjön', 'Krokom')).toEqual(['area:Vallrun', 'area:Åkersjön']);
    expect(names('Kraftig rökutveckling ur en verkstadslokal i Kungens kurva.', 'Huddinge')).toEqual(['area:Kungens kurva']);
  });

  it('finds roads by their number', () => {
    expect(names('Trafikolycka på E22:an strax norr om Trafikplats Fogdarp.', 'Hörby')).toContain('road:E22');
    expect(names('Kollision med en älg längs Rv 70 i älvdalen.', 'Älvdalen')).toContain('road:riksväg 70');
    expect(names('Viltolycka på länsväg 705.', 'Kalix')).toEqual(['road:länsväg 705']);
  });

  it('leaves out words that are not places', () => {
    expect(names('Polisen åker till platsen. Föraren blåser positivt.', 'Gävle')).toEqual([]);
    expect(names('Passageraren, en man, ska ha slagit busschauffören.', 'Bengtsfors')).toEqual([]);
    expect(names('Det brinner i ett förråd på källarplan.', 'Alingsås')).toEqual([]);
    expect(names('Trafikledningen kontaktar polisen om laser mot tågförare.', 'Stockholm')).toEqual([]);
    expect(names('Mycket halt väglag i Hälsingland under natten.', 'Nordanstig')).toEqual([]);
    expect(names('Polis larmas till Hårds väg efter en smäll.', 'Malmö')).toEqual(['street:Hårds väg']);
  });

  it('leaves out the kommun itself, which is where the event already is', () => {
    expect(names('Trafikolycka på Ålidhem i Umeå.', 'Umeå')).toEqual(['area:Ålidhem']);
    expect(names('Piteå, två män misstänkta för grov misshandel.', 'Piteå')).toEqual([]);
  });

  it('asks the geocoder within the kommun', () => {
    expect(geocodeQuery({ name: 'Rosengård', kind: 'area' }, 'Malmö')).toBe('Rosengård, Malmö kommun, Sverige');
    expect(geocodeQuery({ name: 'Sätragatan/Årsundavägen', kind: 'crossing' }, 'Sandviken')).toBe('Sätragatan, Sandviken kommun, Sverige');
    expect(precisionOf('area')).toBe('district');
    expect(precisionOf('crossing')).toBe('street');
    expect(placeKey('Sundsvall', ' Stenstan ')).toBe('sundsvall|stenstan');
  });
});

describe('checking the geocoder\'s answer', () => {
  it('knows a kommun however it is written', () => {
    expect(sameKommun('Sundsvalls kommun', 'Sundsvall')).toBe(true);
    expect(sameKommun('Västerås kommun', 'Västerås')).toBe(true);
    expect(sameKommun('Region Gotland', 'Gotland')).toBe(true);
    expect(sameKommun('Timrå kommun', 'Sundsvall')).toBe(false);
  });

  it('takes the first answer in the right kommun and never the kommun\'s own boundary', () => {
    const centre = { lat: 62.39, lng: 17.31 };
    const hits = [
      { lat: '62.39', lon: '17.30', category: 'boundary', type: 'administrative', address: { municipality: 'Sundsvalls kommun' } },
      { lat: '59.33', lon: '18.06', category: 'place', type: 'suburb', address: { municipality: 'Stockholms kommun' } },
      { lat: '62.391', lon: '17.305', category: 'place', type: 'neighbourhood', address: { municipality: 'Sundsvalls kommun' } },
    ];
    expect(pickHit(hits, 'Sundsvall', centre)).toEqual({ lat: 62.391, lng: 17.305 });
    expect(pickHit(hits.slice(0, 2), 'Sundsvall', centre)).toBeNull();
    // Without a municipality: near the kommun's centre only
    expect(pickHit([{ lat: '62.5', lon: '17.4' }], 'Sundsvall', centre)).toEqual({ lat: 62.5, lng: 17.4 });
    expect(pickHit([{ lat: '59.3', lon: '18.0' }], 'Sundsvall', centre)).toBeNull();
  });
});

describe('keeping the best position', () => {
  const fresh = { lat: 62.39, lng: 17.31, location_precision: 'area' };
  it('keeps the archive\'s street position when a later fetch only found the kommun', () => {
    expect(keepBest(fresh, { lat: 62.4, lng: 17.3, location_precision: 'street' })).toMatchObject({ lat: 62.4, location_precision: 'street' });
  });
  it('takes a fresh position that is at least as precise', () => {
    expect(keepBest({ ...fresh, location_precision: 'street' }, { lat: 1, lng: 1, location_precision: 'district' }).lat).toBe(62.39);
    expect(keepBest(fresh, undefined)).toBe(fresh);
  });
});

describe('spreading markers', () => {
  it('moves every marker 100–600 m, the same way every time', () => {
    for (let i = 0; i < 500; i++) {
      const p = spreadPoint(`pol-${i}`, 62.39, 17.31);
      const m = distanceKm(62.39, 17.31, p.lat, p.lng) * 1000;
      expect(m).toBeGreaterThanOrEqual(SPREAD_MIN_M - 1);
      expect(m).toBeLessThanOrEqual(SPREAD_MAX_M + 1);
    }
    expect(spreadPoint('pol-7', 59.33, 18.07)).toEqual(spreadPoint('pol-7', 59.33, 18.07));
  });

  it('spreads events at one place in all directions', () => {
    const quadrants = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const p = spreadPoint(`pol-${i}`, 59.33, 18.07);
      quadrants.add(`${p.lat > 59.33}${p.lng > 18.07}`);
    }
    expect(quadrants.size).toBe(4);
  });
});

describe('the gazetteer', () => {
  const places: GazetteerPlace[] = [
    ['Sundsvall', 62.39, 17.31, 'c'], ['Stenstan', 62.391, 17.306, 's'], ['Haga', 62.395, 17.29, 's'],
    ['Lugnvik', 62.42, 17.35, 's'], ['Västra Kajen', 62.388, 17.32, 's'], ['Alnö', 62.43, 17.43, 'i'],
  ];
  const index = gazetteerIndex(places);

  it('knows a place by name, also with a kind word after it', () => {
    expect(gazetteerLookup('Stenstan', index)?.[1]).toBe(62.391);
    expect(gazetteerLookup('Lugnviks industriområde', index)?.[0]).toBe('Lugnvik');
    expect(gazetteerLookup('Birsta', index)).toBeNull();
  });

  it('finds the kommun\'s places anywhere in the text, longest name first', () => {
    const found = gazetteerInText('Stenstan: bråk utomhus. Senare olycka vid Västra Kajen och på Alnö.', index, 'Sundsvall');
    expect(found.map((c) => c.name)).toEqual(['Stenstan', 'Västra Kajen', 'Alnö']);
  });

  it('leaves out the kommun itself and words that only start a sentence', () => {
    expect(gazetteerInText('Sundsvall, en man grips. Polisen åker till platsen.', index, 'Sundsvall')).toEqual([]);
  });

  it('takes a word that starts a sentence and goes on into it as an ordinary word', () => {
    const words = gazetteerIndex([['Bilen', 62.4, 17.3, 'h'], ['Elden', 62.4, 17.3, 'h'], ['Kölsillre', 62.4, 17.3, 'v'], ['Körfältet', 62.4, 17.3, 's']]);
    expect(gazetteerInText('Bilen hade kört av vägen. 10:27 Elden spred sig.', words, 'Sundsvall')).toEqual([]);
    expect(gazetteerInText('Kölsillre, resultat efter trafikkontroll. Brand på Körfältet.', words, 'Sundsvall').map((c) => c.name)).toEqual(['Kölsillre', 'Körfältet']);
  });
});

describe('areaAnchor', () => {
  const stockholm = gazetteerIndex([['Farsta', 59.24535, 18.08837, 's'], ['Hisingen', 57.73, 11.92, 'i']]);
  const named: PlaceCandidate[] = [{ name: 'Kyrkvägen', kind: 'street' }, { name: 'Farsta', kind: 'area' }];

  it('finds the area an event names, and keeps a street near it', () => {
    const anchor = areaAnchor(named, stockholm)!;
    expect(anchor.name).toBe('Farsta');
    expect(withinArea(anchor, 59.2435, 18.0950)).toBe(true); // in Farsta
    expect(withinArea(anchor, 59.3326, 18.0649)).toBe(false); // Kyrkvägen-ish in the city, 10 km away
  });

  it('lets a street lie further out in a big area, and has no anchor without a known area', () => {
    const anchor = areaAnchor([{ name: 'Hisingen', kind: 'area' }], stockholm)!;
    expect(withinArea(anchor, 57.78, 11.88)).toBe(true); // 6 km away, still on Hisingen
    expect(areaAnchor([{ name: 'Kyrkvägen', kind: 'street' }, { name: 'Okänd', kind: 'area' }], stockholm)).toBeNull();
  });
});

describe('lanGazetteerIndex', () => {
  const gislaved: GazetteerPlace[] = [['Gislaved', 57.30, 13.54, 'c'], ['Anderstorp', 57.28, 13.63, 'c'], ['Berga', 57.2, 13.5, 'h']];
  const jonkoping: GazetteerPlace[] = [['Jönköping', 57.78, 14.16, 'c'], ['Berga', 57.7, 14.1, 'h'], ['Anderstorp', 57.75, 14.2, 'h']];
  const index = lanGazetteerIndex([gislaved, jonkoping, undefined]);

  it('knows a name found in one kommun of the län', () => {
    expect(index.get('gislaved')?.[1]).toBe(57.30);
  });

  it('takes the town when a name is also a hamlet elsewhere in the län, and leaves out names it can\'t tell apart', () => {
    expect(index.get('anderstorp')?.[1]).toBe(57.28);
    expect(index.has('berga')).toBe(false);
  });
});
