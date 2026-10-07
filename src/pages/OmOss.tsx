import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useSEO } from '@/hooks/useSEO';
import { ABOUT_CONTACT as CONTACT, aboutJsonLd, FOUNDER } from '@/lib/about';
import { TRUSTPILOT_REVIEW_URL } from '@/lib/trustpilot';
import { Eye, MessageSquare, Scale, Star, Users } from 'lucide-react';

const goals = [
  {
    icon: Eye,
    title: 'Trygghet genom kunskap',
    desc: 'Den som vet vad som faktiskt händer kan fatta bättre beslut, oavsett om det gäller vägen hem en sen kväll, var barnen rör sig eller var man ska flytta.',
  },
  {
    icon: Scale,
    title: 'Fakta, inte rykten',
    desc: 'Vi visar det Polisen publicerar, med källa och tidpunkt. Inga spekulationer och inga rubriker som ska skrämma. CrimeAlert är en fristående tjänst och inte en del av Polisen.',
  },
  {
    icon: Users,
    title: 'Öppet för alla',
    desc: 'Kartan, flödet och notiserna är gratis att använda. Pro finns för dig som vill ha händelserna direkt, längre historik och statistik.',
  },
];

// One page in three parts, with the part's number in a column on the left on larger screens
const part = 'grid gap-3 py-10 md:grid-cols-[160px_1fr] md:gap-8 md:py-14';

