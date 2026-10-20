# CrimeAlert i App Store: allt att fylla i

Texter och svar för App Store Connect, färdiga att klistra in. Stegen för att bygga och ladda upp
finns i `README.md`.

## Appinformation

| Fält | Värde |
| --- | --- |
| Namn | CrimeAlert |
| Underrubrik (max 30) | Polishändelser nära dig |
| Primär kategori | Nyheter |
| Sekundär kategori | Verktyg |
| Integritetspolicy | https://crimealert.se/sekretesspolicy |
| Support-URL | https://crimealert.se/om-oss |
| Marknadsförings-URL | https://crimealert.se |
| Copyright | 2026 Aron Leijon |
| Bundle ID | se.crimealert.app |
| SKU | crimealert-ios |

## Kampanjtext (max 170)

Se vad som händer där du bor, direkt när Polisen rapporterar det. Välj dina kommuner och få en notis när något händer.

## Nyckelord (max 100, kommatecken utan mellanslag)

```
polisen,brott,händelser,karta,blåljus,notiser,trygghet,kommun,inbrott,skjutning,larm,nyheter,rån
```

## Beskrivning

```
CrimeAlert visar Polisens händelser i hela Sverige på en karta, tillsammans med VMA, krisinformation och trafikstörningar. Uppgifterna hämtas från Polisen.se och andra öppna källor var femte minut.

BEVAKA DIN KOMMUN
Välj de kommuner du bryr dig om, där du bor, där barnen går i skolan eller där dina föräldrar bor. Du får en notis när Polisen rapporterar något där, och du väljer själv vilka typer av händelser du vill höra om.

KARTA OCH FLÖDE
Se var det händer och vad som hänt det senaste dygnet. Tryck på en händelse för att läsa Polisens beskrivning, relaterade nyheter och vad andra skriver om den.

STATISTIK FÖR DIN KOMMUN
Följ hur brottsligheten utvecklas i din kommun, med månadsrapporter och jämförelser över tid.

VMA OCH KRISINFORMATION
Viktiga meddelanden till allmänheten och krisinformation visas direkt för alla.

TRYGG GEMENSKAP
Kommentera och reagera på händelser. Du kan anmäla kommentarer och blockera användare, och vi granskar anmälningar inom 24 timmar.

CrimeAlert är en fristående tjänst och inte en del av Polisen. Ring alltid 112 vid nödläge och 114 14 för att lämna tips till Polisen.
```

## Granskningsinformation (App Review)

Skapa först ett testkonto på crimealert.se, till exempel `appreview@crimealert.se`, och ge det Pro så
att granskaren ser allt. Fyll i e-post och lösenord under **Inloggningsuppgifter**, och klistra in:

```
CrimeAlert shows the Swedish Police's public incident reports on a map, with push notifications for the municipalities the user follows.

- Sign in: with the demo account (e-mail and password), or with Sign in with Apple or Google on the sign-in page.
- Notifications: Notiser (bell icon) > choose a municipality > Slå på notiser > Skicka testnotis.
- User-generated content: comments on incidents (and citizen reports for members). Every comment and report has a flag button to report it (with a reason) or block its author. Reported content is hidden from the reporter at once and from everyone after three reports. We review reports within 24 hours in our admin view, remove objectionable content and stop the author from posting. Slurs are filtered before posting. The terms (Profil > Användarvillkor) state zero tolerance for objectionable content.
- Blocked users can be unblocked under Profil > Blockerade.
- Account deletion: Profil > Radera konto.
- The app sells nothing and has no links to purchases. Members who already have CrimeAlert Pro from our website get its features when they sign in.
```

## Åldersgräns

Svara ärligt i frågeformuläret. Det som gäller CrimeAlert:

- **Våld (realistiskt):** Sällan/milt. Händelserna beskriver brott i text, utan bilder.
- **Användargenererat innehåll:** Ja (kommentarer och medborgarrapporter).
- **Meddelanden och chatt:** Nej (inga privata meddelanden).
- Övrigt: Nej.

## Dataskydd (App Privacy)

**Spårning:** Nej. Appen visar ingen reklam och delar inget med annonsnätverk.

Data som samlas in, alla för **Appfunktionalitet** och kopplade till användaren om inget annat står:

| Kategori | Typ | Varför |
| --- | --- | --- |
| Kontaktinformation | E-postadress | Konto och inloggning |
| Kontaktinformation | Namn | Användarnamn vid kommentarer, namn från Google |
| Identifierare | Användar-ID | Kontot |
| Identifierare | Enhets-ID | Adressen Apple skickar notiser till |
| Användarinnehåll | Annat användarinnehåll | Kommentarer, anmälningar, medborgarrapporter |
| Användarinnehåll | Foton | Bild som användaren själv bifogar till en medborgarrapport |
| Plats | Exakt plats | Platsen användaren anger för en medborgarrapport |
| Diagnostik | Kraschdata, prestandadata | Felmeddelanden och laddtider, **inte** kopplade till användaren |
| Användningsdata | Produktinteraktion | Antal sidvisningar, **inte** kopplade till användaren |

Köp: inga i appen. Betalningar på webben sköts av Stripe och samlas inte in av appen.

## Skärmbilder

Apple kräver bilder för 6,9-tumsskärm (1320 × 2868). Ta dem i simulatorn:

1. Välj **iPhone 17 Pro Max** överst i Xcode och tryck på ▶︎.
2. Logga in med testkontot och gå till varje vy.
3. Tryck **⌘S** i simulatorn; bilden hamnar på skrivbordet.

Förslag, 4 till 6 bilder: kartan med händelser, en händelse med beskrivning, Notiser med valda
kommuner, Flöde, statistik för en kommun.

## Övriga frågor i App Store Connect

- **Kryptering:** redan besvarat i appen (`ITSAppUsesNonExemptEncryption` = Nej).
- **Innehållsrättigheter:** Ja, appen visar innehåll från tredje part (Polisens öppna data och
  nyhetsrubriker med källa), och vi har rätt att använda det.
- **Reklam-ID (IDFA):** Nej.
