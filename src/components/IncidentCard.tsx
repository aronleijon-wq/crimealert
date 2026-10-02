import { Incident, incidentTypeConfig, riskConfig } from '@/data/mockIncidents';
import { parseIncidentTime } from '@/lib/incidentTime';
import { Clock, MapPin, Lock } from 'lucide-react';
import { useIsPremium } from '@/hooks/useIsPremium';

interface IncidentCardProps {
  incident: Incident;
  selected: boolean;
  index?: number;
  onClick: () => void;
}


const timeAgo = (dateStr: string) => {
  try {
    const date = parseIncidentTime(dateStr);
    if (!date) return '';
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

// Only the top of the list animates; hundreds of running animations make phones sluggish
const ANIMATED_ROWS = 12;

const IncidentCard = ({ incident, selected, index = 0, onClick }: IncidentCardProps) => {
  const animated = index < ANIMATED_ROWS;
  const typeConf = incidentTypeConfig[incident.type];
  const riskConf = riskConfig[incident.risk];
  const { isPremium } = useIsPremium();

  return (
    <button
      onClick={onClick}
      style={animated ? { animationDelay: `${index * 35}ms` } : undefined}
      className={`group relative w-full text-left px-3 py-2.5 border-b border-[hsl(var(--ca-line))] overflow-hidden ${animated ? 'ca-rise' : ''}
        transition-[background-color,border-color,transform] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]
        ${selected
          ? 'bg-[hsla(0,68%,52%,0.07)]'
          : 'hover:bg-[hsla(0,0%,100%,0.03)]'
        }`}
    >
      {/* vänsterkant / statusskena */}
      <span
        className={`absolute left-0 top-0 bottom-0 w-[2px] transition-all duration-500 ${
          selected
            ? 'bg-[hsl(var(--ca-red))] shadow-[0_0_12px_hsl(var(--ca-red)/0.8)]'
            : 'bg-transparent group-hover:bg-[hsl(var(--ca-line-strong))]'
        }`}
      />

      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[11px] leading-none">{typeConf.icon}</span>
          <span className="ca-mono text-[9px] uppercase tracking-[0.2em] text-[hsl(var(--ca-text-3))] truncate">
            {typeConf.label}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {incident.status === 'active' && (
            <span className={`w-1.5 h-1.5 rounded-full bg-[hsl(var(--ca-red))] ${animated ? 'animate-pulse-dot' : ''}`} />
          )}
          {isPremium ? (
            <span className={`ca-mono text-[9px] uppercase tracking-[0.14em] font-semibold ${riskConf.colorClass}`}>
              {riskConf.label}
            </span>
          ) : (
            <span className="ca-mono text-[9px] uppercase tracking-[0.14em] text-[hsl(var(--ca-text-3))] flex items-center gap-1">
              <Lock className="w-2.5 h-2.5 text-destructive/60 drop-shadow-[0_0_4px_hsl(var(--destructive)/0.5)]" />
              Risk
            </span>
          )}
        </div>
      </div>

      <h3 className="ca-display text-[13px] leading-[1.25] mb-1 text-[hsl(var(--ca-text))] transition-colors duration-300 group-hover:text-white">
        {incident.title}
      </h3>

      {(isPremium || incident.type === 'crisis') && (
        <p className="text-[10.5px] leading-relaxed text-[hsl(var(--ca-text-3))] mb-1.5 line-clamp-2">{incident.description}</p>
      )}

      <div className="flex items-center gap-3 ca-mono text-[9px] tracking-[0.1em] text-[hsl(var(--ca-text-3))]">
        <span className="flex items-center gap-1 truncate">
          <MapPin className="w-2.5 h-2.5 shrink-0" />
          {incident.area}
        </span>
        <span className="flex items-center gap-1 shrink-0">
          <Clock className="w-2.5 h-2.5" />
          {timeAgo(incident.time)}
        </span>
      </div>
    </button>
  );
};


export default IncidentCard;
