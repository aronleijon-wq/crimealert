import { useCallback, useEffect, useState } from 'react';
import { Loader2, Mail, RefreshCw } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { PRICES } from '@/components/account/plans';
import ProMembers from './ProMembers';
import CommandCenter from './CommandCenter';
import type { Pulse } from '@/lib/commandCenter';
import type { MemberSummary, ProMember } from '../../../supabase/functions/_shared/members';

interface SourceSummary {
  mrr: number; paying: number; monthly: number; yearly: number; trials: number; trialMrr: number; pastDue: number; endingMrr: number; ending: number;
}
interface Dashboard {
  generated_at: string;
  notes: string[];
  revenue: {
    currency: string; mrr: number; arr: number; netMrr: number; newLast30: number; cancelledLast30: number; appleTest: number;
    /** Paying customers and trials at each month's end; after admin-dashboard is deployed with it */
    history?: { month: string; monthly: number; yearly: number; trials: number }[];
    stripe: SourceSummary; apple: SourceSummary; otherCurrencies: { currency: string; count: number; mrr: number }[];
  };
  users: { total: number; new7: number; new30: number; active30: number; byDay: { day: string; count: number; total: number }[] };
  devices: { app: number | null; web: number | null };
  engagement: { ask7: number | null; ask30: number | null; push7: number | null; places: number | null; reports30: number | null; freePro: number | null; invited: number | null };
  data: { events24h: number | null; eventsTotal: number | null };
  visits: { day: string; mobile: number; desktop: number }[];
  ai?: {
    answers7: number; answers30: number; cost7: number; cost30: number; costAll: number; costPerAnswer: number;
    byModel: { model: string; answers: number; cost: number }[]; byDay: { day: string; cost: number; answers: number }[];
  };
  /** Everyone with Pro now (admin-dashboard after this change; older answers lack it) */
  members?: { summary: MemberSummary; list: ProMember[] };
  /** The command centre's numbers (admin-dashboard after this change) */
  pulse?: Pulse;
  invites?: {
    links: number; inviters: number; invited: number; rewarded: number; proActive: number;
    list: { email: string; code: string; invited: number; rewarded: number; pro_until: string | null; pro_active: boolean; last_invite: string | null }[];
    recent: { at: string; inviter: string; invitee: string; rewarded: boolean }[];
  };
}

const nf = new Intl.NumberFormat('sv-SE');
/** Öre to kronor, rounded */
const kr = (minor: number) => `${nf.format(Math.round(minor / 100))} kr`;
/** Dollars: four decimals under 10 cents, cents up to 100, then whole dollars */
const usd = (v: number) => `$${v > 0 && v < 0.1 ? v.toFixed(4) : v < 100 ? v.toFixed(2) : nf.format(Math.round(v))}`;
const MODEL_NAMES: Record<string, string> = { 'claude-haiku-5-5': 'Haiku 5.5 (gratis)', 'claude-sonnet-5-5': 'Sonnet 5.5 (Pro)', 'claude-sonnet-5': 'Sonnet 5 (reserv)' };
const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('sv-SE') : '–');
const n = (v: number | null | undefined) => (v === null || v === undefined ? '–' : nf.format(v));
const shortDay = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
};

// Two series (mobile, desktop): the first two categorical slots, stepped for each theme and
// checked for colour blindness and contrast. One-series charts use the first.
// The plans use the first four slots in their fixed order (validated: CVD and normal-vision
// separation pass in both themes; the light theme's aqua and yellow are under 3:1 against the
// surface, so every segment also has its number in the table beside it) and a neutral gray for
// the free plan, which is the rest rather than a category of its own.
const CHART_CSS = `.admin-dash{--s1:#2a78d6;--s2:#eb6834;--s3:#1baf7a;--s4:#eda100;--s0:#c9c8c2}.dark .admin-dash{--s1:#3987e5;--s2:#d95926;--s3:#199e70;--s4:#c98500;--s0:#55544f}`;
const pct = (part: number, whole: number) => (whole > 0 ? `${(Math.round((part / whole) * 1000) / 10).toLocaleString('sv-SE')} %` : '–');
const monthName = (month: string) => new Date(`${month}-01T12:00:00Z`).toLocaleDateString('sv-SE', { month: 'short', year: '2-digit' });

