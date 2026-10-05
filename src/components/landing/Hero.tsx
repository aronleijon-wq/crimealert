import { Link } from 'react-router-dom';
import { ArrowRight, MapPin } from 'lucide-react';
import OpsMap from './OpsMap';
import { CountUp, LiveClock, LiveLog, ScrambleText } from './HudBits';
import type { LandingLive } from './useLandingLive';

const HEADLINE = ['Aktuell', 'lägesbild,', 'direkt', 'på', 'karta'];


const Stat = ({ label, children, delay }: { label: string; children: React.ReactNode; delay: number }) => (
  <div className="ca-rise" style={{ animationDelay: `${delay}s` }}>
    <div className="ca-mono text-[9px] tracking-[0.2em] text-[hsl(var(--ca-text-3))]">{label}</div>
    <div className="mt-1.5 font-['Archivo',Inter,sans-serif] text-2xl font-extrabold tabular-nums text-[hsl(var(--ca-text))] md:text-3xl">{children}</div>
  </div>
);

const Hero = ({ live }: { live: LandingLive }) => {
  return (
    <section className="relative flex min-h-[100svh] items-end overflow-hidden pb-12 pt-24 md:items-center md:py-28">
      {/* Atmosphere */}
      <div className="absolute inset-0 ca-gridlines opacity-[0.35]" />
      <div className="absolute inset-0 ca-vignette" />
      <div
        className="ca-fog absolute -top-52 left-1/2 h-[700px] w-[1100px] -translate-x-1/2 rounded-full blur-[170px]"
        style={{ background: 'radial-gradient(circle, hsla(0,68%,52%,0.5) 0%, transparent 65%)' }}
      />
      <div className="absolute inset-x-0 top-0 h-px bg-[hsl(var(--ca-line))]" />

      {/* Operations picture: behind the text on phones, beside it on large screens */}
      <div className="ca-map-in absolute inset-x-0 top-14 h-[60svh] opacity-45 lg:bottom-4 lg:left-auto lg:right-0 lg:top-24 lg:h-auto lg:w-[56%] lg:opacity-100">
        <OpsMap events={live.events} focus={live.focus} alignX={0.12} className="h-full w-full" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[hsl(var(--ca-base))] to-transparent lg:hidden" />
        <div className="absolute inset-y-0 left-0 hidden w-40 bg-gradient-to-r from-[hsl(var(--ca-base))] to-transparent lg:block" />
      </div>

      {/* HUD strip */}
      <div className="ca-rise absolute inset-x-0 top-[76px] hidden px-10 lg:block" style={{ animationDelay: '0.2s' }}>
        <div className="mx-auto flex max-w-[1400px] items-center justify-between border-b border-[hsl(var(--ca-line))] pb-2 ca-mono text-[10px] tracking-[0.2em] text-[hsl(var(--ca-text-3))]">
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--ca-red))] animate-pulse-dot" />
            LIVE · LÄGESBILD SVERIGE · 290 KOMMUNER
          </span>
          <span>KÄLLA POLISEN.SE · <LiveClock withDate /></span>
        </div>
      </div>

      <div className="relative mx-auto w-full max-w-[1400px] px-5 md:px-10">
        <div className="max-w-[640px]">

          <h1 className="ca-display max-w-[16ch] text-[clamp(2.6rem,4.6vw,4.6rem)] uppercase leading-[0.95]" aria-label="Aktuell lägesbild, direkt på karta.">
            {HEADLINE.map((word, i) => {
              const last = i === HEADLINE.length - 1;
              return (
                <span key={word}>
                  <span className="inline-block whitespace-nowrap" aria-hidden>
                    {/* The final word holds the width, so nothing moves while it decodes */}
                    <span className="relative inline-block">
                      <span className="invisible">{word}</span>
                      <span className="absolute inset-0"><ScrambleText text={word} delay={150 + i * 170} duration={700} /></span>
                    </span>
                    {last && <span className="text-[hsl(var(--ca-red))]">.</span>}
                  </span>
                  {!last && ' '}
                </span>
              );
            })}
          </h1>

          <p className="ca-rise mt-6 max-w-[480px] text-[15px] leading-relaxed text-[hsl(var(--ca-text-2))] md:text-[17px]" style={{ animationDelay: '0.9s' }}>
            Polisärenden, olyckor och räddningsinsatser i hela Sverige, hämtade löpande och placerade på kartan där de sker.
          </p>

          <div className="ca-rise mt-8 flex flex-wrap items-center gap-3" style={{ animationDelay: '1.05s' }}>
            <Link
              to="/karta"
              className="group relative inline-flex items-center gap-2 overflow-hidden rounded-md bg-[hsl(var(--ca-red))] px-6 py-3.5 text-sm font-medium text-white shadow-[0_0_40px_-8px_hsl(var(--ca-red))] transition hover:brightness-110"
            >
              <span className="ca-shine absolute inset-0" aria-hidden />
              Öppna livekartan
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              to="/karta"
              className="inline-flex items-center gap-2 rounded-md border border-[hsl(var(--ca-line-strong))] px-6 py-3.5 text-sm text-[hsl(var(--ca-text))] backdrop-blur-md transition hover:bg-[hsl(var(--ca-panel-3))]"
            >
              <MapPin className="h-4 w-4" />
              Sök kommun
            </Link>
            <a href="#hur-det-fungerar" className="inline-flex items-center px-2 py-3.5 text-sm text-[hsl(var(--ca-text-3))] transition hover:text-[hsl(var(--ca-text))]">
              Se hur det fungerar
            </a>
          </div>

          <div className="mt-10 grid max-w-[520px] grid-cols-3 gap-6 border-t border-[hsl(var(--ca-line))] pt-5">
            <Stat label="24 TIMMAR" delay={1.2}><CountUp value={live.lastDay} /></Stat>
            <Stat label="KOMMUNER" delay={1.3}><CountUp value={live.kommuner} /></Stat>
            <Stat label="UPPDATERAD" delay={1.4}>{live.updatedAt ?? '—'}</Stat>
          </div>

          {/* Live log on phones and tablets */}
          <div className="ca-rise mt-6 overflow-hidden rounded-sm border border-[hsl(var(--ca-line))] bg-[hsl(var(--ca-base)/0.6)] backdrop-blur lg:hidden" style={{ animationDelay: '1.5s' }}>
            <LiveLog events={live.events} focus={live.focus} loading={live.loading} failed={live.failed} rows={3} />
          </div>
          <p className="mt-3 ca-mono text-[9px] tracking-[0.18em] text-[hsl(var(--ca-text-3))]">
            UTAN KONTO VISAS POLISENS HÄNDELSER MED 15 MIN FÖRDRÖJNING
          </p>
        </div>
      </div>

    </section>
  );
};

export default Hero;
