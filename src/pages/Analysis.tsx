import { useMemo } from 'react';
import Header from '@/components/Header';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { TrendingUp, AlertTriangle, Shield, Clock, MapPin, RefreshCw } from 'lucide-react';
import { usePoliceEvents } from '@/hooks/usePoliceEvents';

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

const chartTooltipStyle = {
  contentStyle: {
    background: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '6px',
    fontSize: '11px',
    color: 'hsl(var(--foreground))',
  },
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

  const stats = useMemo(() => {
    if (!incidents.length) return null;

    const highRisk = incidents.filter(i => i.risk === 'high').length;
    const mediumRisk = incidents.filter(i => i.risk === 'medium').length;
    const riskIndex = Math.round((highRisk * 3 + mediumRisk * 1.5) / incidents.length * 33);

    // Type distribution
    const typeCounts: Record<string, number> = {};
    incidents.forEach(i => { typeCounts[i.type] = (typeCounts[i.type] || 0) + 1; });
    const typeData = Object.entries(typeCounts)
      .map(([name, value]) => ({ name: TYPE_LABELS[name] || name, value, color: TYPE_COLORS[name] || TYPE_COLORS.other }))
      .sort((a, b) => b.value - a.value);

    // Hourly distribution
    const hourlyCounts = Array.from({ length: 24 }, () => 0);
    incidents.forEach(i => {
      try {
        const h = new Date(i.time).getHours();
        if (!isNaN(h)) hourlyCounts[h]++;
      } catch {}
    });
    const hourlyData = hourlyCounts.map((antal, i) => ({ timme: String(i).padStart(2, '0'), antal }));

    // Peak hour
    let peakHour = 0;
    hourlyCounts.forEach((c, i) => { if (c > hourlyCounts[peakHour]) peakHour = i; });

    // Area distribution
    const areaCounts: Record<string, number> = {};
    incidents.forEach(i => { if (i.area) areaCounts[i.area] = (areaCounts[i.area] || 0) + 1; });
    const topAreas = Object.entries(areaCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([område, count]) => ({ område, index: Math.round((count / incidents.length) * 100) }));

    // Daily trend (group by date)
    const dayCounts: Record<string, number> = {};
    const dayNames = ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör'];
    incidents.forEach(i => {
      try {
        const d = new Date(i.time);
        const key = d.toISOString().slice(0, 10);
        dayCounts[key] = (dayCounts[key] || 0) + 1;
      } catch {}
    });
    const trendData = Object.entries(dayCounts)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-7)
      .map(([date, incidenter]) => {
        const d = new Date(date);
        return { dag: `${dayNames[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`, incidenter };
      });

    // Risk distribution for areas
    const areaRisk: Record<string, { high: number; total: number }> = {};
    incidents.forEach(i => {
      if (!i.area) return;
      if (!areaRisk[i.area]) areaRisk[i.area] = { high: 0, total: 0 };
      areaRisk[i.area].total++;
      if (i.risk === 'high' || i.risk === 'medium') areaRisk[i.area].high++;
    });
    const areaComparison = Object.entries(areaRisk)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 8)
      .map(([område, { high, total }]) => ({ område, index: Math.round((high / total) * 100) }));

    return { riskIndex, typeData, hourlyData, peakHour, topAreas, trendData, areaComparison, highRisk };
  }, [incidents]);

  return (
    <div className="h-screen flex flex-col bg-background">
      <Header />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-foreground">Analys</h1>
              <p className="text-xs text-muted-foreground">Baserat på {incidents.length} händelser från Polisen.se</p>
            </div>
            <button onClick={refetch} disabled={loading} className="p-2 rounded-md hover:bg-muted text-muted-foreground transition disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loading && !incidents.length ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground mr-2" />
              <span className="text-sm text-muted-foreground">Hämtar data från Polisen.se...</span>
            </div>
          ) : stats ? (
            <>
              {/* KPI cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Riskindex" value={stats.riskIndex} sub={`${stats.highRisk} högrisk-händelser`} icon={AlertTriangle} colorClass="text-cr-orange" />
                <StatCard label="Totalt händelser" value={incidents.length} sub="Från Polisen.se" icon={Shield} colorClass="text-cr-blue" />
                <StatCard label="Hög risk" value={stats.highRisk} sub={`${Math.round((stats.highRisk / incidents.length) * 100)}% av alla`} icon={TrendingUp} colorClass="text-cr-red" />
                <StatCard label="Mest aktiv tid" value={`${String(stats.peakHour).padStart(2, '0')}:00`} sub={`${stats.hourlyData[stats.peakHour].antal} händelser`} icon={Clock} colorClass="text-cr-green" />
              </div>

              {/* Charts row 1 */}
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
                      <Tooltip {...chartTooltipStyle} />
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
                      <Tooltip {...chartTooltipStyle} />
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

              {/* Charts row 2 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-card border border-border rounded-lg p-4">
                  <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">Händelser per timme</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={stats.hourlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="timme" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} interval={2} />
                      <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip {...chartTooltipStyle} />
                      <Bar dataKey="antal" fill="hsl(210, 100%, 56%)" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-card border border-border rounded-lg p-4">
                  <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">
                    <MapPin className="w-3 h-3 inline mr-1" />
                    Områdesriskindex
                  </h3>
                  <div className="space-y-3 mt-2">
                    {stats.areaComparison.map((a) => (
                      <div key={a.område}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-foreground truncate mr-2">{a.område}</span>
                          <span className={`text-xs font-mono font-bold ${a.index >= 60 ? 'text-cr-red' : a.index >= 40 ? 'text-cr-orange' : 'text-cr-green'}`}>
                            {a.index}/100
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${a.index}%`,
                              background: a.index >= 60 ? 'hsl(0, 100%, 62%)' : a.index >= 40 ? 'hsl(25, 100%, 63%)' : 'hsl(142, 70%, 45%)',
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
    </div>
  );
};

export default Analysis;
