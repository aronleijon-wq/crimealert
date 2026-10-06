// The guides under /guider: plain-language help on following what happens where you live. Links in
// the text are written [like this](/karta); internal ones open in the app.

export interface GuideSection {
  heading: string;
  text?: string[];
  list?: string[];
}

export interface Guide {
  slug: string;
  title: string;
  /** For search results and the guide list */
  description: string;
  intro: string;
  sections: GuideSection[];
  updated: string;
}

export const GUIDES: Guide[] = [
  {
    slug: 'se-vad-som-hant-i-ditt-omrade',
    title: 'Så ser du vad som har hänt i ditt område',
    description: 'Steg för steg: så hittar du Polisens händelser där du bor, på kartan, per kommun och som notiser i mobilen eller datorn.',
    intro:
      'Har du hört sirener, sett blåljus eller vill du bara veta vad som händer där du bor? Polisen berättar om många av sina insatser i korta händelsenotiser. Så här hittar du dem snabbt.',
    sections: [
      {
        heading: '1. Öppna kartan',
        text: ['På [kartan](/karta) visas Polisens senaste händelser i hela Sverige. Zooma in där du bor och tryck på en händelse för att läsa vad Polisen har skrivit. Kartan är gratis och kräver inget konto.'],
      },
      {
        heading: '2. Gå till din kommuns sida',
        text: [
          'Varje kommun har en egen sida med det som rapporterats det senaste dygnet och den senaste veckan, till exempel [Stockholm](/kommun/stockholm), [Göteborg](/kommun/goteborg) och [Malmö](/kommun/malmo). Hitta din bland [alla 290 kommuner](/kommun).',
          'På kommunens sida finns också månadsrapporter som visar hur många händelser det var under en månad och vilka som var vanligast.',
        ],
      },
      {
        heading: '3. Få en notis när något händer',
        text: ['Under [Notiser](/alerts) väljer du de kommuner du vill bevaka och slår på notiser i mobilen eller datorn. Med ett gratiskonto kommer notisen 15 minuter efter att Polisen publicerat händelsen, med Pro direkt.'],
      },
      {
        heading: '4. Läs hela notisen hos Polisen',
        text: ['Varje händelse har en länk till Polisens egen sida, där notisen kan ha uppdaterats med mer information.'],
      },
      {
        heading: 'Bra att veta',
        list: [
          'Polisens notiser är ett urval av insatserna, inte all brottslighet.',
          'Notiserna publiceras oftast inom några timmar efter händelsen, men det kan variera.',
          'Platsen anges ofta bara som kommun eller stadsdel, så markeringen på kartan är ungefärlig.',
          'Pågår ett brott eller är någon i fara: ring 112. Vill du anmäla något som redan har hänt eller lämna tips: ring 114 14 eller gå till polisen.se.',
        ],
      },
    ],
    updated: '2026-10-06',
  },
  {
    slug: 'polisens-handelsenotiser',
    title: 'Vad är Polisens händelsenotiser?',
    description: 'Vad Polisens händelsenotiser är, hur snabbt de publiceras, vad de visar och inte visar, och hur du läser dem rätt.',
    intro:
      'Polisen publicerar korta notiser om händelser som de har varit inblandade i, till exempel stölder, trafikolyckor och bränder. Det är de notiserna som CrimeAlert visar på kartan.',
    sections: [
      {
        heading: 'Vad står i en notis?',
        text: ['En notis har en tid, en typ av händelse och en plats, till exempel "6 oktober 02.14, Brand, Stockholm", och en kort sammanfattning. Ofta finns en längre text på polisen.se som uppdateras när Polisen vet mer.'],
      },
      {
        heading: 'Hur snabbt publiceras de?',
        text: ['Enligt Polisen publiceras notiserna oftast inom de närmaste timmarna efter att händelsen inträffat, men det varierar. Uppgifterna bygger på den första informationen och kan ändras senare.'],
      },
      {
        heading: 'Vad visar de inte?',
        text: [
          'Notiserna är ett urval. Polisen skriver inte om alla brott och inte om allt de gör, och många brott anmäls först i efterhand. Därför går det inte att använda notiserna som brottsstatistik.',
          'Statistik över alla anmälda brott, per kommun och år, publiceras av Brottsförebyggande rådet (Brå) på [bra.se](https://bra.se).',
        ],
      },
      {
        heading: 'Sammanfattningar',
        text: ['Ibland publicerar Polisen en sammanfattning av natten eller helgen i ett län. CrimeAlert visar dem, men räknar dem inte som egna händelser i statistiken.'],
      },
      {
        heading: 'Var kommer uppgifterna ifrån?',
        text: ['Polisen publicerar notiserna som öppna data, som vem som helst får använda om Polisen anges som källa. CrimeAlert hämtar dem löpande, placerar dem på [kartan](/karta) och sparar dem, så att du kan se utvecklingen över tid i månadsrapporterna på varje [kommunsida](/kommun).'],
      },
    ],
    updated: '2026-10-06',
  },
  {
    slug: 'skydda-hemmet-mot-inbrott',
    title: 'Så skyddar du hemmet mot inbrott',
    description: 'Enkla och beprövade sätt att göra det svårare för tjuven: lås, belysning, grannar, märkta värdesaker och vad du gör om något har hänt.',
    intro:
      'De flesta inbrott sker när ingen är hemma, och tjuven väljer gärna det som ser enkelt ut. Det mesta du kan göra handlar om att det ska se bebott ut och ta tid att ta sig in.',
    sections: [
      {
        heading: 'Lås och dörrar',
        list: [
          'Lås dörrar och fönster även när du bara går ut en kort stund.',
          'Ett bra lås och en säkerhetsdörr gör det svårare och tar längre tid. Kolla vad ditt försäkringsbolag kräver.',
          'Lämna inga nycklar under dörrmattan, i krukan eller i brevlådan.',
          'Ta in stegar, verktyg och trädgårdsmöbler som kan användas för att ta sig in.',
        ],
      },
      {
        heading: 'Låt det se bebott ut',
        list: [
          'Använd timer på några lampor när du är borta.',
          'Be en granne tömma brevlådan, ta in reklamen eller ställa bilen på din uppfart.',
          'Berätta inte i sociala medier att du är bortrest. Lägg hellre upp bilderna när du är hemma igen.',
        ],
      },
      {
        heading: 'Grannar och värdesaker',
        list: [
          'Grannsamverkan gör att fler håller utkik. Kontakta Polisen eller kommunen om du vill starta det där du bor.',
          'Märk värdesaker och spara serienummer och kvitton. Det gör det lättare att få tillbaka det som stulits och att få ersättning.',
          'Ett larm kan avskräcka, och vissa försäkringsbolag ger rabatt för det.',
        ],
      },
      {
        heading: 'Håll koll på området',
        text: ['Med CrimeAlert kan du [bevaka din kommun](/alerts) och få en notis när Polisen rapporterar inbrott eller andra händelser i närheten. Då vet du när det är extra viktigt att vara uppmärksam.'],
      },
      {
        heading: 'Om det har hänt',
        list: [
          'Pågår inbrottet: ring 112.',
          'Rör inget i onödan, så att Polisen kan säkra spår.',
          'Anmäl inbrottet till Polisen på polisen.se eller på 114 14.',
          'Kontakta ditt försäkringsbolag med polisanmälan och en lista över det som saknas.',
        ],
      },
    ],
    updated: '2026-10-06',
  },
  {
    slug: 'kolla-omradet-innan-du-flyttar',
    title: 'Så kollar du ett område innan du flyttar',
    description: 'Fem sätt att få en bild av tryggheten i ett område innan du köper eller hyr: Polisens händelser, Brå:s statistik, ett kvällsbesök och grannarna.',
    intro:
      'Läget är det svåraste att ändra efter en flytt. Så här skaffar du dig en egen bild av ett område, utan att lita på rykten.',
    sections: [
      {
        heading: '1. Se vad Polisen har rapporterat',
        text: [
          'Kommunens sida på CrimeAlert visar det senaste dygnet och den senaste veckan, och månadsrapporterna visar hur en hel månad har sett ut. Hitta kommunen bland [alla kommuner](/kommun).',
          'Med [Pro](/prisplan) kan du spola tillbaka 60 dagar på kartan, se var det händer mest som värmekarta och få statistik per kommun.',
        ],
      },
      {
        heading: '2. Jämför med Brå:s statistik',
        text: ['Brottsförebyggande rådet (Brå) publicerar antalet anmälda brott per kommun. I Nationella trygghetsundersökningen (NTU) berättar Brå också hur trygga människor känner sig och hur många som säger att de har utsatts för brott. Båda finns på [bra.se](https://bra.se).'],
      },
      {
        heading: '3. Tänk på hur många som rör sig där',
        text: ['En stadskärna med butiker, krogar och resenärer får fler händelser än ett bostadsområde, utan att det behöver vara otryggare att bo där. Jämför därför liknande områden med varandra och titta på vilka slags händelser det handlar om.'],
      },
      {
        heading: '4. Besök området på kvällen',
        text: ['Gå runt en vardagskväll och en helgkväll. Hur ser det ut vid busshållplatsen, i trappuppgången och på vägen hem från stationen?'],
      },
      {
        heading: '5. Fråga dem som bor där',
        text: ['Grannar, bostadsrättsföreningen och lokala grupper i sociala medier vet ofta mer än statistiken. Fråga också om det finns grannsamverkan.'],
      },
    ],
    updated: '2026-10-06',
  },
];

