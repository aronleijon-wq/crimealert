import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { MemberKind, MemberSummary, ProMember } from '../../../supabase/functions/_shared/members';

const KIND: Record<MemberKind, { label: string; className: string }> = {
  trial: { label: 'Provperiod', className: 'bg-blue-500/15 text-blue-500' },
  paying: { label: 'Betalar', className: 'bg-green-500/15 text-green-600 dark:text-green-400' },
  past_due: { label: 'Betalning misslyckad', className: 'bg-red-500/15 text-red-500' },
  invite: { label: 'Inbjudan', className: 'bg-purple-500/15 text-purple-500' },
  free: { label: 'Gratis Pro', className: 'bg-muted text-muted-foreground' },
};
const SOURCE: Record<ProMember['source'], string> = { stripe: 'Webben', apple: 'Apple', invite: 'Inbjudan', free: 'Av oss' };
const PLAN: Record<string, string> = { monthly: 'Månad', yearly: 'År' };

type Filter = 'all' | MemberKind;
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Alla' },
  { value: 'trial', label: 'Provperiod' },
  { value: 'paying', label: 'Betalar' },
  { value: 'invite', label: 'Inbjudan' },
  { value: 'free', label: 'Gratis Pro' },
  { value: 'past_due', label: 'Misslyckad betalning' },
];

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: '2-digit' }) : '–');

/** What happens when `until` comes: the trial turns paying, the subscription renews, or Pro ends */
function next(m: ProMember): string {
  if (m.kind === 'free') return 'Inget slut';
  if (m.kind === 'invite') return 'Pro tar slut';
  if (m.kind === 'trial') return m.renews ? 'Börjar betala' : 'Avslutad, slutar';
  return m.renews ? 'Förnyas' : 'Avslutad, slutar';
}

const Box = ({ label, value, sub, tone }: { label: string; value: number; sub?: string; tone?: string }) => (
  <div className="rounded-lg border border-border p-3">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className={`text-2xl font-semibold tabular-nums ${tone ?? 'text-foreground'}`}>{value}</div>
    {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
  </div>
);

/**
 * Pro-medlemmar on the admin dashboard: everyone with Pro now (admin-dashboard, _shared/members),
 * with how they have it, when they joined and how many days are left. Trials ending soonest first.
 */
const ProMembers = ({ summary, list }: { summary: MemberSummary; list: ProMember[] }) => {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const rows = useMemo(
    () => list.filter((m) => (filter === 'all' || m.kind === filter) && m.email.toLowerCase().includes(query.trim().toLowerCase())),
    [list, filter, query],
  );
  const count = (f: Filter) => (f === 'all' ? list.length : list.filter((m) => m.kind === f).length);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Pro-medlemmar</CardTitle>
        <p className="text-sm text-muted-foreground">Alla som har Pro just nu. Provperioderna som tar slut först står överst.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Box label="Har Pro" value={summary.total} />
          <Box label="I provperiod" value={summary.trials} tone="text-blue-500" />
          <Box label="Provperiod slutar inom 3 dagar" value={summary.trialsEndingSoon} sub="och börjar betala" />
          <Box label="Avslutad provperiod" value={summary.trialsCancelled} sub="slutar utan att betala" tone={summary.trialsCancelled ? 'text-orange-500' : undefined} />
          <Box label="Betalar" value={summary.paying} tone="text-green-600 dark:text-green-400" sub={summary.pastDue ? `+ ${summary.pastDue} misslyckad betalning` : undefined} />
          <Box label="Inbjudan / gratis" value={summary.invite + summary.free} sub={`${summary.invite} inbjudan · ${summary.free} gratis`} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.filter((f) => f.value === 'all' || count(f.value) > 0).map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${filter === f.value ? 'bg-foreground text-background' : 'bg-muted text-foreground hover:bg-muted/70'}`}
            >
              {f.label} <span className="opacity-60">{count(f.value)}</span>
            </button>
          ))}
          <label className="relative ml-auto w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Sök e-post" aria-label="Sök e-post" className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary/60" />
          </label>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">E-post</th>
                <th className="px-3 py-2 font-medium">Typ</th>
                <th className="px-3 py-2 font-medium">Via</th>
                <th className="px-3 py-2 font-medium">Plan</th>
                <th className="px-3 py-2 font-medium">Konto sedan</th>
                <th className="px-3 py-2 font-medium">Pro sedan</th>
                <th className="px-3 py-2 font-medium">Nästa steg</th>
                <th className="px-3 py-2 text-right font-medium">Dagar kvar</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">Ingen med Pro här.</td></tr>
              ) : rows.map((m) => (
                <tr key={`${m.email}-${m.source}`} className="border-t border-border">
                  <td className="max-w-[240px] truncate px-3 py-2 font-medium text-foreground" title={m.email}>{m.email}</td>
                  <td className="px-3 py-2"><span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${KIND[m.kind].className}`}>{KIND[m.kind].label}</span></td>
                  <td className="px-3 py-2 text-muted-foreground">{SOURCE[m.source]}</td>
                  <td className="px-3 py-2 text-muted-foreground">{m.plan ? PLAN[m.plan] : '–'}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{date(m.joined)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{date(m.proSince)}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <span className={m.renews === false ? 'text-orange-500' : 'text-foreground'}>{next(m)}</span>
                    {m.until && <span className="text-muted-foreground"> {date(m.until)}</span>}
                  </td>
                  <td className={`px-3 py-2 text-right font-semibold tabular-nums ${m.daysLeft !== null && m.daysLeft <= 3 ? 'text-orange-500' : 'text-foreground'}`}>
                    {m.daysLeft ?? '∞'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          "Nästa steg" visar vad som händer när dagarna är slut: provperioden blir betald, prenumerationen förnyas, eller Pro tar slut.
          Apple visas bara för köp i appen med Apples nycklar inlagda. E-post är personuppgifter: dela inte listan.
        </p>
      </CardContent>
    </Card>
  );
};

export default ProMembers;