const Stat = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
  <div className="rounded-lg border bg-card px-4 py-3.5">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-foreground">{value}</p>
    {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
  </div>
);

const tooltipStyle = { fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', color: 'hsl(var(--foreground))' };
const axis = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' };

/** Sends the four welcome e-mails (lifecycle-emails) to the admin's own address, to see them as a new account would */
const TestEmailsButton = () => {
  const [state, setState] = useState<'idle' | 'sending' | string>('idle');
  const send = async () => {
    setState('sending');
    const { data, error } = await supabase.functions.invoke<{ sent: number; to: string; kommun: string; error?: string }>('lifecycle-emails', { body: { preview: true } });
    setState(error || !data || data.error
      ? 'Kunde inte skicka. Är lifecycle-emails deployad?'
      : `${data.sent} av 4 testmejl skickade till ${data.to} (${data.kommun})`);
  };
  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" variant="outline" onClick={send} disabled={state === 'sending'}>
        {state === 'sending' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />} Testa välkomstmejlen
      </Button>
      {state !== 'idle' && state !== 'sending' && <p className="text-xs text-muted-foreground">{state}</p>}
    </div>
  );
};

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
  // Every account, by plan: paying (by month or year), in a trial, Pro free (from invites or
  // given), and the free plan for the rest
  const monthlyN = r.stripe.monthly + r.apple.monthly;
  const yearlyN = r.stripe.yearly + r.apple.yearly;
  const freeProN = (d.invites?.proActive ?? 0) + (d.engagement.freePro ?? 0);
  const freeN = Math.max(0, d.users.total - paying - trials - freeProN);
  const plans = [
    { key: 'monthly', label: 'Betalar månadsvis', value: monthlyN, color: 'var(--s1)', note: `${PRICES.monthly.price}${PRICES.monthly.period}` },
    { key: 'yearly', label: 'Betalar årsvis', value: yearlyN, color: 'var(--s2)', note: `${PRICES.yearly.price}${PRICES.yearly.period}` },
    { key: 'trial', label: 'I provperiod', value: trials, color: 'var(--s3)', note: 'betalar när den tar slut' },
    { key: 'freePro', label: 'Gratis Pro', value: freeProN, color: 'var(--s4)', note: 'från inbjudningar och gåvor' },
    { key: 'free', label: 'Gratisplan', value: freeN, color: 'var(--s0)', note: '' },
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
        <div className="flex flex-wrap items-start gap-2">
          <TestEmailsButton />
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />} Uppdatera
          </Button>
        </div>
      </div>

      {d.pulse && <CommandCenter pulse={d.pulse} generatedAt={d.generated_at} />}

      {d.notes.length > 0 && (
        <ul className="rounded-lg border border-dashed px-4 py-2.5 text-xs text-muted-foreground">
          {d.notes.map((note) => <li key={note}>{note}</li>)}
        </ul>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="MRR" value={kr(r.mrr)} sub={`ARR ${kr(r.arr)}`} />
        <Stat label="Betalande kunder" value={n(paying)} sub={`${pct(paying, d.users.total)} av kontona · ${r.newLast30} nya, ${r.cancelledLast30} uppsagda på 30 dagar`} />
        <Stat label="Användare" value={n(d.users.total)} sub={`+${n(d.users.new30)} på 30 dagar, +${n(d.users.new7)} på 7`} />
        <Stat label="Besök, 30 dagar" value={n(visits30)} sub={`${n(lastWeekVisits)} senaste veckan`} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Konton per plan</CardTitle>
          <p className="text-xs text-muted-foreground">
            <b className="font-semibold text-foreground">{n(paying)} betalar</b> av {n(d.users.total)} konton ({pct(paying, d.users.total)}),
            {' '}{n(trials)} provar och {n(freeN)} har gratisplanen.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* The whole, as one bar: a 2px gap between the parts, rounded ends */}
          <div className="flex h-4 w-full gap-[2px] overflow-hidden rounded" role="img" aria-label={plans.map((p) => `${p.label} ${p.value}`).join(', ')}>
            {plans.filter((p) => p.value > 0).map((p) => (
              <div key={p.key} title={`${p.label}: ${nf.format(p.value)} (${pct(p.value, d.users.total)})`} style={{ flexGrow: p.value, flexBasis: 0, minWidth: 3, background: p.color }} />
            ))}
          </div>
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Plan</th>
                <th className="py-2 pr-3 text-right font-medium">Konton</th>
                <th className="py-2 pr-3 text-right font-medium">Andel</th>
                <th className="hidden py-2 text-right font-medium sm:table-cell">Webben / appen</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => {
                const split = p.key === 'monthly' ? `${r.stripe.monthly} / ${r.apple.monthly}`
                  : p.key === 'yearly' ? `${r.stripe.yearly} / ${r.apple.yearly}`
                  : p.key === 'trial' ? `${r.stripe.trials} / ${r.apple.trials}` : '';
                return (
                  <tr key={p.key} className="border-b last:border-0">
                    <th scope="row" className="py-2 pr-3 text-left font-normal">
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: p.color }} aria-hidden />
                        <span className="text-foreground">{p.label}</span>
                        {p.note && <span className="hidden text-xs text-muted-foreground md:inline">{p.note}</span>}
                      </span>
                    </th>
                    <td className="py-2 pr-3 text-right font-semibold">{nf.format(p.value)}</td>
                    <td className="py-2 pr-3 text-right text-muted-foreground">{pct(p.value, d.users.total)}</td>
                    <td className="hidden py-2 text-right text-muted-foreground sm:table-cell">{split}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div>
            <p className="mb-1 text-sm font-medium text-foreground">Betalande per månad</p>
            {r.history && r.history.length > 0 ? (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={r.history} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tickFormatter={monthName} tick={axis} tickLine={false} axisLine={false} />
                    <YAxis tick={axis} tickLine={false} axisLine={false} width={44} allowDecimals={false} />
                    <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} contentStyle={tooltipStyle} labelFormatter={(m: string) => monthName(m)}
                      formatter={(v: number, name) => [nf.format(v), name === 'monthly' ? 'Månadsvis' : name === 'yearly' ? 'Årsvis' : 'Provperiod']} />
                    <Legend verticalAlign="top" align="left" height={32} wrapperStyle={{ top: 0, paddingLeft: 40 }} iconType="square" iconSize={9}
                      formatter={(v) => <span className="text-xs text-muted-foreground">{v === 'monthly' ? 'Månadsvis' : v === 'yearly' ? 'Årsvis' : 'Provperiod'}</span>} />
                    <Bar dataKey="monthly" stackId="p" fill="var(--s1)" stroke="hsl(var(--card))" strokeWidth={1} />
                    <Bar dataKey="yearly" stackId="p" fill="var(--s2)" stroke="hsl(var(--card))" strokeWidth={1} />
                    <Bar dataKey="trials" stackId="p" fill="var(--s3)" stroke="hsl(var(--card))" strokeWidth={1} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Visas när funktionen admin-dashboard har deployats med den här versionen.</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">I slutet av varje månad, den här månaden till idag. Appens prenumerationer som avslutats finns inte i historiken.</p>
          </div>
        </CardContent>
      </Card>

      {d.members && <ProMembers summary={d.members.summary} list={d.members.list} />}

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

      {d.ai && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Fråga AI, kostnad</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Senaste 30 dagarna" value={usd(d.ai.cost30)} sub={`${n(d.ai.answers30)} svar`} />
              <Stat label="Senaste veckan" value={usd(d.ai.cost7)} sub={`${n(d.ai.answers7)} svar`} />
              <Stat label="Per svar" value={usd(d.ai.costPerAnswer)} sub="snitt, 30 dagar" />
              <Stat label="Sedan mätningen började" value={usd(d.ai.costAll)} />
            </div>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.ai.byDay} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" tickFormatter={shortDay} tick={axis} tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis tick={axis} tickLine={false} axisLine={false} width={48} tickFormatter={(v: number) => `$${v.toFixed(2)}`} />
                  <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} contentStyle={tooltipStyle} labelFormatter={shortDay}
                    formatter={(v: number, _name, item) => [`${usd(v)} (${(item.payload as { answers: number }).answers} svar)`, 'Kostnad']} />
                  <Bar dataKey="cost" fill="var(--s1)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {d.ai.byModel.length > 0 && (
              <table className="w-full text-sm tabular-nums">
                <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-2 font-medium">Modell, 30 dagar</th><th className="py-2 text-right font-medium">Svar</th><th className="py-2 text-right font-medium">Kostnad</th></tr></thead>
                <tbody>{d.ai.byModel.map((m) => (
                  <tr key={m.model} className="border-b last:border-0"><td className="py-2">{MODEL_NAMES[m.model] ?? m.model}</td><td className="py-2 text-right">{n(m.answers)}</td><td className="py-2 text-right">{usd(m.cost)}</td></tr>
                ))}</tbody>
              </table>
            )}
            <p className="text-xs text-muted-foreground">Räknat från token per svar och Anthropics priser i dollar. Mätningen började när den här versionen deployades.</p>
          </CardContent>
        </Card>
      )}

      {d.invites && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Inbjudningar</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Har bjudit in" value={n(d.invites.inviters)} sub={`${n(d.invites.links)} har hämtat sin länk`} />
              <Stat label="Inbjudna vänner" value={n(d.invites.invited)} />
              <Stat label="Gav gratis Pro" value={n(d.invites.rewarded)} sub="7 dagar per vän, högst 8" />
              <Stat label="Har gratis Pro nu" value={n(d.invites.proActive)} sub="genom inbjudningar" />
            </div>
            {d.invites.list.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm tabular-nums">
                  <thead><tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Har bjudit in</th><th className="py-2 pr-3 text-right font-medium">Inbjudna</th>
                    <th className="py-2 pr-3 text-right font-medium">Gav Pro</th><th className="py-2 pr-3 text-right font-medium">Pro till</th><th className="py-2 text-right font-medium">Senast</th>
                  </tr></thead>
                  <tbody>{d.invites.list.map((i) => (
                    <tr key={i.code} className="border-b last:border-0">
                      <td className="max-w-[220px] truncate py-2 pr-3" title={i.email}>{i.email}</td>
                      <td className="py-2 pr-3 text-right">{i.invited}</td>
                      <td className="py-2 pr-3 text-right">{i.rewarded}</td>
                      <td className={`whitespace-nowrap py-2 pr-3 text-right ${i.pro_active ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>{date(i.pro_until)}</td>
                      <td className="whitespace-nowrap py-2 text-right text-muted-foreground">{date(i.last_invite)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ) : <p className="text-sm text-muted-foreground">Ingen har bjudit in någon än.</p>}
            {d.invites.recent.length > 0 && (
              <div>
                <h3 className="mb-1 text-xs font-medium text-muted-foreground">Senaste inbjudningarna</h3>
                <ul className="divide-y text-sm">{d.invites.recent.map((r) => (
                  <li key={`${r.at}-${r.invitee}`} className="flex flex-wrap items-baseline justify-between gap-x-3 py-1.5">
                    <span className="min-w-0 truncate">{r.inviter} <span className="text-muted-foreground">bjöd in</span> {r.invitee}</span>
                    <span className="whitespace-nowrap text-xs text-muted-foreground">{date(r.at)}{r.rewarded ? ' · gav Pro' : ''}</span>
                  </li>
                ))}</ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Aktiva användare" value={n(d.users.active30)} sub="inloggade senaste 30 dagarna" />
        <Stat label="iPhone-appar med notiser" value={n(d.devices.app)} sub={`${n(d.devices.web)} webbläsare med notiser`} />
        <Stat label="Frågor till AI" value={n(d.engagement.ask7)} sub={`senaste veckan, ${n(d.engagement.ask30)} på 30 dagar`} />
        <Stat label="Notiser skickade" value={n(d.engagement.push7)} sub="senaste veckan" />
        <Stat label="Bevakade platser" value={n(d.engagement.places)} />
        <Stat label="Medborgarrapporter" value={n(d.engagement.reports30)} sub="senaste 30 dagarna" />
        <Stat label="Pro för alltid" value={n(d.engagement.freePro)} sub="gratis, utan prenumeration" />
        <Stat label="Polisens händelser" value={n(d.data.events24h)} sub={`senaste dygnet, ${n(d.data.eventsTotal)} totalt`} />
      </div>
    </section>
  );
};

export default DashboardPanel;
