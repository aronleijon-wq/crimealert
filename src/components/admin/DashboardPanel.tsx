import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface SourceSummary {
  mrr: number; paying: number; monthly: number; yearly: number; trials: number; trialMrr: number; pastDue: number; endingMrr: number; ending: number;
}
interface Dashboard {
  generated_at: string;
  notes: string[];
  revenue: {
    currency: string; mrr: number; arr: number; netMrr: number; newLast30: number; cancelledLast30: number; appleTest: number;
    stripe: SourceSummary; apple: SourceSummary; otherCurrencies: { currency: string; count: number; mrr: number }[];
  };
  users: { total: number; new7: number; new30: number; active30: number; byDay: { day: string; count: number; total: number }[] };
  devices: { app: number | null; web: number | null };
  engagement: { ask7: number | null; ask30: number | null; push7: number | null; places: number | null; reports30: number | null; freePro: number | null; invited: number | null };
  data: { events24h: number | null; eventsTotal: number | null };
  visits: { day: string; mobile: number; desktop: number }[];
}

const nf = new Intl.NumberFormat('sv-SE');
/** Öre to kronor, rounded */
const kr = (minor: number) => `${nf.format(Math.round(minor / 100))} kr`;
const n = (v: number | null | undefined) => (v === null || v === undefined ? '–' : nf.format(v));
const shortDay = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
};

// Two series (mobile, desktop): the first two categorical slots, stepped for each theme and
// checked for colour blindness and contrast. One-series charts use the first.
const CHART_CSS = `.admin-dash{--s1:#2a78d6;--s2:#eb6834}.dark .admin-dash{--s1:#3987e5;--s2:#d95926}`;

const Stat = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
  <div className="rounded-lg border bg-card px-4 py-3.5">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-foreground">{value}</p>
    {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
  </div>
);

