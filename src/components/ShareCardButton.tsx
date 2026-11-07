import { useState, type ReactNode } from 'react';
import { ImageDown, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { shareCard } from '@/lib/shareCard';

interface ShareCardButtonProps {
  /** Draws the picture when tapped (lib/shareCard) */
  make: () => Promise<Blob>;
  title: string;
  text: string;
  url: string;
  fileName: string;
  className?: string;
  children?: ReactNode;
  label?: string;
}

/** "Dela som bild": the event or the statistics as a picture, through the share sheet. */
const ShareCardButton = ({ make, title, text, url, fileName, className = '', children, label = 'Dela som bild' }: ShareCardButtonProps) => {
  const [busy, setBusy] = useState(false);
  const share = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await shareCard(await make(), { title, text, url, fileName });
      if (result === 'unsupported') toast({ title: 'Kunde inte dela bilden', description: 'Din webbläsare stödjer inte att dela bilder.' });
    } catch {
      toast({ title: 'Kunde inte skapa bilden', description: 'Försök igen om en stund.' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" onClick={share} disabled={busy} aria-label={label} className={className}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : children ?? <ImageDown className="h-4 w-4" aria-hidden />}
      {!children && <span>{label}</span>}
    </button>
  );
};

export default ShareCardButton;
