import { IncidentType, incidentTypeConfig } from '@/data/mockIncidents';
import { Lock, User } from 'lucide-react';
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

const TYPE_COLORS: Record<IncidentType, string> = {
  police: 'hsl(var(--cr-blue))',
  fire: 'hsl(var(--cr-red))',
  ambulance: 'hsl(var(--cr-orange))',
  traffic: 'hsl(var(--cr-orange))',
  other: 'hsl(var(--muted-foreground))',
};

const FilterBar = ({ activeFilters, onToggleFilter, incidentCount, activeCount }: FilterBarProps) => {
  const types: IncidentType[] = ['police', 'fire', 'ambulance', 'traffic', 'other'];
  const { isPremium } = useIsPremium();
  const { user } = useAuth();
  const isLoggedIn = !!user;
  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border bg-card/80 backdrop-blur-sm overflow-x-auto scrollbar-none">
      {types.map((type) => {
        const config = incidentTypeConfig[type];
        const active = activeFilters.includes(type);
        const locked = !isPremium && !(isLoggedIn ? LOGGED_IN_FILTERS : FREE_FILTERS).includes(type);
        const needsLogin = !isLoggedIn && LOGGED_IN_FILTERS.includes(type) && !FREE_FILTERS.includes(type);
        const needsPro = locked && !needsLogin;
        const color = TYPE_COLORS[type];

        return (
          <button
            key={type}
            onClick={() => {
              if (locked) {
                if (!isLoggedIn) navigate('/auth?mode=signup');
                return;
              }
              onToggleFilter(type);
            }}
            className={`
              relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium
              transition-all duration-200 whitespace-nowrap select-none
              ${locked
                ? 'bg-muted/30 text-muted-foreground/30 cursor-not-allowed'
                : active
                  ? 'bg-muted text-foreground shadow-sm'
                  : 'bg-transparent text-muted-foreground/60 hover:bg-muted/40 hover:text-muted-foreground'
              }
            `}
            title={
              needsLogin
                ? 'Skapa gratis konto för att använda detta filter'
                : needsPro
                  ? 'Uppgradera till Pro'
                  : config.label
            }
          >
            {/* Color dot indicator */}
            <span
              className={`w-2 h-2 rounded-full shrink-0 transition-opacity duration-200 ${
                locked ? 'opacity-20' : active ? 'opacity-100' : 'opacity-40'
              }`}
              style={{ backgroundColor: locked ? undefined : color }}
            />
            
            <span className="leading-none">{config.label}</span>

            {needsLogin && (
              <span className="flex items-center gap-0.5 ml-0.5 text-[8px] font-bold text-primary/70 uppercase tracking-wider">
                <User className="w-2.5 h-2.5" />
              </span>
            )}
            {needsPro && (
              <Lock className="w-2.5 h-2.5 ml-0.5 opacity-40" />
            )}
          </button>
        );
      })}
    </div>
  );
};

export default FilterBar;
