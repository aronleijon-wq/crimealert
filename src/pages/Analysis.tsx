import { useMemo, useEffect, useState } from 'react';
import Header from '@/components/Header';
import AdBanner from '@/components/AdBanner';
import PremiumGate from '@/components/PremiumGate';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { TrendingUp, AlertTriangle, Shield, Clock, MapPin, RefreshCw } from 'lucide-react';
import { usePoliceEvents } from '@/hooks/usePoliceEvents';
import { useIsPremium } from '@/hooks/useIsPremium';

/** Normalize "2026-02-18 22:03:10 +01:00" → valid Date */
const parseTime = (t: string): Date => {
  // "2026-02-18 22:03:10 +01:00" → "2026-02-18T22:03:10+01:00"
  const normalized = t.replace(' ', 'T').replace('T+', '+').replace('T-', '-');
  return new Date(normalized);
};

const StatCard = ({ label, value, sub, icon: Icon, colorClass }: { label: string; value: string | number; sub: string; icon: any; colorClass: string }) => (
  <div className="bg-card border border-border rounded-lg p-4">
    <div className="flex items-center justify-between mb-2">
      <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{label}</span>
      <Icon className={`w-4 h-4 ${colorClass}`} />
    </div>
    <div className={`text-2xl font-bold font-mono ${colorClass}`}>{value}</div>
    <span className="text-[10px] text-muted-foreground">{sub}</span>
  </div>
);

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-md px-3 py-2 shadow-lg text-xs">
      <p className="text-foreground font-medium mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-mono">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

const TYPE_COLORS: Record<string, string> = {
  police: 'hsl(210, 100%, 56%)',
  fire: 'hsl(0, 100%, 62%)',
  ambulance: 'hsl(142, 70%, 45%)',
  traffic: 'hsl(25, 100%, 63%)',
  other: 'hsl(215, 15%, 55%)',
};

const TYPE_LABELS: Record<string, string> = {
  police: 'Polisinsats',
  fire: 'Brand',
  ambulance: 'Ambulans/Sjukvård',
  traffic: 'Trafikolycka',
  other: 'Övrigt',
};

