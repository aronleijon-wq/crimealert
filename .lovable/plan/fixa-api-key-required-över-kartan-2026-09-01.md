# Fixa "API KEY REQUIRED" över kartan

## Vad som hänt
Kartrutorna hämtas från CARTO:s gratisbasemaps (`basemaps.cartocdn.com`). CARTO har börjat kräva nyckel och lägger nu en diagonal "API KEY REQUIRED"-stämpel på varje ruta. Verifierat: en hämtad ruta returnerar 200 men med vattenstämpeln inbränd.

Det har inget med Google Maps att göra — ingen Google-nyckel behövs.

## Lösning
Byt kartlager till Esri:s gråa baskartor, som är nyckelfria och matchar Gotham-stilen:

- Mörkt läge: `World_Dark_Gray_Base`
- Ljust läge: `World_Light_Gray_Base`

Verifierat: rutorna laddas utan nyckel och utan vattenstämpel.

## Teknisk detalj
- I `src/components/MapView.tsx` byts båda CARTO-URL:erna (initialt lager samt temaomkopplingen) mot Esri-URL:er.
- Esri använder rutordningen `{z}/{y}/{x}` i stället för CARTO:s `{z}/{x}/{y}` — URL-mallen skrivs därefter.
- `subdomains` tas bort (Esri har ingen `{s}`), `maxZoom` sätts till 16 för de gråa lagren.
- Attributionstexten uppdateras till Esri/OSM-bidragsgivare.
- Ingen ändring av markörer, popups, filter eller datalager.

## Om du hellre vill behålla CARTO
Alternativ: skaffa en gratis CARTO-nyckel och lägga in den. Det kräver konto och nyckelhantering. Esri-vägen kräver inget konto alls, så den föreslås först.
