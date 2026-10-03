import { useEffect, useState } from 'react';
import { Check, Share2 } from 'lucide-react';
import { shareEvent, type ShareResult } from '@/lib/share';

const LABELS: Partial<Record<ShareResult, string>> = { copied: 'Länken är kopierad', failed: 'Kunde inte dela' };

/** "Dela": the phone's share sheet, or the link copied, for one event. */
const ShareButton = ({ event, className = '', compact = false }: { event: { id: string; title: string; area?: string }; className?: string; compact?: boolean }) => {
  const [result, setResult] = useState<ShareResult | null>(null);
  useEffect(() => {
    if (!result) return;
    const timer = setTimeout(() => setResult(null), 2500);
    return () => clearTimeout(timer);
  }, [result]);

  const label = (result && LABELS[result]) || 'Dela';
  return (
    <button
      type="button"
      onClick={async (e) => {
        e.stopPropagation();
        setResult(await shareEvent(event));
      }}
      className={className}
      aria-live="polite"
    >
      {result === 'copied' ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
      {compact && !result ? <span className="sr-only">Dela</span> : <span>{label}</span>}
    </button>
  );
};

export default ShareButton;
