import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useBackendHealth } from '@/hooks/useBackendHealth';

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
