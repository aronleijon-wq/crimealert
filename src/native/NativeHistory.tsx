// Statistik → Över tid in the iPhone app: how shootings, explosions, lethal violence and reported
// crimes have changed in Sweden over the years, with Polisen's and Brå's own figures
// (content/crimeTrends), not CrimeAlert's archive. For everyone, with or without Pro.
import { useState } from 'react';
import { ArrowDownRight, ArrowUpRight, ExternalLink } from 'lucide-react';
import ShareCardButton from '@/components/ShareCardButton';
import {
  BRA_2025, BRA_LETHAL, EXPLOSIONS, LETHAL_VIOLENCE, REPORTED, REPORTED_YEARS, SHOOTINGS_FIRST_HALF, SHOOTINGS_FIRST_HALF_SOURCES,
  formatChange, formatNumber, last, percentChange, previous, type Source,
} from '@/content/crimeTrends';
import { drawHistoryCard } from '@/lib/shareCard';
import { Card, FAINT, MUTED } from './StatCard';
import { Segmented } from './ui';

const RED = '#ff453a';
const BLUE = '#0a84ff';
const GREEN = '#30d158';
const URL = 'https://crimealert.se/statistik';

type Tone = 'high' | 'low' | undefined;
interface Bar { label: string; value: number; tone?: Tone }

const TONE_COLOR = { high: RED, low: BLUE };

