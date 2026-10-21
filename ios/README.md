# CrimeAlert för iPhone

Appen är ett inbyggt skal (Capacitor) som öppnar https://crimealert.se/karta. Allt du ändrar på
sajten syns direkt i appen, utan ny App Store-version. Sajten känner igen appen och följer Apples
regler där: ingen reklam och ingen försäljning av Pro (se `src/lib/native.ts`).

Det appen gör själv (`App/AppDelegate.swift`, används av sajten via `src/lib/nativeApp.ts`):

- **Notiser via Apple (APNs).** Telefonens adress sparas bland notisprenumerationerna, så allt sajten
  skickar når även appen (`supabase/functions/_shared/apns.ts`).
- **Logga in med Apple eller Google** i Apples inloggningsfönster, eftersom Google inte tillåter
  inloggning i en apps webbvy. Fönstret öppnar `/app-login` och lämnar tillbaka inloggningen till appen.
- **Pro via App Store** (StoreKit). Servern frågar Apple om varje köp (`apple-subscription`,
  `apple-notifications`) och ger kontot Pro, även på webben.
- **Eget utseende** (`src/native`): flikar längst ner, egen titelrad, iPhones typsnitt och en
  välkomstguide första gången. Webbplatsen påverkas inte; allt det laddas bara i appen.

## Kör appen på din iPhone

1. Öppna Xcode → **Clone Git Repository…** och klistra in
   `https://github.com/aronleijon-wq/crimealert.git` → **Clone**.
2. Öppna `crimealert/ios/App/App.xcodeproj` (File → Open).
   Vänta tills Xcode har hämtat Capacitor (”Resolving Package Graph” längst upp).
3. Klicka på **App** överst till vänster → målet **App** → fliken **Signing & Capabilities**.
   - **Team:** välj ditt Apple-ID (lägg till det under Xcode → Settings → Accounts om det saknas).
   - **Bundle Identifier:** `se.crimealert.app` (ändra om Xcode säger att det är upptaget).
4. Koppla in din iPhone med kabel och välj den överst i Xcode.
   På telefonen: Inställningar → Integritet och säkerhet → **Utvecklarläge** på.
5. Tryck på ▶︎. Första gången: på telefonen, Inställningar → Allmänt → VPN och enhetshantering →
   lita på ditt utvecklarcertifikat.

Ingen npm eller Terminal behövs för detta.

## Notiser: en gång i ditt utvecklarkonto

1. developer.apple.com → **Certificates, IDs & Profiles → Keys → +**. Namn: `CrimeAlert APNs`,
   kryssa i **Apple Push Notifications service (APNs)** → Continue → Register.
2. **Ladda ner** nyckeln (`AuthKey_XXXXXXXXXX.p8`). Det går bara en gång, så spara filen.
   Skriv upp **Key ID** (10 tecken) och ditt **Team ID** (under Membership, eller uppe till höger).
3. I Lovable: lägg till tre secrets (Cloud → Secrets, eller be Lovable i chatten att lägga till dem,
   så får du ett formulär). Klistra aldrig in nyckeln som vanlig text i en chatt.
   - `APNS_KEY_ID` = Key ID
   - `APNS_TEAM_ID` = Team ID
   - `APNS_PRIVATE_KEY` = hela innehållet i `.p8`-filen (öppna den i TextEdit)
4. Notiser finns i bygget du arkiverar (Release: TestFlight och App Store), via
   `App/App.entitlements`. När du kör appen med ▶︎ (Debug) är de avstängda, så att den går att köra
   även utan betalt utvecklarkonto.

Testa i TestFlight: logga in, gå till **Notiser → Slå på notiser → Skicka testnotis**.

## Logga in med Apple

I Lovable: **Cloud → Users → Authentication** (inloggningsmetoder) och se till att **Apple** är på,
precis som Google. Apple kräver att appen erbjuder Logga in med Apple när den erbjuder Google.

## Anmälningar: varje dag

Apple kräver att anmälda kommentarer och rapporter hanteras inom 24 timmar. Öppna
https://crimealert.se/admin, högst upp finns **Anmälda inlägg**: Ta bort, Ta bort och stäng av
skribenten, eller Avfärda. Tre anmälningar döljer ett inlägg för alla tills du har hanterat det.

## Till App Store

1. Gå med i Apple Developer Program (99 USD/år).
2. App Store Connect → **Appar → +** → Ny app: namn CrimeAlert, språk svenska, bundle id
   `se.crimealert.app`, SKU t.ex. `crimealert-ios`.
3. I Xcode: välj **Any iOS Device (arm64)** → Product → **Archive** → **Distribute App** →
   **App Store Connect** → Upload.
4. Testa först via **TestFlight**. Fyll sedan i:
   - Skärmbilder (6,7" och 6,5" iPhone)
   - Integritetspolicy: https://crimealert.se/sekretesspolicy
   - Support: https://crimealert.se/om-oss
   - Dataskydd (”App Privacy”): e-post och konto (inloggning), ungefärlig plats (om användaren väljer
     att använda sin plats), användningsdata utan spårning. Ingen reklam i appen.
   - Granskningsanteckning: ett testkonto (e-post + lösenord) och att konto raderas under
     Profil → Radera konto.

## Inför granskningen

Texter, nyckelord, dataskyddssvar och granskningsanteckning finns i `APPSTORE.md`.

- **Ny version i App Store** behövs bara när något i `ios/` ändras. Höj då **Build** (och
  **Version** vid större ändringar) under målet App → General innan du arkiverar.
- **Pro:** säljs i appen via Apple. Stegen i App Store Connect finns i `APPSTORE.md`
  (Prenumerationen). Den som har Pro från webben har det i appen också, och tvärtom.
- **Ändrar du `capacitor.config.ts`:** kör `npm install` och `npx cap sync ios` (kräver Node.js),
  eller ändra samma sak i `App/App/capacitor.config.json`.
