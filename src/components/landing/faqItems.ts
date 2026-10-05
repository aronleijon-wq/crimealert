// The questions on the start page. Each answer must match what the code and the terms say:
// prices and trial from account/plans.ts, delays from police-events and notifications.ts,
// cancellation from Villkor, stored data from Sekretesspolicy.

import { PRICES, TRIAL_DAYS } from '@/components/account/plans';

export const CONTACT_EMAIL = 'crimealert.swe@gmail.com';

/** A piece of an answer: plain text, or a link (a route like /account, or a mailto: address). */
export type FaqPart = string | { to: string; label: string };

export interface FaqItem {
  q: string;
  a: FaqPart[];
}

const { monthly, yearly } = PRICES;

export const FAQ_ITEMS: FaqItem[] = [
  {
    q: 'Vad är CrimeAlert?',
    a: [
      'En karta och ett flöde med Polisens händelser i hela Sverige, tillsammans med VMA, krisinformation och trafikstörningar. ' +
        'Vi hämtar uppgifterna från Polisen.se och andra öppna källor var femte minut.',
    ],
  },
  {
    q: 'Är CrimeAlert en del av Polisen?',
    a: [
      'Nej. CrimeAlert är en fristående tjänst som visar det Polisen själva publicerar. ' +
        'Ring alltid 112 vid nödläge. Vill du lämna tips till Polisen ringer du 114 14.',
    ],
  },
  {
    q: 'Kostar det något?',
    a: [
      'Nej, det viktigaste är gratis. Utan konto ser du Polisens händelser med 15 minuters fördröjning. ' +
        'Med ett gratis konto kan du också bevaka kommuner och få notiser. VMA och krisinformation visas direkt för alla.',
    ],
  },
  {
    q: 'Vad ingår i Pro och vad kostar det?',
    a: [
      `Pro kostar ${monthly.price} i månaden eller ${yearly.price} om året. ` +
        'Då ser du Polisens händelser och får notiser direkt, läser hela beskrivningen av varje händelse och slipper reklam. ' +
        `Har du aldrig haft Pro kan du prova gratis i ${TRIAL_DAYS} dagar. `,
      { to: '/account', label: 'Jämför Gratis och Pro' },
      '.',
    ],
  },
  {
    q: 'Hur avslutar jag Pro?',
    a: [
      'Gå till ',
      { to: '/account', label: 'Konto' },
      ' och tryck på Hantera prenumeration. Avslutar du under provperioden dras inga pengar. ' +
        'Annars har du Pro perioden ut, och sedan dras inget mer.',
    ],
  },
  {
    q: 'Hur snabbt kommer notiserna?',
    a: [
      'Vi hämtar nya händelser från Polisen var femte minut. Med Pro kommer notisen så snart vi hittat händelsen, ' +
        'med ett gratis konto 15 minuter senare. Tänk på att Polisen ofta publicerar en händelse en stund efter att den hänt.',
    ],
  },
  {
    q: 'Hur får jag notiser på iPhone?',
    a: [
      'Öppna crimealert.se i Safari, tryck på Dela och välj Lägg till på hemskärmen. ' +
        'Öppna sedan CrimeAlert från hemskärmen, gå till ',
      { to: '/alerts', label: 'Notiser' },
      ' och tryck på Slå på notiser. Det kräver iOS 16.4 eller senare. ' +
        'På Android och dator räcker det att slå på notiser och tillåta dem.',
    ],
  },
  {
    q: 'Finns det en app?',
    a: [
      'Inte i App Store än. Men lägger du till CrimeAlert på hemskärmen öppnas den som en app, ' +
        'med egen ikon och utan webbläsarens adressfält.',
    ],
  },
  {
    q: 'Varför hamnar en händelse inte på exakt rätt plats?',
    a: [
      'Polisen anger oftast bara kommun eller ort, ibland en gata eller ett område. ' +
        'Vi placerar händelsen så exakt som uppgifterna räcker till. Står bara kommunen hamnar den mitt i orten.',
    ],
  },
  {
    q: 'Vilka uppgifter sparar ni om mig?',
    a: [
      'Det som behövs för ditt konto: e-postadress, namn om du loggar in med Google, och vilka kommuner du bevakar. ' +
        'Betalningar sköts av Stripe, och vi ser aldrig ditt kortnummer. Allt lagras inom EU, ' +
        'och du kan när som helst be oss radera dina uppgifter. Läs mer i vår ',
      { to: '/sekretesspolicy', label: 'sekretesspolicy' },
      '.',
    ],
  },
];

/** An answer as plain text, links reduced to their words. */
export const faqAnswerText = (parts: FaqPart[]) => parts.map((p) => (typeof p === 'string' ? p : p.label)).join('');

/** The questions as schema.org FAQPage structured data, safe to put inside a script tag. */
export function faqJsonLd(items: FaqItem[] = FAQ_ITEMS): string {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: faqAnswerText(a) },
    })),
  };
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
