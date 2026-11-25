import { useMemo, useEffect, useState, useRef } from 'react';
import Header from '@/components/Header';
import { useSEO } from '@/hooks/useSEO';

import PremiumGate from '@/components/PremiumGate';
import { AlertTriangle, MapPin, RefreshCw, Search, X, ChevronDown, House, TreePine, Sun, Moon, Car, type LucideIcon } from 'lucide-react';
import { usePoliceEvents } from '@/hooks/usePoliceEvents';
import { useArchiveEvents } from '@/hooks/useArchiveEvents';
import type { Incident } from '@/data/mockIncidents';
import { useIsPremium } from '@/hooks/useIsPremium';
import ExportData from '@/components/ExportData';
import DangerRanking from '@/components/DangerRanking';
import { Link } from 'react-router-dom';
import { ChevronRight, Map as MapIcon } from 'lucide-react';
import { isNativeApp } from '@/lib/native';
import NativeHistory from '@/native/NativeHistory';
import { Card, FAINT, MUTED } from '@/native/StatCard';
import { Segmented } from '@/native/ui';
import { cleanPoliceTitle } from '@/lib/feed';
import { eventPath } from '@/lib/share';
import { splitParentIds } from '@/lib/summaries';
import StatsTrends from '@/native/StatsTrends';
import { SWEDISH_KOMMUNER } from '@/data/kommuner';
import { kommunMatcher } from '../../supabase/functions/_shared/notifications';

/**
 * On the website, above the full analysis: the app's statistics, trends where you live and
 * Sweden over the years, side by side, for everyone (Pro sees all the trends).
 */
const Overview = () => (
  <section className="mx-auto max-w-7xl px-4 pt-6 md:px-6" aria-labelledby="oversikt-rubrik">
    <h1 id="oversikt-rubrik" className="text-xl font-bold text-foreground">Analys &amp; statistik</h1>
    <p className="mt-1 text-sm text-muted-foreground">Läget där du bor, hur brotten ändras och hur Sverige har förändrats sedan 2017.</p>
    <Link
      to="/brottsatlas"
      className="mt-4 flex items-center gap-4 rounded-2xl border border-[hsl(var(--ca-line-strong))] bg-card p-4 transition hover:border-[hsl(var(--ca-red)/0.5)]"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--ca-red)/0.15)] text-[hsl(var(--ca-red))]"><MapIcon className="h-5 w-5" aria-hidden /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold text-foreground">Brottsatlas</span>
        <span className="block text-sm text-muted-foreground">Sök en kommun och se vad som är vanligast där, eller välj ett brott och se var det är vanligast.</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
    <div className="mt-5 grid items-start gap-5 lg:grid-cols-2">
      <div className="ca-dark overflow-hidden rounded-3xl bg-black pb-6 text-white">
        <h2 className="px-5 pb-1 pt-5 text-[22px] font-bold tracking-tight">Trender</h2>
        <StatsTrends />
      </div>
      <div className="ca-dark overflow-hidden rounded-3xl bg-black pb-6 text-white">
        <h2 className="px-5 pb-1 pt-5 text-[22px] font-bold tracking-tight">Sverige över tid</h2>
        <NativeHistory />
      </div>
    </div>
  </section>
);

/** Normalize "2026-02-18 22:03:10 +01:00" or "2026-02-19 7:45:12 +01:00" → valid Date */
const parseTime = (t: string): Date => {
  const parts = t.trim().split(/\s+/);
  // parts: ["2026-02-18", "22:03:10", "+01:00"] or ["2026-02-19", "7:45:12", "+01:00"]
  if (parts.length >= 3) {
    // Ensure time components are zero-padded (7:45:12 → 07:45:12)
    const timeParts = parts[1].split(':');
    const paddedTime = timeParts.map(p => p.padStart(2, '0')).join(':');
    return new Date(`${parts[0]}T${paddedTime}${parts[2]}`);
  }
  return new Date(t);
};

