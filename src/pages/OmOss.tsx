import { useEffect, useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useSEO } from '@/hooks/useSEO';



const useCountUp = (target: number) => {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target);
      return;
    }
    let frame = 0;
    const total = 45;
    const id = setInterval(() => {
      frame++;
      setValue(Math.round(target * (1 - Math.pow(1 - frame / total, 3))));
      if (frame >= total) clearInterval(id);
    }, 22);
    return () => clearInterval(id);
  }, [target]);
  return value;
};

const OmOss = () => {
  useSEO({
    title: 'Om oss — CrimeAlert | Säkerhetskarta för Sverige',
    description:
      'CrimeAlert visar polisanmälda händelser i Sveriges 290 kommuner på karta, hämtade direkt från Polisen.se och uppdaterade löpande.',
    canonical: 'https://crimealert.se/om-oss',
  });

  const events = useCountUp(1247);
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="ca-dark min-h-[100dvh] flex flex-col">
      <Header />

      <main className="flex-1">
        {/* Datastrip */}
        <div className="border-y border-[hsl(var(--ca-line))] bg-[hsl(var(--ca-base-2))]">
          <div className="max-w-4xl mx-auto px-4 py-2 flex items-center gap-4 overflow-x-auto">
            <span className="flex items-center gap-2 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--ca-red))] animate-pulse-dot" />
              <span className="ca-meta text-[hsl(var(--ca-text-2))]">
                {events.toLocaleString('sv-SE')} händelser loggade denna vecka
              </span>
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
                CrimeAlert hämtar polisanmälda händelser direkt från Polisens officiella flöde på polisen.se och
                placerar dem på karta över samtliga 290 kommuner. En rånförsök i Rinkeby, en trafikolycka på E4 eller
                en brand i ett flerfamiljshus syns i tjänsten inom några minuter efter att polisen publicerat den.
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


        {/* Kontakt */}
        <section className="border-t border-[hsl(var(--ca-line))]">
          <div className="max-w-4xl mx-auto px-4 py-12">
            <p className="ca-eyebrow">// kontakt</p>
            <h2 className="ca-display mt-2 text-xl md:text-2xl text-[hsl(var(--ca-text))]">Kontakta redaktionen</h2>
            <p className="mt-3 text-sm text-[hsl(var(--ca-text-2))] max-w-xl leading-relaxed">
              Frågor om data, felaktiga händelser på kartan eller samarbeten — skriv till oss så återkommer vi.
            </p>
            <a
              href="mailto:crimealert.swe@gmail.com"
              className="inline-flex items-center gap-2 mt-5 px-4 py-2.5 ca-tac ca-panel-hover ca-mono text-[11px] uppercase tracking-[0.18em] text-[hsl(var(--ca-text))]"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--ca-red))]" />
              crimealert.swe@gmail.com
            </a>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default OmOss;
