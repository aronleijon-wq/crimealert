import { useState } from 'react';
import { Flag } from 'lucide-react';
import { REPORT_REASONS, type ReportReason } from '@/lib/moderation';

interface Props {
  /** What is reported, as in "Rapportera kommentaren" */
  what: 'kommentaren' | 'rapporten';
  /** Who is blocked, as in "Blockera Anna" */
  author: string;
  onReport: (reason: ReportReason) => Promise<void>;
  onBlock: () => Promise<void>;
  /** The map popup is light whatever the theme */
  tone?: 'app' | 'popup';
}

const TONES = {
  app: {
    trigger: 'text-muted-foreground hover:text-foreground',
    panel: 'border-border bg-muted/40 text-foreground',
    muted: 'text-muted-foreground',
    chip: 'border-border bg-background hover:border-primary/40 hover:text-primary',
    danger: 'bg-destructive text-destructive-foreground',
  },
  popup: {
    trigger: 'text-[#aaa] hover:text-[#555]',
    panel: 'border-[#e5e7eb] bg-[#f8f8f8] text-[#333]',
    muted: 'text-[#888]',
    chip: 'border-[#e5e7eb] bg-white hover:border-[#3b82f6] hover:text-[#3b82f6]',
    danger: 'bg-[#ef4444] text-white',
  },
};

/**
 * Report a post or block its author: what Apple asks of apps where people post to each other.
 * Renders the flag button, and below it (on a line of its own in a wrapping row) the choices.
 */
const ModerationMenu = ({ what, author, onReport, onBlock, tone = 'app' }: Props) => {
  const [step, setStep] = useState<'closed' | 'menu' | 'block'>('closed');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = TONES[tone];

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      setStep('closed');
    } catch {
      setError('Det gick inte just nu. Försök igen.');
    } finally {
      setBusy(false);
    }
  };

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <>
      <button
        type="button"
        onClick={(e) => { stop(e); setStep(step === 'closed' ? 'menu' : 'closed'); setError(null); }}
        className={`flex items-center text-[10px] transition ${t.trigger}`}
        aria-label={`Rapportera ${what} eller blockera ${author}`}
        aria-expanded={step !== 'closed'}
      >
        <Flag className="h-3 w-3" aria-hidden />
      </button>

      {step !== 'closed' && (
        <div className={`basis-full mt-1 rounded-md border p-2 text-[10px] ${t.panel}`} onClick={stop}>
          {step === 'menu' ? (
            <>
              <p className="font-semibold">Rapportera {what}</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {REPORT_REASONS.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    disabled={busy}
                    onClick={() => run(() => onReport(r.value))}
                    className={`rounded-full border px-2 py-0.5 transition disabled:opacity-50 ${t.chip}`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <button type="button" onClick={() => setStep('block')} className="font-semibold underline">
                  Blockera {author}
                </button>
                <button type="button" onClick={() => setStep('closed')} className={t.muted}>
                  Avbryt
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="font-semibold">Blockera {author}?</p>
              <p className={`mt-0.5 ${t.muted}`}>
                Du ser inte längre det {author} skriver. Du kan häva det under Profil.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(onBlock)}
                  className={`rounded-full px-2.5 py-0.5 font-semibold disabled:opacity-50 ${t.danger}`}
                >
                  Blockera
                </button>
                <button type="button" onClick={() => setStep('menu')} className={t.muted}>
                  Tillbaka
                </button>
              </div>
            </>
          )}
          {error && <p className="mt-1.5 text-[#ef4444]">{error}</p>}
        </div>
      )}
    </>
  );
};

export default ModerationMenu;
