import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import Reveal from './Reveal';

const FinalCTA = () => {
  const { user } = useAuth();
  return (
  <section className="relative py-28 md:py-40 px-5 md:px-10 border-t border-[hsl(var(--ca-line))] overflow-hidden">
    <div
      className="absolute inset-x-0 bottom-[-40%] h-[560px] blur-[170px] opacity-[0.13] ca-fog"
      style={{ background: 'radial-gradient(circle at 50% 50%, hsl(var(--ca-red)) 0%, transparent 65%)' }}
    />
    <Reveal className="relative max-w-[1400px] mx-auto text-center">
      <div className="ca-mono text-[10px] tracking-[0.24em] text-[hsl(var(--ca-text-3))] mb-6">
        LIVE • SVERIGE
      </div>
      <h2 className="ca-display text-[clamp(2.2rem,6.5vw,5rem)] uppercase max-w-[900px] mx-auto">
        Se vad som händer just nu
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
          to={user ? '/account' : '/auth?mode=signup'}
          className="inline-flex items-center px-7 py-4 rounded-md border border-[hsl(var(--ca-line-strong))] text-sm hover:bg-[hsl(var(--ca-panel-2))] transition"
        >
          {user ? 'Min profil' : 'Skapa konto'}
        </Link>
      </div>
    </Reveal>
  </section>
  );
};

export default FinalCTA;
