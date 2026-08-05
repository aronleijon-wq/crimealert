import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const FinalCTA = () => (
  <section className="relative py-28 md:py-40 px-5 md:px-10 border-t border-[hsla(0,0%,100%,0.08)] overflow-hidden">
    <div
      className="absolute inset-x-0 bottom-[-40%] h-[520px] blur-[150px] opacity-[0.14]"
      style={{ background: 'radial-gradient(circle at 50% 50%, hsl(var(--ca-red)) 0%, transparent 65%)' }}
    />
    <div className="relative max-w-[1400px] mx-auto text-center">
      <div className="ca-mono text-[10px] tracking-[0.24em] text-[hsl(var(--ca-text-3))] mb-6">
        SYSTEM • SVERIGE
      </div>
      <h2 className="ca-display text-[clamp(2.2rem,6.5vw,5rem)] uppercase max-w-[900px] mx-auto">
        Öppna livekartan och följ utvecklingen i realtid
      </h2>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Link
          to="/karta"
          className="group inline-flex items-center gap-2 px-7 py-4 rounded-md bg-[hsl(var(--ca-red))] text-white text-sm font-medium hover:brightness-110 transition"
        >
          Öppna livekartan
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </Link>
        <Link
          to="/auth?mode=signup"
          className="inline-flex items-center px-7 py-4 rounded-md border border-[hsla(0,0%,100%,0.12)] text-sm hover:bg-[hsl(var(--ca-panel-2))] transition"
        >
          Skapa konto
        </Link>
      </div>
    </div>
  </section>
);

export default FinalCTA;