const Analysis = () => {
  const { incidents, loading, refetch } = usePoliceEvents();
  const { isPremium } = useIsPremium();

  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Auto-refresh every 15 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
      setLastUpdated(new Date());
    }, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refetch]);

  // Track when data loads
  useEffect(() => {
    if (incidents.length > 0) setLastUpdated(new Date());
  }, [incidents]);

  // Filter to today's incidents only (resets at midnight)
  const todayIncidents = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return incidents.filter(i => {
      try { return parseTime(i.time) >= today; } catch { return false; }
    });
  }, [incidents]);

  const stats = useMemo(() => {
    if (!todayIncidents.length) return null;

    const highRisk = todayIncidents.filter(i => i.risk === 'high').length;
    const mediumRisk = todayIncidents.filter(i => i.risk === 'medium').length;
    const riskIndex = Math.round((highRisk * 3 + mediumRisk * 1.5) / todayIncidents.length * 33);

    const typeCounts: Record<string, number> = {};
    todayIncidents.forEach(i => { typeCounts[i.type] = (typeCounts[i.type] || 0) + 1; });
    const typeData = Object.entries(typeCounts)
      .map(([name, value]) => ({ name: TYPE_LABELS[name] || name, value, color: TYPE_COLORS[name] || TYPE_COLORS.other }))
      .sort((a, b) => b.value - a.value);

    const hourlyCounts = Array.from({ length: 24 }, () => 0);
    todayIncidents.forEach(i => {
      try { const h = parseTime(i.time).getHours(); if (!isNaN(h)) hourlyCounts[h]++; } catch {}
    });
    const hourlyData = hourlyCounts.map((antal, i) => ({ timme: String(i).padStart(2, '0'), antal }));

    let peakHour = 0;
    hourlyCounts.forEach((c, i) => { if (c > hourlyCounts[peakHour]) peakHour = i; });

    const areaCounts: Record<string, number> = {};
    todayIncidents.forEach(i => { if (i.area) areaCounts[i.area] = (areaCounts[i.area] || 0) + 1; });

    // Trend data uses ALL incidents (last 7 days) for the chart
    const dayCounts: Record<string, number> = {};
    const dayNames = ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör'];
    incidents.forEach(i => {
      try { const d = parseTime(i.time); dayCounts[d.toISOString().slice(0, 10)] = (dayCounts[d.toISOString().slice(0, 10)] || 0) + 1; } catch {}
    });
    const trendData = Object.entries(dayCounts)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-7)
      .map(([date, incidenter]) => {
        const d = new Date(date);
        return { dag: `${dayNames[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`, incidenter };
      });

    // Safety index uses last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentIncidents = incidents.filter(i => {
      try { return parseTime(i.time) >= sevenDaysAgo; } catch { return false; }
    });

    const areaRisk: Record<string, { high: number; medium: number; low: number; total: number }> = {};
    recentIncidents.forEach(i => {
      if (!i.area) return;
      if (!areaRisk[i.area]) areaRisk[i.area] = { high: 0, medium: 0, low: 0, total: 0 };
      areaRisk[i.area].total++;
      if (i.risk === 'high') areaRisk[i.area].high++;
      else if (i.risk === 'medium') areaRisk[i.area].medium++;
      else areaRisk[i.area].low++;
    });

    const maxWeight = Math.max(...Object.values(areaRisk).map(a => a.high * 5 + a.medium * 2 + a.low), 1);
    const areaComparison = Object.entries(areaRisk)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 8)
      .map(([område, { high, medium, low }]) => {
        const dangerScore = high * 5 + medium * 2 + low;
        const safetyIndex = Math.round(100 - (dangerScore / maxWeight) * 100);
        return { område, index: safetyIndex, total: high + medium + low, high };
      });

    return { riskIndex, typeData, hourlyData, peakHour, trendData, areaComparison, highRisk, totalToday: todayIncidents.length };
  }, [todayIncidents, incidents]);

  return (
    <div className="h-screen flex flex-col bg-background">
      <Header />
      <AdBanner />
      {!isPremium ? (
        <PremiumGate
          title="Riskanalys & Statistik"
          description="Uppgradera till Pro för att se detaljerad analys, heatmaps, trender och säkerhetsindex per område."
        />
      ) : (
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-foreground">Analys</h1>
                <p className="text-xs text-muted-foreground">
                  Senaste 24 timmarna · {todayIncidents.length} händelser idag · Uppdaterad {lastUpdated.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <button onClick={() => { refetch(); setLastUpdated(new Date()); }} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-muted text-muted-foreground transition disabled:opacity-50 text-xs">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline font-medium">Uppdatera</span>
              </button>
            </div>

            {loading && !incidents.length ? (
              <div className="flex items-center justify-center py-20">
                <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground mr-2" />
                <span className="text-sm text-muted-foreground">Hämtar data från Polisen.se...</span>
              </div>
            ) : stats ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatCard label="Riskindex" value={stats.riskIndex} sub={`${stats.highRisk} högrisk idag`} icon={AlertTriangle} colorClass="text-cr-orange" />
                  <StatCard label="Händelser idag" value={stats.totalToday} sub="Senaste 24 timmarna · Polisen.se" icon={Shield} colorClass="text-cr-blue" />
                  <StatCard label="Hög risk" value={stats.highRisk} sub={`${Math.round((stats.highRisk / stats.totalToday) * 100)}% av dagens`} icon={TrendingUp} colorClass="text-cr-red" />
                  <StatCard label="Mest aktiv tid" value={`${String(stats.peakHour).padStart(2, '0')}:00`} sub={`${stats.hourlyData[stats.peakHour].antal} händelser denna timme`} icon={Clock} colorClass="text-cr-green" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-card border border-border rounded-lg p-4">
                    <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">Händelser per dag</h3>
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
                  </div>

                  <div className="bg-card border border-border rounded-lg p-4">
                    <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">Fördelning per typ</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={stats.typeData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" stroke="none">
                          {stats.typeData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap gap-3 mt-2 justify-center">
                      {stats.typeData.map((t) => (
                        <span key={t.name} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <span className="w-2 h-2 rounded-full" style={{ background: t.color }} />
                          {t.name} ({t.value})
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-card border border-border rounded-lg p-4">
                    <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">Händelser per timme</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={stats.hourlyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="timme" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} interval={2} />
                        <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="antal" fill="hsl(210, 100%, 56%)" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="bg-card border border-border rounded-lg p-4">
                    <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1">
                      <Shield className="w-3 h-3 inline mr-1" />
                      Säkerhetsindex per område
                    </h3>
                    <p className="text-[10px] text-muted-foreground mb-3">Baserat på händelser senaste 7 dagarna · 100 = säkrast</p>
                    <div className="space-y-3 mt-2">
                      {stats.areaComparison.map((a) => (
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
                                background: a.index <= 30 ? 'hsl(0, 100%, 62%)' : a.index <= 60 ? 'hsl(25, 100%, 63%)' : 'hsl(142, 70%, 45%)',
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <p className="text-[10px] text-muted-foreground/50 font-mono text-center pb-4">
                  CrimeRadar • Data från Polisen.se • Inga personuppgifter visas • GDPR-kompatibel
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-10">Ingen data tillgänglig.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Analysis;
