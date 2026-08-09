import Header from '@/components/Header';
import { useSEO } from '@/hooks/useSEO';
import { ArrowLeft, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Sekretesspolicy = () => {
  useSEO({ title: 'Sekretesspolicy | CrimeAlert', description: 'Så samlar CrimeAlert in, använder och skyddar dina personuppgifter. Läs om cookies, lagring, rättigheter och kontakt.', canonical: 'https://crimealert.se/sekretesspolicy' });
  const navigate = useNavigate();

  return (
    <div className="h-screen flex flex-col bg-background">
      <Header />
      <div className="flex-1 overflow-y-auto">
        <article className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">Sekretesspolicy</h1>
              <p className="text-xs text-muted-foreground">Senast uppdaterad: 7 mars 2026</p>
            </div>
          </div>

          <div className="prose-sm space-y-6 text-muted-foreground text-sm leading-relaxed">
            <section>
              <p>
                CrimeAlert (crimealert.se) värnar om din integritet. Denna sekretesspolicy förklarar vilken information vi
                samlar in, hur vi använder den och vilka rättigheter du har. Tjänsten sammanställer och visualiserar offentlig
                information från Polisen och andra myndigheter – vi skapar inte eget innehåll om brott.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">1. Insamling av information</h2>
              <p>Vi samlar in följande typer av information:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>
                  <strong>Kontoinformation:</strong> E-postadress och namn vid registrering och inloggning. Om du loggar in
                  via Google OAuth samlar vi in din e-postadress och ditt namn från ditt Google-konto för att identifiera dig
                  och tillhandahålla tjänsten.
                </li>
                <li>
                  <strong>Betalningsuppgifter:</strong> Hanteras av vår betalningsleverantör Stripe. Vi lagrar aldrig
                  kortnummer eller bankuppgifter.
                </li>
                <li>
                  <strong>Användningsdata:</strong> Anonymiserad statistik om hur du använder tjänsten (t.ex. vilka sidor
                  du besöker och vilka filter du använder).
                </li>
                <li>
                  <strong>Kommunbevakning:</strong> Vilka kommuner du väljer att bevaka lagras kopplat till ditt konto.
                </li>
                <li>
                  <strong>Användarrapporter:</strong> Om du skickar in rapporter via Medborgarrapporter lagras titel,
                  beskrivning, kategori och ungefärlig plats.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">2. Användning av information</h2>
              <p>Vi använder din information för att:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>Tillhandahålla och förbättra tjänsten – inklusive att visa brottshändelser i din närhet.</li>
                <li>Hantera ditt konto och din prenumeration.</li>
                <li>Skicka relevanta notiser om händelser i kommuner du bevakar.</li>
                <li>Analysera trafik och användarmönster för att förbättra upplevelsen.</li>
                <li>Visa annonser via Google AdSense (gäller ej Pro-medlemmar).</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">3. Offentlig data</h2>
              <p>
                CrimeAlert sammanställer och presenterar offentlig information som publiceras av Polismyndigheten och andra
                svenska myndigheter. Denna information är redan tillgänglig för allmänheten. Vi visar inga personuppgifter
                om brottsoffer, misstänkta eller vittnen. Exakta adresser visas aldrig – händelser placeras på en ungefärlig
                position baserat på område eller stadsdel.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">4. Tredjepartsdelning</h2>
              <p>
                Vi säljer aldrig din personliga information. Dock delar vi viss data med betrodda tredjepartsleverantörer
                som hjälper oss att driva tjänsten:
              </p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>
                  <strong>Google Analytics:</strong> Anonymiserad trafikdata för att förstå användningsmönster.
                </li>
                <li>
                  <strong>Google AdSense:</strong> Kan använda cookies för att visa anpassade annonser. Se vår{' '}
                  <button onClick={() => navigate('/cookies')} className="text-primary hover:underline">
                    cookiepolicy
                  </button>{' '}
                  för mer information.
                </li>
                <li>
                  <strong>Leaflet / OpenStreetMap:</strong> Karttjänst för att visa händelser på kartan.
                </li>
                <li>
                  <strong>Stripe:</strong> Säker betalningshantering för Pro-prenumerationer.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">5. Dina rättigheter enligt GDPR</h2>
              <p>Enligt EU:s dataskyddsförordning (GDPR) har du rätt att:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>
                  <strong>Tillgång:</strong> Begära en kopia av den information vi har om dig.
                </li>
                <li>
                  <strong>Rättelse:</strong> Begära att felaktig information korrigeras.
                </li>
                <li>
                  <strong>Radering:</strong> Begära att dina personuppgifter raderas ("rätten att bli glömd").
                </li>
                <li>
                  <strong>Portabilitet:</strong> Begära att dina uppgifter överförs till en annan tjänst.
                </li>
                <li>
                  <strong>Invändning:</strong> Invända mot viss typ av behandling, t.ex. direktmarknadsföring.
                </li>
                <li>
                  <strong>Begränsning:</strong> Begära att behandlingen av dina uppgifter begränsas.
                </li>
              </ul>
              <p className="mt-2">
                För att utöva dina rättigheter, kontakta oss via formuläret på{' '}
                <button onClick={() => navigate('/account')} className="text-primary hover:underline">
                  kontosidan
                </button>
                .
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">6. Datalagring och säkerhet</h2>
              <p>
                Din data lagras säkert på servrar inom EU. Vi använder kryptering och branschstandard för att skydda din
                information. Betalningsuppgifter hanteras uteslutande av Stripe och passerar aldrig våra servrar.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">7. Barn</h2>
              <p>
                CrimeAlert riktar sig inte till barn under 16 år. Vi samlar inte medvetet in personuppgifter från barn. Om
                du som vårdnadshavare upptäcker att ditt barn har lämnat personuppgifter, kontakta oss så raderar vi dem.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">8. Ändringar i policyn</h2>
              <p>
                Vi kan uppdatera denna policy vid behov. Väsentliga ändringar meddelas via e-post eller i tjänsten. Den
                senaste versionen finns alltid tillgänglig på denna sida.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">9. Kontakt</h2>
              <p>
                Har du frågor om hur vi hanterar dina personuppgifter? Kontakta oss via formuläret på{' '}
                <button onClick={() => navigate('/account')} className="text-primary hover:underline">
                  kontosidan
                </button>
                .
              </p>
            </section>
          </div>

          <div className="mt-10 pt-6 border-t border-border">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition"
            >
              <ArrowLeft className="w-4 h-4" /> Tillbaka till startsidan
            </button>
          </div>
        </article>
      </div>
    </div>
  );
};

export default Sekretesspolicy;
