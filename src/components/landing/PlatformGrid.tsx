import { Link } from 'react-router-dom';
import { BarChart3, Bell, UserPlus, CreditCard, ArrowUpRight } from 'lucide-react';

const cards = [
  {
    icon: BarChart3,
    title: 'Analys',
    text: 'Se händelser i ett större sammanhang med en tydligare uppföljning över tid.',
    to: '/analysis',
  },
  {
    icon: Bell,
    title: 'Notiser',
    text: 'Få uppdateringar om utvalda områden eller kategorier när något nytt inträffar.',
    to: '/alerts',
  },
  {
    icon: UserPlus,
    title: 'Skapa konto',
    text: 'Spara bevakningar, anpassa vyer och samla det som är relevant för dig.',
    to: '/auth?mode=signup',
  },
  {
    icon: CreditCard,
    title: 'Prisplan',
    text: 'Välj den nivå som passar ditt behov, från enkel överblick till mer avancerad bevakning.',
    to: '/account',
  },
];

const PlatformGrid = () => (
  <section className="relative py-24 md:py-32 px-5 md:px-10 border-t border-[hsla(0,0%,100%,0.08)]">
    <div className="max-w-[1400px] mx-auto">
      <div className="ca-mono text-[10px] tracking-[0.24em] text-[hsl(var(--ca-text-3))] mb-4">
        PLATTFORMEN
      </div>
      <h2 className="ca-display text-[clamp(2rem,5vw,3.6rem)] uppercase max-w-[680px] mb-14">
        Mer än en karta
      </h2>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ icon: Icon, title, text, to }) => (
          <Link
            key={title}
            to={to}
            className="ca-panel ca-panel-hover rounded-xl p-6 md:p-7 flex flex-col min-h-[240px] group"
          >
            <div className="flex items-start justify-between">
              <Icon className="w-5 h-5 text-[hsl(var(--ca-steel))]" />
              <ArrowUpRight className="w-4 h-4 text-[hsl(var(--ca-text-3))] transition-all duration-400 group-hover:text-[hsl(var(--ca-text))] group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </div>
            <h3 className="ca-display text-xl uppercase mt-auto">{title}</h3>
            <p className="mt-3 text-[13px] leading-relaxed text-[hsl(var(--ca-text-3))]">{text}</p>
          </Link>
        ))}
      </div>
    </div>
  </section>
);

export default PlatformGrid;
