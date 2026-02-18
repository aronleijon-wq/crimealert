import { Incident } from '@/data/mockIncidents';
import { AlertTriangle, Activity, TrendingUp, Shield } from 'lucide-react';

interface StatsBarProps {
  incidents: Incident[];
}

const StatsBar = ({ incidents }: StatsBarProps) => {
  const active = incidents.filter((i) => i.status === 'active').length;
  const highRisk = incidents.filter((i) => i.risk === 'high').length;
  const resolved = incidents.filter((i) => i.status === 'resolved').length;

  const stats = [
    { label: 'Aktiva', value: active, icon: Activity, colorClass: 'text-cr-red' },
    { label: 'Hög risk', value: highRisk, icon: AlertTriangle, colorClass: 'text-cr-orange' },
    { label: 'Avslutade', value: resolved, icon: Shield, colorClass: 'text-cr-green' },
    { label: 'Riskindex', value: '62', icon: TrendingUp, colorClass: 'text-cr-blue' },
  ];

  return (
    <div className="grid grid-cols-4 gap-px bg-border border-b border-border">
      {stats.map((s) => (
        <div key={s.label} className="bg-card px-3 py-2 flex items-center gap-2">
          <s.icon className={`w-3.5 h-3.5 ${s.colorClass}`} />
          <div>
            <span className={`text-base font-bold font-mono ${s.colorClass}`}>{s.value}</span>
            <span className="text-[9px] text-muted-foreground ml-1.5 uppercase tracking-wider">{s.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default StatsBar;
