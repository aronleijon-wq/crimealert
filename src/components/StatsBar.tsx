import { Incident, incidentTypeConfig } from '@/data/mockIncidents';

interface StatsBarProps {
  incidents: Incident[];
}

const getTimeAgo = (iso: string) => {
  const diff = (Date.now() - new Date(iso).getTime()) / 60000;
  if (diff < 60) return `${Math.round(diff)} min sedan`;
  if (diff < 1440) return `${Math.round(diff / 60)}h sedan`;
  return `${Math.round(diff / 1440)}d sedan`;
};

const StatsBar = ({ incidents }: StatsBarProps) => {
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
              className="inline-flex items-center gap-2 px-4 py-2 shrink-0"
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
