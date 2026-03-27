import { Incident, incidentTypeConfig, riskConfig } from '@/data/mockIncidents';
import { Clock, MapPin, Lock } from 'lucide-react';
import { useIsPremium } from '@/hooks/useIsPremium';

interface IncidentCardProps {
  incident: Incident;
  selected: boolean;
  onClick: () => void;
}

const timeAgo = (dateStr: string) => {
  try {
    if (!dateStr) return '';
    // Normalize "2026-02-20 8:05:52 +01:00" → "2026-02-20T08:05:52+01:00"
    let s = dateStr.trim();
    // Replace first space between date and time with T, collapse timezone spaces
    s = s.replace(
      /^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}):(\d{2}):(\d{2})\s*([+-]\s*\d{2}:\d{2})?$/,
      (_, d, h, m, sec, tz) => {
        const hh = h.padStart(2, '0');
        const tzClean = tz ? tz.replace(/\s/g, '') : '';
        return `${d}T${hh}:${m}:${sec}${tzClean}`;
      }
    );
    const date = new Date(s);
    if (isNaN(date.getTime())) return '';
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 0) return 'Just nu';
    if (diff < 60) return 'Just nu';
    if (diff < 3600) return `${Math.floor(diff / 60)} min sedan`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} tim sedan`;
    return `${Math.floor(diff / 86400)}d sedan`;
  } catch {
    return '';
  }
};

const IncidentCard = ({ incident, selected, onClick }: IncidentCardProps) => {
  const typeConf = incidentTypeConfig[incident.type];
  const riskConf = riskConfig[incident.risk];
  const { isPremium } = useIsPremium();

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 border-b border-border transition-all ${
        selected ? 'bg-muted border-l-2 border-l-primary' : 'hover:bg-muted/50 border-l-2 border-l-transparent'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-xs">{typeConf.icon}</span>
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            {typeConf.label}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {incident.status === 'active' && (
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-dot" />
          )}
          {isPremium ? (
            <span className={`text-[10px] font-mono font-semibold ${riskConf.colorClass}`}>
              {riskConf.label}
            </span>
          ) : (
            <span className="text-[10px] font-mono text-muted-foreground/40 flex items-center gap-0.5 relative">
              <Lock className="w-2.5 h-2.5 text-destructive/60 drop-shadow-[0_0_4px_hsl(var(--destructive)/0.5)]" />
              <span className="blur-[3px] select-none pointer-events-none text-destructive/40 font-semibold" aria-hidden="true">Medel</span>
            </span>
          )}
        </div>
      </div>

      <h3 className="text-sm font-semibold text-foreground mb-1 leading-tight">{incident.title}</h3>

      {isPremium && (
        <p className="text-[10px] text-muted-foreground mb-1.5 line-clamp-2">{incident.description}</p>
      )}

      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-0.5">
          <MapPin className="w-3 h-3" />
          {incident.area}
        </span>
        <span className="flex items-center gap-0.5">
          <Clock className="w-3 h-3" />
          {timeAgo(incident.time)}
        </span>
      </div>
    </button>
  );
};

export default IncidentCard;
