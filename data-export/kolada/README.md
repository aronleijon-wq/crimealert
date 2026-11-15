# Kolada – reported crimes per kommun (Brå)

Official reported-crime statistics (anmälda brott) per kommun, from Brå (with SCB population figures), published through Kolada.

- **Fetched:** 2026-11-12T17:22:47Z (UTC)
- **API:** `https://api.kolada.se/v3` — the requested v2 API now answers `{"error": "This endpoint is deprecated. Please use /v3 instead."}`, so v3 was used (same endpoints: `/kpi?title=`, `/data/kpi/{id}/year/{year}`, `/municipality?type=K`).
- **Unit:** reported crimes per 100 000 inhabitants, gender total (`T`). The rate is based on the crime location; some reports lack a location, so kommun figures have a varying non-response.
- **Coverage:** all 290 kommuner, for 2025 (latest year with data) and 2024. Kolada lists 2026 data for publication on 2027-03-31.

## Files

- `kpis.json` – one entry per KPI: `id`, `title`, `description`, `municipality_type`, `operating_area`, `source`, `years_available` (years with a value for Stockholm, 0180), `years_exported`.
- `values.json` – list of `{kpi, kommun_id, kommun, year, value}` (9 280 rows = 16 KPIs × 290 kommuner × 2 years).

## KPIs chosen

Selected: titles starting “Anmälda …” or “Anmält …” and ending “antal/100 000 inv”, municipality type K or A, and “Källa: BRÅ och SCB” in the description. Source for all: BRÅ och SCB; operating area: Befolkning.

| KPI | Title | Years available | Exported |
|---|---|---|---|
| N07402 | Anmälda brott om grov kvinnofridskränkning i kommunen, antal/100 000 inv | 2008–2025 | 2024, 2025 |
| N07403 | Anmälda våldsbrott, antal/100 000 inv | 2008–2025 | 2024, 2025 |
| N07536 | Anmälda brott mot frihet och frid, antal/100 000 inv | 2008–2025 | 2024, 2025 |
| N07537 | Anmälda sexualbrott, antal/100 000 inv | 2008–2025 | 2024, 2025 |
| N07538 | Anmälda ekobrott, antal/100 000 inv | 2015–2025 | 2024, 2025 |
| N07540 | Anmälda brott totalt, antal/100 000 inv | 2008–2025 | 2024, 2025 |
| N07541 | Anmält våld i inomhusmiljö mot barn och unga, antal/100 000 inv | 2008–2025 | 2024, 2025 |
| N07542 | Anmält våld i utomhusmiljö mot barn och unga, antal/100 000 inv | 2008–2025 | 2024, 2025 |
| N07543 | Anmälda personrån, antal/100 000 inv | 2008–2025 | 2024, 2025 |
| N07544 | Anmälda narkotikabrott, antal/100 000 inv | 2008–2025 | 2024, 2025 |
| N07546 | Anmälda bostadsinbrott, antal/100 000 inv | 2008–2025 | 2024, 2025 |
| N07547 | Anmälda bilbrott, antal/100 000 inv | 2008–2025 | 2024, 2025 |
| N07548 | Anmälda trafikbrott, antal/100 000 inv | 2008–2025 | 2024, 2025 |
| N07549 | Anmälda misshandelsbrott mot kvinna, inomhus, bekant med offret, antal/100 000 inv | 2008–2025 | 2024, 2025 |
| U07417 | Anmälda stöld- och tillgreppsbrott, antal/100 000 inv | 2008–2025 | 2024, 2025 |
| U07452 | Anmälda brott om skadegörelse, antal/100 000 inv | 2008–2025 | 2024, 2025 |

Excluded: U00489 and U00490 (deviation from a model-estimated value, a 0/1/2 score, not a rate), plus survey KPIs (NTU, Medborgarundersökningen) about worry and self-reported exposure, which are not reported crimes.

## Crime types asked about, and what Kolada has

| Asked about | Kolada KPI per kommun |
|---|---|
| Anmälda brott (total) | Yes – N07540 |
| Inbrott | Only **residential burglary** – N07546 (bostadsinbrott). No KPI for burglary of shops, businesses or other premises. |
| Stöld | Yes – U07417 (all of BrB ch. 8, stöld, rån m.m.); also N07547 (bilbrott) |
| Våld | Yes – N07403 (våldsbrott); related: N07541/N07542 (violence against children), N07549, N07402, N07543 (personrån) |
| Narkotika | Yes – N07544 |
| Skadegörelse | Yes – U07452 |
| **Rattfylleri** | **No.** A title search for “rattfylleri” returns 0 KPIs (“rattonykter” also 0). Rattfylleri is counted inside N07548 (all offences under trafikbrottslagen, 1951:649), but it cannot be separated from other traffic offences there. |

Also: a title search for “bedrägeri” finds no separate fraud rate; fraud is only counted inside N07538 (ekobrott).

---

# Räddningstjänstens insatser per kommun (MSB/MCF)

