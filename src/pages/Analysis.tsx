import Header from '@/components/Header';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { TrendingUp, TrendingDown, AlertTriangle, Shield, Clock, MapPin } from 'lucide-react';

const trendData = [
  { dag: 'Mån', incidenter: 18 }, { dag: 'Tis', incidenter: 24 },
  { dag: 'Ons', incidenter: 15 }, { dag: 'Tor', incidenter: 31 },
  { dag: 'Fre', incidenter: 28 }, { dag: 'Lör', incidenter: 42 },
  { dag: 'Sön', incidenter: 22 },
];

const hourlyData = Array.from({ length: 24 }, (_, i) => ({
  timme: `${String(i).padStart(2, '0')}`,
  antal: Math.round(5 + Math.random() * 25 + (i >= 18 && i <= 23 ? 15 : 0) + (i >= 0 && i <= 4 ? 10 : 0)),
}));

const typeData = [
  { name: 'Polisinsats', value: 42, color: 'hsl(210, 100%, 56%)' },
  { name: 'Brand', value: 18, color: 'hsl(0, 100%, 62%)' },
  { name: 'Ambulans', value: 15, color: 'hsl(142, 70%, 45%)' },
  { name: 'Trafikolycka', value: 20, color: 'hsl(25, 100%, 63%)' },
  { name: 'Övrigt', value: 5, color: 'hsl(215, 15%, 55%)' },
];

const areaComparison = [
  { område: 'Södermalm', index: 72 },
  { område: 'Norrmalm', index: 68 },
  { område: 'Kungsholmen', index: 45 },
  { område: 'Östermalm', index: 38 },
  { område: 'Gamla Stan', index: 62 },
  { område: 'Bromma', index: 25 },
];

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
    background: 'hsl(222, 40%, 8%)',
    border: '1px solid hsl(222, 20%, 16%)',
    borderRadius: '6px',
    fontSize: '11px',
    color: 'hsl(210, 20%, 90%)',
  },
};

const Analysis = () => (
  <div className="h-screen flex flex-col bg-background">
    <Header />
    <div className="flex-1 overflow-y-auto p-4 md:p-6 grid-overlay">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Analys</h1>
          <p className="text-xs text-muted-foreground">Stockholm — senaste 7 dagarna</p>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Riskindex" value="62" sub="+5 från förra veckan" icon={AlertTriangle} colorClass="text-cr-orange" />
          <StatCard label="Totalt incidenter" value="180" sub="Senaste 7 dagar" icon={Shield} colorClass="text-cr-blue" />
          <StatCard label="Trend" value="↑ 12%" sub="Jmf föregående period" icon={TrendingUp} colorClass="text-cr-red" />
          <StatCard label="Mest aktiv tid" value="22:00" sub="Fredagar, lördagar" icon={Clock} colorClass="text-cr-green" />
        </div>

        {/* Charts row 1 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">Incidenttrend — Vecka</h3>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="redGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(0, 100%, 62%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(0, 100%, 62%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 20%, 16%)" />
                <XAxis dataKey="dag" tick={{ fontSize: 10, fill: 'hsl(215, 15%, 55%)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(215, 15%, 55%)' }} />
                <Tooltip {...chartTooltipStyle} />
                <Area type="monotone" dataKey="incidenter" stroke="hsl(0, 100%, 62%)" fill="url(#redGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">Fördelning per typ</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={typeData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" stroke="none">
                  {typeData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip {...chartTooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-3 mt-2 justify-center">
              {typeData.map((t) => (
                <span key={t.name} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span className="w-2 h-2 rounded-full" style={{ background: t.color }} />
                  {t.name}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Charts row 2 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">Aktiva tider på dygnet</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 20%, 16%)" />
                <XAxis dataKey="timme" tick={{ fontSize: 9, fill: 'hsl(215, 15%, 55%)' }} interval={2} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(215, 15%, 55%)' }} />
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
              {areaComparison.map((a) => (
                <div key={a.område}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-foreground">{a.område}</span>
                    <span className={`text-xs font-mono font-bold ${a.index >= 60 ? 'text-cr-red' : a.index >= 40 ? 'text-cr-orange' : 'text-cr-green'}`}>
                      {a.index}/100
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${a.index}%`,
                        background: a.index >= 60
                          ? 'hsl(0, 100%, 62%)'
                          : a.index >= 40
                            ? 'hsl(25, 100%, 63%)'
                            : 'hsl(142, 70%, 45%)',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* AI prediction */}
        <div className="bg-card border border-primary/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-primary" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-foreground">Prediktiv riskindikator</h3>
              <span className="text-[10px] text-muted-foreground">AI-baserad modell • Beta</span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="bg-muted/50 rounded p-3">
              <span className="text-muted-foreground block mb-1">Nästa 24h prognos</span>
              <span className="text-cr-orange font-mono font-bold text-lg">Medel</span>
              <span className="text-muted-foreground block text-[10px]">Förhöjd risk fredagskväll</span>
            </div>
            <div className="bg-muted/50 rounded p-3">
              <span className="text-muted-foreground block mb-1">Hotspot-prediktion</span>
              <span className="text-foreground font-mono font-bold">Södermalm</span>
              <span className="text-muted-foreground block text-[10px]">Baserat på historisk data</span>
            </div>
            <div className="bg-muted/50 rounded p-3">
              <span className="text-muted-foreground block mb-1">Modellens konfidens</span>
              <span className="text-cr-blue font-mono font-bold text-lg">78%</span>
              <span className="text-muted-foreground block text-[10px]">Baserat på 30 dagars data</span>
            </div>
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground/50 font-mono text-center pb-4">
          CrimeRadar • Data sammanställd från öppna källor • Inga personuppgifter visas • GDPR-kompatibel
        </p>
      </div>
    </div>
  </div>
);

export default Analysis;
