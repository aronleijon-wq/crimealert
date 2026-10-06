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
            <div className="mt-6 max-w-2xl space-y-4 text-sm md:text-[15px] leading-relaxed text-[hsl(var(--ca-text-2))]">
              <p>
                CrimeAlert hämtar Polisens händelser direkt från det officiella flödet på polisen.se och placerar dem
                på en karta över samtliga 290 kommuner. Ett inbrott, en trafikolycka på E4:an eller en brand i ett
                flerfamiljshus syns i tjänsten inom några minuter efter att Polisen publicerat den.
              </p>
              <p>
                Flödet läses av löpande och kartan uppdateras var femte minut. Pro-konton ser händelser direkt när de
                publiceras; gratiskonton ser samma händelser med 15 minuters fördröjning.
              </p>
              <p>
                Tjänsten är byggd för dig som vill veta vad som hänt på din egen gata, i din kommun eller där dina barn
                rör sig — utan att vänta på lokaltidningen eller ett andrahandsrykte i ett kvartersforum.
              </p>
            </div>
          </div>
        </section>

        {/* Grundare */}
        <section className="max-w-4xl mx-auto px-4 py-12 md:py-16">
          <p className="ca-eyebrow">// bakom tjänsten</p>
          <h2 className="ca-display mt-2 text-xl md:text-2xl text-[hsl(var(--ca-text))]">Vem står bakom CrimeAlert?</h2>

          <figure className="ca-tac ca-tac-top mt-6 p-5 md:p-7">
            <blockquote className="max-w-2xl space-y-4 text-sm md:text-[15px] leading-relaxed text-[hsl(var(--ca-text-2))]">
              <p>
                Jag startade CrimeAlert för att jag själv ville veta vad som hände omkring mig, utan att leta igenom
                Polisens webbplats eller lita på rykten i sociala medier. Informationen finns redan och är öppen för
                alla. Den behövde bara bli lätt att hitta, lätt att förstå och snabb att få.
              </p>
              <p>
                Målet är att du ska kunna öppna kartan och på några sekunder förstå vad som händer där du bor. Jag
                ansvarar för tjänstens innehåll och utveckling, så ser du något som är fel är det mig du når.
              </p>
            </blockquote>
            <figcaption className="mt-6 flex items-center gap-3 border-t border-[hsl(var(--ca-line))] pt-4">
              <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--ca-red))]" />
              <span className="text-[15px] font-semibold text-[hsl(var(--ca-text))]">{FOUNDER.name}</span>
              <span className="ca-mono text-[11px] uppercase tracking-[0.18em] text-[hsl(var(--ca-text-3))]">
                {FOUNDER.role}, CrimeAlert
              </span>
            </figcaption>
          </figure>
        </section>

        {/* Mål */}
        <section className="border-t border-[hsl(var(--ca-line))]">
          <div className="max-w-4xl mx-auto px-4 py-12 md:py-16">
            <p className="ca-eyebrow">// vad vi strävar efter</p>
            <h2 className="ca-display mt-2 text-xl md:text-2xl text-[hsl(var(--ca-text))]">Vad vi strävar efter</h2>
            <div className="grid md:grid-cols-3 gap-px mt-6 bg-[hsl(var(--ca-line))]">
              {goals.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="ca-tac ca-tac-top p-5">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-[hsl(var(--ca-red))]" />
                    <h3 className="ca-mono text-[11px] uppercase tracking-[0.18em] text-[hsl(var(--ca-text))]">{title}</h3>
                  </div>
                  <p className="mt-3 text-[13px] leading-relaxed text-[hsl(var(--ca-text-2))]">{desc}</p>
                </div>
              ))}
            </div>
            <p className="mt-5 text-[13px] text-[hsl(var(--ca-text-2))]">
              Börja med <Link to="/karta" className="text-[hsl(var(--ca-text))] underline underline-offset-4">kartan</Link> eller
              hitta <Link to="/kommun" className="text-[hsl(var(--ca-text))] underline underline-offset-4">din kommun</Link>.
            </p>
          </div>
        </section>

        {/* Feedback och kontakt */}
        <section className="border-t border-[hsl(var(--ca-line))]">
          <div className="max-w-4xl mx-auto px-4 py-12 md:py-16">
            <p className="ca-eyebrow">// feedback och kontakt</p>
            <h2 className="ca-display mt-2 text-xl md:text-2xl text-[hsl(var(--ca-text))]">Vi vill höra vad du tycker</h2>
            <div className="mt-3 max-w-xl space-y-3 text-sm leading-relaxed text-[hsl(var(--ca-text-2))]">
              <p>
                CrimeAlert blir bättre tack vare dem som använder tjänsten. Saknar du en funktion, har du hittat ett fel
                eller tycker du att något kan bli enklare? Vi ser alltid fram emot feedback och åsikter om sidan, och vi
                läser allt som kommer in.
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
      </main>

      <Footer />
    </div>
  );
};

export default OmOss;
