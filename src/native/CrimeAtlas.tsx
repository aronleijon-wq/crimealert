// Brottsatlas: search a kommun and see what is most common there compared with Sweden, or pick a
// kind of crime and see where in Sweden it is most common per inhabitant. In the app under
// Statistik → Atlas and on the website (/brottsatlas, Analys). From lib/crimeAtlas.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, ChevronRight, MessagesSquare, Search, X } from 'lucide-react';
import SituationCard from '@/components/SituationCard';
import ShareCardButton from '@/components/ShareCardButton';
import { fitSweden, SWEDEN_SHAPES } from '@/components/landing/swedenGeo';
import { KOMMUN_COORDINATES, searchKommuner } from '@/data/kommuner';
import { POPULATION_YEAR } from '@/data/kommunPopulation';
import { useCrimeAtlas } from '@/hooks/useCrimeAtlas';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import {
  formatRate, formatRatio, kommunProfile, periodOf, mostCommon, ratioSentence, risingMost, themeRanking, THEMES,
  type Atlas, type KommunRate, type Period,
} from '@/lib/crimeAtlas';
import { kommunPath, neighbourKommuner } from '@/lib/kommunPages';
import { drawHistoryCard } from '@/lib/shareCard';
import { chatPath } from './chats';
import { haptics } from './haptics';
import { Card, FAINT, MUTED } from './StatCard';
import { Segmented } from './ui';

const RED = '#ff453a';
const GREEN = '#30d158';
const URL = 'https://crimealert.se/brottsatlas';
/** "per 100 000" that never breaks between the digits */
const PER = 'per 100\u00a0000';
const shareClass = 'mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#2c2c2e] text-[15px] font-semibold text-[#0a84ff] active:opacity-60';

/** A name short enough for a bar's label on the shared picture */
const shortName = (name: string) => (name.length > 9 ? `${name.slice(0, 8)}…` : name);

/** "2,3× Sverige" in red above Sweden's level, green below, grey around it */
const RatioPill = ({ ratio }: { ratio: number | null }) => {
  if (ratio === null) return <span className={`text-[12px] ${FAINT}`}>för få</span>;
  const color = ratio >= 1.2 ? RED : ratio <= 0.83 ? GREEN : '#8e8e93';
  return (
    <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-semibold tabular-nums" style={{ color, background: `${color}24` }}>
      {formatRatio(ratio)} Sverige
    </span>
  );
};

const Change = ({ value }: { value: number | null }) => {
  if (value === null) return null;
  const up = value > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-0.5 text-[12px] font-semibold tabular-nums" style={{ color: up ? RED : GREEN }}>
      <Icon className="h-3 w-3" strokeWidth={2.6} aria-hidden />{up ? '+' : '−'}{Math.abs(value)} %
    </span>
  );
};

// Sweden's outline in a 120×260 box, as on the kommun pages
const { toPixel } = fitSweden(120, 260, 6);
const SWEDEN_PATH = SWEDEN_SHAPES.map(
  (shape) => `M${shape.map(([lat, lng]) => toPixel(lat, lng).map((n) => n.toFixed(1)).join(' ')).join(' L')} Z`,
).join(' ');
const COORDS = new Map(KOMMUN_COORDINATES.map((k) => [k.name, k]));

/**
 * Sweden with a dot for every kommun where the kind of crime was reported: larger for more
 * events, redder for more per inhabitant. The chosen kommun is ringed.
 */