/** One number on Djupanalys: big, with what it is and a line on what it means */
const Figure = ({ value, label, note, tone }: { value: string | number; label: string; note: string; tone?: string }) => (
  <div className="rounded-xl bg-[#2c2c2e] px-3.5 py-3">
    <div className="text-[30px] font-bold leading-tight tabular-nums" style={tone ? { color: tone } : undefined}>{value}</div>
    <div className="text-[15px] font-semibold leading-snug text-white">{label}</div>
    <div className={`mt-0.5 text-[13px] leading-snug ${MUTED}`}>{note}</div>
  </div>
);

/** Riskindex in words, for those who don't read an index */
const riskWord = (index: number) => (index >= 50 ? { word: 'Högt', color: '#ff453a' } : index >= 25 ? { word: 'Medel', color: '#ff9f0a' } : { word: 'Lågt', color: '#30d158' });

/** Simple bars, the tallest at full height; the busiest one red, its label shown under it */
const Bars = ({ values, labels, every, unit }: { values: number[]; labels: string[]; every: number; unit: string }) => {
  const max = Math.max(...values, 1);
  const peak = values.indexOf(Math.max(...values));
  return (
    <div>
      <div className="flex h-[130px] items-end gap-[3px]" role="img" aria-label={`Flest ${unit} ${labels[peak]}: ${values[peak]}`}>
        {values.map((v, i) => (
          <div key={labels[i]} className="group relative flex h-full flex-1 items-end">
            <div className="w-full rounded-t-[4px]" style={{ height: `${Math.max(v ? 3 : 0, (v / max) * 100)}%`, background: i === peak ? '#ff453a' : '#636366' }} />
            <span className="pointer-events-none absolute -top-7 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-black px-2 py-1 text-[12px] text-white group-hover:block">
              {labels[i]}: {v} {unit}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-[3px]">
        {labels.map((l, i) => (
          <span key={l} className={`flex-1 text-center text-[11px] tabular-nums ${i === peak ? 'font-semibold text-white' : FAINT}`}>{i % every === 0 || i === peak ? l : ''}</span>
        ))}
      </div>
    </div>
  );
};

const TYPE_COLORS: Record<string, string> = {
  police: 'hsl(210, 100%, 56%)',
  fire: 'hsl(0, 100%, 62%)',
  ambulance: 'hsl(142, 70%, 45%)',
  traffic: 'hsl(25, 100%, 63%)',
  other: 'hsl(215, 15%, 55%)'
};

const TYPE_LABELS: Record<string, string> = {
  police: 'Polisinsats',
  fire: 'Brand',
  ambulance: 'Ambulans/Sjukvård',
  traffic: 'Trafikolycka',
  other: 'Övrigt'
};

type TimeRange = '24h' | '7d' | '30d' | '60d';
const TIME_RANGE_OPTIONS: {value: TimeRange;label: string;}[] = [
{ value: '24h', label: 'Idag' },
{ value: '7d', label: '7 dagar' },
{ value: '30d', label: '30 dagar' },
{ value: '60d', label: '60 dagar' }];
/** Days each range covers; today's is read from the live events. */
const RANGE_DAYS: Record<TimeRange, number> = { '24h': 1, '7d': 7, '30d': 30, '60d': 60 };


const MunicipalitySelector = ({ areas, selected, onSelect }: {areas: string[];selected: string | null;onSelect: (v: string | null) => void;}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = areas.filter((a) => a.toLowerCase().includes(search.toLowerCase()));

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[15px] font-semibold text-black transition active:opacity-80">

        <MapPin className="h-4 w-4" aria-hidden />
        <span className="max-w-[180px] truncate">{selected ?? 'Hela Sverige'}</span>
        {selected ?
        <X className="h-4 w-4" aria-label="Visa hela Sverige" onClick={(e) => {e.stopPropagation();onSelect(null);setOpen(false);}} /> :

        <ChevronDown className="h-4 w-4" aria-hidden />
        }
      </button>
      {open &&
      <div className="absolute top-full mt-2 left-0 z-[99999] w-[calc(100vw-4rem)] sm:w-72 rounded-xl bg-[#2c2c2e] text-white shadow-xl overflow-hidden">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Sök kommun eller län"
              className="w-full rounded-lg bg-[#1c1c1e] py-2.5 pl-9 pr-3 text-[16px] text-white placeholder:text-white/40 focus:outline-none" />

            </div>
          </div>
          <div className="max-h-72 overflow-y-auto">
            <button
            onClick={() => {onSelect(null);setOpen(false);setSearch('');}}
            className={`w-full px-4 py-3 text-left text-[16px] transition hover:bg-white/10 ${!selected ? 'font-semibold text-[#ff453a]' : 'text-white'}`}>

              Hela Sverige
            </button>
            {filtered.map((a) =>
          <button
            key={a}
            onClick={() => {onSelect(a);setOpen(false);setSearch('');}}
            className={`w-full px-4 py-3 text-left text-[16px] transition hover:bg-white/10 ${selected === a ? 'font-semibold text-[#ff453a]' : 'text-white'}`}>

                {a}
              </button>
          )}
            {filtered.length === 0 &&
          <p className="px-4 py-3 text-[15px] text-white/60">Ingen kommun med det namnet</p>
          }
          </div>
        </div>
      }
    </div>);

};

const SEVERITY_COLOR = { danger: '#ff453a', warning: '#ff9f0a', info: '#0a84ff' } as const;

/** Events in the kommun's history shown before "Visa alla" */
const HISTORY_SHOWN = 15;

const Analysis = () => {
  useSEO({
    title: 'Brottsanalys & statistik — CrimeAlert',
    description: 'Analysera brottsstatistik och polishändelser i Sverige. Trender, farligaste områden och datadriven trygghetsanalys.',
    canonical: 'https://crimealert.se/analysis',
  });
  const { incidents: liveIncidents, loading: liveLoading, refetch, dataVersion, totalEverSeen, updatedAt: liveUpdatedAt } = usePoliceEvents();
  const { isPremium } = useIsPremium();
  // In the app this page is Statistik → Analys, next to the app's own trends; on the website it has them too
  const web = !isNativeApp();

  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  // The kommun's event history shows the latest first, the rest on request
  const [showAllHistory, setShowAllHistory] = useState(false);
  useEffect(() => setShowAllHistory(false), [selectedArea, timeRange]);

  // Fetch archive data for 7, 30 and 60 days (with pagination to bypass 1000-row limit)
  const archiveDays = timeRange === '24h' ? 0 : RANGE_DAYS[timeRange];
  const { incidents: archiveIncidents, loading: archiveLoading } = useArchiveEvents(archiveDays, timeRange !== '24h');

  // Use live data for 24h, archive data for the longer ranges
  const incidents = timeRange === '24h' ? liveIncidents : archiveIncidents;
  const loading = timeRange === '24h' ? liveLoading : archiveLoading;

  // Every kommun, whether or not something has happened there in the chosen period (an empty
  // list for "24 timmar" left out quiet places like Nacka), and the other areas the events name
  // ("Stockholms län")
  const availableAreas = useMemo(() => {
    const areas = new Set<string>(SWEDISH_KOMMUNER);
    [...liveIncidents, ...archiveIncidents].forEach((i) => {if (i.area) areas.add(i.area);});
    return Array.from(areas).sort((a, b) => a.localeCompare(b, 'sv'));
  }, [liveIncidents, archiveIncidents]);
  // A kommun takes its events however Polisen spells the place ("Nacka", "Nacka kommun"); other areas by name
  const inSelectedArea = useMemo(() => {
    if (!selectedArea) return () => true;
    const kommun = SWEDISH_KOMMUNER.includes(selectedArea) ? kommunMatcher(selectedArea) : null;
    return (i: Incident) => (kommun ? kommun(i.area) : i.area === selectedArea);
  }, [selectedArea]);

  // Track when data loads or changes. Live data may come from another page's recent
  // fetch, so show when it was actually fetched.
  useEffect(() => {
    if (incidents.length > 0) {
      setLastUpdated(timeRange === '24h' && liveUpdatedAt ? new Date(liveUpdatedAt) : new Date());
    }
  }, [dataVersion, incidents.length, timeRange, liveUpdatedAt]);

  // Filter incidents based on selected area (time filtering already done by data source)
  const filteredIncidents = useMemo(() => {
    const isSummary = (i: Incident) =>
      (i.originalType || '').toLowerCase().includes('sammanfattning');

    // Lists and summaries that were split count by their parts (lib/summaries)
    const parents = splitParentIds(incidents);
    if (timeRange === '24h') {
      const now = new Date();
      const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      return incidents.filter((i) => {
        try {
          const inTimeRange = parseTime(i.time) >= cutoff;
          const inArea = inSelectedArea(i);
          return inTimeRange && inArea && !isSummary(i) && !parents.has(i.id);
        } catch {return false;}
      });
    }
    return incidents.filter((i) => {
      const inArea = inSelectedArea(i);
      return inArea && !isSummary(i) && !parents.has(i.id);
    });
  }, [incidents, timeRange, inSelectedArea]);

  const stats = useMemo(() => {
    if (!filteredIncidents.length) return null;

    const highRisk = filteredIncidents.filter((i) => i.risk === 'high').length;
    const mediumRisk = filteredIncidents.filter((i) => i.risk === 'medium').length;
    const riskIndex = Math.round((highRisk * 3 + mediumRisk * 1.5) / filteredIncidents.length * 33);

    const typeCounts: Record<string, number> = {};
    filteredIncidents.forEach((i) => {typeCounts[i.type] = (typeCounts[i.type] || 0) + 1;});
    const typeData = Object.entries(typeCounts).
    map(([name, value]) => ({ name: TYPE_LABELS[name] || name, value, color: TYPE_COLORS[name] || TYPE_COLORS.other })).
    sort((a, b) => b.value - a.value);

    const hourlyCounts = Array.from({ length: 24 }, () => 0);
    filteredIncidents.forEach((i) => {
      try {const h = parseTime(i.time).getHours();if (!isNaN(h)) hourlyCounts[h]++;} catch {/* skip unparsable time */}
    });
    const hourlyData = hourlyCounts.map((antal, i) => ({ timme: String(i).padStart(2, '0'), antal }));

    let peakHour = 0;
    hourlyCounts.forEach((c, i) => {if (c > hourlyCounts[peakHour]) peakHour = i;});

    const areaCounts: Record<string, number> = {};
    filteredIncidents.forEach((i) => {if (i.area) areaCounts[i.area] = (areaCounts[i.area] || 0) + 1;});

    // Trend data based on filtered incidents
    const dayCounts: Record<string, number> = {};
    const dayNames = ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör'];
    filteredIncidents.forEach((i) => {
      try {const d = parseTime(i.time);dayCounts[d.toISOString().slice(0, 10)] = (dayCounts[d.toISOString().slice(0, 10)] || 0) + 1;} catch {/* skip unparsable time */}
    });
    const trendData = Object.entries(dayCounts).
    sort((a, b) => a[0].localeCompare(b[0])).
    map(([date, incidenter]) => {
      const d = new Date(date);
      return { dag: `${dayNames[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`, incidenter };
    });

    // Safety index based on filtered incidents
    const areaRisk: Record<string, {high: number;medium: number;low: number;total: number;}> = {};
    filteredIncidents.forEach((i) => {
      if (!i.area) return;
      if (!areaRisk[i.area]) areaRisk[i.area] = { high: 0, medium: 0, low: 0, total: 0 };
      areaRisk[i.area].total++;
      if (i.risk === 'high') areaRisk[i.area].high++;else
      if (i.risk === 'medium') areaRisk[i.area].medium++;else
      areaRisk[i.area].low++;
    });

    const maxWeight = Math.max(...Object.values(areaRisk).map((a) => a.high * 5 + a.medium * 2 + a.low), 1);
    const areaComparison = Object.entries(areaRisk).
    sort((a, b) => b[1].total - a[1].total).
    slice(0, 8).
    map(([område, { high, medium, low }]) => {
      const dangerScore = high * 5 + medium * 2 + low;
      const safetyIndex = Math.round(100 - dangerScore / maxWeight * 100);
      return { område, index: safetyIndex, total: high + medium + low, high };
    });

    // Seasonal warnings
    const seasonalWarnings: { icon: LucideIcon; title: string; message: string; severity: 'info' | 'warning' | 'danger' }[] = [];
    const now2 = new Date();
    const month = now2.getMonth();
    const policeCount = typeCounts['police'] || 0;
    const trafficCount = typeCounts['traffic'] || 0;
    const areaLabel = selectedArea || 'ditt område';

    if (month >= 9 && month <= 10 && policeCount > 3) {
      seasonalWarnings.push({
        icon: House, title: 'Höstlovssäsong – ökad inbrottsrisk',
        message: `Vi ser ${policeCount} polishändelser i ${areaLabel}. Statistiskt ökar bostadsinbrott inför och under höstlovet – tänk på att tända lampor och lås ordentligt.`,
        severity: 'warning',
      });
    }
    if (month === 11 || month === 0) {
      seasonalWarnings.push({
        icon: TreePine, title: 'Julperiod – stölder ökar',
        message: `Under december–januari ökar butiksstölder och paketbedrägerier i ${areaLabel}. Var extra vaksam med leveranser.`,
        severity: 'info',
      });
    }
    if (month >= 5 && month <= 7) {
      seasonalWarnings.push({
        icon: Sun, title: 'Sommar – fler inbrott i tomma hem',
        message: `Under semesterperioden ökar bostadsinbrott i ${areaLabel}. Använd tidur för belysning och be grannar hålla koll.`,
        severity: 'warning',
      });
    }
    const nightIncidents = [0,1,2,3,4].reduce((sum, h2) => sum + hourlyCounts[h2], 0);
    if (nightIncidents > filteredIncidents.length * 0.3 && filteredIncidents.length > 5) {
      seasonalWarnings.push({
        icon: Moon, title: 'Nattlig aktivitet ovanligt hög',
        message: `${Math.round(nightIncidents / filteredIncidents.length * 100)}% av händelserna i ${areaLabel} sker mellan kl. 00–05. Var extra försiktig under nattetid.`,
        severity: 'danger',
      });
    }
    if ((month >= 9 || month <= 2) && trafficCount > 3) {
      seasonalWarnings.push({
        icon: Car, title: 'Mörkerperiod – fler trafikolyckor',
        message: `${trafficCount} trafikhändelser i ${areaLabel}. Under mörka månader ökar risken – kör försiktigt och använd reflexer.`,
        severity: 'info',
      });
    }
    if (highRisk > 2 && highRisk / filteredIncidents.length > 0.2) {
      seasonalWarnings.push({
        icon: AlertTriangle, title: 'Ovanligt många allvarliga händelser',
        message: `${highRisk} högrisk-händelser av totalt ${filteredIncidents.length} i ${areaLabel}. Var uppmärksam och följ polisens uppmaningar.`,
        severity: 'danger',
      });
    }

    return { riskIndex, typeData, hourlyData, peakHour, trendData, areaComparison, highRisk, total: filteredIncidents.length, seasonalWarnings };
  }, [filteredIncidents, selectedArea]);

  const place = selectedArea ?? 'Hela Sverige';
  const periodWord = timeRange === '24h' ? 'idag' : `${RANGE_DAYS[timeRange]} dagar`;

  return (
    <div className="h-screen flex flex-col bg-background">
      <Header />
      <div className={web ? 'flex-1 overflow-y-auto' : 'contents'}>
      {web && <Overview />}
      {!isPremium ?
      <PremiumGate
        title="Riskanalys & Statistik"
        description="Med Pro ser du trender, mest aktiva tider, riskindex och säkerhetsindex per kommun, upp till 60 dagar bakåt, och kan exportera till PDF och CSV."
        free={{ to: '/statistik', label: 'Se brottsutvecklingen i hela Sverige gratis' }} /> :


      <section className={web ? 'mx-auto max-w-7xl px-4 pb-10 pt-5 md:px-6' : 'flex-1 overflow-y-auto pb-10'} aria-labelledby="djupanalys">
        <div className="ca-dark rounded-3xl bg-black pb-8 pt-5 text-white">
          <div className="flex flex-wrap items-start justify-between gap-3 px-5">
            <div>
              <h2 id="djupanalys" className="text-[22px] font-bold tracking-tight">{web ? 'Djupanalys' : 'Analys'}</h2>
              <p className={`mt-0.5 text-[13px] ${MUTED}`}>
                {filteredIncidents.length} händelser · uppdaterad kl {lastUpdated.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <button onClick={() => {refetch();setLastUpdated(new Date());}} disabled={loading} aria-label="Uppdatera" className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1c1c1e] text-white transition active:opacity-60 disabled:opacity-50">
              <RefreshCw className={`h-[18px] w-[18px] ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="mt-4 px-4">
            <MunicipalitySelector areas={availableAreas} selected={selectedArea} onSelect={setSelectedArea} />
          </div>
          <div className="mt-3 max-w-md">
            <Segmented<TimeRange> options={TIME_RANGE_OPTIONS} value={timeRange} onChange={setTimeRange} />
          </div>

          {loading && !incidents.length ? (
            <div className="mx-4 mt-6 space-y-4" aria-label="Hämtar händelser">
              {[150, 200, 200].map((h, i) => <div key={i} className="animate-pulse rounded-2xl bg-[#1c1c1e]" style={{ height: h }} />)}
            </div>
          ) : !stats ? (
            <Card><p className={`text-[15px] ${MUTED}`}>Inga händelser {selectedArea ? `i ${selectedArea} ` : ''}{timeRange === '24h' ? 'idag än' : 'under perioden'}.</p></Card>
          ) : (
            <div className="lg:grid lg:grid-cols-2 lg:gap-x-2">
              <div>
                <Card title={`${place} · ${periodWord}`}>
                  <div className="grid grid-cols-2 gap-3">
                    <Figure value={stats.total} label="Händelser" note={timeRange === '24h' ? 'sedan midnatt' : `senaste ${RANGE_DAYS[timeRange]} dagarna`} />
                    <Figure
                      value={stats.highRisk}
                      label="Allvarliga"
                      note={stats.total ? `${Math.round(stats.highRisk / stats.total * 100)} % av alla` : '–'}
                      tone={stats.highRisk > 0 ? '#ff453a' : undefined}
                    />
                    <Figure value={`kl ${String(stats.peakHour).padStart(2, '0')}`} label="Mest händer" note={`${stats.hourlyData[stats.peakHour].antal} händelser den timmen`} />
                    <Figure value={riskWord(stats.riskIndex).word} label="Risknivå" note={`Index ${stats.riskIndex} av 100`} tone={riskWord(stats.riskIndex).color} />
                  </div>
                </Card>

                <Card title="Vad händer" footer="Polisens egen indelning av händelserna.">
                  <ul className="space-y-3">
                    {stats.typeData.map((t) => (
                      <li key={t.name}>
                        <div className="flex items-baseline justify-between gap-3 text-[15px]">
                          <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: t.color }} aria-hidden />{t.name}</span>
                          <span className="tabular-nums"><b className="font-semibold">{t.value}</b> <span className={MUTED}>· {Math.round(t.value / stats.total * 100)} %</span></span>
                        </div>
                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#2c2c2e]">
                          <div className="h-full rounded-full" style={{ width: `${(t.value / stats.typeData[0].value) * 100}%`, background: t.color }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>

                <Card title="När på dygnet" footer={`Flest händelser kl ${String(stats.peakHour).padStart(2, '0')}. Peka på en stapel för antalet.`}>
                  <Bars values={stats.hourlyData.map((h) => h.antal)} labels={stats.hourlyData.map((h) => h.timme)} every={6} unit="händelser" />
                </Card>

                {timeRange !== '24h' && stats.trendData.length > 1 && (
                  <Card title="Dag för dag">
                    <Bars values={stats.trendData.map((d) => d.incidenter)} labels={stats.trendData.map((d) => d.dag)} every={Math.max(1, Math.ceil(stats.trendData.length / 5))} unit="händelser" />
                  </Card>
                )}
              </div>

              <div>
                <DangerRanking
                  incidents={filteredIncidents}
                  periodLabel={`${periodWord}${selectedArea ? ` i ${selectedArea}` : ''}`}
                />

                {stats.seasonalWarnings.length > 0 && (
                  <Card title="Att tänka på">
                    <ul className="space-y-4">
                      {stats.seasonalWarnings.map((w) => (
                        <li key={w.title} className="flex gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: `${SEVERITY_COLOR[w.severity]}26`, color: SEVERITY_COLOR[w.severity] }} aria-hidden>
                            <w.icon className="h-[18px] w-[18px]" />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[15px] font-semibold leading-snug">{w.title}</span>
                            <span className={`mt-0.5 block text-[14px] leading-snug ${MUTED}`}>{w.message}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}

                {selectedArea && filteredIncidents.length > 0 && (
                  <Card title={`Senaste i ${selectedArea}`} footer={`${filteredIncidents.length} händelser ${timeRange === '24h' ? 'idag' : `de senaste ${RANGE_DAYS[timeRange]} dagarna`}.`}>
                    <ul className="-my-1">
                      {(showAllHistory ? filteredIncidents : filteredIncidents.slice(0, HISTORY_SHOWN)).map((inc) => {
                        const t = parseTime(inc.time);
                        return (
                          <li key={inc.id} className="border-b border-[rgba(84,84,88,0.65)] last:border-0">
                            <Link to={eventPath(inc.id)} className="flex items-center gap-3 py-2.5 active:opacity-60">
                              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: TYPE_COLORS[inc.type] || TYPE_COLORS.other }} aria-hidden />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[16px]">{cleanPoliceTitle(inc.title)}</span>
                                <span className={`block text-[13px] ${MUTED}`}>
                                  {t.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })} kl {t.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                                  {inc.risk === 'high' && <span className="text-[#ff453a]"> · Allvarlig</span>}
                                </span>
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                    {filteredIncidents.length > HISTORY_SHOWN && (
                      <button type="button" onClick={() => setShowAllHistory((v) => !v)} className="mt-2 h-11 w-full rounded-xl bg-[#2c2c2e] text-[16px] font-semibold text-[#0a84ff] active:opacity-60">
                        {showAllHistory ? 'Visa färre' : `Visa alla ${filteredIncidents.length}`}
                      </button>
                    )}
                  </Card>
                )}

                <div className="mx-4 mt-6">
                  <ExportData liveIncidents={liveIncidents} selectedArea={selectedArea} />
                </div>
              </div>
            </div>
          )}

          <p className={`mx-6 mt-6 text-center text-[12px] leading-snug ${FAINT}`}>
            Källa: Polisens händelser på polisen.se. Inga personuppgifter visas.
          </p>
        </div>
      </section>
      }
      </div>
    </div>);

};

export default Analysis;