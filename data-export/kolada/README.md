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
