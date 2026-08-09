import { Link } from 'react-router-dom';
import { Search, SlidersHorizontal, Layers, Clock } from 'lucide-react';
import SwedenMap from './SwedenMap';

const categories = ['Polisinsats', 'Brand', 'Ambulans', 'Trafikolycka', 'Övrigt'];

const feed = [
  { t: 'Polisinsats', p: 'Stockholm', time: '19:42', tone: 'red' },
  { t: 'Trafikolycka', p: 'Göteborg', time: '19:21', tone: 'amber' },
  { t: 'Brand', p: 'Malmö', time: '18:57', tone: 'amber' },
  { t: 'Ambulans', p: 'Uppsala', time: '18:33', tone: 'steel' },
  { t: 'Polisinsats', p: 'Örebro', time: '18:04', tone: 'red' },
];

const toneClass: Record<string, string> = {
  red: 'bg-[hsl(var(--ca-red))]',
  amber: 'bg-[hsl(var(--ca-amber))]',
  steel: 'bg-[hsl(var(--ca-steel))]',
};

const MapPreview = () => (
  <section className="relative py-24 md:py-32 px-5 md:px-10 border-t border-[hsl(var(--ca-line))]">
    <div className="max-w-[1400px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <div className="ca-mono text-[10px] tracking-[0.24em] text-[hsl(var(--ca-text-3))] mb-4">
            LIVEKARTAN
          </div>
          <h2 className="ca-display text-[clamp(2rem,5vw,3.6rem)] uppercase max-w-[620px]">
            Aktuell lägesbild, direkt på karta
          </h2>
        </div>
        <p className="max-w-[380px] text-[15px] leading-relaxed text-[hsl(var(--ca-text-2))]">
          Sök kommun, filtrera efter kategori och följ aktiva händelser tillsammans med tidslinje
          och detaljer i samma vy.
        </p>
      </div>

      <div className="ca-panel rounded-xl overflow-hidden shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)]">
        {/* Verktygsrad */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[hsl(var(--ca-line))] flex-wrap">
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-[hsl(var(--ca-base-2))] border border-[hsl(var(--ca-line))] min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-[hsl(var(--ca-text-3))]" />
            <span className="text-[12px] text-[hsl(var(--ca-text-3))]">Sök kommun eller plats</span>
          </div>
          <button className="flex items-center gap-2 px-3 py-2 rounded-md border border-[hsl(var(--ca-line))] text-[12px] text-[hsl(var(--ca-text-2))] hover:border-[hsl(var(--ca-line-strong))] transition">
            <SlidersHorizontal className="w-3.5 h-3.5" /> Filter
          </button>
          <div className="hidden md:flex items-center gap-1.5">
            {categories.map((c, i) => (
              <span
                key={c}
                className={`ca-mono text-[10px] tracking-wider px-2.5 py-1.5 rounded border transition ${
                  i < 3
                    ? 'border-[hsl(var(--ca-line-strong))] text-[hsl(var(--ca-text))]'
                    : 'border-[hsl(var(--ca-line))] text-[hsl(var(--ca-text-3))]'
                }`}
              >
                {c.toUpperCase()}
              </span>
            ))}
          </div>
          <span className="ml-auto flex items-center gap-2 ca-mono text-[10px] tracking-[0.18em] text-[hsl(var(--ca-text-3))]">
            <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--ca-red))] animate-pulse-dot" />
            LIVE • SENASTE 7 DYGNEN
          </span>
        </div>

        <div className="grid md:grid-cols-[300px_1fr]">
          {/* Panel */}
          <div className="border-b md:border-b-0 md:border-r border-[hsl(var(--ca-line))] bg-[hsl(var(--ca-panel))]">
            {feed.map((f) => (
              <div
                key={f.t + f.time}
                className="px-4 py-3.5 border-b border-[hsl(var(--ca-line))] hover:bg-[hsl(var(--ca-panel-3))] transition"
              >
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${toneClass[f.tone]}`} />
                  <span className="text-[13px] text-[hsl(var(--ca-text))]">{f.t}</span>
                  <span className="ml-auto ca-mono text-[10px] text-[hsl(var(--ca-text-3))]">{f.time}</span>
                </div>
                <div className="ca-mono text-[10px] tracking-wider text-[hsl(var(--ca-text-3))] mt-1.5 pl-3.5">
                  {f.p.toUpperCase()}
                </div>
              </div>
            ))}
            <div className="px-4 py-3 flex items-center gap-2 text-[hsl(var(--ca-text-3))]">
              <Clock className="w-3 h-3" />
              <span className="ca-mono text-[10px] tracking-wider">UPPDATERAS LÖPANDE</span>
            </div>
          </div>

          {/* Karta */}
          <div className="relative h-[380px] md:h-[520px] bg-[hsl(var(--ca-base-2))] overflow-hidden">
            <div className="absolute inset-0 ca-gridlines opacity-60" />
            <div className="absolute inset-0 grid place-items-center py-8">
              <SwedenMap className="h-full w-auto" />
            </div>
            <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-md bg-[hsl(var(--ca-base))]/80 backdrop-blur border border-[hsl(var(--ca-line))]">
              <Layers className="w-3 h-3 text-[hsl(var(--ca-text-3))]" />
              <span className="ca-mono text-[10px] tracking-wider text-[hsl(var(--ca-text-2))]">
                12 AKTIVA
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-10">
        <Link
          to="/karta"
          className="inline-flex items-center gap-2 px-6 py-3.5 rounded-md border border-[hsl(var(--ca-line-strong))] text-sm hover:bg-[hsl(var(--ca-panel-2))] transition"
        >
          Se aktuella händelser
        </Link>
      </div>
    </div>
  </section>
);

export default MapPreview;
