import { Link } from 'react-router-dom';
import { ArrowRight, ExternalLink } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useSEO } from '@/hooks/useSEO';
import { TrendTile } from '@/components/TrendTiles';
import {
  BRA_2025, EXPLOSIONS, REPORTED, REPORTED_YEARS, SHOOTINGS, first, formatChange, formatNumber, headlineTiles, last, percentChange,
  type Source, type Trend,
} from '@/content/crimeTrends';

const URL = 'https://crimealert.se/statistik';

const jsonLd = () =>
  JSON.stringify([
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'Brottsutvecklingen i Sverige: skjutningar, sprängningar och inbrott',
      description: 'Officiella siffror från Polisen och Brå om hur skjutningar, sprängningar, inbrott och andra brott har förändrats i Sverige.',
      inLanguage: 'sv-SE',
      dateModified: '2026-10-12',
      author: { '@type': 'Organization', name: 'CrimeAlert', url: 'https://crimealert.se' },
      publisher: { '@id': 'https://crimealert.se/#organization' },
      mainEntityOfPage: URL,
      citation: [...SHOOTINGS.sources, BRA_2025].map((s) => s.url),
    },
  ]);

/** Columns per year: the newest in red with its value, earlier years muted, every value on hover and in the table. */
const YearColumns = ({ trend }: { trend: Trend }) => {
  const max = Math.max(...trend.values.map((v) => v.value));
  const newest = last(trend).year;
  return (
    <div role="img" aria-label={`${trend.title} per år: ${trend.values.map((v) => `${v.year} ${formatNumber(v.value)}`).join(', ')}`}>
      <div className="flex h-48 items-end gap-2 border-b border-[hsl(var(--ca-line-strong))]">
        {trend.values.map((v) => (
          <div key={v.year} tabIndex={0} className="group relative flex h-full flex-1 flex-col items-center justify-end outline-none" aria-label={`${v.year}: ${formatNumber(v.value)} ${trend.unit}`}>
            <span className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded border border-[hsl(var(--ca-line-strong))] bg-card px-2 py-1 text-[12px] text-foreground opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus:opacity-100">
              {v.year}: {formatNumber(v.value)} {trend.unit}
            </span>
            {v.year === newest && <span className="mb-1.5 text-sm font-semibold tabular-nums text-foreground">{formatNumber(v.value)}</span>}
            <span
              className={`w-6 rounded-t-[4px] ${v.year === newest ? 'bg-[hsl(var(--ca-red))]' : 'bg-[hsl(var(--ca-text-3)/0.45)]'}`}
              style={{ height: `${Math.max(2, (v.value / max) * 150)}px` }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2 pt-2">
        {trend.values.map((v) => <span key={v.year} className="ca-meta flex-1 text-center">{v.year}</span>)}
      </div>
    </div>
  );
};

const SourceLinks = ({ sources }: { sources: Source[] }) => (
  <ul className="mt-5 space-y-1.5">
    {sources.map((s) => (
      <li key={s.url}>
        <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-1.5 text-[12px] text-[hsl(var(--ca-text-3))] underline-offset-2 hover:text-foreground hover:underline">
          <ExternalLink className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          {s.label}
        </a>
      </li>
    ))}
  </ul>
);

const TrendSection = ({ trend, index }: { trend: Trend; index: number }) => {
  const change = percentChange(first(trend).value, last(trend).value);
  return (
    <section id={trend.id} aria-labelledby={`${trend.id}-rubrik`} className="grid gap-8 py-10 md:grid-cols-[1fr_1.1fr] md:py-14">
      <div>
        <p className="ca-meta">{String(index).padStart(2, '0')} / Polisen</p>
        <h2 id={`${trend.id}-rubrik`} className="ca-display mt-2 text-2xl text-foreground md:text-3xl">{trend.title}</h2>
        <p className="mt-3 text-[15px] text-[hsl(var(--ca-text-2))]">
          <span className="font-semibold text-foreground">{formatNumber(last(trend).value)}</span> {trend.unit} {last(trend).year},{' '}
          <span className="font-semibold text-foreground">{formatChange(change)}</span> jämfört med {first(trend).year}.
        </p>
        <div className="mt-4 space-y-3 text-sm leading-relaxed text-[hsl(var(--ca-text-2))]">
          {trend.text.map((p) => <p key={p}>{p}</p>)}
        </div>
        {trend.halfYear && (
          <p className="mt-4 border-l-2 border-[hsl(var(--ca-red))] pl-3 text-sm text-[hsl(var(--ca-text-2))]">
            {trend.halfYear.label}: <span className="font-semibold text-foreground">{formatNumber(trend.halfYear.value)}</span> {trend.unit}, mot{' '}
            {formatNumber(trend.halfYear.before)} under {trend.halfYear.beforeLabel} ({formatChange(percentChange(trend.halfYear.before, trend.halfYear.value))}).
          </p>
        )}
        <SourceLinks sources={trend.sources} />
      </div>
      <div className="ca-tac p-5">
        <YearColumns trend={trend} />
        <table className="mt-5 w-full text-left text-[13px]">
          <caption className="sr-only">{trend.title} per år</caption>
          <thead>
            <tr className="ca-meta">
              <th scope="col" className="pb-2 font-normal">År</th>
              <th scope="col" className="pb-2 text-right font-normal">{trend.title}</th>
              {trend.details?.map((d) => <th key={d.label} scope="col" className="pb-2 text-right font-normal">{d.label}</th>)}
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {trend.values.map((v, i) => (
              <tr key={v.year} className="border-t border-[hsl(var(--ca-line))]">
                <th scope="row" className="py-2 font-normal text-[hsl(var(--ca-text-2))]">{v.year}</th>
                <td className="py-2 text-right font-semibold text-foreground">{formatNumber(v.value)}</td>
                {trend.details?.map((d) => <td key={d.label} className="py-2 text-right text-foreground">{formatNumber(d.values[i].value)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

const ReportedCrimes = () => {
  const { before, after } = REPORTED_YEARS;
  return (
    <section id="anmalda-brott" aria-labelledby="anmalda-rubrik" className="py-10 md:py-14">
      <p className="ca-meta">03 / Brå</p>
      <h2 id="anmalda-rubrik" className="ca-display mt-2 text-2xl text-foreground md:text-3xl">Anmälda brott</h2>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[hsl(var(--ca-text-2))]">
        Under {after} anmäldes knappt 1,44 miljoner brott i Sverige, 3 % färre än {before}. Stölder och inbrott minskade mest, medan
        misshandel och bedrägerier ökade något. Bostadsinbrotten har enligt Brå i princip halverats sedan 2017.
      </p>

      <div className="ca-tac mt-6 p-5">
        <div className="flex items-center gap-4 text-[12px] text-[hsl(var(--ca-text-2))]" aria-hidden>
          <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-[hsl(var(--ca-text-3)/0.45)]" />{before}</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-[hsl(var(--ca-red))]" />{after}</span>
        </div>
        <ul className="mt-4 divide-y divide-[hsl(var(--ca-line))]">
          {REPORTED.map((r) => {
            const max = Math.max(r.before, r.after);
            const change = percentChange(r.before, r.after);
            return (
              <li key={r.label} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 py-3.5 md:grid-cols-[200px_1fr_auto]">
                <span className="text-sm font-medium text-foreground">{r.label}</span>
                <span className="text-right text-sm tabular-nums text-[hsl(var(--ca-text-2))] md:order-last">
                  <span className="font-semibold text-foreground">{formatNumber(r.after)}</span> ({formatChange(change)})
                </span>
                <div
                  className="col-span-2 space-y-0.5 md:col-span-1"
                  role="img"
                  aria-label={`${r.label}: ${formatNumber(r.before)} år ${before}, ${formatNumber(r.after)} år ${after}`}
                  title={`${before}: ${formatNumber(r.before)} · ${after}: ${formatNumber(r.after)}`}
                >
                  <span className="block h-2 rounded-r-[4px] bg-[hsl(var(--ca-text-3)/0.45)]" style={{ width: `${(r.before / max) * 100}%` }} />
                  <span className="block h-2 rounded-r-[4px] bg-[hsl(var(--ca-red))]" style={{ width: `${(r.after / max) * 100}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      <SourceLinks sources={[BRA_2025]} />
    </section>
  );
};

/** National trends for everyone: Polisen's shootings and explosions, and Brå's reported crimes. */
const Statistik = () => {
  useSEO({
    title: 'Brottsstatistik Sverige: skjutningar, sprängningar och inbrott | CrimeAlert',
    description: 'Så har skjutningar, sprängningar, inbrott och andra brott förändrats i Sverige de senaste åren, med officiella siffror från Polisen och Brå.',
    canonical: URL,
  });

  return (
    <div className="ca-dark flex min-h-[100dvh] flex-col">
      <Header />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd() }} />
      <main className="flex-1">
        <section className="relative overflow-hidden border-b border-[hsl(var(--ca-line))]">
          <div className="pointer-events-none absolute inset-0 ca-hud opacity-60" />
          <div className="pointer-events-none absolute inset-0 ca-vignette" />
          <div className="relative mx-auto max-w-5xl px-4 py-14 md:py-20">
            <p className="ca-eyebrow">// statistik</p>
            <h1 className="ca-display mt-3 text-3xl text-foreground md:text-5xl">Brottsutvecklingen i Sverige</h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-[hsl(var(--ca-text-2))] md:text-lg">
              Hur har skjutningar, sprängningar och inbrott förändrats de senaste åren? Här är de officiella siffrorna från Polisen och
              Brottsförebyggande rådet (Brå) för hela Sverige, samlade på ett ställe.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {headlineTiles().map((t) => <TrendTile key={t.label} {...t} />)}
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-5xl divide-y divide-[hsl(var(--ca-line))] px-4">
          <TrendSection trend={SHOOTINGS} index={1} />
          <TrendSection trend={EXPLOSIONS} index={2} />
          <ReportedCrimes />

          <section aria-labelledby="las-rubrik" className="py-10 md:py-14">
            <h2 id="las-rubrik" className="ca-display text-2xl text-foreground">Så ska du läsa siffrorna</h2>
            <ul className="mt-4 max-w-2xl space-y-3 text-sm leading-relaxed text-[hsl(var(--ca-text-2))]">
              <li>Polisens siffror över skjutningar och sprängningar är preliminära och sammanställs manuellt, så de kan ändras i efterhand.</li>
              <li>Anmälda brott visar inte all brottslighet. Många brott anmäls aldrig, och fler eller färre anmälningar kan också bero på att människor anmäler mer eller mindre, eller på hur brotten registreras.</li>
              <li>
                Siffrorna här gäller hela Sverige och kommer från Polisen och Brå, inte från CrimeAlert. Vill du se hur det ser ut där du bor finns
                Polisens händelsenotiser och månadsrapporter per kommun på <Link to="/kommun" className="text-foreground underline decoration-[hsl(var(--ca-red))] underline-offset-4">kommunsidorna</Link>.
              </li>
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/kommun" className="inline-flex h-11 items-center gap-2 rounded-md bg-[hsl(var(--ca-red))] px-5 text-sm font-semibold text-white transition hover:brightness-110">
                Hitta din kommun <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/karta" className="inline-flex h-11 items-center rounded-md border border-[hsl(var(--ca-line-strong))] px-5 text-sm font-medium text-foreground transition hover:bg-[hsl(var(--ca-panel-3))]">
                Öppna kartan
              </Link>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Statistik;
