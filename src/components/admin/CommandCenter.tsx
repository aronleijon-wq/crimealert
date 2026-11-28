// The command centre at the top of the admin dashboard: the last day live, who uses CrimeAlert,
// how many come back, the way from a visit to paying, and where visitors come from. A dark,
// glowing panel in both themes; every number also stands as text, so nothing depends on colour.
import { Activity, Radio } from 'lucide-react';
import { change, funnelSteps, share, sourceName, stickiness, type Pulse } from '@/lib/commandCenter';

const nf = new Intl.NumberFormat('sv-SE');
const n = (v: number | null | undefined) => (v === null || v === undefined ? '–' : nf.format(v));
const p = (v: number | null) => (v === null ? '–' : `${v.toLocaleString('sv-SE')} %`);

const CSS = `
.cc{--cc-bg:#05080f;--cc-line:rgba(94,234,255,.16);--cc-glow:#5eeaff;--cc-hot:#ff4d6d;--cc-ok:#3dffa8;--cc-dim:rgba(200,230,255,.55);
  position:relative;overflow:hidden;border-radius:14px;border:1px solid var(--cc-line);color:#e8f6ff;
  background:radial-gradient(1200px 300px at 10% -20%,rgba(94,234,255,.12),transparent 60%),radial-gradient(900px 300px at 110% 120%,rgba(255,77,109,.10),transparent 60%),var(--cc-bg)}
.cc:before{content:"";position:absolute;inset:0;pointer-events:none;opacity:.5;
  background-image:linear-gradient(var(--cc-line) 1px,transparent 1px),linear-gradient(90deg,var(--cc-line) 1px,transparent 1px);background-size:28px 28px;
  mask-image:linear-gradient(180deg,#000,transparent 85%)}
.cc:after{content:"";position:absolute;left:0;right:0;height:120px;top:-120px;pointer-events:none;
  background:linear-gradient(180deg,transparent,rgba(94,234,255,.06),transparent);animation:cc-scan 7s linear infinite}
@keyframes cc-scan{to{top:110%}}
@media (prefers-reduced-motion:reduce){.cc:after{animation:none;display:none}}
.cc-mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.14em;text-transform:uppercase}
.cc-cell{position:relative;border:1px solid var(--cc-line);border-radius:10px;background:rgba(10,20,34,.65);backdrop-filter:blur(4px)}
.cc-cell:before,.cc-cell:after{content:"";position:absolute;width:10px;height:10px;border-color:var(--cc-glow);opacity:.7}
.cc-cell:before{top:-1px;left:-1px;border-top:1px solid;border-left:1px solid;border-top-left-radius:10px}
.cc-cell:after{bottom:-1px;right:-1px;border-bottom:1px solid;border-right:1px solid;border-bottom-right-radius:10px}
.cc-num{font-variant-numeric:tabular-nums;text-shadow:0 0 18px rgba(94,234,255,.45)}
.cc-bar{height:8px;border-radius:99px;background:linear-gradient(90deg,#5eeaff,#7c8cff);box-shadow:0 0 12px rgba(94,234,255,.55)}
.cc-dot{width:8px;height:8px;border-radius:99px;background:var(--cc-ok);box-shadow:0 0 10px var(--cc-ok);animation:cc-blink 1.6s ease-in-out infinite}
@keyframes cc-blink{50%{opacity:.35}}
`;

const Label = ({ children }: { children: React.ReactNode }) => <p className="cc-mono text-[10px] text-[var(--cc-dim)]">{children}</p>;

const Live = ({ label, value }: { label: string; value: number | null }) => (
  <div className="cc-cell px-3 py-2.5">
    <Label>{label}</Label>
    <p className="cc-num mt-1 text-2xl font-semibold">{n(value)}</p>
  </div>
);

/** A ring: how many of a cohort came back */
const Gauge = ({ label, part, whole, hint }: { label: string; part: number; whole: number; hint: string }) => {
  const v = share(part, whole);
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <div className="cc-cell flex items-center gap-3 px-3 py-3">
      <svg viewBox="0 0 72 72" className="h-16 w-16 shrink-0" aria-hidden>
        <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(94,234,255,.15)" strokeWidth="6" />
        <circle cx="36" cy="36" r={r} fill="none" stroke="var(--cc-glow)" strokeWidth="6" strokeLinecap="round"
          strokeDasharray={`${((v ?? 0) / 100) * c} ${c}`} transform="rotate(-90 36 36)" style={{ filter: 'drop-shadow(0 0 4px #5eeaff)' }} />
        <text x="36" y="40" textAnchor="middle" fontSize="13" fontWeight="600" fill="#e8f6ff">{v === null ? '–' : `${Math.round(v)}%`}</text>
      </svg>
      <div className="min-w-0">
        <Label>{label}</Label>
        <p className="mt-1 text-sm">{n(part)} av {n(whole)} kom tillbaka</p>
        <p className="text-[11px] text-[var(--cc-dim)]">{hint}</p>
      </div>
    </div>
  );
};

