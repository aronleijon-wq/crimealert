## Mål
Göra det enkelt att komma till `/admin`-sidan där alla användares e-postadresser kan laddas ner som CSV.

## Vad som händer just nu
- Sidan **finns redan** på `/admin` med "Hämta användare" + "Ladda ner CSV"-knappar
- Den är skyddad och visas bara för användare med rollen `admin` i `user_roles`-tabellen
- Du står just nu i Cloud-dashboarden (backend-vyn), inte i själva appen — därför ser du inte sidan

## Förslag på lösning

### 1. Lägg till en "Admin"-knapp på kontosidan
På `/account`, om den inloggade användaren är admin, visa en tydlig knapp:
> **Admin – Exportera användare** → går till `/admin`

Knappen är osynlig för vanliga användare (säkert via `user_roles`-kontroll).

### 2. Verifiera att din användare är admin
Innan vi går vidare behöver vi bekräfta att ditt användarkonto har `admin`-rollen i `user_roles`-tabellen. Om inte kommer `/admin` att redirecta dig till startsidan. Jag kontrollerar det och lägger till rollen om den saknas.

### 3. Direktinstruktion (medan vi väntar)
Öppna i en ny flik: **https://crimealert.se/admin**
- Logga in om du inte redan är det
- Klicka **"Hämta användare"**
- Klicka **"Ladda ner CSV"**

## Tekniska detaljer
- Filändring: `src/pages/Account.tsx` — lägg till villkorlig admin-knapp som länkar till `/admin`
- Kontrollera `user_roles` i databasen för din `auth.uid()` och lägg till `admin`-rad om saknas
- Inga schema-ändringar krävs

## Vad jag behöver från dig
Bekräfta att du vill att jag:
1. Lägger till admin-knappen på kontosidan, **och**
2. Verifierar/lägger till admin-rollen för ditt konto (vilken e-post är inloggad?)