/** Columns, one per year, with the value above each; the highest in red and the newest low in blue */
const Columns = ({ bars, label }: { bars: Bar[]; label: string }) => {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <div role="img" aria-label={`${label}: ${bars.map((b) => `${b.label} ${formatNumber(b.value)}`).join(', ')}`}>
      <div className="flex h-[170px] items-end gap-[5px]">
        {bars.map((b) => (
          <div key={b.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
            <span className="mb-1 text-[11px] font-semibold tabular-nums" style={{ color: b.tone ? '#fff' : 'rgba(235,235,245,0.6)' }}>{formatNumber(b.value)}</span>
            <span
              className="w-full rounded-t-[5px]"
              style={{
                height: `${Math.max(3, (b.value / max) * 140)}px`,
                background: b.tone ? TONE_COLOR[b.tone] : 'rgba(235,235,245,0.22)',
                boxShadow: b.tone ? `0 0 18px ${TONE_COLOR[b.tone]}66` : undefined,
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-[5px]">
        {bars.map((b) => <span key={b.label} className={`min-w-0 flex-1 text-center text-[11px] tabular-nums ${MUTED}`}>{bars.length > 6 ? `’${b.label.slice(2)}` : b.label}</span>)}
      </div>
    </div>
  );
};

/** "−81 %" in green for less crime, "+39 %" in red for more */
const Change = ({ value }: { value: number }) => {
  const Icon = value > 0 ? ArrowUpRight : ArrowDownRight;
  const color = value > 0 ? RED : value < 0 ? GREEN : 'rgba(235,235,245,0.6)';
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[13px] font-semibold tabular-nums" style={{ color, background: `${color}26` }}>
      {value !== 0 && <Icon className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />}
      {formatChange(value)}
    </span>
  );
};

const Sources = ({ sources }: { sources: Source[] }) => (
  <ul className="mt-3 space-y-1.5 border-t border-[rgba(84,84,88,0.65)] pt-3">
    {sources.map((s) => (
      <li key={s.url}>
        <a href={s.url} target="_blank" rel="noopener noreferrer" className={`flex items-start gap-1.5 text-[12px] leading-snug ${MUTED} active:opacity-60`}>
          <ExternalLink className="mt-[2px] h-3 w-3 shrink-0" aria-hidden />
          {s.label}
        </a>
      </li>
    ))}
  </ul>
);

const shareClass = 'mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#2c2c2e] text-[15px] font-semibold text-[#0a84ff] active:opacity-60';

const MEASURES = [
  { value: 'shootings', label: 'Skjutningar', noun: 'skjutningar' },
  { value: 'dead', label: 'Döda', noun: 'döda' },
  { value: 'injured', label: 'Skadade', noun: 'skadade' },
] as const;
type Measure = (typeof MEASURES)[number]['value'];

/** The highest year in red, and the newest in blue when it is the lowest since the peak */
const tonesFor = (values: number[]): Tone[] => {
  const peak = values.indexOf(Math.max(...values));
  const newest = values.length - 1;
  const newestLow = values[newest] <= Math.min(...values.slice(peak));
  return values.map((_, i) => (i === peak ? 'high' : i === newest && newestLow && newest !== peak ? 'low' : undefined));
};

const ShootingsOverTime = () => {
  const [measure, setMeasure] = useState<Measure>('shootings');
  const { label, noun } = MEASURES.find((m) => m.value === measure)!;
  const values = SHOOTINGS_FIRST_HALF.map((r) => r[measure]);
  const tones = tonesFor(values);
  const bars = SHOOTINGS_FIRST_HALF.map((r, i) => ({ label: String(r.year), value: r[measure], tone: tones[i] }));
  const peak = SHOOTINGS_FIRST_HALF[values.indexOf(Math.max(...values))];
  const newest = SHOOTINGS_FIRST_HALF[SHOOTINGS_FIRST_HALF.length - 1];
  const kicker = `${label} · januari–juni`;
  const title = `${formatNumber(newest[measure])} ${noun} första halvåret ${newest.year}`;
  return (
    <section className="mx-4 mt-6">
      <h2 className={`mb-1.5 px-1 text-[13px] uppercase tracking-[0.02em] ${MUTED}`}>Skjutningar sedan 2017</h2>
      <div className="mb-2.5 -mx-4"><Segmented<Measure> options={MEASURES.map((m) => ({ value: m.value, label: m.label }))} value={measure} onChange={setMeasure} /></div>
      <div className="rounded-2xl bg-[#1c1c1e] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[17px] font-semibold leading-snug">{title}</div>
            <div className={`mt-0.5 text-[13px] ${MUTED}`}>Toppen var {peak.year} med {formatNumber(peak[measure])}</div>
          </div>
          <Change value={percentChange(peak[measure], newest[measure])} />
        </div>
        <div className="mt-5"><Columns bars={bars} label={`${label} januari–juni`} /></div>
        {measure === 'dead' && (
          <p className={`mt-3 text-[13px] leading-snug ${MUTED}`}>2025 sticker ut: i siffran ingår skjutningen på Campus Risbergska i Örebro i februari.</p>
        )}
        <ShareCardButton
          make={() => drawHistoryCard({ kicker, title, bars, note: `${label} januari–juni varje år. Källa: Polisen (preliminärt).`, url: URL })}
          title={`${label} i Sverige sedan 2017`}
          text={`${title}. Så har det sett ut sedan 2017 – på CrimeAlert`}
          url={URL}
          fileName="crimealert-skjutningar.png"
          className={shareClass}
        />
        <Sources sources={SHOOTINGS_FIRST_HALF_SOURCES} />
      </div>
      <p className={`mt-1.5 px-1 text-[13px] leading-snug ${MUTED}`}>
        Samma halvår varje år, så att alla år jämförs på samma sätt. Polisens siffror är preliminära och kan ändras.
      </p>
    </section>
  );
};

const Explosions = () => {
  const newest = last(EXPLOSIONS);
  const before = previous(EXPLOSIONS);
  const bars = EXPLOSIONS.values.map((v) => ({ label: String(v.year), value: v.value, tone: (v.year === newest.year ? 'high' : undefined) as Tone }));
  const half = EXPLOSIONS.halfYear!;
  const title = `${formatNumber(newest.value)} sprängningar under ${newest.year}`;
  return (
    <Card title="Sprängningar per år">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[17px] font-semibold leading-snug">{title}</div>
          <div className={`mt-0.5 text-[13px] ${MUTED}`}>Mot {formatNumber(before.value)} året innan</div>
        </div>
        <Change value={percentChange(before.value, newest.value)} />
      </div>
      <div className="mt-5"><Columns bars={bars} label="Sprängningar per år" /></div>
      <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-[#2c2c2e] px-3 py-2.5">
        <span className="text-[15px] leading-snug">{half.label}: <span className="font-semibold tabular-nums">{formatNumber(half.value)}</span> <span className={MUTED}>mot {formatNumber(half.before)}</span></span>
        <Change value={percentChange(half.before, half.value)} />
      </div>
      <ShareCardButton
        make={() => drawHistoryCard({ kicker: 'Sprängningar per år', title, bars, note: 'Sprängningar i hela Sverige. Källa: Polisen (preliminärt).', url: URL })}
        title="Sprängningar i Sverige"
        text={`${title} – på CrimeAlert`}
        url={URL}
        fileName="crimealert-sprangningar.png"
        className={shareClass}
      />
      <Sources sources={EXPLOSIONS.sources} />
    </Card>
  );
};

const LethalViolence = () => {
  const max = Math.max(...LETHAL_VIOLENCE.map((r) => r.total));
  return (
    <Card title="Dödligt våld" footer="Konstaterade fall av dödligt våld i hela Sverige, enligt Brå.">
      <div className="text-[17px] font-semibold leading-snug">Ungefär hälften sker med skjutvapen</div>
      <ul className="mt-4 space-y-3" aria-label="Dödligt våld per år">
        {LETHAL_VIOLENCE.map((r) => (
          <li key={r.year} className="flex items-center gap-3" aria-label={`${r.year}: ${r.total} fall, varav ${r.firearm} med skjutvapen`}>
            <span className={`w-10 text-[15px] tabular-nums ${MUTED}`}>{r.year}</span>
            <span className="relative h-7 flex-1 overflow-hidden rounded-lg bg-[rgba(118,118,128,0.18)]" aria-hidden>
              <span className="absolute inset-y-0 left-0 rounded-lg bg-[rgba(235,235,245,0.22)]" style={{ width: `${(r.total / max) * 100}%` }} />
              <span className="absolute inset-y-0 left-0 flex items-center rounded-lg pl-2 text-[12px] font-semibold tabular-nums" style={{ width: `${(r.firearm / max) * 100}%`, background: RED }}>{r.firearm}</span>
            </span>
            <span className="w-9 text-right text-[15px] font-semibold tabular-nums">{r.total}</span>
          </li>
        ))}
      </ul>
      <div className={`mt-3 flex gap-4 text-[12px] ${MUTED}`} aria-hidden>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[rgba(235,235,245,0.35)]" />Totalt</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: RED }} />Med skjutvapen</span>
      </div>
      <Sources sources={[BRA_LETHAL]} />
    </Card>
  );
};

const Reported = () => (
  <Card title={`Anmälda brott ${REPORTED_YEARS.after}`} footer={`Jämfört med ${REPORTED_YEARS.before}. Anmälda brott visar inte all brottslighet, många brott anmäls aldrig.`}>
    {REPORTED.map((r) => (
      <div key={r.label} className="flex items-center gap-3 border-b border-[rgba(84,84,88,0.65)] py-2.5 first:pt-0 last:border-0">
        <span className="min-w-0 flex-1 text-[17px] leading-[22px]">{r.label}</span>
        <span className={`text-[15px] tabular-nums ${MUTED}`}>{formatNumber(r.after)}</span>
        <span className="w-[76px] text-right"><Change value={percentChange(r.before, r.after)} /></span>
      </div>
    ))}
    <Sources sources={[BRA_2025]} />
  </Card>
);

const NativeHistory = () => {
  const first = SHOOTINGS_FIRST_HALF.find((r) => r.year === 2022)!;
  const newest = SHOOTINGS_FIRST_HALF[SHOOTINGS_FIRST_HALF.length - 1];
  const change = percentChange(first.shootings, newest.shootings);
  return (
    <>
      <Card>
        <div className="text-[13px] font-semibold uppercase tracking-[0.06em]" style={{ color: RED }}>Sverige {SHOOTINGS_FIRST_HALF[0].year}–{newest.year}</div>
        <div className="mt-1 text-[54px] font-bold leading-none tracking-tight tabular-nums" style={{ color: GREEN }}>{formatChange(change)}</div>
        <div className="mt-2 text-[15px] leading-snug">
          färre skjutningar första halvåret {newest.year} än {first.year}, det värsta året. Den lägsta nivån sedan Polisen började räkna.
        </div>
      </Card>
      <ShootingsOverTime />
      <Explosions />
      <LethalViolence />
      <Reported />
      <p className={`mx-6 mt-6 text-center text-[12px] leading-snug ${FAINT}`}>
        Siffrorna gäller hela Sverige och kommer från Polisen och Brå, inte från CrimeAlert.
      </p>
    </>
  );
};

export default NativeHistory;
