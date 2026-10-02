import { BellOff, BellRing, Loader2, RotateCw, Send, Share, ShieldAlert, SquarePlus } from 'lucide-react';

export type DeviceState = 'checking' | 'on' | 'off' | 'blocked' | 'install' | 'unsupported';

interface DeviceCardProps {
  state: DeviceState;
  busy: boolean;
  hasAreas: boolean;
  error: string | null;
  onEnable: () => void;
  onDisable: () => void;
  onTest: () => void;
}

const BADGES: Record<DeviceState, { label: string; className: string }> = {
  checking: { label: 'Kontrollerar…', className: 'border-[hsl(var(--ca-line-strong))] text-muted-foreground' },
  on: { label: 'På', className: 'border-[hsl(var(--cr-green)/0.4)] bg-[hsl(var(--cr-green)/0.12)] text-[hsl(var(--cr-green))]' },
  off: { label: 'Av', className: 'border-[hsl(var(--ca-line-strong))] text-muted-foreground' },
  blocked: { label: 'Blockerad', className: 'border-[hsl(var(--ca-red)/0.4)] bg-[hsl(var(--ca-red)/0.1)] text-[hsl(var(--ca-red))]' },
  install: { label: 'Installera först', className: 'border-[hsl(var(--ca-amber)/0.4)] bg-[hsl(var(--ca-amber)/0.12)] text-[hsl(var(--ca-amber))]' },
  unsupported: { label: 'Stöds inte', className: 'border-[hsl(var(--ca-line-strong))] text-muted-foreground' },
};

const Step = ({ n, children }: { n: number; children: React.ReactNode }) => (
  <li className="flex items-start gap-3">
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--ca-panel-3))] ca-mono text-[11px] font-semibold text-foreground">{n}</span>
    <span className="pt-0.5 text-[13px] leading-relaxed text-[hsl(var(--ca-text-2))]">{children}</span>
  </li>
);

const primaryButton = 'inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[0_0_24px_-8px_hsl(var(--ca-red))] transition hover:bg-primary/90 disabled:opacity-60';
const secondaryButton = 'inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[hsl(var(--ca-line-strong))] bg-card/60 px-4 text-sm font-medium text-foreground transition hover:border-primary/50 disabled:opacity-60';

/** Push notifications on this phone or computer: its state and what to do next. */
/** Short status of push on this device, for the section header. */
export const DeviceBadge = ({ state }: { state: DeviceState }) => (
  <span className={`shrink-0 rounded-full border px-2.5 py-0.5 ca-mono text-[10px] uppercase tracking-[0.12em] ${BADGES[state].className}`}>
    {BADGES[state].label}
  </span>
);

const DeviceCard = ({ state, busy, hasAreas, error, onEnable, onDisable, onTest }: DeviceCardProps) => {
  return (
    <div>
      {state === 'checking' && (
        <div className="h-11 w-48 animate-pulse rounded-xl bg-[hsl(var(--ca-panel-3))]" aria-hidden />
      )}

      {state === 'on' && (
        <>
          <p className="text-[13px] leading-relaxed text-[hsl(var(--ca-text-2))]">
            {hasAreas
              ? 'Du får en notis här så fort något händer i dina områden.'
              : 'Notiser är på, men du bevakar inga kommuner ännu. Lägg till ett område ovan.'}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={onTest} disabled={busy} className={secondaryButton}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Skicka testnotis
            </button>
            <button type="button" onClick={onDisable} disabled={busy} className={`${secondaryButton} text-muted-foreground`}>
              <BellOff className="h-4 w-4" /> Stäng av
            </button>
          </div>
        </>
      )}

      {state === 'off' && (
        <>
          <p className="text-[13px] leading-relaxed text-[hsl(var(--ca-text-2))]">
            Slå på för att få en notis direkt när Polisen rapporterar något i dina områden, även när sidan är stängd.
          </p>
          <button type="button" onClick={onEnable} disabled={busy} className={`${primaryButton} mt-4 w-full sm:w-auto`}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />} Slå på notiser
          </button>
          {!hasAreas && <p className="mt-2 text-xs text-muted-foreground">Tips: välj minst ett område ovan, annars finns det inget att få notiser om.</p>}
        </>
      )}

      {state === 'install' && (
        <>
          <p className="text-[13px] leading-relaxed text-[hsl(var(--ca-text-2))]">
            På iPhone och iPad fungerar notiser bara när CrimeAlert är tillagt på hemskärmen. Det tar tio sekunder:
          </p>
          <ol className="mt-3 space-y-2.5">
            <Step n={1}>Tryck på <Share className="inline h-3.5 w-3.5 -translate-y-px text-foreground" aria-label="Dela" /> <strong className="text-foreground">Dela</strong> längst ner i Safari.</Step>
            <Step n={2}>Välj <SquarePlus className="inline h-3.5 w-3.5 -translate-y-px text-foreground" aria-hidden /> <strong className="text-foreground">Lägg till på hemskärmen</strong>.</Step>
            <Step n={3}>Öppna CrimeAlert från hemskärmen, gå till Notiser och tryck på <strong className="text-foreground">Slå på notiser</strong>.</Step>
          </ol>
        </>
      )}

      {state === 'blocked' && (
        <>
          <p className="flex items-start gap-2 text-[13px] leading-relaxed text-[hsl(var(--ca-text-2))]">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--ca-red))]" />
            Notiser från crimealert.se är blockerade i den här webbläsaren. Så här tillåter du dem igen:
          </p>
          <ol className="mt-3 space-y-2.5">
            <Step n={1}>Klicka eller tryck på ikonen till vänster om adressen (hänglås eller reglage).</Step>
            <Step n={2}>Ändra <strong className="text-foreground">Aviseringar</strong> till <strong className="text-foreground">Tillåt</strong>.</Step>
            <Step n={3}>Ladda om sidan och tryck på <strong className="text-foreground">Slå på notiser</strong>.</Step>
          </ol>
          <button type="button" onClick={() => window.location.reload()} className={`${secondaryButton} mt-4`}>
            <RotateCw className="h-4 w-4" /> Ladda om sidan
          </button>
        </>
      )}

      {state === 'unsupported' && (
        <p className="text-[13px] leading-relaxed text-[hsl(var(--ca-text-2))]">
          Den här webbläsaren kan inte ta emot pushnotiser. Använd Chrome, Edge, Firefox eller Safari på dator eller Android,
          eller lägg till CrimeAlert på hemskärmen på iPhone.
        </p>
      )}

      {error && state !== 'install' && state !== 'unsupported' && (
        <p role="alert" className="mt-3 rounded-lg border border-[hsl(var(--ca-red)/0.3)] bg-[hsl(var(--ca-red)/0.08)] px-3 py-2 text-xs text-[hsl(var(--ca-red))]">
          {error}
        </p>
      )}

      <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
        Notiser slås på per enhet. Gör samma sak i varje mobil eller dator där du vill få dem.
      </p>
    </div>
  );
};

export default DeviceCard;
