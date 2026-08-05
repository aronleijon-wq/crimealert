import { Link } from 'react-router-dom';
import { ArrowRight, MapPin } from 'lucide-react';
import SwedenMap from './SwedenMap';

const Hero = () => {
  return (
    <section className="relative min-h-[100svh] flex items-end md:items-center overflow-hidden pt-24 pb-14 md:py-28">
      {/* Bakgrundslager */}
      <div className="absolute inset-0 ca-gridlines opacity-[0.55]" />
      <div className="absolute inset-0 ca-vignette" />
      <div
        className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full blur-[140px] opacity-[0.16]"
        style={{ background: 'radial-gradient(circle, hsl(var(--ca-red)) 0%, transparent 65%)' }}
      />
      <div className="absolute inset-x-0 top-0 h-px bg-[hsla(0,0%,100%,0.08)]" />

      {/* Kartlager */}
      <div className="absolute right-[-12%] md:right-[4%] top-1/2 -translate-y-1/2 h-[85%] md:h-[92%] opacity-45 md:opacity-80 pointer-events-none">
        <div className="relative h-full">
          <SwedenMap className="h-full w-auto" />
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[hsl(var(--ca-steel))]/10 to-transparent ca-sweep" />
        </div>
      </div>

      <div className="relative max-w-[1400px] w-full mx-auto px-5 md:px-10">
        <div className="max-w-[820px]">
          <div className="ca-rise flex items-center gap-3 mb-7" style={{ animationDelay: '0.1s' }}>
            <span className="flex items-center gap-2 ca-mono text-[10px] tracking-[0.22em] text-[hsl(var(--ca-text-3))] border border-[hsla(0,0%,100%,0.08)] rounded-full px-3 py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--ca-red))] animate-pulse-dot" />
              LIVE-DATA • SVERIGE
            </span>
          </div>

          <h1
            className="ca-rise ca-display text-[clamp(2.6rem,8.2vw,6.2rem)] uppercase"
            style={{ animationDelay: '0.22s' }}
          >
            Följ händelser
            <br />
            i Sverige
            <br />
            <span className="text-[hsl(var(--ca-text-3))]">i realtid.</span>
          </h1>

          <p
            className="ca-rise mt-7 max-w-[560px] text-[15px] md:text-[17px] leading-relaxed text-[hsl(var(--ca-text-2))]"
            style={{ animationDelay: '0.34s' }}
          >
            CrimeAlert samlar aktuella polisärenden, olyckor och andra samhällshändelser i en
            interaktiv karta, så att du snabbt kan se vad som händer i ditt område.
          </p>

          <div className="ca-rise mt-9 flex flex-wrap items-center gap-3" style={{ animationDelay: '0.46s' }}>
            <Link
              to="/karta"
              className="group inline-flex items-center gap-2 px-6 py-3.5 rounded-md bg-[hsl(var(--ca-red))] text-white text-sm font-medium hover:brightness-110 transition"
            >
              Öppna livekartan
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              to="/karta"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-md border border-[hsla(0,0%,100%,0.12)] text-sm text-[hsl(var(--ca-text))] hover:bg-[hsl(var(--ca-panel-2))] transition"
            >
              <MapPin className="w-4 h-4" />
              Sök kommun
            </Link>
            <a
              href="#hur-det-fungerar"
              className="inline-flex items-center px-2 py-3.5 text-sm text-[hsl(var(--ca-text-3))] hover:text-[hsl(var(--ca-text))] transition"
            >
              Se hur det fungerar
            </a>
          </div>

          <div
            className="ca-rise mt-14 flex flex-wrap gap-x-10 gap-y-3 border-t border-[hsla(0,0%,100%,0.08)] pt-5"
            style={{ animationDelay: '0.58s' }}
          >
            {[
              ['KÄLLA', 'Polisen.se'],
              ['UPPDATERING', 'Löpande'],
              ['TÄCKNING', 'Hela Sverige'],
            ].map(([k, v]) => (
              <div key={k}>
                <div className="ca-mono text-[9px] tracking-[0.2em] text-[hsl(var(--ca-text-3))]">{k}</div>
                <div className="text-[13px] text-[hsl(var(--ca-text-2))] mt-1">{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