const CommandCenter = ({ pulse, generatedAt }: { pulse: Pulse; generatedAt: string }) => {
  const { last24, activity, growth, funnel30, sources } = pulse;
  const wow = change(growth.thisWeek, growth.weekBefore);
  const steps = funnelSteps(funnel30);
  const topSource = Math.max(1, ...sources.map((s) => s.visits));
  const sourceTotal = sources.reduce((a, s) => a + s.visits, 0);
  const time = new Date(generatedAt).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });

  return (
    <section className="cc p-4 sm:p-5" aria-label="Kommandocentral">
      <style>{CSS}</style>
      <div className="relative space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Radio className="h-4 w-4 text-[var(--cc-glow)]" aria-hidden />
            <p className="cc-mono text-xs text-[var(--cc-glow)]">CrimeAlert · Kommandocentral</p>
          </div>
          <p className="cc-mono flex items-center gap-2 text-[10px] text-[var(--cc-dim)]"><span className="cc-dot" aria-hidden /> Live · {time}</p>
        </header>

        <div>
          <Label>Senaste dygnet</Label>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Live label="Besök idag" value={last24.visits} />
            <Live label="Nya konton" value={last24.signups} />
            <Live label="Rapporter" value={last24.reports} />
            <Live label="Polishändelser" value={last24.events} />
            <Live label="Notiser skickade" value={last24.push} />
            <Live label="AI-frågor" value={last24.ask} />
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1.1fr_1fr]">
          <div className="cc-cell px-4 py-3.5">
            <div className="flex items-center justify-between">
              <Label>Aktiva användare</Label>
              <Activity className="h-3.5 w-3.5 text-[var(--cc-dim)]" aria-hidden />
            </div>
            {activity ? (
              <>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {([['Idag', activity.dau], ['7 dagar', activity.wau], ['30 dagar', activity.mau]] as const).map(([l, v]) => (
                    <div key={l}><p className="cc-num text-3xl font-semibold">{n(v)}</p><p className="text-[11px] text-[var(--cc-dim)]">{l}</p></div>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-[var(--cc-dim)]">
                  Inloggade som använt sajten eller appen. {p(stickiness(activity))} av månadens användare är inne varje dag.
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-[var(--cc-dim)]">Kör migrationen admin_activity för att se aktiva användare.</p>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {activity ? (
              <>
                <Gauge label="Återkomst dag 7" part={activity.d7.back} whole={activity.d7.cohort} hint="Konton 7–37 dagar gamla" />
                <Gauge label="Återkomst dag 30" part={activity.d30.back} whole={activity.d30.cohort} hint="Konton 30–90 dagar gamla" />
              </>
            ) : (
              <div className="cc-cell px-3 py-3 text-sm text-[var(--cc-dim)] sm:col-span-2">Återkomst visas efter migrationen.</div>
            )}
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="cc-cell px-4 py-3.5">
            <Label>Trattan · 30 dagar</Label>
            <ol className="mt-3 space-y-2.5">
              {steps.map((s) => (
                <li key={s.label}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span>{s.label}</span>
                    <span className="tabular-nums"><b className="cc-num font-semibold">{n(s.value)}</b>{s.fromPrevious !== null && <span className="ml-2 text-[11px] text-[var(--cc-dim)]">{p(s.fromPrevious)} av steget före</span>}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-[rgba(94,234,255,.08)]"><div className="cc-bar" style={{ width: `${s.width}%` }} /></div>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-[11px] text-[var(--cc-dim)]">
              Nya konton denna vecka: <b className="text-[#e8f6ff]">{n(growth.thisWeek)}</b> (veckan före {n(growth.weekBefore)}
              {wow !== null && <>, <span style={{ color: wow >= 0 ? 'var(--cc-ok)' : 'var(--cc-hot)' }}>{wow >= 0 ? '+' : ''}{wow} %</span></>}).
              Rapporter 7 dagar: {n(pulse.reports7)}.
            </p>
          </div>
          <div className="cc-cell px-4 py-3.5">
            <Label>Källor · 30 dagar</Label>
            {sources.length ? (
              <ul className="mt-3 space-y-2">
                {sources.map((s) => (
                  <li key={s.source} className="grid grid-cols-[6.5rem_1fr_6.5rem] items-center gap-2 text-sm">
                    <span className="truncate">{sourceName(s.source)}</span>
                    <div className="h-2 rounded-full bg-[rgba(94,234,255,.08)]"><div className="cc-bar" style={{ width: `${Math.max(2, Math.round((s.visits / topSource) * 100))}%` }} /></div>
                    <span className="text-right tabular-nums text-[12px]">{n(s.visits)} <span className="text-[var(--cc-dim)]">{p(share(s.visits, sourceTotal))}</span></span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-[var(--cc-dim)]">Inga källor än.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default CommandCenter;
