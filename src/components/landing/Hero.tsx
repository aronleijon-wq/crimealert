import { Link } from 'react-router-dom';
import { ArrowRight, MapPin } from 'lucide-react';
import SwedenMap from './SwedenMap';

const Hero = () => {
  return (
    <section className="relative min-h-[100svh] flex items-end md:items-center overflow-hidden pt-24 pb-14 md:py-28">
      {/* Bakgrundslager */}
      <div className="absolute inset-0 ca-gridlines opacity-[0.35]" />
      <div className="absolute inset-0 ca-vignette" />
      <div
        className="ca-fog absolute -top-52 left-1/2 -translate-x-1/2 w-[1100px] h-[700px] rounded-full blur-[170px]"
        style={{ background: 'radial-gradient(circle, hsla(0,68%,52%,0.5) 0%, transparent 65%)' }}
      />
      <div
        className="ca-fog absolute bottom-[-30%] left-[-10%] w-[900px] h-[600px] rounded-full blur-[180px] opacity-[0.12]"
        style={{ background: 'radial-gradient(circle, hsla(200,38%,62%,0.5) 0%, transparent 70%)', animationDelay: '-9s' }}
      />
      <div className="absolute inset-x-0 top-0 h-px bg-[hsl(var(--ca-line))]" />

      {/* Kartlager */}
      <div className="absolute right-[-12%] md:right-[4%] top-1/2 -translate-y-1/2 h-[85%] md:h-[92%] opacity-25 md:opacity-50 pointer-events-none">
        <div className="relative h-full">
          <SwedenMap className="h-full w-auto" />
          <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[hsl(var(--ca-steel))]/10 to-transparent ca-scan" />
        </div>
      </div>

      <div className="relative max-w-[1400px] w-full mx-auto px-5 md:px-10">
        <div className="max-w-[820px]">
          <div className="ca-rise flex items-center gap-3 mb-7" style={{ animationDelay: '0.1s' }}>
            <span className="flex items-center gap-2 ca-mono text-[10px] tracking-[0.22em] text-[hsl(var(--ca-text-3))] border border-[hsl(var(--ca-line))] rounded-full px-3 py-1.5 backdrop-blur-md">
              <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--ca-red))] animate-pulse-dot" />
              LIVE • SVERIGE
            </span>
          </div>

          <h1
            className="ca-rise ca-display text-[clamp(2.6rem,8.2vw,6.2rem)] uppercase"
            style={{ animationDelay: '0.28s' }}
          >
            Aktuell lägesbild,
            <br />
            direkt på karta
            <span className="text-[hsl(var(--ca-red))]">.</span>
          </h1>

          <p
            className="ca-rise mt-7 max-w-[520px] text-[15px] md:text-[17px] leading-relaxed text-[hsl(var(--ca-text-2))]"
            style={{ animationDelay: '0.44s' }}
          >
            Polisärenden, olyckor och räddningsinsatser i Sverige — hämtade löpande och
            placerade på kartan där de sker.
          </p>

          <div className="ca-rise mt-9 flex flex-wrap items-center gap-3" style={{ animationDelay: '0.6s' }}>
            <Link
              to="/karta"
              className="group inline-flex items-center gap-2 px-6 py-3.5 rounded-md bg-[hsl(var(--ca-red))] text-white text-sm font-medium hover:brightness-110 transition"
            >
              Öppna livekartan
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              to="/karta"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-md border border-[hsl(var(--ca-line-strong))] text-sm text-[hsl(var(--ca-text))] backdrop-blur-md hover:bg-[hsl(var(--ca-panel-3))] transition"
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
            className="ca-rise mt-14 flex flex-wrap gap-x-10 gap-y-3 border-t border-[hsl(var(--ca-line))] pt-5"
            style={{ animationDelay: '0.76s' }}
          >
            {[
              ['KÄLLA', 'Polisen.se'],
              ['UPPDATERING', 'Var femte minut'],
              ['OMFATTNING', 'Alla 290 kommuner'],
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
