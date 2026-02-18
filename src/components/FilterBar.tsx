import { IncidentType, incidentTypeConfig } from '@/data/mockIncidents';
import { Lock } from 'lucide-react';
import { useIsPremium } from '@/hooks/useIsPremium';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';

interface FilterBarProps {
  activeFilters: IncidentType[];
  onToggleFilter: (type: IncidentType) => void;
  incidentCount: number;
  activeCount: number;
}

const FREE_FILTERS: IncidentType[] = ['police', 'traffic'];
const LOGGED_IN_FILTERS: IncidentType[] = ['police', 'fire', 'ambulance', 'traffic'];

const FilterBar = ({ activeFilters, onToggleFilter, incidentCount, activeCount }: FilterBarProps) => {
  const types: IncidentType[] = ['police', 'fire', 'ambulance', 'traffic', 'other'];
  const { isPremium } = useIsPremium();
  const { user } = useAuth();
  const isLoggedIn = !!user;
  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card/50">
      <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mr-2">Filter</span>
      {types.map((type) => {
        const config = incidentTypeConfig[type];
        const active = activeFilters.includes(type);
        const locked = !isPremium && !(isLoggedIn ? LOGGED_IN_FILTERS : FREE_FILTERS).includes(type);
        return (
          <button
            key={type}
            onClick={() => {
              if (locked) {
                if (!isLoggedIn) {
                  navigate('/account?mode=login');
                }
                return;
              }
              onToggleFilter(type);
            }}
            disabled={false}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-all border ${
              locked
                ? 'border-transparent bg-transparent text-muted-foreground/30 cursor-not-allowed'
                : active
                ? 'border-border bg-muted text-foreground'
                : 'border-transparent bg-transparent text-muted-foreground/50 hover:text-muted-foreground'
            }`}
            title={locked ? 'Uppgradera till Pro för alla filter' : config.label}
          >
            <span className="text-xs">{config.icon}</span>
            <span>{config.label}</span>
            {locked && <Lock className="w-2.5 h-2.5 ml-0.5" />}
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
