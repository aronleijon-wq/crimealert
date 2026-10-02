import { SWEDISH_MUNICIPALITIES } from '../../supabase/functions/_shared/data/municipalities';

/** All 290 Swedish municipalities, as stored in notification_preferences. */
export const SWEDISH_KOMMUNER: string[] = [
  'Ale', 'Alingsås', 'Alvesta', 'Aneby', 'Arboga', 'Arjeplog', 'Arvidsjaur', 'Arvika', 'Askersund',
  'Avesta', 'Bengtsfors', 'Berg', 'Bjurholm', 'Bjuv', 'Boden', 'Bollebygd', 'Bollnäs', 'Borgholm',
  'Borlänge', 'Borås', 'Botkyrka', 'Boxholm', 'Bromölla', 'Bräcke', 'Burlöv', 'Båstad', 'Dals-Ed',
  'Danderyd', 'Degerfors', 'Dorotea', 'Eda', 'Ekerö', 'Eksjö', 'Emmaboda', 'Enköping',
  'Eskilstuna', 'Eslöv', 'Essunga', 'Fagersta', 'Falkenberg', 'Falköping', 'Falun', 'Filipstad',
  'Finspång', 'Flen', 'Forshaga', 'Färgelanda', 'Gagnef', 'Gislaved', 'Gnesta', 'Gnosjö',
  'Gotland', 'Grums', 'Grästorp', 'Gullspång', 'Gällivare', 'Gävle', 'Göteborg', 'Götene', 'Habo',
  'Hagfors', 'Hallsberg', 'Hallstahammar', 'Halmstad', 'Hammarö', 'Haninge', 'Haparanda', 'Heby',
  'Hedemora', 'Helsingborg', 'Herrljunga', 'Hjo', 'Hofors', 'Huddinge', 'Hudiksvall', 'Hultsfred',
  'Hylte', 'Håbo', 'Hällefors', 'Härjedalen', 'Härnösand', 'Härryda', 'Hässleholm', 'Höganäs',
  'Högsby', 'Hörby', 'Höör', 'Jokkmokk', 'Järfälla', 'Jönköping', 'Kalix', 'Kalmar', 'Karlsborg',
  'Karlshamn', 'Karlskoga', 'Karlskrona', 'Karlstad', 'Katrineholm', 'Kil', 'Kinda', 'Kiruna',
  'Klippan', 'Knivsta', 'Kramfors', 'Kristianstad', 'Kristinehamn', 'Krokom', 'Kumla',
  'Kungsbacka', 'Kungsör', 'Kungälv', 'Kävlinge', 'Köping', 'Laholm', 'Landskrona', 'Laxå',
  'Lekeberg', 'Leksand', 'Lerum', 'Lessebo', 'Lidingö', 'Lidköping', 'Lilla Edet', 'Lindesberg',
  'Linköping', 'Ljungby', 'Ljusdal', 'Ljusnarsberg', 'Lomma', 'Ludvika', 'Luleå', 'Lund',
  'Lycksele', 'Lysekil', 'Malmö', 'Malung-Sälen', 'Malå', 'Mariestad', 'Mark', 'Markaryd',
  'Mellerud', 'Mjölby', 'Mora', 'Motala', 'Mullsjö', 'Munkedal', 'Munkfors', 'Mölndal',
  'Mönsterås', 'Mörbylånga', 'Nacka', 'Nora', 'Norberg', 'Nordanstig', 'Nordmaling', 'Norrköping',
  'Norrtälje', 'Norsjö', 'Nybro', 'Nykvarn', 'Nyköping', 'Nynäshamn', 'Nässjö', 'Ockelbo',
  'Olofström', 'Orsa', 'Orust', 'Osby', 'Oskarshamn', 'Ovanåker', 'Oxelösund', 'Pajala',
  'Partille', 'Perstorp', 'Piteå', 'Ragunda', 'Robertsfors', 'Ronneby', 'Rättvik', 'Sala', 'Salem',
  'Sandviken', 'Sigtuna', 'Simrishamn', 'Sjöbo', 'Skara', 'Skellefteå', 'Skinnskatteberg',
  'Skurup', 'Skövde', 'Smedjebacken', 'Sollefteå', 'Sollentuna', 'Solna', 'Sorsele', 'Sotenäs',
  'Staffanstorp', 'Stenungsund', 'Stockholm', 'Storfors', 'Storuman', 'Strängnäs', 'Strömstad',
  'Strömsund', 'Sundbyberg', 'Sundsvall', 'Sunne', 'Surahammar', 'Svalöv', 'Svedala', 'Svenljunga',
  'Säffle', 'Säter', 'Sävsjö', 'Söderhamn', 'Söderköping', 'Södertälje', 'Sölvesborg', 'Tanum',
  'Tibro', 'Tidaholm', 'Tierp', 'Timrå', 'Tingsryd', 'Tjörn', 'Tomelilla', 'Torsby', 'Torsås',
  'Tranemo', 'Tranås', 'Trelleborg', 'Trollhättan', 'Trosa', 'Tyresö', 'Täby', 'Töreboda',
  'Uddevalla', 'Ulricehamn', 'Umeå', 'Upplands Väsby', 'Upplands-Bro', 'Uppsala', 'Uppvidinge',
  'Vadstena', 'Vaggeryd', 'Valdemarsvik', 'Vallentuna', 'Vansbro', 'Vara', 'Varberg', 'Vaxholm',
  'Vellinge', 'Vetlanda', 'Vilhelmina', 'Vimmerby', 'Vindeln', 'Vingåker', 'Vårgårda',
  'Vänersborg', 'Vännäs', 'Värmdö', 'Värnamo', 'Västervik', 'Västerås', 'Växjö', 'Ydre', 'Ystad',
  'Åmål', 'Ånge', 'Åre', 'Årjäng', 'Åsele', 'Åstorp', 'Åtvidaberg', 'Älmhult', 'Älvdalen',
  'Älvkarleby', 'Älvsbyn', 'Ängelholm', 'Öckerö', 'Ödeshög', 'Örebro', 'Örkelljunga',
  'Örnsköldsvik', 'Östersund', 'Österåker', 'Östhammar', 'Östra Göinge', 'Överkalix', 'Övertorneå',
];

