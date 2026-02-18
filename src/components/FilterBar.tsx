import { IncidentType, incidentTypeConfig } from '@/data/mockIncidents';

interface FilterBarProps {
  activeFilters: IncidentType[];
  onToggleFilter: (type: IncidentType) => void;
  incidentCount: number;
  activeCount: number;
}

const FilterBar = ({ activeFilters, onToggleFilter, incidentCount, activeCount }: FilterBarProps) => {
  const types: IncidentType[] = ['police', 'fire', 'ambulance', 'traffic', 'other'];

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card/50">
      <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mr-2">Filter</span>
      {types.map((type) => {
        const config = incidentTypeConfig[type];
        const active = activeFilters.includes(type);
        return (
          <button
            key={type}
            onClick={() => onToggleFilter(type)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-all border ${
              active
                ? 'border-border bg-muted text-foreground'
                : 'border-transparent bg-transparent text-muted-foreground/50 hover:text-muted-foreground'
            }`}
          >
            <span className="text-xs">{config.icon}</span>
            <span>{config.label}</span>
          </button>
        );
      })}
      <div className="ml-auto flex items-center gap-3">
        <span className="text-[10px] font-mono text-muted-foreground">
          <span className="text-foreground">{incidentCount}</span> händelser
        </span>
        <span className="text-[10px] font-mono text-cr-red">
          <span className="font-semibold">{activeCount}</span> aktiva
        </span>
      </div>
    </div>
  );
};

export default FilterBar;
