// The lägesbild card: the last week in a kommun in a few sentences, with whether AI wrote it and
// when. In the app's dark lists (Brottsatlas, Flöde) and on the website's kommun page.
import { Radar } from 'lucide-react';
import { useSituationReport } from '@/hooks/useSituationReport';

const clock = (iso: string) => new Date(iso).toLocaleTimeString('sv-SE', { timeZone: 'Europe/Stockholm', hour: '2-digit', minute: '2-digit' });

const SituationCard = ({ kommun, variant = 'app', className = '' }: { kommun: string; variant?: 'app' | 'web'; className?: string }) => {
  const { report, loading } = useSituationReport(kommun);
  if (!loading && !report) return null;
  const app = variant === 'app';
  const muted = app ? 'text-[rgba(235,235,245,0.6)]' : 'text-muted-foreground';
  return (
    <section
      aria-label={`Lägesbild ${kommun}`}
      aria-busy={loading}
      className={app
        ? `rounded-[14px] bg-[#1c1c1e] p-4 text-white ${className}`
        : `rounded-2xl border border-[hsl(var(--ca-line-strong))] bg-card p-4 sm:p-5 ${className}`}
    >
      <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-[#ff453a]">
        <Radar className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden /> Lägesbild · senaste veckan
      </p>
      {loading || !report ? (
        <div className="mt-3 space-y-2" aria-label="Hämtar lägesbilden">
          {[100, 92, 60].map((w) => <span key={w} className={`block h-3.5 animate-pulse rounded ${app ? 'bg-white/[0.08]' : 'bg-muted'}`} style={{ width: `${w}%` }} />)}
        </div>
      ) : (
        <>
          <p className={`mt-2 text-[16px] leading-[23px] ${app ? 'text-white' : 'text-foreground'}`}>{report.summary}</p>
          <p className={`mt-2.5 text-[12px] leading-snug ${muted}`}>
            {report.ai ? 'Sammanfattat med AI utifrån Polisens händelser och kan innehålla fel.' : 'Utifrån Polisens händelser.'} Uppdaterad {clock(report.generatedAt)}.
          </p>
        </>
      )}
    </section>
  );
};

export default SituationCard;
