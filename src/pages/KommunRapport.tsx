import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BarChart3, BellRing, CalendarDays, ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react';
import Header from '@/components/Header';
import { supabase } from '@/integrations/supabase/client';
import { useSEO } from '@/hooks/useSEO';
import { kommunFromSlug, kommunPath } from '@/lib/kommunPages';
import {
  averagePerDay, buildMonthReport, isMonth, monthLabel, monthSummary, REPORT_START, shiftMonth, stockholmToday,
  type MonthReport, type MonthRow,
} from '@/lib/monthlyReport';

const fetchMonth = async (kommun: string, month: string): Promise<MonthRow[]> => {
  const { data, error } = await supabase.rpc('kommun_month_counts', { _kommun: kommun, _month: `${month}-01` });
  if (error) throw error;
  return (data ?? []) as MonthRow[];
};

const Stat = ({ icon: Icon, label, value }: { icon: typeof BarChart3; label: string; value: string | number }) => (
  <div className="rounded-xl border border-[hsl(var(--ca-line-strong))] bg-card px-3 py-2.5">
    <p className="ca-meta flex items-center gap-1.5 !text-[9px]"><Icon className="h-3 w-3" />{label}</p>
    <p className="mt-1 truncate font-['Archivo',Inter,sans-serif] text-xl font-extrabold tabular-nums text-foreground">{value}</p>
  </div>
);

const reportJsonLd = (kommun: string, month: string, summary: string, published: string) =>
  JSON.stringify([
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Kommuner', item: 'https://crimealert.se/kommun' },
        { '@type': 'ListItem', position: 2, name: kommun, item: `https://crimealert.se${kommunPath(kommun)}` },
        { '@type': 'ListItem', position: 3, name: monthLabel(month), item: `https://crimealert.se${kommunPath(kommun)}/${month}` },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: `Polisens händelser i ${kommun} i ${monthLabel(month)}`,
      description: summary,
      inLanguage: 'sv-SE',
      datePublished: published,
      dateModified: published,
      author: { '@type': 'Organization', name: 'CrimeAlert', url: 'https://crimealert.se' },
      publisher: { '@type': 'Organization', name: 'CrimeAlert', logo: { '@type': 'ImageObject', url: 'https://crimealert.se/pwa-512x512.png' } },
      mainEntityOfPage: `https://crimealert.se${kommunPath(kommun)}/${month}`,
      about: { '@type': 'Place', name: kommun, address: { '@type': 'PostalAddress', addressCountry: 'SE' } },
    },
  ]);

