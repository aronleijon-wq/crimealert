import { lazy, Suspense, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, Lock, Sparkles } from 'lucide-react';
import { useIsPremium } from '@/hooks/useIsPremium';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { usePoliceEvents } from '@/hooks/usePoliceEvents';
import { useSEO } from '@/hooks/useSEO';
import { parseIncidentTime } from '@/lib/incidentTime';
import { canSellPro } from '@/lib/native';
import { kommunPath } from '@/lib/kommunPages';
import { areaStats, inArea, insights, kommunChanges, risingKommuner, WEEKDAYS_SHORT, type AreaStats, type StatEvent, type ThemeTrend } from './stats';
import { useStatsEvents } from './useStatsEvents';
import ShareCardButton from '@/components/ShareCardButton';
import { drawTrendCard } from '@/lib/shareCard';
import { Screen, Segmented } from './ui';
import { Card, FAINT, MUTED } from './StatCard';
import NativeHistory from './NativeHistory';

// The website's analysis page, with everything it has (charts, risk, citizen reports, export),
// under "Analys" next to the app's own trends
const Analysis = lazy(() => import('@/pages/Analysis'));

const RED = '#ff453a';
const GREEN = '#30d158';

/** "+23 %" in red for more crime, "−12 %" in green for less */
const ChangePill = ({ value }: { value: number | null }) => {
  if (value === null) return <span className={`text-[13px] ${FAINT}`}>–</span>;
  const up = value > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[13px] font-semibold tabular-nums"
      style={{ color: value === 0 ? 'rgba(235,235,245,0.6)' : up ? RED : GREEN, background: value === 0 ? 'rgba(118,118,128,0.24)' : up ? 'rgba(255,69,58,0.15)' : 'rgba(48,209,88,0.15)' }}>
      {value !== 0 && <Icon className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />}
      {value > 0 ? '+' : value < 0 ? '−' : '±'}{Math.abs(value)} %
    </span>
  );
};

const Sparkline = ({ values, color }: { values: number[]; color: string }) => {
  const max = Math.max(1, ...values);
  const w = 64;
  const h = 22;
  const step = values.length > 1 ? w / (values.length - 1) : w;
  const points = values.map((v, i) => `${(i * step).toFixed(1)},${(h - 2 - (v / max) * (h - 4)).toFixed(1)}`).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="shrink-0">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};

const PULSE = {
  calm: { label: 'Lugnare än vanligt', color: GREEN },
  normal: { label: 'Som vanligt', color: '#0a84ff' },
  busy: { label: 'Mer än vanligt', color: RED },
};

const Pulse = ({ stats, place }: { stats: AreaStats; place: string }) => {
  const { label, color } = PULSE[stats.pulse.level];
  return (
    <Card title="Läget just nu">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-[44px] font-bold leading-none tracking-tight tabular-nums">{stats.pulse.last24h}</div>
          <div className={`mt-1 text-[15px] ${MUTED}`}>händelser senaste dygnet i {place}</div>
        </div>
        <span className="mb-1 shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-[14px] font-semibold" style={{ color, background: `${color}26` }}>{label}</span>
      </div>
      <div className={`mt-3 text-[13px] ${MUTED}`}>Ett vanligt dygn: {stats.pulse.perDay.toFixed(stats.pulse.perDay < 10 ? 1 : 0).replace('.', ',')} händelser</div>
    </Card>
  );
};

const SinceLast = ({ stats, days }: { stats: AreaStats; days: number }) => (
  <Card title="Dagar sedan senaste" footer={`Räknat på Polisens händelser de senaste ${days} dagarna.`}>
    <div className="grid grid-cols-2 gap-3">
      {stats.sinceLast.map(({ theme, days: since }) => (
        <div key={theme.id} className="rounded-xl bg-[#2c2c2e] px-3 py-2.5">
          <div className="text-[28px] font-bold leading-tight tabular-nums" style={{ color: since === null ? GREEN : since < 2 ? RED : '#fff' }}>
            {since === null ? `${days}+` : since}
          </div>
          <div className={`text-[13px] ${MUTED}`}>{since === 0 ? 'Idag: ' : ''}{theme.label.toLowerCase()}</div>
        </div>
      ))}
    </div>
  </Card>
);

