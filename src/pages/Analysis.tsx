import { useMemo, useEffect, useState, useRef } from 'react';
import Header from '@/components/Header';
import AdBanner from '@/components/AdBanner';
import PremiumGate from '@/components/PremiumGate';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, Legend } from 'recharts';
import { TrendingUp, AlertTriangle, Shield, Clock, MapPin, RefreshCw, Search, X, ChevronDown, Eye, Lightbulb } from 'lucide-react';
import { usePoliceEvents } from '@/hooks/usePoliceEvents';
import { useIsPremium } from '@/hooks/useIsPremium';
import CommunityReports from '@/components/CommunityReports';

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

const StatCard = ({ label, value, sub, icon: Icon, colorClass }: {label: string;value: string | number;sub: string;icon: any;colorClass: string;}) =>
<div className="bg-card border border-border rounded-lg p-4">
    <div className="flex items-center justify-between mb-2">
      <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{label}</span>
      <Icon className={`w-4 h-4 ${colorClass}`} />
    </div>
    <div className={`text-2xl font-bold font-mono ${colorClass}`}>{value}</div>
    <span className="text-[10px] text-muted-foreground">{sub}</span>
  </div>;


const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-md px-3 py-2 shadow-lg text-xs">
      <p className="text-foreground font-medium mb-1">{label}</p>
      {payload.map((p: any, i: number) =>
      <p key={i} style={{ color: p.color }} className="font-mono">
          {p.name}: {p.value}
        </p>
      )}
    </div>);

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

type TimeRange = '24h' | '7d' | '30d';
const TIME_RANGE_OPTIONS: {value: TimeRange;label: string;}[] = [
{ value: '24h', label: 'Idag' },
{ value: '7d', label: '7 dagar' },
{ value: '30d', label: '30 dagar' }];


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
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted hover:bg-muted/80 text-xs font-medium transition border border-border">

        <MapPin className="w-3 h-3 text-muted-foreground" />
        <span className="max-w-[120px] truncate">{selected ?? 'Hela Sverige'}</span>
        {selected ?
        <X className="w-3 h-3 text-muted-foreground hover:text-foreground" onClick={(e) => {e.stopPropagation();onSelect(null);setOpen(false);}} /> :

        <ChevronDown className="w-3 h-3 text-muted-foreground" />
        }
      </button>
      {open &&
      <div className="absolute top-full mt-1 right-0 z-50 w-64 bg-card border border-border rounded-lg shadow-xl overflow-hidden">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Sök kommun eller län..."
              className="w-full pl-7 pr-3 py-1.5 bg-background border border-border rounded-md text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />

            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            <button
            onClick={() => {onSelect(null);setOpen(false);setSearch('');}}
            className={`w-full text-left px-3 py-2 text-xs hover:bg-muted transition ${!selected ? 'text-primary font-semibold' : 'text-foreground'}`}>

              🇸🇪 Hela Sverige
            </button>
            {filtered.map((a) =>
          <button
            key={a}
            onClick={() => {onSelect(a);setOpen(false);setSearch('');}}
            className={`w-full text-left px-3 py-2 text-xs hover:bg-muted transition ${selected === a ? 'text-primary font-semibold' : 'text-foreground'}`}>

                {a}
              </button>
          )}
            {filtered.length === 0 &&
          <p className="px-3 py-2 text-xs text-muted-foreground">Inga resultat</p>
          }
          </div>
        </div>
      }
    </div>);

};

