import { TrendingDown, TrendingUp } from 'lucide-react';
import { formatChange, formatNumber } from '@/content/crimeTrends';

/** A headline number with its change, for the top of the page and the start page. */
export const TrendTile = ({ label, value, change, since }: { label: string; value: number; change: number; since: string }) => {
  const Icon = change < 0 ? TrendingDown : TrendingUp;
  return (
    <div className="ca-tac ca-tac-top p-5">
      <p className="ca-meta">{label}</p>
      <p className="mt-2 font-['Archivo',Inter,sans-serif] text-4xl font-extrabold tabular-nums text-foreground">{formatNumber(value)}</p>
      <p className="mt-2 flex items-center gap-1.5 text-[13px] text-[hsl(var(--ca-text-2))]">
        <Icon className="h-4 w-4 shrink-0 text-[hsl(var(--ca-text))]" aria-hidden />
        <span><span className="font-semibold text-foreground">{formatChange(change)}</span> {since}</span>
      </p>
    </div>
  );
};