export const guideBySlug = (slug: string | undefined) => GUIDES.find((g) => g.slug === slug) ?? null;

export type TextPart = string | { label: string; href: string };

/** "Se [kartan](/karta)." → ['Se ', { label: 'kartan', href: '/karta' }, '.'] */
export function parseLinks(text: string): TextPart[] {
  const parts: TextPart[] = [];
  const re = /\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push({ label: m[1], href: m[2] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/** The text without link markup, for search engines and descriptions. */
export const plainText = (text: string) => parseLinks(text).map((p) => (typeof p === 'string' ? p : p.label)).join('');

/** A guide as a schema.org Article with breadcrumbs. */
export function guideJsonLd(guide: Guide): string {
  const url = `https://crimealert.se/guider/${guide.slug}`;
  return JSON.stringify([
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Guider', item: 'https://crimealert.se/guider' },
        { '@type': 'ListItem', position: 2, name: guide.title, item: url },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: guide.title,
      description: guide.description,
      inLanguage: 'sv-SE',
      datePublished: guide.updated,
      dateModified: guide.updated,
      author: { '@type': 'Organization', name: 'CrimeAlert', url: 'https://crimealert.se' },
      publisher: { '@type': 'Organization', name: 'CrimeAlert', logo: { '@type': 'ImageObject', url: 'https://crimealert.se/pwa-512x512.png' } },
      mainEntityOfPage: url,
    },
  ]);
}
