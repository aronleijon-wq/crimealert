// Who runs CrimeAlert, for the Om oss page and what search engines read about it.

export const FOUNDER = { name: 'Aron Leijon', role: 'Grundare' };
/** One id for the founder everywhere, so search engines tie the name to CrimeAlert. */
export const FOUNDER_ID = 'https://crimealert.se/om-oss#aron-leijon';
export const ABOUT_CONTACT = 'crimealert.swe@gmail.com';

/** AboutPage with the organisation and its founder, as schema.org JSON-LD. */
export const aboutJsonLd = () =>
  JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    url: 'https://crimealert.se/om-oss',
    name: 'Om CrimeAlert',
    inLanguage: 'sv-SE',
    mainEntity: {
      '@type': 'Organization',
      '@id': 'https://crimealert.se/#organization',
      name: 'CrimeAlert',
      url: 'https://crimealert.se',
      logo: 'https://crimealert.se/pwa-512x512.png',
      email: ABOUT_CONTACT,
      description: 'Polisens händelser på karta i Sveriges 290 kommuner, med notiser, statistik och historik.',
      areaServed: { '@type': 'Country', name: 'Sverige' },
      founder: { '@id': FOUNDER_ID },
    },
    about: { '@id': FOUNDER_ID },
    mentions: {
      '@type': 'Person',
      '@id': FOUNDER_ID,
      name: FOUNDER.name,
      jobTitle: `${FOUNDER.role} av CrimeAlert`,
      url: 'https://crimealert.se/om-oss',
      worksFor: { '@id': 'https://crimealert.se/#organization' },
      nationality: { '@type': 'Country', name: 'Sverige' },
    },
  });
