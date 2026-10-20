# CrimeAlert för iPhone

Appen är ett inbyggt skal (Capacitor) som öppnar https://crimealert.se/karta. Allt du ändrar på
sajten syns direkt i appen, utan ny App Store-version. Sajten känner igen appen och följer Apples
regler där: ingen reklam, ingen försäljning av Pro, ingen Google-inloggning (se `src/lib/native.ts`).

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

- **Pushnotiser:** Apple vill att appen gör mer än webbplatsen (regel 4.2). Nästa steg är riktiga
  pushnotiser via Apple (kräver en APNs-nyckel från ditt utvecklarkonto).
- **Pro:** appen säljer inte Pro och länkar inte till var det säljs. Den som redan har Pro loggar in
  och får det. Vill Apple att Pro ska kunna köpas i appen behövs köp via Apple (t.ex. RevenueCat).
- **Ändrar du `capacitor.config.ts`:** kör `npm install` och `npx cap sync ios` (kräver Node.js).
