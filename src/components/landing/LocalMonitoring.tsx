import { Link } from 'react-router-dom';
import { Search, Bell, MapPin } from 'lucide-react';

const chips = ['Stockholm', 'Göteborg', 'Malmö', 'Uppsala', 'Västerås', 'Linköping', 'Örebro', 'Helsingborg'];

const LocalMonitoring = () => (
  <section className="relative py-24 md:py-32 px-5 md:px-10 border-t border-[hsl(var(--ca-line))]">
    <div className="absolute inset-0 ca-gridlines opacity-20 pointer-events-none" />
    <div className="relative max-w-[1400px] mx-auto grid lg:grid-cols-2 gap-14 items-center">
      <div>
        <div className="ca-mono text-[10px] tracking-[0.24em] text-[hsl(var(--ca-text-3))] mb-4">
          LOKAL BEVAKNING
        </div>
        <h2 className="ca-display text-[clamp(2rem,5vw,3.6rem)] uppercase max-w-[520px]">
          Följ din kommun
        </h2>
        <p className="mt-6 max-w-[460px] text-[15px] leading-relaxed text-[hsl(var(--ca-text-2))]">
          Sök upp din kommun en gång — sedan ligger den kvar som bevakning med notiser.
        </p>

        <div className="mt-8 flex items-center gap-3 px-4 py-3.5 rounded-md bg-[hsl(var(--ca-panel-3))] backdrop-blur-md border border-[hsl(var(--ca-line-strong))] max-w-[420px]">
          <Search className="w-4 h-4 text-[hsl(var(--ca-text-3))]" />
          <span className="text-[14px] text-[hsl(var(--ca-text-3))]">Sök kommun eller område</span>
        </div>

        <div className="mt-5 flex flex-wrap gap-2 max-w-[520px]">
          {chips.map((c) => (
            <Link
              key={c}
              to="/karta"
              className="px-3 py-1.5 rounded-full border border-[hsl(var(--ca-line))] text-[12px] text-[hsl(var(--ca-text-2))] hover:border-[hsla(0,0%,100%,0.2)] hover:text-[hsl(var(--ca-text))] transition"
            >
              {c}
            </Link>
          ))}
        </div>

        <Link
          to="/karta"
          className="mt-9 inline-flex items-center gap-2 px-6 py-3.5 rounded-md bg-[hsl(var(--ca-red))] text-white text-sm font-medium hover:brightness-110 transition"
        >
          <MapPin className="w-4 h-4" />
          Sök kommun
        </Link>
      </div>

      <div className="ca-panel rounded-xl p-5 md:p-6">
        <div className="flex items-center justify-between mb-5">
          <span className="ca-mono text-[10px] tracking-[0.2em] text-[hsl(var(--ca-text-3))]">
            BEVAKNING • STOCKHOLM
          </span>
          <span className="ca-mono text-[10px] tracking-[0.2em] text-[hsl(var(--ca-red))]">ACTIVE</span>
        </div>

        <div className="space-y-3">
          {[
            ['Polisinsats', 'Södermalm', '19:42'],
            ['Trafikolycka', 'E4 norrgående', '19:05'],
            ['Brand', 'Kista', '18:12'],
          ].map(([t, p, time]) => (
            <div
              key={t}
              className="ca-panel-hover rounded-lg px-4 py-3.5 border border-[hsl(var(--ca-line))] bg-[hsl(var(--ca-base-2))] backdrop-blur-sm"
            >
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-[hsl(var(--ca-text))]">{t}</span>
                <span className="ca-mono text-[10px] text-[hsl(var(--ca-text-3))]">{time}</span>
              </div>
              <div className="ca-mono text-[10px] tracking-wider text-[hsl(var(--ca-text-3))] mt-1">
                {p.toUpperCase()}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-center gap-3 px-4 py-3.5 rounded-lg border border-dashed border-[hsl(var(--ca-line-strong))]">
          <Bell className="w-4 h-4 text-[hsl(var(--ca-amber))]" />
          <span className="text-[12px] text-[hsl(var(--ca-text-2))]">
            Notiser på för valda kategorier
          </span>
        </div>
      </div>
    </div>
  </section>
);

export default LocalMonitoring;