const Analysis = () => {
  const { incidents, loading, refetch, dataVersion, totalEverSeen } = usePoliceEvents();
  const { isPremium } = useIsPremium();

  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [selectedArea, setSelectedArea] = useState<string | null>(null);

  // Extract unique areas from all incidents
  const availableAreas = useMemo(() => {
    const areas = new Set<string>();
    incidents.forEach((i) => {if (i.area) areas.add(i.area);});
    return Array.from(areas).sort((a, b) => a.localeCompare(b, 'sv'));
  }, [incidents]);

  // Auto-refresh every 15 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
      setLastUpdated(new Date());
    }, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refetch]);

  // Track when data loads or changes
  useEffect(() => {
    if (incidents.length > 0) setLastUpdated(new Date());
  }, [dataVersion]);

  // Filter incidents based on selected time range
  const filteredIncidents = useMemo(() => {
    const now = new Date();
    let cutoff: Date;
    switch (timeRange) {
      case '24h':
        // Reset at midnight — show only today's incidents
        cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        break;
      case '7d':
        cutoff = new Date(now);
        cutoff.setDate(cutoff.getDate() - 7);
        break;
      case '30d':
        cutoff = new Date(now);
        cutoff.setDate(cutoff.getDate() - 30);
        break;
      case '30d':
        cutoff = new Date(now);
        cutoff.setDate(cutoff.getDate() - 30);
        break;
    }
    return incidents.filter((i) => {
      try {
        const inTimeRange = parseTime(i.time) >= cutoff;
        const inArea = !selectedArea || i.area === selectedArea;
        return inTimeRange && inArea;
      } catch {return false;}
    });
  }, [incidents, timeRange, selectedArea, dataVersion]);

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
      try {const h = parseTime(i.time).getHours();if (!isNaN(h)) hourlyCounts[h]++;} catch {}
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
      try {const d = parseTime(i.time);dayCounts[d.toISOString().slice(0, 10)] = (dayCounts[d.toISOString().slice(0, 10)] || 0) + 1;} catch {}
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

    // Time profiles: hourly breakdown per type
    const typeHourly: Record<string, number[]> = {};
    filteredIncidents.forEach((i) => {
      try {
        const h = parseTime(i.time).getHours();
        if (!isNaN(h)) {
          if (!typeHourly[i.type]) typeHourly[i.type] = Array.from({ length: 24 }, () => 0);
          typeHourly[i.type][h]++;
        }
      } catch {}
    });
    const timeProfileData = Array.from({ length: 24 }, (_, h) => {
      const row: any = { timme: String(h).padStart(2, '0') + ':00' };
      Object.keys(typeHourly).forEach((type) => {
        row[TYPE_LABELS[type] || type] = typeHourly[type][h];
      });
      return row;
    });
    const timeProfileTypes = Object.keys(typeHourly).map((t) => ({
      key: TYPE_LABELS[t] || t,
      color: TYPE_COLORS[t] || TYPE_COLORS.other,
    }));

    // Seasonal warnings
    const seasonalWarnings: { icon: string; title: string; message: string; severity: 'info' | 'warning' | 'danger' }[] = [];
    const now2 = new Date();
    const month = now2.getMonth();
    const policeCount = typeCounts['police'] || 0;
    const trafficCount = typeCounts['traffic'] || 0;
    const areaLabel = selectedArea || 'ditt område';

    if (month >= 9 && month <= 10 && policeCount > 3) {
      seasonalWarnings.push({
        icon: '🏠', title: 'Höstlovssäsong – ökad inbrottsrisk',
        message: `Vi ser ${policeCount} polishändelser i ${areaLabel}. Statistiskt ökar bostadsinbrott inför och under höstlovet – tänk på att tända lampor och lås ordentligt.`,
        severity: 'warning',
      });
    }
    if (month === 11 || month === 0) {
      seasonalWarnings.push({
        icon: '🎄', title: 'Julperiod – stölder ökar',
        message: `Under december–januari ökar butiksstölder och paketbedrägerier i ${areaLabel}. Var extra vaksam med leveranser.`,
        severity: 'info',
      });
    }
    if (month >= 5 && month <= 7) {
      seasonalWarnings.push({
        icon: '☀️', title: 'Sommar – fler inbrott i tomma hem',
        message: `Under semesterperioden ökar bostadsinbrott i ${areaLabel}. Använd tidur för belysning och be grannar hålla koll.`,
        severity: 'warning',
      });
    }
    const nightIncidents = [0,1,2,3,4].reduce((sum, h2) => sum + hourlyCounts[h2], 0);
    if (nightIncidents > filteredIncidents.length * 0.3 && filteredIncidents.length > 5) {
      seasonalWarnings.push({
        icon: '🌙', title: 'Nattlig aktivitet ovanligt hög',
        message: `${Math.round(nightIncidents / filteredIncidents.length * 100)}% av händelserna i ${areaLabel} sker mellan kl. 00–05. Var extra försiktig under nattetid.`,
        severity: 'danger',
      });
    }
    if ((month >= 9 || month <= 2) && trafficCount > 3) {
      seasonalWarnings.push({
        icon: '🚗', title: 'Mörkerperiod – fler trafikolyckor',
        message: `${trafficCount} trafikhändelser i ${areaLabel}. Under mörka månader ökar risken – kör försiktigt och använd reflexer.`,
        severity: 'info',
      });
    }
    if (highRisk > 2 && highRisk / filteredIncidents.length > 0.2) {
      seasonalWarnings.push({
        icon: '⚠️', title: 'Ovanligt många allvarliga händelser',
        message: `${highRisk} högrisk-händelser av totalt ${filteredIncidents.length} i ${areaLabel}. Var uppmärksam och följ polisens uppmaningar.`,
        severity: 'danger',
      });
    }

    return { riskIndex, typeData, hourlyData, peakHour, trendData, areaComparison, highRisk, total: filteredIncidents.length, timeProfileData, timeProfileTypes, seasonalWarnings };
  }, [filteredIncidents, dataVersion]);

  return (
    <div className="h-screen flex flex-col bg-background">
      <Header />
      <AdBanner />
      {!isPremium ?
      <PremiumGate
        title="Riskanalys & Statistik"
        description="Uppgradera till Pro för att se detaljerad analys, heatmaps, trender och säkerhetsindex per område." /> :


      <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  Analys {selectedArea && <span className="text-primary">· {selectedArea}</span>}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {filteredIncidents.length} händelser{selectedArea ? ` i ${selectedArea}` : ''} · Uppdaterad {lastUpdated.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <MunicipalitySelector areas={availableAreas} selected={selectedArea} onSelect={setSelectedArea} />
                <div className="flex bg-muted rounded-lg p-0.5">
                  {TIME_RANGE_OPTIONS.map((opt) =>
                <button
                  key={opt.value}
                  onClick={() => setTimeRange(opt.value)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  timeRange === opt.value ?
                  'bg-background text-foreground shadow-sm' :
                  'text-muted-foreground hover:text-foreground'}`
                  }>

                      {opt.label}
                    </button>
                )}
                </div>
                <button onClick={() => {refetch();setLastUpdated(new Date());}} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-muted text-muted-foreground transition disabled:opacity-50 text-xs">
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline font-medium">Uppdatera</span>
                </button>
              </div>
            </div>

          {loading && !incidents.length ?
          <div className="flex items-center justify-center py-20">
                <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground mr-2" />
                <span className="text-sm text-muted-foreground">Hämtar data från Polisen.se...</span>
              </div> :

          <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatCard
                    label={timeRange === '24h' ? 'Idag' : 'I perioden'}
                    value={filteredIncidents.length}
                    sub={timeRange === '24h'
                      ? `Sedan kl 00:00 · ${new Date().toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}${selectedArea ? ` · ${selectedArea}` : ''}`
                      : `${TIME_RANGE_OPTIONS.find(o => o.value === timeRange)?.label ?? timeRange}${selectedArea ? ` · ${selectedArea}` : ''}`}
                    icon={TrendingUp}
                    colorClass="text-foreground"
                  />
                  <StatCard label="Riskindex" value={stats?.riskIndex ?? '–'} sub={stats ? `${stats.highRisk} högrisk` : 'Väntar på data'} icon={AlertTriangle} colorClass="text-cr-orange" />
                  <StatCard label="Hög risk" value={stats?.highRisk ?? 0} sub={stats && stats.total > 0 ? `${Math.round(stats.highRisk / stats.total * 100)}% av perioden` : 'Inga händelser ännu'} icon={AlertTriangle} colorClass="text-cr-red" />
                  <StatCard label="Mest aktiv tid" value={stats ? `${String(stats.peakHour).padStart(2, '0')}:00` : '–'} sub={stats ? `${stats.hourlyData[stats.peakHour].antal} händelser · ${timeRange === '24h' ? 'idag' : timeRange === '7d' ? 'snitt 7 dagar' : 'snitt 30 dagar'}` : 'Väntar på data'} icon={Clock} colorClass="text-cr-green" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-card border border-border rounded-lg p-4">
                    <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">Händelser per dag</h3>
                    {stats?.trendData?.length ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={stats.trendData}>
                        <defs>
                          <linearGradient id="redGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(0, 100%, 62%)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(0, 100%, 62%)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="dag" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                        <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                        <Tooltip content={<ChartTooltip />} />
                        <Area type="monotone" dataKey="incidenter" stroke="hsl(0, 100%, 62%)" fill="url(#redGrad)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                    ) : (
                    <div className="h-[220px] flex items-center justify-center">
                      <p className="text-xs text-muted-foreground">Ingen data ännu – uppdateras automatiskt</p>
                    </div>
                    )}
                  </div>

                  <div className="bg-card border border-border rounded-lg p-4">
                    <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">Fördelning per typ</h3>
                    {stats?.typeData?.length ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={stats.typeData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" stroke="none">
                          {stats.typeData.map((entry) =>
                      <Cell key={entry.name} fill={entry.color} />
                          )}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    ) : (
                    <div className="h-[220px] flex items-center justify-center">
                      <p className="text-xs text-muted-foreground">Ingen data ännu – uppdateras automatiskt</p>
                    </div>
                    )}
                    {stats?.typeData?.length ? (
                    <div className="flex flex-wrap gap-3 mt-2 justify-center">
                      {stats.typeData.map((t) =>
                  <span key={t.name} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <span className="w-2 h-2 rounded-full" style={{ background: t.color }} />
                          {t.name} ({t.value})
                        </span>
                      )}
                    </div>
                    ) : null}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-card border border-border rounded-lg p-4">
                    <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">Händelser per timme</h3>
                    {stats?.hourlyData?.some(h => h.antal > 0) ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={stats.hourlyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="timme" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} interval={2} />
                        <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="antal" fill="hsl(210, 100%, 56%)" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                    ) : (
                    <div className="h-[220px] flex items-center justify-center">
                      <p className="text-xs text-muted-foreground">Ingen data ännu – uppdateras automatiskt</p>
                    </div>
                    )}
                  </div>

                  <div className="bg-card border border-border rounded-lg p-4">
                    <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1">
                      <Shield className="w-3 h-3 inline mr-1" />
                      Säkerhetsindex per område
                    </h3>
                    <p className="text-[10px] text-muted-foreground mb-3">Baserat på {TIME_RANGE_OPTIONS.find(o => o.value === timeRange)?.label?.toLowerCase() ?? 'vald period'} · 100 = säkrast</p>
                    {stats?.areaComparison?.length ? (
                    <div className="space-y-3 mt-2">
                      {stats.areaComparison.map((a) =>
                  <div key={a.område}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-foreground truncate mr-2">{a.område}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-muted-foreground">{a.total} brott{a.high > 0 ? ` (${a.high} allvarliga)` : ''}</span>
                              <span className={`text-xs font-mono font-bold ${a.index <= 30 ? 'text-cr-red' : a.index <= 60 ? 'text-cr-orange' : 'text-cr-green'}`}>
                                {a.index}/100
                              </span>
                            </div>
                          </div>
                          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${a.index}%`,
                          background: a.index <= 30 ? 'hsl(0, 100%, 62%)' : a.index <= 60 ? 'hsl(25, 100%, 63%)' : 'hsl(142, 70%, 45%)'
                        }} />
                          </div>
                        </div>
                      )}
                    </div>
                    ) : (
                    <div className="h-[120px] flex items-center justify-center">
                      <p className="text-xs text-muted-foreground">Ingen data ännu – uppdateras automatiskt</p>
                    </div>
                    )}
                  </div>
                </div>

                {/* Predictive Analysis Section */}
                <div className="bg-card border border-border rounded-lg p-4 md:p-6">
                  <div className="flex items-center gap-2 mb-1">
                    <Eye className="w-4 h-4 text-primary" />
                    <h2 className="text-sm font-bold text-foreground">Prediktiv Analys – Trendspaning</h2>
                  </div>
                  <p className="text-[10px] text-muted-foreground mb-5">Baserat på mönster i aktuell data{selectedArea ? ` för ${selectedArea}` : ''}</p>

                  {/* Time Profiles Chart */}
                  <div className="mb-6">
                    <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3">
                      Tidsprofil – Brottstyp per timme
                    </h3>
                    <p className="text-[10px] text-muted-foreground mb-3">Visar när på dygnet olika händelsetyper är vanligast</p>
                    {stats?.timeProfileData && stats.timeProfileTypes.length > 0 ? (
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={stats.timeProfileData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="timme" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} interval={2} />
                          <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                          <Tooltip content={<ChartTooltip />} />
                          <Legend wrapperStyle={{ fontSize: 10 }} />
                          {stats.timeProfileTypes.map((t) => (
                            <Bar key={t.key} dataKey={t.key} stackId="a" fill={t.color} radius={[0, 0, 0, 0]} />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[200px] flex items-center justify-center">
                        <p className="text-xs text-muted-foreground">Ingen data ännu</p>
                      </div>
                    )}
                  </div>

                  {/* Seasonal Warnings */}
                  {stats?.seasonalWarnings && stats.seasonalWarnings.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Lightbulb className="w-3.5 h-3.5 text-cr-orange" />
                        <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Säsongsvarningar & insikter</h3>
                      </div>
                      <div className="space-y-3">
                        {stats.seasonalWarnings.map((w, i) => (
                          <div
                            key={i}
                            className={`rounded-lg border p-3 ${
                              w.severity === 'danger'
                                ? 'border-cr-red/30 bg-cr-red/5'
                                : w.severity === 'warning'
                                ? 'border-cr-orange/30 bg-cr-orange/5'
                                : 'border-primary/20 bg-primary/5'
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              <span className="text-lg">{w.icon}</span>
                              <div className="flex-1 min-w-0">
                                <p className={`text-xs font-semibold mb-0.5 ${
                                  w.severity === 'danger' ? 'text-cr-red' : w.severity === 'warning' ? 'text-cr-orange' : 'text-primary'
                                }`}>
                                  {w.title}
                                </p>
                                <p className="text-[11px] text-muted-foreground leading-relaxed">{w.message}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Community Reports */}
                <CommunityReports />

                <p className="text-[10px] text-muted-foreground/50 font-mono text-center pb-4">
                  CrimeAlert • Data från Polisen.se • Inga personuppgifter visas • GDPR-kompatibel
                </p>
              </>
          }
          </div>
        </div>
      }
    </div>);

};

export default Analysis;