const tooltipStyle = { fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', color: 'hsl(var(--foreground))' };
const axis = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' };

/** Revenue (Stripe and Apple), users, devices, engagement and visits, on one page */
const DashboardPanel = () => {
  const [d, setD] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase.functions.invoke<Dashboard>('admin-dashboard', { body: {} });
    if (err || !data) setError('Kunde inte hämta översikten. Är funktionen admin-dashboard deployad?');
    else setD(data);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (!d) {
    return (
      <Card><CardContent className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
        {error ?? <><Loader2 className="h-4 w-4 animate-spin" /> Hämtar översikten…</>}
        {error && <Button size="sm" variant="outline" onClick={load}>Försök igen</Button>}
      </CardContent></Card>
    );
  }

  const r = d.revenue;
  const paying = r.stripe.paying + r.apple.paying;
  const trials = r.stripe.trials + r.apple.trials;
  const rows: { label: string; stripe: string; apple: string; total: string }[] = [
    { label: 'MRR', stripe: kr(r.stripe.mrr), apple: kr(r.apple.mrr), total: kr(r.mrr) },
    { label: 'Betalande kunder', stripe: n(r.stripe.paying), apple: n(r.apple.paying), total: n(paying) },
    { label: 'varav månad / år', stripe: `${r.stripe.monthly} / ${r.stripe.yearly}`, apple: `${r.apple.monthly} / ${r.apple.yearly}`, total: `${r.stripe.monthly + r.apple.monthly} / ${r.stripe.yearly + r.apple.yearly}` },
    { label: 'I provperiod', stripe: n(r.stripe.trials), apple: n(r.apple.trials), total: n(trials) },
    { label: 'MRR efter provperioderna', stripe: kr(r.stripe.trialMrr), apple: kr(r.apple.trialMrr), total: kr(r.stripe.trialMrr + r.apple.trialMrr) },
    { label: 'Avslutas', stripe: `${r.stripe.ending} (${kr(r.stripe.endingMrr)})`, apple: `${r.apple.ending} (${kr(r.apple.endingMrr)})`, total: `${r.stripe.ending + r.apple.ending} (${kr(r.stripe.endingMrr + r.apple.endingMrr)})` },
    { label: 'Misslyckad betalning', stripe: n(r.stripe.pastDue), apple: '–', total: n(r.stripe.pastDue) },
  ];
  const visits30 = d.visits.reduce((s, v) => s + v.mobile + v.desktop, 0);
  const lastWeekVisits = d.visits.slice(-7).reduce((s, v) => s + v.mobile + v.desktop, 0);

  return (
    <section className="admin-dash space-y-4" aria-labelledby="oversikt-rubrik">
      <style>{CHART_CSS}</style>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 id="oversikt-rubrik" className="text-2xl font-semibold tracking-tight text-foreground">Översikt</h1>
          <p className="text-xs text-muted-foreground">Uppdaterad {new Date(d.generated_at).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })}</p>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />} Uppdatera
        </Button>
      </div>

      {d.notes.length > 0 && (
        <ul className="rounded-lg border border-dashed px-4 py-2.5 text-xs text-muted-foreground">
          {d.notes.map((note) => <li key={note}>{note}</li>)}
        </ul>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="MRR" value={kr(r.mrr)} sub={`ARR ${kr(r.arr)}`} />
        <Stat label="Betalande kunder" value={n(paying)} sub={`${r.newLast30} nya, ${r.cancelledLast30} uppsagda på 30 dagar`} />
        <Stat label="Användare" value={n(d.users.total)} sub={`+${n(d.users.new30)} på 30 dagar, +${n(d.users.new7)} på 7`} />
        <Stat label="Besök, 30 dagar" value={n(visits30)} sub={`${n(lastWeekVisits)} senaste veckan`} />
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Intäkter</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium"><span className="sr-only">Mått</span></th>
                  <th className="py-2 pr-3 text-right font-medium">Webben<span className="hidden sm:inline"> (Stripe)</span></th>
                  <th className="py-2 pr-3 text-right font-medium">Appen<span className="hidden sm:inline"> (Apple)</span></th>
                  <th className="py-2 text-right font-medium">Totalt</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {rows.map((row, i) => (
                  <tr key={row.label} className="border-b last:border-0">
                    <th scope="row" className={`py-2 pr-3 text-left font-normal ${i === 0 ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{row.label}</th>
                    <td className="whitespace-nowrap py-2 pr-3 text-right">{row.stripe}</td>
                    <td className="whitespace-nowrap py-2 pr-3 text-right">{row.apple}</td>
                    <td className={`whitespace-nowrap py-2 text-right ${i === 0 ? 'font-semibold' : ''}`}>{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            MRR är vad betalande kunder betalar per månad, årsabonnemang räknade som en tolftedel. Ungefär <b className="font-semibold text-foreground">{kr(r.netMrr)}</b> i månaden
            blir kvar efter 25 % moms, Stripes avgift (1,5 % + 1,80 kr per betalning) och Apples avgift (15 % i Small Business Program, annars 30 %).
            {r.appleTest > 0 && ` ${r.appleTest} testköp i appen räknas inte.`}
            {r.otherCurrencies.map((o) => ` ${o.count} i ${o.currency.toUpperCase()} (${nf.format(Math.round(o.mrr / 100))} ${o.currency.toUpperCase()}/mån) räknas inte i totalen.`)}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-base">Användare, 60 dagar</CardTitle></CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={d.users.byDay} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tickFormatter={shortDay} tick={axis} tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis tick={axis} tickLine={false} axisLine={false} width={44} allowDecimals={false} domain={[0, 'auto']} />
                <Tooltip contentStyle={tooltipStyle} labelFormatter={shortDay} formatter={(v: number, name) => [nf.format(v), name === 'total' ? 'Användare' : 'Nya']} />
                <Area type="monotone" dataKey="total" stroke="var(--s1)" strokeWidth={2} fill="var(--s1)" fillOpacity={0.12} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-base">Nya konton per dag</CardTitle></CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.users.byDay.slice(-30)} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tickFormatter={shortDay} tick={axis} tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis tick={axis} tickLine={false} axisLine={false} width={44} allowDecimals={false} />
                <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} contentStyle={tooltipStyle} labelFormatter={shortDay} formatter={(v: number) => [nf.format(v), 'Nya konton']} />
                <Bar dataKey="count" fill="var(--s1)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-1"><CardTitle className="text-base">Besök per dag, 30 dagar</CardTitle></CardHeader>
        <CardContent className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={d.visits} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tickFormatter={shortDay} tick={axis} tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis tick={axis} tickLine={false} axisLine={false} width={44} allowDecimals={false} />
              <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} contentStyle={tooltipStyle} labelFormatter={shortDay} formatter={(v: number, name) => [nf.format(v), name === 'mobile' ? 'Mobil' : 'Dator']} />
              <Legend verticalAlign="top" align="left" height={32} wrapperStyle={{ top: 0, paddingLeft: 40 }} iconType="square" iconSize={9} formatter={(v) => <span className="text-xs text-muted-foreground">{v === 'mobile' ? 'Mobil' : 'Dator'}</span>} />
              <Bar dataKey="mobile" stackId="v" fill="var(--s1)" stroke="hsl(var(--card))" strokeWidth={1} />
              <Bar dataKey="desktop" stackId="v" fill="var(--s2)" stroke="hsl(var(--card))" strokeWidth={1} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Aktiva användare" value={n(d.users.active30)} sub="inloggade senaste 30 dagarna" />
        <Stat label="iPhone-appar med notiser" value={n(d.devices.app)} sub={`${n(d.devices.web)} webbläsare med notiser`} />
        <Stat label="Frågor till AI" value={n(d.engagement.ask7)} sub={`senaste veckan, ${n(d.engagement.ask30)} på 30 dagar`} />
        <Stat label="Notiser skickade" value={n(d.engagement.push7)} sub="senaste veckan" />
        <Stat label="Bevakade platser" value={n(d.engagement.places)} />
        <Stat label="Medborgarrapporter" value={n(d.engagement.reports30)} sub="senaste 30 dagarna" />
        <Stat label="Gratis Pro" value={n(d.engagement.freePro)} sub={`${n(d.engagement.invited)} inbjudningar som gav Pro`} />
        <Stat label="Polisens händelser" value={n(d.data.events24h)} sub={`senaste dygnet, ${n(d.data.eventsTotal)} totalt`} />
      </div>
    </section>
  );
};

export default DashboardPanel;
