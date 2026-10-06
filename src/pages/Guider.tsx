import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useSEO } from '@/hooks/useSEO';
import { GUIDES } from '@/content/guides';

/** The guides: how to follow what happens where you live, and how to read it. */
const Guider = () => {
  useSEO({
    title: 'Guider – trygghet, Polisens händelser och ditt område | CrimeAlert',
    description: 'Guider om hur du ser vad som hänt i ditt område, läser Polisens händelsenotiser, skyddar hemmet mot inbrott och kollar ett område innan du flyttar.',
    canonical: 'https://crimealert.se/guider',
  });
  return (
    <div className="ca-dark min-h-[100dvh] flex flex-col">
      <Header />
      <main className="flex-1">
        <section className="relative overflow-hidden border-b border-[hsl(var(--ca-line))]">
          <div className="absolute inset-0 ca-hud opacity-60 pointer-events-none" />
          <div className="relative max-w-4xl mx-auto px-4 py-14 md:py-20">
            <p className="ca-eyebrow">// guider</p>
            <h1 className="ca-display mt-3 text-3xl md:text-5xl text-[hsl(var(--ca-text))]">Guider</h1>
            <p className="mt-5 max-w-2xl text-sm md:text-[15px] leading-relaxed text-[hsl(var(--ca-text-2))]">
              Hur du följer vad som händer där du bor, hur Polisens händelsenotiser ska läsas och vad du själv kan göra för att känna dig tryggare.
            </p>
          </div>
        </section>
        <section className="max-w-4xl mx-auto px-4 py-12">
          <ul className="grid sm:grid-cols-2 gap-px bg-[hsl(var(--ca-line))]">
            {GUIDES.map((g, i) => (
              <li key={g.slug} className="ca-tac ca-tac-top ca-panel-hover">
                <Link to={`/guider/${g.slug}`} className="group flex h-full flex-col p-5">
                  <span className="ca-meta">{String(i + 1).padStart(2, '0')}</span>
                  <h2 className="mt-2 text-[17px] font-semibold leading-snug text-[hsl(var(--ca-text))]">{g.title}</h2>
                  <p className="mt-2 flex-1 text-[13px] leading-relaxed text-[hsl(var(--ca-text-2))]">{g.description}</p>
                  <span className="mt-4 inline-flex items-center gap-1 ca-mono text-[11px] uppercase tracking-[0.18em] text-[hsl(var(--ca-red))]">
                    Läs guiden <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Guider;