const BubbleMap = ({ ranking, chosen, onPick, label }: { ranking: KommunRate[]; chosen: string | null; onPick: (k: string) => void; label: string }) => {
  const maxCount = Math.max(1, ...ranking.map((r) => r.count));
  const rates = ranking.filter((r) => r.count > 0).map((r) => r.rate).sort((a, b) => a - b);
  // Colour by where the rate falls among all kommuner, so a single outlier doesn't wash out the rest
  const level = (rate: number) => (rates.length ? rates.filter((r) => r <= rate).length / rates.length : 0);
  const dots = ranking.filter((r) => r.count > 0 && COORDS.has(r.kommun)).sort((a, b) => b.count - a.count);
  return (
    <svg viewBox="0 0 120 260" className="mx-auto h-[300px] w-auto" role="img" aria-label={label}>
      <path d={SWEDEN_PATH} fill="rgba(235,235,245,0.07)" stroke="rgba(235,235,245,0.25)" strokeWidth="0.6" />
      {dots.map((r) => {
        const c = COORDS.get(r.kommun)!;
        const [x, y] = toPixel(c.lat, c.lng);
        const radius = 1.4 + 6 * Math.sqrt(r.count / maxCount);
        const l = level(r.rate);
        const fill = `rgba(255, ${Math.round(190 - 150 * l)}, ${Math.round(80 - 40 * l)}, ${0.35 + 0.5 * l})`;
        return (
          <circle key={r.kommun} cx={x} cy={y} r={radius} fill={fill} stroke={r.kommun === chosen ? '#fff' : 'rgba(0,0,0,0.35)'} strokeWidth={r.kommun === chosen ? 1.2 : 0.3}
            onClick={() => onPick(r.kommun)} className="cursor-pointer">
            <title>{`${r.kommun}: ${r.count} · ${formatRate(r.rate)} ${PER}`}</title>
          </circle>
        );
      })}
    </svg>
  );
};

