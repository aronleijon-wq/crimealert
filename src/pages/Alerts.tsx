import Header from '@/components/Header';
import { Bell, MapPin, Clock, Lock } from 'lucide-react';
import { usePoliceEvents } from '@/hooks/usePoliceEvents';
import { incidentTypeConfig, riskConfig } from '@/data/mockIncidents';

const getTimeAgo = (time: string): string => {
  try {
    const diff = Date.now() - new Date(time).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins} min sedan`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h sedan`;
    return `${Math.floor(hours / 24)}d sedan`;
  } catch { return ''; }
};

const Alerts = () => {
  const { incidents } = usePoliceEvents();
  const latest = incidents.slice(0, 8);

  return (
    <div className="h-screen flex flex-col bg-background">
      <Header />
      <div className="flex-1 overflow-y-auto p-6 grid-overlay">
        <div className="max-w-2xl mx-auto space-y-6">
          <div>
            <h1 className="text-xl font-bold text-foreground">Notiser</h1>
            <p className="text-xs text-muted-foreground">Hantera dina bevakningsområden och notifikationer</p>
          </div>

          {/* Free user CTA */}
          <div className="bg-card border border-primary/20 rounded-lg p-5 text-center">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <Bell className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-sm font-bold text-foreground mb-1">Bevaka ditt område</h2>
            <p className="text-xs text-muted-foreground mb-4 max-w-sm mx-auto">
              Sätt en radie runt ditt hem eller arbetsplats och få pushnotiser vid incidenter i närheten.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div className="bg-muted/50 rounded-lg p-3 text-left">
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Gratis</span>
                <ul className="text-xs text-foreground mt-2 space-y-1">
                  <li className="flex items-center gap-1.5"><MapPin className="w-3 h-3 text-cr-blue" /> 1 område</li>
                  <li className="flex items-center gap-1.5"><Clock className="w-3 h-3 text-cr-blue" /> Senaste 24h</li>
                </ul>
              </div>
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-left">
                <span className="text-[10px] font-mono text-primary uppercase tracking-wider">Premium</span>
                <ul className="text-xs text-foreground mt-2 space-y-1">
                  <li className="flex items-center gap-1.5"><MapPin className="w-3 h-3 text-primary" /> 10 områden</li>
                  <li className="flex items-center gap-1.5"><Bell className="w-3 h-3 text-primary" /> Push + veckorapport</li>
                  <li className="flex items-center gap-1.5"><Lock className="w-3 h-3 text-primary" /> Historik & export</li>
                </ul>
              </div>
            </div>

            <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-xs font-semibold hover:bg-primary/90 transition glow-red">
              Uppgradera till Premium — 19 kr/mån
            </button>
          </div>

          {/* Real notifications from police API */}
          <div className="space-y-2">
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Senaste händelser</span>
            {latest.map((inc) => {
              const typeConf = incidentTypeConfig[inc.type];
              return (
                <div key={inc.id} className="flex items-center gap-3 bg-card border border-border rounded-lg p-3">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${inc.risk === 'high' ? 'bg-cr-red' : inc.risk === 'medium' ? 'bg-cr-orange' : 'bg-cr-green'}`} />
                  <span className="text-sm">{typeConf.icon}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-foreground block truncate">{inc.title.replace(/^\d+\s\w+\s[\d.]+,\s*/, '')}</span>
                    <span className="text-[10px] text-muted-foreground">{inc.area}</span>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">{getTimeAgo(inc.time)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Alerts;