const TrendRow = ({ trend }: { trend: ThemeTrend }) => {
  const color = trend.change === null || trend.change === 0 ? '#8e8e93' : trend.change > 0 ? RED : GREEN;
  return (
    <div className="flex items-center gap-3 border-b border-[rgba(84,84,88,0.65)] py-2.5 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="text-[17px] leading-[22px]">{trend.theme.label}</div>
        <div className={`text-[13px] tabular-nums ${MUTED}`}>{trend.count} st · före {trend.previous}</div>
      </div>
      <Sparkline values={trend.weeks} color={color} />
      <div className="w-[76px] text-right"><ChangePill value={trend.change} /></div>
    </div>
  );
};

const DailyChart = ({ stats }: { stats: AreaStats }) => {
  const max = Math.max(1, ...stats.daily.map((d) => d.count));
  const average = stats.daily.reduce((s, d) => s + d.count, 0) / Math.max(1, stats.daily.length);
  const first = stats.daily[0]?.day.slice(5).split('-').reverse().join('/');
  return (
    <Card title="Dag för dag" footer={`Streckad linje: snitt ${average.toFixed(1).replace('.', ',')} per dag.`}>
      <div className="relative flex h-[120px] items-end gap-[2px]">
        {stats.daily.map((d, i) => (
          <div key={d.day} className="flex-1 rounded-t-[3px]"
            style={{ height: `${Math.max(2, (d.count / max) * 100)}%`, background: i === stats.daily.length - 1 ? RED : 'rgba(255,69,58,0.55)' }}
            title={`${d.day}: ${d.count}`} />
        ))}
        <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-white/50" style={{ bottom: `${(average / max) * 100}%` }} aria-hidden />
      </div>
      <div className={`mt-1.5 flex justify-between text-[12px] ${FAINT}`}><span>{first}</span><span>Idag</span></div>
    </Card>
  );
};

const Heatmap = ({ stats }: { stats: AreaStats }) => {
  const max = Math.max(1, ...stats.heatmap.flat());
  return (
    <Card title="När händer det?" footer={stats.peak ? `Mest: ${WEEKDAYS_SHORT[stats.peak.weekday].toLowerCase()} kl. ${String(stats.peak.hour).padStart(2, '0')}–${String((stats.peak.hour + 1) % 24).padStart(2, '0')}.` : undefined}>
      <div className="grid gap-[2px]" style={{ gridTemplateColumns: '30px repeat(24, minmax(0, 1fr))' }}>
        {stats.heatmap.map((hours, weekday) => [
          <div key={`l${weekday}`} className={`pr-1 text-[11px] leading-[14px] ${MUTED}`}>{WEEKDAYS_SHORT[weekday]}</div>,
          ...hours.map((count, hour) => (
            <div key={`${weekday}-${hour}`} className="aspect-square rounded-[2px]"
              style={{ background: count ? `rgba(255,69,58,${0.12 + 0.88 * (count / max)})` : 'rgba(118,118,128,0.18)' }} />
          )),
        ])}
      </div>
      <div className={`mt-1.5 flex justify-between pl-[32px] text-[11px] ${FAINT}`}><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div>
    </Card>
  );
};

const KommunList = ({ title, rows, onPick, footer }: { title: string; rows: { name: string; count: number; change: number | null }[]; onPick: (name: string) => void; footer?: string }) => (
  <Card title={title} footer={footer}>
    {rows.map((r, i) => (
      <button key={r.name} type="button" onClick={() => onPick(r.name)} className="flex w-full items-center gap-3 border-b border-[rgba(84,84,88,0.65)] py-2.5 text-left last:border-0 active:opacity-60">
        <span className={`w-5 text-[15px] tabular-nums ${MUTED}`}>{i + 1}</span>
        <span className="min-w-0 flex-1 truncate text-[17px]">{r.name}</span>
        <span className={`text-[15px] tabular-nums ${MUTED}`}>{r.count}</span>
        <span className="w-[76px] text-right"><ChangePill value={r.change} /></span>
      </button>
    ))}
  </Card>
);

