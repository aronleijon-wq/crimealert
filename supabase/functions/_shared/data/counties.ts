// Swedish counties (län) with SCB county codes and the coordinates of each county seat.
// Used to place county-level information (VMA, Krisinformation, Trafikverket) on the map.

export interface County {
  code: number;
  name: string;
  lat: number;
  lng: number;
}

export const SWEDISH_COUNTIES: County[] = [
  { code: 1, name: 'Stockholms län', lat: 59.3293, lng: 18.0686 },
  { code: 3, name: 'Uppsala län', lat: 59.8586, lng: 17.6389 },
  { code: 4, name: 'Södermanlands län', lat: 58.7530, lng: 17.0086 },
  { code: 5, name: 'Östergötlands län', lat: 58.4108, lng: 15.6214 },
  { code: 6, name: 'Jönköpings län', lat: 57.7826, lng: 14.1618 },
  { code: 7, name: 'Kronobergs län', lat: 56.8777, lng: 14.8091 },
  { code: 8, name: 'Kalmar län', lat: 56.6634, lng: 16.3568 },
  { code: 9, name: 'Gotlands län', lat: 57.6348, lng: 18.2948 },
  { code: 10, name: 'Blekinge län', lat: 56.1612, lng: 15.5869 },
  { code: 12, name: 'Skåne län', lat: 55.6050, lng: 13.0038 },
  { code: 13, name: 'Hallands län', lat: 56.6745, lng: 12.8578 },
  { code: 14, name: 'Västra Götalands län', lat: 57.7089, lng: 11.9746 },
  { code: 17, name: 'Värmlands län', lat: 59.3793, lng: 13.5036 },
  { code: 18, name: 'Örebro län', lat: 59.2753, lng: 15.2134 },
  { code: 19, name: 'Västmanlands län', lat: 59.6099, lng: 16.5448 },
  { code: 20, name: 'Dalarnas län', lat: 60.6065, lng: 15.6355 },
  { code: 21, name: 'Gävleborgs län', lat: 60.6749, lng: 17.1413 },
  { code: 22, name: 'Västernorrlands län', lat: 62.6323, lng: 17.9378 },
  { code: 23, name: 'Jämtlands län', lat: 63.1792, lng: 14.6357 },
  { code: 24, name: 'Västerbottens län', lat: 63.8258, lng: 20.2630 },
  { code: 25, name: 'Norrbottens län', lat: 65.5848, lng: 22.1547 },
];
