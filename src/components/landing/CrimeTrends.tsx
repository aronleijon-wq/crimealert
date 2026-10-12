import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { TrendTile } from '@/components/TrendTiles';
import { headlineTiles } from '@/content/crimeTrends';
import Reveal from './Reveal';

/** The national picture in three numbers, with a way into /statistik. */
const CrimeTrends = () => (
  <section id="brottsutvecklingen" className="relative border-t border-[hsl(var(--ca-line))] px-5 py-24 md:px-10 md:py-32">
    <div className="relative mx-auto max-w-[1400px]">
      <Reveal>
        <div className="ca-mono mb-4 text-[10px] tracking-[0.24em] text-[hsl(var(--ca-text-3))]">BROTTSUTVECKLINGEN</div>
        <h2 className="ca-display max-w-[760px] text-[clamp(2rem,5vw,3.6rem)] uppercase">Så har brotten förändrats</h2>
        <p className="mt-6 max-w-[560px] text-[15px] leading-relaxed text-[hsl(var(--ca-text-2))]">
          Officiella siffror från Polisen och Brå för hela Sverige. Skjutningarna har mer än halverats på tre år, medan sprängningarna ökade under 2025.
        </p>
      </Reveal>
      <Reveal className="mt-10 grid gap-3 sm:grid-cols-3" delay={0.1}>
        {headlineTiles().map((t) => <TrendTile key={t.label} {...t} />)}
      </Reveal>
      <Link
        to="/statistik"
        className="group mt-8 inline-flex items-center gap-2 text-sm font-medium text-[hsl(var(--ca-text))] underline decoration-[hsl(var(--ca-red))] underline-offset-4"
      >
        Se all statistik
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </Link>
    </div>
  </section>
);

export default CrimeTrends;