const OmOss = () => {
  useSEO({
    title: 'Om CrimeAlert – Polisens händelser på karta i hela Sverige',
    description: `CrimeAlert grundades av ${FOUNDER.name} och visar Polisens händelser på karta i Sveriges 290 kommuner, med notiser, statistik och 60 dagars historik.`,
    canonical: 'https://crimealert.se/om-oss',
  });

  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="ca-dark min-h-[100dvh] flex flex-col">
      <Header />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: aboutJsonLd() }} />

      <main className="flex-1">
        {/* Datastrip */}
        <div className="border-y border-[hsl(var(--ca-line))] bg-[hsl(var(--ca-base-2))]">
          <div className="max-w-4xl mx-auto px-4 py-2 flex items-center gap-4 overflow-x-auto">
            <span className="flex items-center gap-2 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--ca-red))] animate-pulse-dot" />
              <span className="ca-meta text-[hsl(var(--ca-text-2))]">uppdateras var femte minut</span>
            </span>
            <span className="ca-meta shrink-0">/ 290 kommuner</span>
            <span className="ca-meta shrink-0">/ källa polisen.se</span>
            <span className="ca-meta shrink-0 ml-auto">
              {clock.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })} cet
            </span>
          </div>
        </div>

        {/* Intro */}
        <section className="relative overflow-hidden border-b border-[hsl(var(--ca-line))]">
          <div className="absolute inset-0 ca-hud opacity-60 pointer-events-none" />
          <div className="absolute inset-0 ca-vignette pointer-events-none" />
          <div className="relative max-w-4xl mx-auto px-4 py-14 md:py-20">
            <p className="ca-eyebrow">// om tjänsten</p>
            <h1 className="ca-display mt-3 text-3xl md:text-5xl text-[hsl(var(--ca-text))]">
              Om oss
            </h1>
            <p className="mt-6 max-w-2xl text-base md:text-lg leading-relaxed text-[hsl(var(--ca-text-2))]">
              Bakom CrimeAlert står grundaren{' '}
              <strong className="whitespace-nowrap font-semibold text-[hsl(var(--ca-text))]">{FOUNDER.name}</strong>, och idén är enkel:
              det ska gå att se vad som händer där man bor, utan att leta igenom polisen.se eller lita på rykten i
              sociala medier.
            </p>
          </div>
        </section>

        <div className="max-w-4xl mx-auto px-4 divide-y divide-[hsl(var(--ca-line))]">
          {/* Bakgrund */}
          <section className={part}>
            <p className="ca-meta">01 / bakgrund</p>
            <div className="max-w-2xl space-y-4 text-sm md:text-[15px] leading-relaxed text-[hsl(var(--ca-text-2))]">
              <p>
                Därför hämtar CrimeAlert Polisens händelser direkt från det officiella flödet på polisen.se och placerar
                dem på en karta över Sveriges alla 290 kommuner. Ett inbrott, en trafikolycka på E4:an eller en brand i
                ett flerfamiljshus syns inom några minuter efter att Polisen publicerat den.
              </p>
              <p>
                Kartan uppdateras var femte minut. Med Pro ser du händelserna direkt när de publiceras, med ett
                gratiskonto 15 minuter senare.
              </p>
              <p>
                Informationen finns redan och är öppen för alla. Den behövde bara bli lätt att hitta, lätt att förstå
                och snabb att få, för dig som vill veta vad som hänt på din egen gata, i din kommun eller där dina barn
                rör sig.
              </p>
              <p>
                Börja med <Link to="/karta" className="text-[hsl(var(--ca-text))] underline underline-offset-4">kartan</Link> eller
                hitta <Link to="/kommun" className="text-[hsl(var(--ca-text))] underline underline-offset-4">din kommun</Link>.
              </p>
            </div>
          </section>

          {/* Mål */}
          <section className={part}>
            <p className="ca-meta">02 / mål</p>
            <div className="max-w-2xl">
              <h2 className="ca-display text-xl md:text-2xl text-[hsl(var(--ca-text))]">Vad vi strävar efter</h2>
              <ul className="mt-5 space-y-5">
                {goals.map(({ icon: Icon, title, desc }) => (
                  <li key={title} className="flex gap-4">
                    <span className="ca-tac flex h-9 w-9 shrink-0 items-center justify-center">
                      <Icon className="w-4 h-4 text-[hsl(var(--ca-red))]" />
                    </span>
                    <div>
                      <h3 className="ca-mono text-[11px] uppercase tracking-[0.18em] text-[hsl(var(--ca-text))]">{title}</h3>
                      <p className="mt-1.5 text-[13px] md:text-sm leading-relaxed text-[hsl(var(--ca-text-2))]">{desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Feedback och kontakt */}
          <section className={part}>
            <p className="ca-meta">03 / kontakt</p>
            <div className="max-w-2xl">
              <h2 className="ca-display text-xl md:text-2xl text-[hsl(var(--ca-text))]">Vi vill höra vad du tycker</h2>
              <div className="mt-3 space-y-3 text-sm md:text-[15px] leading-relaxed text-[hsl(var(--ca-text-2))]">
                <p>
                  CrimeAlert blir bättre tack vare dem som använder tjänsten. Saknar du en funktion, har du hittat ett
                  fel eller tycker du att något kan bli enklare? Vi ser alltid fram emot feedback och åsikter om sidan,
                  och allt som kommer in läses av grundaren själv, som också ansvarar för tjänstens innehåll och
                  utveckling.
                </p>
                <p>Frågor om data, felaktiga händelser på kartan eller samarbeten — skriv till oss så återkommer vi.</p>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <a
                  href={`mailto:${CONTACT}`}
                  className="inline-flex items-center gap-2 px-4 py-2.5 ca-tac ca-panel-hover ca-mono text-[11px] uppercase tracking-[0.18em] text-[hsl(var(--ca-text))]"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-[hsl(var(--ca-red))]" />
                  {CONTACT}
                </a>
                <a
                  href={TRUSTPILOT_REVIEW_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 ca-tac ca-panel-hover ca-mono text-[11px] uppercase tracking-[0.18em] text-[hsl(var(--ca-text))]"
                >
                  <Star className="w-3.5 h-3.5 text-[hsl(var(--ca-red))]" />
                  Lämna ett omdöme på Trustpilot
                </a>
              </div>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default OmOss;
