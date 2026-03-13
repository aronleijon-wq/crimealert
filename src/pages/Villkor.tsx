import Header from '@/components/Header';
import { ArrowLeft, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Villkor = () => {
  const navigate = useNavigate();

  return (
    <div className="h-screen flex flex-col bg-background">
      <Header />
      <div className="flex-1 overflow-y-auto">
        <article className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="flex items-center gap-3 mb-8">
            

            
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">Användarvillkor</h1>
              <p className="text-xs text-muted-foreground">Senast uppdaterad: 7 mars 2026</p>
            </div>
          </div>

          <div className="prose-sm space-y-6 text-muted-foreground text-sm leading-relaxed">
            <section>
              <p>
                Genom att använda CrimeAlert (crimealert.se) godkänner du dessa användarvillkor. Om du inte
                accepterar villkoren ber vi dig att inte använda tjänsten.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">1. Om tjänsten</h2>
              <p>
                CrimeAlert sammanställer och visualiserar offentlig information från Polisen och andra myndigheter
                på en karta i realtid. Tjänsten skapar inte eget innehåll om brott och ansvarar inte för
                riktigheten i den data som hämtas från externa källor.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">2. Användarkonto</h2>
              <p>
                Vissa funktioner kräver att du skapar ett konto. Du ansvarar för att hålla dina inloggningsuppgifter
                säkra och för all aktivitet som sker under ditt konto. Vi förbehåller oss rätten att stänga av
                konton som bryter mot dessa villkor.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">3. Premiumtjänster</h2>
              <p>
                CrimeAlert erbjuder premiumfunktioner genom betalda prenumerationer. Priser och funktioner
                framgår vid köptillfället. Prenumerationer hanteras via Stripe och du kan när som helst
                avsluta din prenumeration via ditt konto. Återbetalning sker enligt gällande konsumentlagstiftning.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">4. Användarinnehåll</h2>
              <p>
                Om du skickar in medborgarrapporter, recensioner eller annan information via tjänsten garanterar du
                att innehållet är korrekt och inte kränker andras rättigheter. Vi förbehåller oss rätten att ta bort
                innehåll som bedöms vara olämpligt, stötande eller felaktigt.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">5. Tillåten användning</h2>
              <p>Du förbinder dig att:</p>
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li>Inte använda tjänsten för olagliga ändamål</li>
                <li>Inte försöka manipulera eller störa tjänstens funktionalitet</li>
                <li>Inte sprida falsk information via medborgarrapporter</li>
                <li>Inte automatiserat hämta data från tjänsten utan skriftligt tillstånd</li>
                <li>Respektera andra användares integritet</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">6. Ansvarsbegränsning</h2>
              <p>
                CrimeAlert tillhandahålls "i befintligt skick" utan garantier. Vi ansvarar inte för
                skador som uppstår till följd av användning av tjänsten, felaktigheter i data eller
                avbrott i tillgängligheten. Information som visas ska inte användas som enda källa
                för beslut som rör personlig säkerhet.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">7. Immateriella rättigheter</h2>
              <p>
                Allt innehåll, design och kod på CrimeAlert skyddas av upphovsrätt och andra immateriella
                rättigheter. Du får inte kopiera, distribuera eller skapa derivatverk baserat på tjänsten
                utan vårt skriftliga medgivande.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">8. Kommunikation och e-post</h2>
              <p>
                Genom att skapa ett konto och använda tjänsten samtycker du till att CrimeAlert vid behov kan skicka dig e-postmeddelanden relaterade till din användning av tjänsten, exempelvis säkerhetsnotiser, tjänsteuppdateringar och funktionsrelaterad information. Vi skickar aldrig marknadsföring till tredje part och du kan när som helst hantera dina kommunikationsinställningar via din mail hanterare.   
              



              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">9. Integritet och cookies</h2>
              <p>
                Din integritet är viktig för oss. Se vår{' '}
                <button
                  onClick={() => navigate('/sekretesspolicy')}
                  className="text-primary hover:underline font-medium">
                  sekretesspolicy
                </button>{' '}
                och{' '}
                <button
                  onClick={() => navigate('/cookies')}
                  className="text-primary hover:underline font-medium">
                  cookiepolicy
                </button>{' '}
                för mer information om hur vi hanterar dina uppgifter.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">10. Ändringar av villkoren</h2>
              <p>
                Vi kan uppdatera dessa villkor vid behov. Väsentliga ändringar meddelas via tjänsten.
                Fortsatt användning efter ändring innebär att du accepterar de uppdaterade villkoren.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">11. Tillämplig lag</h2>
              <p>
                Dessa villkor regleras av svensk lag. Eventuella tvister ska i första hand lösas genom
                dialog, och i andra hand av svensk domstol.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">Kontakt</h2>
              <p>
                Om du har frågor om dessa användarvillkor är du välkommen att kontakta oss via
                kontaktformuläret på webbplatsen.
              </p>
            </section>
          </div>

          <button
            onClick={() => navigate(-1)}
            className="mt-10 inline-flex items-center gap-2 text-xs text-primary hover:underline font-medium">
            
            <ArrowLeft className="w-3.5 h-3.5" />
            Tillbaka
          </button>
        </article>
      </div>
    </div>);

};

export default Villkor;