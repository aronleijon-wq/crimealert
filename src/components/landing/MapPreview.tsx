import { Link } from 'react-router-dom';
import { Search, SlidersHorizontal, Layers, Clock, ArrowRight } from 'lucide-react';
import OpsMap from './OpsMap';
import { LiveLog } from './HudBits';
import Reveal from './Reveal';
import type { LandingLive } from './useLandingLive';

const categories = ['Polisinsats', 'Brand', 'Ambulans', 'Trafikolycka', 'Övrigt'];

const MapPreview = ({ live }: { live: LandingLive }) => (
  <section className="relative border-t border-[hsl(var(--ca-line))] px-5 py-24 md:px-10 md:py-32">
    <div className="mx-auto max-w-[1400px]">
      <Reveal className="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div>
          <div className="mb-4 ca-mono text-[10px] tracking-[0.24em] text-[hsl(var(--ca-text-3))]">LIVEKARTAN</div>
          <h2 className="ca-display max-w-[760px] text-[clamp(2rem,5vw,3.6rem)] uppercase">Hela Sverige i en vy</h2>
        </div>
        <p className="max-w-[380px] text-[15px] leading-relaxed text-[hsl(var(--ca-text-2))]">
          Sök kommun, filtrera efter kategori och följ händelserna medan de rapporteras, med tid, plats och detaljer i samma vy.
        </p>
      </Reveal>

      <Reveal delay={0.1} className="ca-panel overflow-hidden rounded-xl shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)]">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-[hsl(var(--ca-line))] px-4 py-3">
          <div className="flex min-w-[200px] items-center gap-2 rounded-md border border-[hsl(var(--ca-line))] bg-[hsl(var(--ca-base-2))] px-3 py-2">
            <Search className="h-3.5 w-3.5 text-[hsl(var(--ca-text-3))]" />
            <span className="text-[12px] text-[hsl(var(--ca-text-3))]">Sök kommun eller plats</span>
          </div>
          <span className="flex items-center gap-2 rounded-md border border-[hsl(var(--ca-line))] px-3 py-2 text-[12px] text-[hsl(var(--ca-text-2))]">
            <SlidersHorizontal className="h-3.5 w-3.5" /> Filter
          </span>
          <div className="hidden items-center gap-1.5 md:flex">
            {categories.map((c) => (
              <span key={c} className="rounded border border-[hsl(var(--ca-line-strong))] px-2.5 py-1.5 ca-mono text-[10px] tracking-wider text-[hsl(var(--ca-text))]">
                {c.toUpperCase()}
              </span>
            ))}
          </div>
          <span className="ml-auto flex items-center gap-2 ca-mono text-[10px] tracking-[0.18em] text-[hsl(var(--ca-text-3))]">
            <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--ca-red))] animate-pulse-dot" />
            LIVE · POLISEN.SE
          </span>
        </div>

        <div className="grid md:grid-cols-[320px_1fr]">
          {/* Event list */}
          <div className="border-b border-[hsl(var(--ca-line))] bg-[hsl(var(--ca-panel))] md:border-b-0 md:border-r">
            <div className="py-1.5">
              <LiveLog events={live.events} focus={live.focus} loading={live.loading} failed={live.failed} rows={10} />
            </div>
            <div className="flex items-center gap-2 border-t border-[hsl(var(--ca-line))] px-4 py-3 text-[hsl(var(--ca-text-3))]">
              <Clock className="h-3 w-3" />
              <span className="ca-mono text-[10px] tracking-wider">
                {live.updatedAt ? `UPPDATERAD ${live.updatedAt} · VAR 5:E MINUT` : 'UPPDATERAS LÖPANDE'}
              </span>
            </div>
          </div>

          {/* Map */}
          <div className="relative h-[420px] overflow-hidden bg-[hsl(var(--ca-base-2))] md:h-[560px]">
            <div className="absolute inset-0 ca-gridlines opacity-60" />
            <div className="absolute inset-0">
              <OpsMap events={live.events} focus={live.focus} className="h-full w-full" />
            </div>
            <div className="absolute left-4 top-4 flex items-center gap-2 rounded-md border border-[hsl(var(--ca-line))] bg-[hsl(var(--ca-base))]/80 px-3 py-1.5 backdrop-blur">
              <Layers className="h-3 w-3 text-[hsl(var(--ca-text-3))]" />
              <span className="ca-mono text-[10px] tracking-wider text-[hsl(var(--ca-text-2))]">
                {live.lastDay !== null ? `${live.lastDay} HÄNDELSER SENASTE DYGNET` : 'ANSLUTER'}
              </span>
            </div>
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.15} className="mt-10">
        <Link
          to="/karta"
          className="group inline-flex items-center gap-2 rounded-md border border-[hsl(var(--ca-line-strong))] px-6 py-3.5 text-sm transition hover:bg-[hsl(var(--ca-panel-2))]"
        >
          Se alla händelser på kartan
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </Reveal>
    </div>
  </section>
);

export default MapPreview;