/** Polisen's events in one kommun in one month: a summary, the commonest kinds and every day. */
const KommunRapport = () => {
  const { slug, month } = useParams();
  const name = kommunFromSlug(slug);
  const today = stockholmToday();
  const valid = !!name && isMonth(month) && month >= REPORT_START && month <= today.month;
  const [report, setReport] = useState<MonthReport | null>(null);
  const [previous, setPrevious] = useState<MonthReport | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!valid || !name || !month) return;
    let live = true;
    setReport(null);
    setPrevious(null);
    setFailed(false);
    const prevMonth = shiftMonth(month, -1);
    Promise.all([fetchMonth(name, month), prevMonth >= REPORT_START ? fetchMonth(name, prevMonth) : Promise.resolve(null)])
      .then(([rows, prevRows]) => {
        if (!live) return;
        setReport(buildMonthReport(rows, name, month));
        setPrevious(prevRows ? buildMonthReport(prevRows, name, prevMonth) : null);
      })
      .catch(() => live && setFailed(true));
    return () => { live = false; };
  }, [valid, name, month]);

  const summary = report && name ? monthSummary(name, report, previous) : '';
  const label = valid && month ? monthLabel(month) : '';
  useSEO({
    title: valid ? `Polisen ${name} ${label} – månadsrapport | CrimeAlert` : 'Rapporten finns inte | CrimeAlert',
    description: summary || (valid ? `Polisens händelser i ${name} i ${label}: antal, vanligaste händelserna och utvecklingen dag för dag.` : 'Månadsrapporter per kommun på CrimeAlert.'),
    canonical: valid && name ? `https://crimealert.se${kommunPath(name)}/${month}` : 'https://crimealert.se/kommun',
  });

  if (!valid || !name || !month) {
    return (
      <div className="ca-dark flex h-[100dvh] flex-col">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-md px-4 py-20 text-center">
            <h1 className="ca-display text-4xl uppercase text-foreground">Rapporten finns inte</h1>
            <p className="mt-3 text-sm text-[hsl(var(--ca-text-2))]">Månadsrapporterna börjar i {monthLabel(REPORT_START)}.</p>
            <Link to={name ? kommunPath(name) : '/kommun'} className="mt-6 inline-flex h-11 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground">
              {name ? `Till ${name}` : 'Visa alla kommuner'}
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const prevMonth = shiftMonth(month, -1);
  const nextMonth = shiftMonth(month, 1);
  const top = report?.byCategory.slice(0, 8) ?? [];
  const topMax = top[0]?.count ?? 1;
  const dayMax = Math.max(1, ...(report?.perDay.map((d) => d.events) ?? [1]));
  const published = report?.complete ? `${nextMonth}-01` : today.date;

  return (
    <div className="ca-dark flex h-[100dvh] flex-col">
      <Header />
      <main className="relative flex-1 overflow-y-auto">
        <div className="relative mx-auto max-w-2xl px-4 pb-20">
          <nav aria-label="Brödsmulor" className="ca-meta flex items-center gap-1.5 pt-6 !text-[10px]">
            <Link to="/kommun" className="hover:text-foreground">Kommuner</Link>
            <ChevronRight className="h-3 w-3" aria-hidden />
            <Link to={kommunPath(name)} className="hover:text-foreground">{name}</Link>
            <ChevronRight className="h-3 w-3" aria-hidden />
            <span className="text-foreground">{label}</span>
          </nav>

          <p className="ca-eyebrow mt-5">// månadsrapport</p>
          <h1 className="ca-display mt-3 text-3xl text-foreground sm:text-4xl">Polisens händelser i {name} i {label}</h1>
          {failed ? (
            <p className="mt-4 text-sm text-destructive">Rapporten kunde inte hämtas just nu. Försök igen om en stund.</p>
          ) : (
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[hsl(var(--ca-text-2))]">{summary || 'Räknar ihop månaden…'}</p>
          )}

          {report && (
            <>
              <div className="mt-6 grid grid-cols-3 gap-2">
                <Stat icon={BarChart3} label={report.complete ? 'Hela månaden' : 'Hittills'} value={report.total.toLocaleString('sv-SE')} />
                <Stat icon={CalendarDays} label="Snitt per dag" value={report.days ? averagePerDay(report) : '–'} />
                <Stat icon={TrendingUp} label="Vanligast" value={top[0]?.name ?? '–'} />
              </div>

              {top.length > 0 && (
                <section className="mt-8" aria-labelledby="vanligast">
                  <h2 id="vanligast" className="font-['Archivo',Inter,sans-serif] text-lg font-extrabold text-foreground">Vanligaste händelserna</h2>
                  <ul className="mt-3 space-y-2">
                    {top.map(({ name: category, count }) => (
                      <li key={category} className="flex items-center gap-3 text-[13px]">
                        <span className="w-36 shrink-0 truncate text-[hsl(var(--ca-text-2))]">{category}</span>
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-[hsl(var(--ca-panel-3))]">
                          <span className="block h-full rounded-full bg-[hsl(var(--ca-red))]" style={{ width: `${(count / topMax) * 100}%` }} />
                        </span>
                        <span className="w-10 shrink-0 text-right font-mono tabular-nums text-foreground">{count}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {report.total > 0 && (
                <section className="mt-8" aria-labelledby="perdag">
                  <h2 id="perdag" className="font-['Archivo',Inter,sans-serif] text-lg font-extrabold text-foreground">Dag för dag</h2>
                  <div className="mt-3 flex h-32 items-end gap-[3px] rounded-2xl border border-[hsl(var(--ca-line-strong))] bg-card p-3" role="img"
                    aria-label={`Händelser per dag i ${label}${report.busiestDay ? `, flest den ${Number(report.busiestDay.day.slice(8))}:e med ${report.busiestDay.events}` : ''}`}>
                    {report.perDay.map(({ day, events }) => (
                      <span key={day} title={`${Number(day.slice(8))} ${label.split(' ')[0]}: ${events}`} className="flex-1 rounded-sm bg-[hsl(var(--ca-red))]/70"
                        style={{ height: `${Math.max(2, (events / dayMax) * 100)}%` }} />
                    ))}
                  </div>
                  <p className="ca-meta mt-1.5 flex justify-between !text-[10px]"><span>1 {label.split(' ')[0]}</span><span>{report.days} {label.split(' ')[0]}</span></p>
                </section>
              )}
              <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: reportJsonLd(name, month, summary, published) }} />
            </>
          )}

          <div className="mt-8 flex flex-wrap gap-2">
            <Link to={kommunPath(name)} className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90">
              Senaste händelserna i {name}
            </Link>
            <Link to={`/alerts?kommun=${encodeURIComponent(name)}`} className="inline-flex h-11 items-center gap-2 rounded-xl border border-[hsl(var(--ca-line-strong))] px-5 text-sm font-medium text-foreground transition hover:border-primary/50">
              <BellRing className="h-4 w-4" /> Bevaka {name}
            </Link>
          </div>

          <nav aria-label="Andra månader" className="mt-6 flex items-center justify-between text-sm">
            {prevMonth >= REPORT_START ? (
              <Link to={`${kommunPath(name)}/${prevMonth}`} className="inline-flex items-center gap-1 text-[hsl(var(--ca-text-2))] hover:text-foreground">
                <ChevronLeft className="h-4 w-4" /> {monthLabel(prevMonth)}
              </Link>
            ) : <span />}
            {nextMonth <= today.month && (
              <Link to={`${kommunPath(name)}/${nextMonth}`} className="inline-flex items-center gap-1 text-[hsl(var(--ca-text-2))] hover:text-foreground">
                {monthLabel(nextMonth)} <ChevronRight className="h-4 w-4" />
              </Link>
            )}
          </nav>

          <p className="mt-10 text-xs leading-relaxed text-muted-foreground">
            Rapporten bygger på Polisens händelsenotiser på polisen.se: ett urval av Polisens insatser, inte all brottslighet i kommunen.
            {report?.countyWide && ' Händelser som Polisen bara anger för hela länet räknas också med här.'} Statistik över alla anmälda brott
            publiceras av Brottsförebyggande rådet (Brå).
          </p>
        </div>
      </main>
    </div>
  );
};

export default KommunRapport;