const KommunSearch = ({ value, onPick }: { value: string; onPick: (k: string) => void }) => {
  const [query, setQuery] = useState('');
  const matches = useMemo(() => searchKommuner(query, 6), [query]);
  return (
    <div className="relative mx-4 mt-4">
      <div className="flex h-10 items-center gap-1.5 rounded-[10px] bg-[rgba(118,118,128,0.24)] px-2.5">
        <Search className="h-4 w-4 shrink-0 text-[rgba(235,235,245,0.6)]" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Sök kommun (nu: ${value})`}
          aria-label="Sök kommun"
          className="min-w-0 flex-1 bg-transparent text-[17px] text-white outline-none placeholder:text-[rgba(235,235,245,0.6)] [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button type="button" onClick={() => setQuery('')} aria-label="Rensa" className="flex h-5 w-5 items-center justify-center rounded-full bg-[rgba(235,235,245,0.6)]">
            <X className="h-3 w-3 text-black" strokeWidth={3} aria-hidden />
          </button>
        )}
      </div>
      {query.trim() && (
        <ul className="absolute inset-x-0 top-11 z-20 overflow-hidden rounded-xl bg-[#2c2c2e] shadow-2xl" role="listbox" aria-label="Kommuner">
          {matches.length ? matches.map((k) => (
            <li key={k}>
              <button type="button" role="option" aria-selected={k === value} onClick={() => { haptics.selection(); onPick(k); setQuery(''); }}
                className="flex w-full items-center justify-between border-b border-white/[0.06] px-4 py-3 text-left text-[16px] text-white last:border-0 active:bg-white/10">
                {k}<ChevronRight className="h-4 w-4 text-white/30" aria-hidden />
              </button>
            </li>
          )) : <li className={`px-4 py-3 text-[15px] ${MUTED}`}>Ingen kommun heter så</li>}
        </ul>
      )}
    </div>
  );
};

const KommunView = ({ atlas, kommun, period, onPick }: { atlas: Atlas; kommun: string; period: Period; onPick: (k: string) => void }) => {
  const profile = useMemo(() => kommunProfile(atlas, kommun), [atlas, kommun]);
  const neighbours = useMemo(() => {
    const names = [kommun, ...neighbourKommuner(kommun, 5)];
    return names.map((k) => ({ k, p: kommunProfile(atlas, k) })).sort((a, b) => b.p.rate - a.p.rate);
  }, [atlas, kommun]);
  const maxRate = Math.max(1, ...neighbours.map((n) => n.p.rate));
  const top = profile.themes.slice(0, 8);
  const title = profile.standout ? ratioSentence(profile.standout.theme, kommun, profile.standout.ratio!) : `Vanligast i ${kommun}`;

  return (
    <>
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-[22px] font-bold tracking-tight">{kommun}</div>
            <div className={`text-[13px] ${MUTED}`}>{profile.population.toLocaleString('sv-SE')} invånare</div>
          </div>
          <RatioPill ratio={profile.ratio} />
        </div>
        <div className="mt-4 flex items-end gap-6">
          <div>
            <div className="text-[34px] font-bold leading-none tabular-nums">{profile.total.toLocaleString('sv-SE')}</div>
            <div className={`mt-1 text-[13px] ${MUTED}`}>händelser, {period.short}</div>
          </div>
          <div>
            <div className="text-[34px] font-bold leading-none tabular-nums">{formatRate(profile.rate)}</div>
            <div className={`mt-1 text-[13px] ${MUTED}`}>{PER} invånare</div>
          </div>
        </div>
        {profile.standout && (
          <p className="mt-4 rounded-xl bg-[rgba(255,69,58,0.12)] px-3 py-2.5 text-[15px] font-semibold leading-snug text-[#ff6961]">{title}</p>
        )}
      </Card>

      <SituationCard kommun={kommun} className="mx-4 mt-3" />

      <Card title={`Vanligast i ${kommun}`} footer="Jämfört med Sverige, per invånare.">
        {top.length ? top.map((t) => (
          <div key={t.theme.id} className="border-b border-[rgba(84,84,88,0.65)] py-2.5 first:pt-0 last:border-0 last:pb-0">
            <div className="flex items-center gap-3">
              <span className="min-w-0 flex-1 text-[16px]">{t.theme.label}</span>
              <span className="w-8 text-right text-[15px] font-semibold tabular-nums">{t.count}</span>
              <span className="w-[92px] text-right"><RatioPill ratio={t.ratio} /></span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden>
              <div className="h-full rounded-full bg-[#ff453a]" style={{ width: `${Math.max(3, t.share * 100)}%` }} />
            </div>
          </div>
        )) : <p className={`text-[15px] ${MUTED}`}>Polisen har inte rapporterat något av de här slagen i {kommun} {period.long}.</p>}
        {top.length > 0 && (
          <ShareCardButton
            make={() => drawHistoryCard({
              kicker: `Brottsatlas · ${kommun}`,
              title,
              bars: top.slice(0, 5).map((t, i) => ({ label: shortName(t.theme.label), value: t.count, tone: i === 0 ? 'high' : undefined })),
              note: `Polisens händelser i ${kommun}, ${period.long}.`,
              url: URL,
            })}
            title={`Brotten i ${kommun}`}
            text={`${title} – på CrimeAlert`}
            url={URL}
            fileName="crimealert-brottsatlas.png"
            className={shareClass}
          />
        )}
      </Card>

      <Card title="Jämfört med grannarna" footer={`Händelser ${PER} invånare.`}>
        {neighbours.map(({ k, p }) => (
          <button key={k} type="button" onClick={() => { if (k !== kommun) { haptics.selection(); onPick(k); } }} className="flex w-full items-center gap-3 py-1.5 text-left active:opacity-60">
            <span className={`w-28 truncate text-[15px] ${k === kommun ? 'font-semibold text-white' : MUTED}`}>{k}</span>
            <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden>
              <span className="block h-full rounded-full" style={{ width: `${Math.max(2, (p.rate / maxRate) * 100)}%`, background: k === kommun ? RED : 'rgba(235,235,245,0.35)' }} />
            </span>
            <span className="w-12 text-right text-[14px] tabular-nums">{formatRate(p.rate)}</span>
          </button>
        ))}
      </Card>

      <div className="mx-4 mt-4 grid grid-cols-2 gap-2.5">
        <Link to={chatPath(kommun)} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#1c1c1e] text-[15px] font-semibold text-[#0a84ff] active:opacity-60">
          <MessagesSquare className="h-4 w-4" aria-hidden /> Chatten
        </Link>
        <Link to={kommunPath(kommun)} className="flex h-11 items-center justify-center rounded-xl bg-[#1c1c1e] text-[15px] font-semibold text-[#0a84ff] active:opacity-60">
          Mer om {kommun.length > 12 ? 'kommunen' : kommun}
        </Link>
      </div>
    </>
  );
};

const ThemeView = ({ atlas, themeId, setThemeId, period, chosen, onPick }: { atlas: Atlas; themeId: string; setThemeId: (t: string) => void; period: Period; chosen: string; onPick: (k: string) => void }) => {
  const theme = THEMES.find((t) => t.id === themeId) ?? THEMES[0];
  const ranking = useMemo(() => themeRanking(atlas, theme.id), [atlas, theme.id]);
  const common = mostCommon(ranking);
  const rising = risingMost(ranking);
  const total = atlas.sweden.get(theme.id)?.now ?? 0;
  const [tapped, setTapped] = useState<string | null>(null);
  const tappedRow = ranking.find((r) => r.kommun === tapped);
  const maxRate = Math.max(1, ...common.map((r) => r.rate));
  const chips = useRef<HTMLDivElement>(null);
  // The chosen kind in view, also when it is far along the row
  useEffect(() => {
    chips.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView?.({ inline: 'center', block: 'nearest' });
  }, [theme.id]);
  const title = common[0] ? `${theme.label}: vanligast i ${common[0].kommun}` : theme.label;

  return (
    <>
      <div ref={chips} className="mt-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" role="tablist" aria-label="Brott">
        {THEMES.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={t.id === theme.id} onClick={() => { haptics.selection(); setThemeId(t.id); setTapped(null); }}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-[14px] font-medium ${t.id === theme.id ? 'bg-white text-black' : 'bg-[#1c1c1e] text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <Card title={`${theme.label} i Sverige · ${period.short}`} footer="Större prick: fler händelser. Rödare: fler per invånare.">
        <div className="flex items-baseline gap-2">
          <span className="text-[30px] font-bold tabular-nums">{total.toLocaleString('sv-SE')}</span>
          <span className={`text-[14px] ${MUTED}`}>{theme.plural} rapporterade · {formatRate((total / atlas.population) * 100_000)} {PER}</span>
        </div>
        <div className="mt-2"><BubbleMap ranking={ranking} chosen={tapped} onPick={(k) => { haptics.selection(); setTapped(k); }} label={`Karta över ${theme.plural} per kommun`} /></div>
        {tappedRow && (
          <button type="button" onClick={() => onPick(tappedRow.kommun)} className="mt-2 flex w-full items-center gap-3 rounded-xl bg-[#2c2c2e] px-3.5 py-2.5 text-left active:opacity-70">
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-semibold">{tappedRow.kommun}</span>
              <span className={`block text-[13px] ${MUTED}`}>{tappedRow.count} {theme.plural} · {formatRate(tappedRow.rate)} {PER}</span>
            </span>
            <span className="text-[14px] font-semibold text-[#0a84ff]">Se kommunen</span>
            <ChevronRight className="h-4 w-4 text-white/30" aria-hidden />
          </button>
        )}
      </Card>

      <Card title="Vanligast per invånare" footer={`Kommuner med minst tre ${theme.plural}.`}>
        {common.length ? common.map((r, i) => (
          <button key={r.kommun} type="button" onClick={() => onPick(r.kommun)} className="flex w-full items-center gap-3 py-1.5 text-left active:opacity-60">
            <span className={`w-5 text-[14px] tabular-nums ${MUTED}`}>{i + 1}</span>
            <span className={`w-28 truncate text-[15px] ${r.kommun === chosen ? 'font-semibold' : ''}`}>{r.kommun}</span>
            <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden>
              <span className="block h-full rounded-full bg-[#ff453a]" style={{ width: `${Math.max(2, (r.rate / maxRate) * 100)}%`, opacity: 1 - i * 0.06 }} />
            </span>
            <span className="w-12 text-right text-[14px] tabular-nums">{formatRate(r.rate)}</span>
          </button>
        )) : <p className={`text-[15px] ${MUTED}`}>För få {theme.plural} {period.long} för att jämföra kommuner.</p>}
        {common.length > 0 && (
          <ShareCardButton
            make={() => drawHistoryCard({
              kicker: `Brottsatlas · ${theme.label}`,
              title,
              bars: common.slice(0, 5).map((r, i) => ({ label: shortName(r.kommun), value: Math.round(r.rate * 10) / 10, tone: i === 0 ? 'high' : undefined })),
              note: `${theme.label} ${PER} invånare, ${period.long}.`,
              url: URL,
            })}
            title={title}
            text={`${title} – på CrimeAlert`}
            url={URL}
            fileName="crimealert-brottsatlas.png"
            className={shareClass}
          />
        )}
      </Card>

      {rising.length > 0 && (
        <Card title="Ökat mest" footer={`Jämfört med lika lång tid före, bland kommuner med minst fem ${theme.plural} då.`}>
          {rising.map((r) => (
            <button key={r.kommun} type="button" onClick={() => onPick(r.kommun)} className="flex w-full items-center gap-3 border-b border-[rgba(84,84,88,0.65)] py-2.5 text-left last:border-0 active:opacity-60">
              <span className="min-w-0 flex-1 truncate text-[16px]">{r.kommun}</span>
              <span className={`text-[14px] tabular-nums ${MUTED}`}>{r.count} st</span>
              <Change value={r.change} />
            </button>
          ))}
        </Card>
      )}
    </>
  );
};

const VIEWS = [{ value: 'kommun', label: 'Kommun' }, { value: 'brott', label: 'Brott' }] as const;
const PERIODS = [{ value: '7', label: '7 dagar' }, { value: '30', label: '30 dagar' }, { value: 'start', label: 'Sedan start' }];

const CrimeAtlas = () => {
  const { kommuner } = useNotificationPreferences();
  const [view, setView] = useState<'kommun' | 'brott'>('kommun');
  // All the archive by default: the more events, the steadier each kommun's numbers
  const [days, setDays] = useState('start');
  const [picked, setPicked] = useState<string | null>(null);
  const [themeId, setThemeId] = useState('inbrott');
  const kommun = picked ?? kommuner[0] ?? 'Stockholm';
  const period = useMemo(() => periodOf(days), [days]);
  const { atlas, loading, error } = useCrimeAtlas(period.days);

  const pick = (k: string) => { setPicked(k); setView('kommun'); };

  return (
    <div className="pb-2">
      <div className="mt-1"><Segmented<'kommun' | 'brott'> options={VIEWS.map((v) => ({ ...v }))} value={view} onChange={(v) => { haptics.selection(); setView(v); }} /></div>
      {view === 'kommun' && <KommunSearch value={kommun} onPick={pick} />}
      <div className="mt-3"><Segmented options={PERIODS} value={days} onChange={setDays} /></div>

      {error ? (
        <Card><p className={`text-[15px] ${MUTED}`}>Atlasen gick inte att hämta just nu. Försök igen om en stund.</p></Card>
      ) : loading || !atlas ? (
        <div className="mx-4 mt-6 space-y-4" aria-label="Laddar brottsatlasen">
          {[140, 260, 180].map((h) => <div key={h} className="animate-pulse rounded-2xl bg-[#1c1c1e]" style={{ height: h }} />)}
        </div>
      ) : view === 'kommun' ? (
        <KommunView atlas={atlas} kommun={kommun} period={period} onPick={pick} />
      ) : (
        <ThemeView atlas={atlas} themeId={themeId} setThemeId={setThemeId} period={period} chosen={kommun} onPick={pick} />
      )}

      <p className={`mx-6 mt-6 text-center text-[12px] leading-snug ${FAINT}`}>
        Polisens publicerade händelser, inte all brottslighet. Per invånare med SCB:s befolkning {POPULATION_YEAR}. Händelser för ett helt län räknas inte.
      </p>
    </div>
  );
};

export default CrimeAtlas;
