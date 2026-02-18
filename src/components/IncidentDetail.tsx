import { Incident, incidentTypeConfig, riskConfig } from '@/data/mockIncidents';
import { X, MapPin, Clock, Shield, Radio, ExternalLink, Lock, Zap } from 'lucide-react';
import { useIsPremium } from '@/hooks/useIsPremium';
import { useNavigate } from 'react-router-dom';

interface IncidentDetailProps {
  incident: Incident;
  onClose: () => void;
}

const IncidentDetail = ({ incident, onClose }: IncidentDetailProps) => {
  const typeConf = incidentTypeConfig[incident.type];
  const riskConf = riskConfig[incident.risk];
  const time = new Date(incident.time);
  const { isPremium } = useIsPremium();
  const navigate = useNavigate();

  return (
    <div className="bg-card border border-border rounded-lg p-4 shadow-xl max-w-sm">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{typeConf.icon}</span>
          <div>
            <h3 className="text-sm font-bold text-foreground">{incident.title}</h3>
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{typeConf.label}</span>
          </div>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-muted text-muted-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      {isPremium ? (
        <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{incident.description}</p>
      ) : (
        <div className="relative mb-3">
          <p className="text-xs text-muted-foreground leading-relaxed blur-[6px] select-none" aria-hidden>
            {incident.description}
          </p>
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              onClick={() => navigate('/account')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-md text-[11px] font-semibold text-primary hover:bg-primary/20 transition"
            >
              <Lock className="w-3 h-3" /> Uppgradera för detaljer
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between py-1.5 border-t border-border">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="w-3 h-3" /> Tidpunkt
          </span>
          <span className="font-mono text-foreground">{time.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <div className="flex items-center justify-between py-1.5 border-t border-border">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <MapPin className="w-3 h-3" /> Område
          </span>
          <span className="text-foreground">{incident.area}</span>
        </div>
        <div className="flex items-center justify-between py-1.5 border-t border-border">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Radio className="w-3 h-3" /> Status
          </span>
          <span className={incident.status === 'active' ? 'text-cr-red font-semibold' : 'text-cr-green'}>
            {incident.status === 'active' ? 'Pågående' : 'Avslutad'}
          </span>
        </div>
        <div className="flex items-center justify-between py-1.5 border-t border-border">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Shield className="w-3 h-3" /> Risknivå
          </span>
          {isPremium ? (
            <span className={`font-semibold ${riskConf.colorClass}`}>{riskConf.label}</span>
          ) : (
            <span className="text-muted-foreground/40 flex items-center gap-1 text-[10px]">
              <Lock className="w-3 h-3" /> Pro
            </span>
          )}
        </div>
        <div className="flex items-center justify-between py-1.5 border-t border-border">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <ExternalLink className="w-3 h-3" /> Källa
          </span>
          <span className="text-cr-blue">{incident.source}</span>
        </div>
      </div>

      <p className="text-[9px] text-muted-foreground/60 mt-3 font-mono">
        {isPremium ? 'Realtidsdata.' : 'Data med 15 min fördröjning.'} Sammanställd från öppna källor.
      </p>
    </div>
  );
};

export default IncidentDetail;
