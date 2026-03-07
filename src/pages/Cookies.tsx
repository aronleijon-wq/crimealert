import Header from '@/components/Header';
import { ArrowLeft, Cookie } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Cookies = () => {
  const navigate = useNavigate();

  return (
    <div className="h-screen flex flex-col bg-background">
      <Header />
      <div className="flex-1 overflow-y-auto">
        <article className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Cookie className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">Cookies</h1>
              <p className="text-xs text-muted-foreground">Senast uppdaterad: 7 mars 2026</p>
            </div>
          </div>

          <div className="prose-sm space-y-6 text-muted-foreground text-sm leading-relaxed">
            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">Vad är cookies?</h2>
              <p>
                Cookies är små textfiler som lagras på din enhet (dator, mobil eller surfplatta) när du besöker en webbplats.
                De används för att webbplatsen ska fungera korrekt, för att analysera hur besökare använder sidan och för att
                möjliggöra viss funktionalitet som annars inte hade varit tillgänglig.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">Vilka typer av cookies använder vi?</h2>

              <div className="space-y-4">
                <div className="bg-card border border-border rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-1">Nödvändiga cookies</h3>
                  <p>
                    Dessa cookies krävs för att webbplatsen ska fungera och kan inte stängas av. De inkluderar t.ex. cookies
                    för inloggning, sessionshantering och säkerhetsfunktioner. Utan dessa cookies kan vi inte tillhandahålla
                    grundläggande funktioner som kontohantering och betalning.
                  </p>
                </div>

                <div className="bg-card border border-border rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-1">Analyscookies</h3>
                  <p>
                    Vi använder analyskookies (bland annat Google Analytics) för att förstå hur besökare interagerar med vår
                    webbplats. Informationen används för att förbättra sidans prestanda, användarvänlighet och innehåll. Dessa
                    cookies samlar in anonymiserad data som sidvisningar, besökslängd och vilka funktioner som används mest.
                  </p>
                </div>

                <div className="bg-card border border-border rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-1">Marknadsföringscookies</h3>
                  <p>
                    CrimeAlert använder Google AdSense för att visa annonser. Google och dess annonsnätverk kan placera cookies
                    på din enhet för att visa relevanta annonser baserat på dina intressen. Dessa cookies spårar din aktivitet
                    över olika webbplatser för att anpassa annonsupplevelsen. Pro-medlemmar ser inga annonser och berörs därför
                    inte av dessa cookies.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">Tredjepartscookies</h2>
              <p>
                Utöver våra egna cookies kan tredjepartsleverantörer placera cookies på din enhet. Dessa inkluderar:
              </p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li><strong>Google Analytics</strong> – för trafikanalys och besöksstatistik</li>
                <li><strong>Google AdSense</strong> – för att visa anpassade annonser</li>
                <li><strong>Leaflet / OpenStreetMap</strong> – karttjänster för att visa brottshändelser</li>
                <li><strong>Stripe</strong> – för säker betalningshantering</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">Hur stänger man av cookies?</h2>
              <p>
                Du kan hantera och radera cookies via din webbläsares inställningar. Observera att om du blockerar vissa
                cookies kan det påverka webbplatsens funktionalitet.
              </p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li><strong>Chrome:</strong> Inställningar → Sekretess och säkerhet → Cookies</li>
                <li><strong>Firefox:</strong> Inställningar → Sekretess & Säkerhet → Cookies och webbplatsdata</li>
                <li><strong>Safari:</strong> Inställningar → Sekretess → Hantera webbplatsdata</li>
                <li><strong>Edge:</strong> Inställningar → Sekretess, sökning och tjänster → Cookies</li>
              </ul>
              <p className="mt-2">
                Du kan även besöka{' '}
                <a href="https://www.youronlinechoices.eu" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  www.youronlinechoices.eu
                </a>{' '}
                för att hantera intressebaserad annonsering.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">Kontakt</h2>
              <p>
                Har du frågor om vår användning av cookies? Kontakta oss via formuläret på{' '}
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

export default Cookies;
