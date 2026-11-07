# Roadmap

## Klart
- [x] App Store-prenumerationsnycklar sparade (APPSTORE_PRIVATE_KEY, APPSTORE_KEY_ID, APPSTORE_ISSUER_ID) och apple-subscription + apple-notifications deployade och testade — svarar 200, inte längre 503/not_configured

- [x] Inbjudningsmigreringen (20261107090000_invites.sql) körd exakt som skriven
- [x] Alla 15 backendfunktioner deployade igen och stickprovstestade (senast 7 nov 17:00)
- [x] MapKit-hemligheter sparade (MAPKIT_KEY_ID, MAPKIT_PRIVATE_KEY)
- [x] Apple Maps på webbens karta också (Karta/Hybrid/Satellit, faller tillbaka till egen karta om Apple inte svarar)
- [x] Nyhetsbrevsmigreringen (20261107120000_newsletter_contacts.sql) körd exakt som skriven

## Väntar på användaren
- Testa iPhone-push i TestFlight (Notiser → Skicka testnotis)
- AdSense-godkännande: kontrollera status i Google-kontot
- Beslut: mobilprestanda (canvas-markörer/kollapsad lista) och SEO-förslag
- Nyhetsbrev: RESEND_API_KEY (och ev. RESEND_AUDIENCE_ID) saknas — utan den läggs ingen till i listan
- "Lägg till marknadsförings liten del" på inloggningssidan: vad den ska innehålla
