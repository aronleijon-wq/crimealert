import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useBackendHealth } from '@/hooks/useBackendHealth';
import { hasAppDesign13 } from '@/lib/native';

export default function BackendStatusBanner() {
  const { status, downSince, recheck } = useBackendHealth();
  const [checking, setChecking] = useState(false);

  if (status !== 'down') return null;

  const minutes = downSince ? Math.max(1, Math.round((Date.now() - downSince) / 60000)) : 1;

  const handleRetry = async () => {
    setChecking(true);
    await recheck();
    setChecking(false);
  };

  // The app from 1.3: a small card at the top, below the title bar or the map's search, in the
  // phone's own type, not a red strip over the tabs
  if (hasAppDesign13()) {
    return (
      <div role="status" aria-live="polite" className="fixed inset-x-3 z-[9999] flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-[rgba(44,44,46,0.92)] px-4 py-3 text-white shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 60px)' }}>
        <AlertTriangle className="h-5 w-5 shrink-0 text-[#ff9f0a]" aria-hidden />
        <p className="min-w-0 flex-1 text-[14px] leading-snug">
          <span className="block font-semibold">Ingen anslutning</span>
          <span className="block text-[13px] text-[rgba(235,235,245,0.6)]">Visar det senast kända. Försöker igen av sig själv.</span>
        </p>
        <button type="button" onClick={handleRetry} disabled={checking} className="shrink-0 text-[15px] font-semibold text-[#ff453a] disabled:opacity-50">
          {checking ? 'Försöker…' : 'Försök igen'}
        </button>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-0 left-0 right-0 z-[9999] border-t border-destructive/40 bg-destructive/95 px-4 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] text-destructive-foreground"
    >
      <div className="mx-auto flex max-w-3xl items-center gap-3 text-xs font-mono">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <p className="flex-1 leading-tight">
          Anslutningen till CrimeAlerts server ligger nere ({minutes} min). Kartan visar
          senast kända data — vi försöker återansluta automatiskt.
        </p>
        <button
          onClick={handleRetry}
          disabled={checking}
          className="flex shrink-0 items-center gap-1 rounded border border-destructive-foreground/40 px-2 py-1 uppercase tracking-wide transition-opacity hover:opacity-80 disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${checking ? 'animate-spin' : ''}`} />
          Försök igen
        </button>
      </div>
    </div>
  );
}