Statistik över räddningstjänstens insatser till bränder och trafikolyckor per kommun, från MCF (Myndigheten för civilt försvar, tidigare MSB), hämtad via Kolada på samma sätt som Brå-nyckeltalen ovan.

- **Hämtad:** 2026-11-15T11:12:23Z (UTC)
- **API:** `https://api.kolada.se/v3` – `/kpi?title=`, `/kpi/{id}`, `/data/kpi/{id}/year/{year}`, `/municipality?type=K`.
- **Enhet:** antal räddningsinsatser **per 1 000 invånare** (inte per 100 000 som Brå-talen). Kön: Kolada delar inte upp dessa nyckeltal på kön; värdet med `gender = T` används.
- **Obs – glidande medelvärden:** byggnadsbränderna avser femårsperioden T-4 till T, trafikolyckorna ett genomsnitt för T-2 till T. Värdet för ett år är alltså inte bara det årets insatser.

## Filer

- `msb_kpis.json` – ett objekt per nyckeltal: `id`, `title`, `description`, `municipality_type`, `operating_area`, `source`, `years_available` (år där minst en kommun har ett värde), `years_exported`.
- `msb_values.json` – lista med `{kpi, kommun_id, kommun, year, value}`, 1 753 rader. Kommuner utan värde för ett år finns inte med som rader.

## Valda nyckeltal

| KPI | Titel | Typ | År med data | Exporterade år | Kommuner |
|---|---|---|---|---|---|
| N07415 | Byggnadsbränder med spridning från startobjektet, antal/1000 inv | K | 2024 | 2024 | 290 |
| U07415 | Utvecklade bränder i byggnad, antal/1000 inv (-2023) | K | 2007–2023 | 2021, 2022, 2023 | 290 per år |
| N00799 | Trafikolyckor med räddningsinsatser per 1000 inv | A | 2010–2025 | 2023, 2024, 2025 | 290 / **13** / 290 |

Varför:

- **N07415** är det aktuella måttet för bränder i byggnad (bostäder, allmänna byggnader, industri m.m.) som räddningstjänsten gjort insats till. Det har bara data för 2024 än; 2025 publiceras enligt Kolada 2026-12-03.
- **U07415** är föregångaren (utvecklade bränder i byggnad, där det fortfarande brinner när räddningstjänsten kommer). Den slutar 2023 och ersätts av N07415. Kolada skriver att **de två inte är jämförbara** (ändrad definition), så de ska inte sättas ihop till en tidsserie.
- **N00799** är räddningsinsatser till trafikolyckor (alla trafikelement: personbil, lastbil, djur, mc, moped, cykel m.m.). För **2024 har bara 13 kommuner värden** i Kolada; 2023 och 2025 täcker alla 290. Nästa publicering (2026) är 2027-05-05.

Ej med: N00488 (avvikelse från modellberäknat värde, en poäng 0/1/2, inte en kvot), kostnadsmått (N07009, N07020, N07041, U07075), personal (N07032, N07035, U07003), SOS Alarms larm- och responstider (U07440, U07442), enkätmått (Medborgarundersökningen N00629/U01629, Företagsklimat U07446) och IVPA-insatser (U07461, källa Öppna jämförelser, inte MCF).

## Sökt men saknas i Kolada per kommun

Titelsökningar 2026-11-15 och vad de gav:

| Sökning | Träffar | Kommentar |
|---|---|---|
| `brand` | 2 | U07003 (andel kvinnor bland brandpersonal), U07446 (Företagsklimat – brandskydd). Inga insatsmått. |
| `bränder` | 3 | N07415, U07415, N00488 – se ovan. |
| `räddningstjänst` | 9 | Kostnader, personal, larmtider och enkäter – inga antal insatser. |
| `räddningsinsats` | 1 | N00799. |
| `insats` | 97 | Nästan bara socialtjänst/LSS/arbetsmarknad; inga räddningsmått utöver N00799. |
| `olyck` | 6 | N00799, U07413, N00998, N07804, U00487, U07075 – de övriga har andra källor (Socialstyrelsen, Arbetsmiljöverket, STRADA) eller är kostnad/modellavvikelse. |
| `larm` | 9 | Larmtider (SOS Alarm) och trygghetslarm i äldreomsorgen. |
| `bostadsbrand` | 0 | |
| `anlagd`, `anlagda` | 0 | |
| `skogsbrand`, `drunkn`, `omkom`, `döda` | 0 | |

Det betyder:

- **Bränder i bostad / bostadsbrand:** finns inte som eget nyckeltal. Bostäder ingår bara i byggnadsbränderna (N07415/U07415) och går inte att skilja ut där.
- **Anlagda bränder:** finns inte per kommun i Kolada (0 träffar).
- **Räddningstjänstens insatser totalt:** finns inte – Kolada har bara insatser till byggnadsbränder och till trafikolyckor, ingen total.
- **Trafikolyckor där räddningstjänsten larmats:** finns – N00799.
