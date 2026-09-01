# Ingen Google Maps-integration

## Beslut
CrimeAlert fortsätter använda Leaflet med CARTO-tiles. Google Maps Platform aktiveras inte.

## Vad du gör på Google Cloud
- Slutför inte onboarding-flödet i skärmbilden.
- Aktivera inte billing för projektet `crimealert-489719`.
- Om en Maps-API-nyckel redan skapats: ta bort den så den inte kan användas av misstag.

## Varför
- Kartan renderas av `leaflet` / `react-leaflet` med gratis CARTO-tiles (mörkt och ljust tema).
- Geokodning sker via Nominatim.
- Ingen kod i projektet anropar Google Maps.
- Google Maps skulle kräva nyckel, billing och omskrivning av kartvyn, med rörlig kostnad per kartladdning.

## Kodändringar
Inga.