// Seats of the municipalities missing from the shared coordinate list, for "near me"
const EXTRA_COORDINATES: Record<string, [number, number]> = {
  Danderyd: [59.404, 18.036], Eda: [59.883, 12.300], Ekerö: [59.291, 17.811],
  Ljusnarsberg: [59.875, 14.997], Malå: [65.183, 18.742], Nykvarn: [59.179, 17.432],
  Nynäshamn: [58.903, 17.948], Salem: [59.200, 17.770], Söderköping: [58.480, 16.323],
  Tidaholm: [58.180, 13.955], Torsås: [56.413, 16.000], Trosa: [58.896, 17.550],
  Ulricehamn: [57.792, 13.414], 'Upplands Väsby': [59.518, 17.911], 'Upplands-Bro': [59.478, 17.752],
  Vadstena: [58.448, 14.890], Valdemarsvik: [58.202, 16.603], Vaxholm: [59.402, 18.351],
  Vänersborg: [58.380, 12.324], Västervik: [57.758, 16.637], Årjäng: [59.391, 12.134],
  Åsele: [64.161, 17.348], Åstorp: [56.134, 12.946], Åtvidaberg: [58.202, 16.000],
  Älvsbyn: [65.676, 21.003], Öckerö: [57.709, 11.651], Österåker: [59.480, 18.300],
  'Östra Göinge': [56.254, 14.077],
};

const COORDINATES: { name: string; lat: number; lng: number }[] = [
  ...SWEDISH_MUNICIPALITIES.map(({ name, lat, lng }) => ({ name, lat, lng })),
  ...Object.entries(EXTRA_COORDINATES).map(([name, [lat, lng]]) => ({ name, lat, lng })),
];

/** Lower case without accents, so "malmo" finds Malmö and "goteborg" finds Göteborg. */
const fold = (value: string) => value.toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

/** Municipalities matching what the user typed: names starting with it first, then words, then anywhere. */
export function searchKommuner(query: string, limit = 8): string[] {
  const q = fold(query);
  if (!q) return [];
  const rank = (name: string) => {
    const n = fold(name);
    if (n.startsWith(q)) return 0;
    if (n.split(/[\s-]+/).some((word) => word.startsWith(q))) return 1;
    return n.includes(q) ? 2 : -1;
  };
  return SWEDISH_KOMMUNER
    .map((name) => ({ name, rank: rank(name) }))
    .filter((r) => r.rank >= 0)
    .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name, 'sv'))
    .slice(0, limit)
    .map((r) => r.name);
}

/** The municipalities whose seats are closest to a position, nearest first. */
export function nearestKommuner(lat: number, lng: number, count = 3): string[] {
  const rad = Math.PI / 180;
  const distance = (p: { lat: number; lng: number }) => {
    const dLat = (p.lat - lat) * rad;
    const dLng = (p.lng - lng) * rad;
    return Math.sin(dLat / 2) ** 2 + Math.cos(lat * rad) * Math.cos(p.lat * rad) * Math.sin(dLng / 2) ** 2;
  };
  return [...COORDINATES].sort((a, b) => distance(a) - distance(b)).slice(0, count).map((p) => p.name);
}