/** What free users see: today's count, and what Pro adds, behind a lock */
const ProLock = () => (
  <Card>
    <div className="pointer-events-none select-none blur-[6px]" aria-hidden>
      {['Skjutningar', 'Inbrott', 'Rån', 'Misshandel'].map((label, i) => (
        <div key={label} className="flex items-center justify-between py-2.5">
          <span className="text-[17px]">{label}</span>
          <span style={{ color: i % 2 ? GREEN : RED }}>{i % 2 ? '−18 %' : '+24 %'}</span>
        </div>
      ))}
    </div>
    <div className="mt-3 text-center">
      <Lock className="mx-auto h-6 w-6 text-[#ff453a]" aria-hidden />
      <p className="mt-2 text-[17px] font-semibold">Statistik med Pro</p>
      <p className={`mx-auto mt-1 max-w-[280px] text-[14px] leading-snug ${MUTED}`}>
        Se om skjutningar, rån och inbrott ökar eller minskar där du bor, när på dygnet det händer och hur länge sedan det senast hände.
      </p>
      {canSellPro() && (
        <Link to="/prisplan" className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-[#ff453a] px-6 text-[17px] font-semibold text-white active:opacity-80">
          Prova Pro
        </Link>
      )}
    </div>
  </Card>
);

const toStat = (incidents: { time: string; area: string; originalType?: string }[]): StatEvent[] =>
  incidents.flatMap((i) => {
    const at = parseIncidentTime(i.time)?.getTime();
    return at === undefined ? [] : [{ at, area: i.area, category: i.originalType ?? '' }];
  });

const VIEW_OPTIONS = [{ value: 'trender', label: 'Trender' }, { value: 'over-tid', label: 'Över tid' }, { value: 'analys', label: 'Analys' }];

const DAY_OPTIONS = [{ value: '7', label: '7 dagar' }, { value: '30', label: '30 dagar' }];

/**
 * Statistik in the iPhone app: is it calm or busy where you live, are shootings, robberies and
 * burglaries rising or falling, when in the week things happen, how long since the last
 * shooting, and which kommuner change most. Pro sees all of it; others see today.
 */
const NativeStats = () => {
  useSEO({ title: 'Statistik | CrimeAlert', description: 'Polisens händelser i siffror.', noindex: true });
  const { isPremium } = useIsPremium();
  const { kommuner } = useNotificationPreferences();
  const { incidents: live } = usePoliceEvents();
  const [params, setParams] = useSearchParams();
  const view = VIEW_OPTIONS.some((o) => o.value === params.get('vy')) ? params.get('vy')! : 'trender';
  const setView = (next: string) => { setParams(next === 'trender' ? {} : { vy: next }, { replace: true }); window.dispatchEvent(new Event('ca-tab-top')); };
  const [area, setArea] = useState<string | null>(null);
  const [days, setDays] = useState('30');
  const period = Number(days);
  const { events, loading, error } = useStatsEvents(60, isPremium);

  const chips = useMemo(() => [...new Set([...kommuner, ...(area ? [area] : [])])], [kommuner, area]);
  const place = area ?? 'Sverige';
  const stats = useMemo(() => (events ? areaStats(events, area, period) : null), [events, area, period]);
  const lines = useMemo(() => (stats ? insights(stats, place, period) : []), [stats, place, period]);
  const changes = useMemo(() => (events && !area ? kommunChanges(events, period) : []), [events, area, period]);
  const freeToday = useMemo(() => {
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return inArea(toStat(live), area).filter((e) => e.at > dayAgo && !/sammanfattning/i.test(e.category)).length;
  }, [live, area]);

  const pick = (name: string) => { setArea(name); window.dispatchEvent(new Event('ca-tab-top')); };

  return (
    <Screen title="Statistik">
      <div className="mb-2 mt-1"><Segmented options={VIEW_OPTIONS} value={view} onChange={setView} /></div>
      {view === 'over-tid' ? (
        <NativeHistory />
      ) : view === 'analys' ? (
        <div className="ca-app-analysis">
          <Suspense fallback={<div className="mx-4 mt-6 h-40 animate-pulse rounded-2xl bg-[#1c1c1e]" />}>
            <Analysis />
          </Suspense>
        </div>
      ) : (
      <>
      <div className="-mt-1 flex gap-2 overflow-x-auto px-4 pb-1 pt-2 [scrollbar-width:none]">
        {[null, ...chips].map((name) => (
          <button key={name ?? 'sverige'} type="button" onClick={() => setArea(name)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-[15px] font-medium ${area === name ? 'bg-white text-black' : 'bg-[#1c1c1e] text-white'}`}>
            {name ?? 'Sverige'}
          </button>
        ))}
      </div>

      {isPremium && <div className="mt-3"><Segmented options={DAY_OPTIONS} value={days} onChange={setDays} /></div>}

      {!isPremium ? (
        <>
          <Card title="Läget just nu">
            <div className="text-[44px] font-bold leading-none tracking-tight tabular-nums">{freeToday}</div>
            <div className={`mt-1 text-[15px] ${MUTED}`}>händelser senaste dygnet i {place}</div>
          </Card>
          <ProLock />
        </>
      ) : error ? (
        <Card><p className={`text-[15px] ${MUTED}`}>Statistiken gick inte att hämta just nu. Försök igen om en stund.</p></Card>
      ) : loading || !stats ? (
        <div className="mx-4 mt-6 space-y-4" aria-label="Laddar statistik">
          {[96, 180, 220].map((h) => <div key={h} className="animate-pulse rounded-2xl bg-[#1c1c1e]" style={{ height: h }} />)}
        </div>
      ) : (
        <>
          <Pulse stats={stats} place={place} />

          {lines.length > 0 && (
            <Card title="Insikter">
              <ul className="space-y-3">
                {lines.map((line) => (
                  <li key={line} className="flex gap-3 text-[15px] leading-snug">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#ffd60a]" aria-hidden />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card title={`Brottstrender · ${period} dagar`} footer={`Jämfört med de ${period} dagarna före. Kurvan visar vecka för vecka.`}>
            {stats.trends.some((t) => t.count + t.previous > 0)
              ? stats.trends.slice(0, 12).map((t) => <TrendRow key={t.theme.id} trend={t} />)
              : <p className={`text-[15px] ${MUTED}`}>Inga händelser av de här slagen i {place} under perioden.</p>}
          </Card>

          <div className="mx-4 mt-3">
            <ShareCardButton
              make={() => drawTrendCard({
                place,
                days: period,
                rows: stats.trends.filter((t) => t.count + t.previous > 0).slice(0, 5).map((t) => ({ label: t.theme.label, count: t.count, change: t.change })),
                url: area ? `https://crimealert.se${kommunPath(area)}` : 'https://crimealert.se/statistik',
              })}
              title={`Brotten i ${place}`}
              text={`Så har brotten förändrats i ${place} de senaste ${period} dagarna – på CrimeAlert`}
              url={area ? `https://crimealert.se${kommunPath(area)}` : 'https://crimealert.se/statistik'}
              fileName="crimealert-statistik.png"
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1c1c1e] text-[17px] font-semibold text-[#0a84ff] active:opacity-60"
            />
          </div>

          <SinceLast stats={stats} days={60} />
          <DailyChart stats={stats} />
          <Heatmap stats={stats} />

          {!area && changes.length > 0 && (
            <>
              <KommunList title="Flest händelser" rows={changes.slice(0, 8)} onPick={pick} />
              {risingKommuner(changes).length > 0 && (
                <KommunList title="Störst ökning" rows={risingKommuner(changes)} onPick={pick}
                  footer="Kommuner med minst 10 händelser perioden före." />
              )}
            </>
          )}

          {area && (
            <div className="mx-4 mt-6">
              <Link to={kommunPath(area)} className="flex h-11 items-center justify-center rounded-xl bg-[#1c1c1e] text-[17px] text-[#0a84ff] active:opacity-60">
                Mer om {area}
              </Link>
            </div>
          )}
        </>
      )}

      <p className={`mx-6 mt-6 text-center text-[12px] leading-snug ${FAINT}`}>
        Källa: Polisens händelser på polisen.se. Visar vad Polisen rapporterat, inte anmälda brott.
      </p>
      </>
      )}
    </Screen>
  );
};

export default NativeStats;
