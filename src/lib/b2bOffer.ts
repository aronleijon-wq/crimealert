// What CrimeAlert offers kommuner, myndigheter and companies: on Prisplan (B2BOffer) and /for-kommuner.

export const B2B_MAIL_SUBJECT = 'CrimeAlert för kommuner och organisationer';

/** What an organisation gets, in the order a buyer asks about it */
export const OFFER: { title: string; text: string }[] = [
  {
    title: 'Lägesrapporter',
    text: 'För en kommun, en stadsdel eller ett eget område. Varje månad, varje kvartal eller inför ett evenemang.',
  },
  {
    title: 'Statistik och jämförelser',
    text: 'Anmälda brott och räddningstjänstens insatser per invånare, jämfört med riket och året innan.',
  },
  {
    title: 'Data och export',
    text: 'Händelserna med tid, plats och Polisens text, även de som bara finns i nattsammanfattningarna. Som CSV eller PDF.',
  },
];

export const STEPS = [
  'Ni berättar vilket område och vilka frågor det gäller.',
  'Vi skickar ett förslag och en exempelrapport för ert område.',
  'Rapporterna levereras löpande, och data finns att hämta.',
];

export const SOURCES = 'Polisen, Brå, MCF (tidigare MSB) och SCB';
