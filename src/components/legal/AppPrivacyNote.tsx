import { isNativeApp } from '@/lib/native';

/**
 * At the top of the privacy and cookie pages inside the iPhone app: the app shows no ads and
 * tracks no one (AdsController keeps AdSense out of it), so what those pages say about ad and
 * analytics cookies is for the website only. Renders nothing on the website.
 */
const AppPrivacyNote = () => {
  if (!isNativeApp()) return null;
  return (
    <section className="ca-tac ca-tac-top p-4">
      <h2 className="text-base font-semibold text-foreground mb-2">I CrimeAlert-appen</h2>
      <p>
        Appen visar ingen reklam och spårar dig inte. Den använder inga cookies för spårning, analys eller annonser och
        delar inga uppgifter med annonsnätverk eller datamäklare. Appen sparar bara det som behövs för att du ska vara
        inloggad och för dina inställningar.
      </p>
    </section>
  );
};

export default AppPrivacyNote;
