# CrimeAlert SWE

Bygg en modern, skalbar webbsida + mobilapp med namnet CrimeAlert. Plattformen ska fungera som en realtidsbaserad säkerhets- och incidentkarta för Sverige, med fokus på trygghet, analys och datavisualisering – inte sensation.

Designen ska kännas:

Seriös

Teknisk

Modern

Lite “Bloomberg möter Flightradar”

Mörkt tema som standard

Målgruppen är:

Privatpersoner

Fastighetsägare

Företag

Säkerhetsbolag

Journalister

🎨 DESIGN & UI

Färgtema

Primär: Mörk navy / nästan svart (#0B0F1A)

Accent: Neonröd (#FF3B3B) för aktiva incidenter

Sekundär: Orange (#FF8C42) för varningar

Neutral: Ljusgrå för statistik

Känsla:
Minimalistisk. Professionell. Datadriven.

🗺 HUVUDFUNKTION – INTERAKTIV KARTA

Kartan är hjärtat av plattformen.

Den ska:

Visa incidenter i realtid (med 10–15 min fördröjning)

Ha filter:

Polisinsats

Brand

Ambulans

Trafikolycka

Övrigt

Visa heatmap-läge

Visa tidslinje (senaste 24h / 7 dagar / 30 dagar)

Zooma från Sverige → stad → kvarter

När man klickar på en incident visas:

Typ av händelse

Tidpunkt

Område (ej exakt adress)

Status (pågående / avslutad)

Risknivå (låg / medel / hög)

Källa (öppen data / verifierad)

Inga personuppgifter ska visas.

📊 DATA & ANALYS-SEKTION

Skapa en flik som heter “Analys”.

Den ska innehålla:

Områdesriskindex (0–100)

Incidenttrend (upp/ner senaste 30 dagar)

Mest aktiva tider på dygnet

Jämförelse mellan områden

Prediktiv riskindikator (AI-baserad modell)

Visa detta i:

Diagram

Heatmaps

Stapeldiagram

Tidslinjegrafer

🔔 NOTIS-SYSTEM

Användare ska kunna:

Sätta en radie (500m / 1km / 5km)

Få pushnotiser vid incident

Få veckorapport

Få “Riskökning”-notis

Premium-användare får:

Fler områden

Historisk export

Riskprognos

👤 KONTO & ANVÄNDARE

Gratis:

Se karta

Se senaste 24h

Begränsade filter

Premium:

Full historik

Notiser

Riskanalys

Exportfunktion (PDF/CSV)

API-access (företag)

B2B-version ska innehålla:

Dashboard med flera områden

Riskrapporter

Dataexport

API-nyckel

📱 MOBILAPP

Mobilappen ska:

Vara snabb

Ha livekarta som startsida

Ha notiscenter

Ha “Mitt område”-vy

Ha riskmätare i toppen

UI ska vara ren och lätt att förstå.

⚖️ JURIDIK & SÄKERHET

Plattformen måste:

Följa GDPR

Inte visa personuppgifter

Inte visa exakta adresser

Ha fördröjning på livehändelser

Ha disclaimer om att data är sammanställd från öppna källor

Inte uppmana till att åka till incidenter

Positionering:
Trygghets- och analysplattform, inte dramatjänst.

🚀 TEKNISK ARKITEKTUR

Frontend:

React eller Next.js

Mapbox eller Google Maps API

Dark UI

Backend:

Node.js eller Python

Realtidsdatastream

Databas (PostgreSQL)

AI-analysmodul

Skalbarhet:
Bygg så det kan expandera från:
Stockholm → Sverige → Norden → EU

💰 MONETISERING

Freemium

Premium (79–149 kr/mån)

B2B-pris: 999–4999 kr/mån

API-licens

White-label till säkerhetsbolag

🧠 VARUMÄRKE

CrimeRadar ska kännas som:

“Situational awareness for the modern world.”

Inte alarmistisk.
Inte clickbait.
Datadriven.
Professionell.

📈 MVP-PLAN

Version 1:

Stockholm

Trafikolyckor

Brandlarm

Historisk data

Enkel karta

Version 2:

Notiser

Premium

Riskindex

Version 3:

AI-prognoser

Företagsdashboard

API

🔥 LÅNGSIKTIG VISION

CrimeRadar ska bli:

Nordens största incidentdataplattform

Ett verktyg för fastighetsvärdering

Ett säkerhetsverktyg för företag

En dataleverantör till media

Fokus är:
Data.
Visualisering.
Riskanalys.
Skalbarhet.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://crimealert.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/c9c5629c-ccab-4cdc-9797-2cb282162906).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
