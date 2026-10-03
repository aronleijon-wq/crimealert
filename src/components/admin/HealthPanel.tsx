import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, Gauge, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

interface Summary {
  views_by_day: { day: string; mobile: number | null; desktop: number | null }[];
  top_pages: { page: string; views: number }[];
  vitals: { name: string; device: string; p75: number; samples: number }[];
  errors: { name: string; count: number; last_seen: string; pages: string[]; detail: string | null }[];
}

// Google's limits for a good and a poor experience (75th percentile)
const LIMITS: Record<string, { good: number; poor: number; unit: string; label: string }> = {
  LCP: { good: 2500, poor: 4000, unit: 'ms', label: 'Största innehållet syns' },
  INP: { good: 200, poor: 500, unit: 'ms', label: 'Svarstid på tryck' },
  CLS: { good: 0.1, poor: 0.25, unit: '', label: 'Hopp i layouten' },
  FCP: { good: 1800, poor: 3000, unit: 'ms', label: 'Första innehållet syns' },
  TTFB: { good: 800, poor: 1800, unit: 'ms', label: 'Serverns svarstid' },
};

const verdict = (name: string, value: number) => {
  const limit = LIMITS[name];
  if (!limit) return 'text-foreground';
  return value <= limit.good ? 'text-[hsl(var(--cr-green))]' : value <= limit.poor ? 'text-[hsl(var(--cr-orange))]' : 'text-destructive';
};

const formatVital = (name: string, value: number) => (name === 'CLS' ? value.toFixed(2) : `${(value / 1000).toFixed(2)} s`);

/** How the site is doing for real visitors: views, loading times and errors, the last 7 days. */
const HealthPanel = () => {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [police, setPolice] = useState<{ fetched_at: string | null; alerted_at: string | null; latest_event_at: string | null } | null>(null);

  useEffect(() => {
    supabase.rpc('monitoring_summary', { _days: 7 }).then(({ data, error: rpcError }) => {
      if (rpcError) setError('Statistiken finns inte än. Kör databasmigreringen för övervakningen.');
      else setSummary(data as unknown as Summary);
    });
    supabase.rpc('police_fetch_status').then(({ data }) => {
      if (data) setPolice(data as unknown as typeof police);
    });
  }, []);

  const ago = (iso: string | null) => (iso ? `${Math.round((Date.now() - Date.parse(iso)) / 60000)} min sedan` : 'aldrig');
  const policeStale = !police?.fetched_at || Date.now() - Date.parse(police.fetched_at) > 30 * 60 * 1000;

  const totalViews = summary?.views_by_day.reduce((n, d) => n + (d.mobile ?? 0) + (d.desktop ?? 0), 0) ?? 0;
  const maxDay = Math.max(1, ...(summary?.views_by_day.map((d) => (d.mobile ?? 0) + (d.desktop ?? 0)) ?? [1]));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Activity className="h-6 w-6 text-primary" />
          <div>
            <CardTitle className="text-xl">Hälsa – senaste 7 dagarna</CardTitle>
            <CardDescription>Besök, laddtider och fel hos riktiga besökare. Utan cookies och utan personuppgifter, sparas 30 dagar.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {police && (
          <p className={`rounded-md border px-3 py-2 text-sm ${policeStale ? 'border-destructive/50 text-destructive' : 'border-border text-foreground'}`}>
            Polisen: senast hämtat {ago(police.fetched_at)} · senaste nya händelse {ago(police.latest_event_at)}
            {policeStale && ' · hämtningen har stannat, admin får en pushnotis'}
          </p>
        )}
        {error ? (
          <p className="text-sm text-muted-foreground">{error}</p>
        ) : !summary ? (
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        ) : (
          <>
            <section>
              <h3 className="text-sm font-semibold text-foreground">Sidvisningar: {totalViews}</h3>
              <div className="mt-3 flex h-28 items-end gap-1.5" aria-label="Sidvisningar per dag">
                {summary.views_by_day.map((d) => {
                  const mobile = d.mobile ?? 0;
                  const desktop = d.desktop ?? 0;
                  return (
                    <div key={d.day} className="flex flex-1 flex-col items-center gap-1" title={`${d.day}: ${mobile} mobil, ${desktop} dator`}>
                      <div className="flex w-full flex-col justify-end" style={{ height: '6rem' }}>
                        <div className="w-full rounded-t bg-primary/40" style={{ height: `${(desktop / maxDay) * 100}%` }} />
                        <div className="w-full bg-primary" style={{ height: `${(mobile / maxDay) * 100}%` }} />
                      </div>
                      <span className="text-[10px] text-muted-foreground">{d.day.slice(5)}</span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">Mörkt: mobil. Ljust: dator.</p>
              <ul className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                {summary.top_pages.map((p) => (
                  <li key={p.page} className="flex justify-between gap-3">
                    <span className="truncate font-mono text-xs text-muted-foreground">{p.page}</span>
                    <span className="tabular-nums">{p.views}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground"><Gauge className="h-4 w-4" /> Laddtider (75 % av besöken är snabbare)</h3>
              {summary.vitals.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Inga mätningar än.</p>
              ) : (
                <table className="mt-2 w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground"><th className="py-1 font-medium">Mått</th><th className="font-medium">Mobil</th><th className="font-medium">Dator</th></tr>
                  </thead>
                  <tbody>
                    {Object.keys(LIMITS).map((name) => {
                      const cell = (device: string) => {
                        const v = summary.vitals.find((x) => x.name === name && x.device === device);
                        return v ? <span className={verdict(name, v.p75)}>{formatVital(name, v.p75)} <span className="text-[10px] text-muted-foreground">({v.samples})</span></span> : <span className="text-muted-foreground">–</span>;
                      };
                      return (
                        <tr key={name} className="border-t border-border">
                          <td className="py-1.5">{LIMITS[name].label} <span className="text-[10px] text-muted-foreground">{name}</span></td>
                          <td>{cell('mobile')}</td>
                          <td>{cell('desktop')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </section>

            <section>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground"><AlertTriangle className="h-4 w-4" /> Fel</h3>
              {summary.errors.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Inga fel rapporterade.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {summary.errors.map((e) => (
                    <li key={e.name} className="rounded-md border border-border p-2">
                      <div className="flex items-start justify-between gap-3">
                        <span className="break-all font-mono text-xs text-foreground">{e.name}</span>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{e.count} st</span>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Senast {new Date(e.last_seen).toLocaleString('sv-SE')} · {e.pages.join(', ')}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default HealthPanel;
