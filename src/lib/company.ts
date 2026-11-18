// The company behind CrimeAlert, as it is shown on the site: in the footers, the privacy policy and
// terms, Om oss and the page for kommuner. One place, so it reads the same everywhere.
export const COMPANY = {
  name: 'KGV Analysis AB',
  orgNr: '559243-8054',
  street: 'Karl Gerhards Väg 9',
  locality: 'Saltsjöbaden',
  email: 'kontakt@crimealert.se',
} as const;

export const COMPANY_ADDRESS = `${COMPANY.street}, ${COMPANY.locality}`;

/** "KGV Analysis AB, org.nr 559243-8054, Karl Gerhards Väg 9, Saltsjöbaden": who someone deals with */
export const COMPANY_IDENTITY = `${COMPANY.name}, org.nr ${COMPANY.orgNr}, ${COMPANY_ADDRESS}`;
