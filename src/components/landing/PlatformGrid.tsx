import { Link } from 'react-router-dom';
import { BarChart3, Bell, UserPlus, CreditCard, ArrowUpRight } from 'lucide-react';
import Reveal from './Reveal';

const cards = [
  {
    icon: BarChart3,
    title: 'Analys',
    text: 'Statistik per kommun och kategori, 24 timmar till 60 dagar. Ingår i Pro.',
    to: '/analysis',
  },
  {
    icon: Bell,
    title: 'Notiser',
    text: 'Push direkt till mobilen för de områden du bevakar.',
    to: '/alerts',
  },
  {
    icon: UserPlus,
    title: 'Skapa konto',
    text: 'Bevaka kommuner, få notiser, gilla och kommentera. Gratis.',
    to: '/auth?mode=signup',
  },
  {
    icon: CreditCard,
    title: 'Prisplan',
    text: 'Gratis med 15 minuters fördröjning, Pro i realtid.',
    to: '/prisplan',
  },
];

const PlatformGrid = () => (
  <section className="relative py-24 md:py-32 px-5 md:px-10 border-t border-[hsl(var(--ca-line))]">
    <div className="max-w-[1400px] mx-auto">
      <Reveal>
        <div className="ca-mono text-[10px] tracking-[0.24em] text-[hsl(var(--ca-text-3))] mb-4">
          PLATTFORMEN
        </div>
        <h2 className="ca-display text-[clamp(2rem,5vw,3.6rem)] uppercase max-w-[680px] mb-14">
          Mer än kartan
        </h2>
      </Reveal>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ icon: Icon, title, text, to }, i) => (
          <Reveal key={title} delay={i * 0.08} className="flex">
          <Link
            to={to}
            className="ca-panel ca-panel-hover rounded-xl p-6 md:p-7 flex flex-1 flex-col min-h-[240px] group"
          >
            <div className="flex items-start justify-between">
              <Icon className="w-5 h-5 text-[hsl(var(--ca-steel))]" />
              <ArrowUpRight className="w-4 h-4 text-[hsl(var(--ca-text-3))] transition-all duration-400 group-hover:text-[hsl(var(--ca-text))] group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </div>
            <h3 className="ca-display text-xl uppercase mt-auto">{title}</h3>
            <p className="mt-3 text-[13px] leading-relaxed text-[hsl(var(--ca-text-3))]">{text}</p>
          </Link>
          </Reveal>
        ))}
      </div>
    </div>
  </section>
);

export default PlatformGrid;
