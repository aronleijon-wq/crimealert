import Header from '@/components/Header';
import { Bell, MapPin, Clock, Lock } from 'lucide-react';

const Alerts = () => (
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
            Uppgradera till Premium — 79 kr/mån
          </button>
        </div>

        {/* Mock notifications */}
        <div className="space-y-2">
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Senaste notiser (demo)</span>
          {[
            { text: 'Brandlarm i Norrmalm', time: '12 min sedan', type: 'high' },
            { text: 'Trafikolycka vid E4, Solna', time: '2h sedan', type: 'medium' },
            { text: 'Ordningsstörning Gamla Stan', time: '3h sedan', type: 'medium' },
          ].map((n, i) => (
            <div key={i} className="flex items-center gap-3 bg-card border border-border rounded-lg p-3">
              <div className={`w-2 h-2 rounded-full ${n.type === 'high' ? 'bg-cr-red' : 'bg-cr-orange'}`} />
              <div className="flex-1">
                <span className="text-xs text-foreground">{n.text}</span>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground">{n.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

export default Alerts;
