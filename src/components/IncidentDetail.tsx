import { Incident, incidentTypeConfig, riskConfig } from '@/data/mockIncidents';
import { X, MapPin, Clock, Shield, Radio, ExternalLink, Lock, Zap, Tag, Crosshair, Calendar } from 'lucide-react';
import { useIsPremium } from '@/hooks/useIsPremium';
import { useNavigate } from 'react-router-dom';

interface IncidentDetailProps {
  incident: Incident;
  onClose: () => void;
}

const timeAgo = (dateStr: string): string => {
  try {
    const parts = dateStr.trim().split(/\s+/);
    const date = parts.length >= 3
      ? new Date(`${parts[0]}T${parts[1]}${parts[2]}`)
      : new Date(dateStr);
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60) return 'Just nu';
    if (diff < 3600) return `${Math.floor(diff / 60)} min sedan`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} tim sedan`;
    return `${Math.floor(diff / 86400)} dagar sedan`;
  } catch {
    return '';
  }
};

const formatFullDate = (dateStr: string): string => {
  try {
    const parts = dateStr.trim().split(/\s+/);
    const date = parts.length >= 3
      ? new Date(`${parts[0]}T${parts[1]}${parts[2]}`)
      : new Date(dateStr);
    return date.toLocaleDateString('sv-SE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return '';
  }
};

const IncidentDetail = ({ incident, onClose }: IncidentDetailProps) => {
  const typeConf = incidentTypeConfig[incident.type];
  const riskConf = riskConfig[incident.risk];
  const { isPremium } = useIsPremium();
  const navigate = useNavigate();

  const ago = timeAgo(incident.time);
  const fullDate = formatFullDate(incident.time);

  // Parse time for display
  let timeDisplay = '';
  try {
    const parts = incident.time.trim().split(/\s+/);
    const date = parts.length >= 3
      ? new Date(`${parts[0]}T${parts[1]}${parts[2]}`)
      : new Date(incident.time);
    timeDisplay = date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
  } catch {
    timeDisplay = '–';
  }

  return (
    <div className="bg-card border border-border rounded-lg p-4 shadow-xl max-w-sm">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{typeConf.icon}</span>
          <div>
            <h3 className="text-sm font-bold text-foreground">{incident.title}</h3>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{typeConf.label}</span>
              {ago && (
                <span className="text-[10px] text-muted-foreground">· {ago}</span>
              )}
            </div>
          </div>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-muted text-muted-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Description */}
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
              <Lock className="w-3 h-3 drop-shadow-[0_0_4px_hsl(var(--destructive)/0.5)]" /> Uppgradera för detaljer
            </button>
          </div>
        </div>
      )}

      {/* Info rows */}
      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between py-1.5 border-t border-border">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="w-3 h-3" /> Tidpunkt
          </span>
          <div className="text-right">
            <span className="font-mono text-foreground">{timeDisplay}</span>
            {isPremium && fullDate && (
              <p className="text-[10px] text-muted-foreground">{fullDate}</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between py-1.5 border-t border-border">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <MapPin className="w-3 h-3" /> Område
          </span>
          <span className="text-foreground text-right max-w-[180px] truncate">{incident.area}</span>
        </div>

        {/* Pro: Original police type */}
        {isPremium && incident.originalType && (
          <div className="flex items-center justify-between py-1.5 border-t border-border">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Tag className="w-3 h-3" /> Poliskategori
            </span>
            <span className="text-foreground text-right max-w-[180px] truncate">{incident.originalType}</span>
          </div>
        )}

        {/* Pro: Location precision */}
        {isPremium && incident.locationPrecision && (
          <div className="flex items-center justify-between py-1.5 border-t border-border">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Crosshair className="w-3 h-3" /> Precision
            </span>
            <span className="text-foreground capitalize">
              {incident.locationPrecision === 'street' ? 'Gatunivå' :
               incident.locationPrecision === 'exact' ? 'Exakt' :
               incident.locationPrecision === 'district' ? 'Stadsdel' : 'Ungefärligt'}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between py-1.5 border-t border-border">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Radio className="w-3 h-3" /> Status
          </span>
          {isPremium ? (
            <span className={incident.status === 'active' ? 'text-cr-red font-semibold' : 'text-cr-green'}>
              {incident.status === 'active' ? 'Pågående' : 'Avslutad'}
            </span>
          ) : (
            <span className="text-muted-foreground/40 flex items-center gap-1 text-[10px]">
              <Lock className="w-3 h-3" /> Pro
            </span>
          )}
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
          {isPremium && incident.url ? (
            <a
              href={incident.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cr-blue hover:underline flex items-center gap-1"
            >
              {incident.source} <ExternalLink className="w-2.5 h-2.5" />
            </a>
          ) : (
            <span className="text-cr-blue">{incident.source}</span>
          )}
        </div>
      </div>

      <p className="text-[9px] text-muted-foreground/60 mt-3 font-mono">
        {isPremium ? 'Realtidsdata.' : 'Data med 15 min fördröjning.'} Sammanställd från öppna källor.
      </p>
    </div>
  );
};

export default IncidentDetail;
