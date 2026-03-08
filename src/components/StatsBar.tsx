import { Incident, incidentTypeConfig } from '@/data/mockIncidents';

interface StatsBarProps {
  incidents: Incident[];
  onSelectIncident?: (id: string) => void;
}

const getTimeAgo = (dateStr: string) => {
  try {
    if (!dateStr) return '';
    let s = dateStr.trim();
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
    if (diff < 0 || diff < 60) return 'Just nu';
    if (diff < 3600) return `${Math.floor(diff / 60)} min sedan`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h sedan`;
    return `${Math.floor(diff / 86400)}d sedan`;
  } catch {
    return '';
  }
};

const StatsBar = ({ incidents, onSelectIncident }: StatsBarProps) => {
  const latest = incidents.slice(0, 20);
  // Duplicate for seamless loop
  const items = [...latest, ...latest];

  return (
    <div className="bg-card border-b border-border overflow-hidden relative">
      <div className="flex animate-ticker whitespace-nowrap">
        {items.map((inc, i) => {
          const conf = incidentTypeConfig[inc.type];
          const isActive = inc.status === 'active';
          return (
            <div
              key={`${inc.id}-${i}`}
              onClick={() => onSelectIncident?.(inc.id)}
              className="inline-flex items-center gap-2 px-4 py-2 shrink-0 cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? 'animate-pulse-dot' : ''}`}
                style={{ background: conf.color }}
              />
              <span className="text-[10px] font-medium text-foreground truncate max-w-[180px]">
                {inc.title.replace(/^\d+\s\w+\s[\d.]+,\s*/, '')}
              </span>
              <span className="text-[9px] text-muted-foreground font-mono">
                {getTimeAgo(inc.time)}
              </span>
              <span className="text-[9px] text-muted-foreground/30 ml-2">|</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StatsBar;
