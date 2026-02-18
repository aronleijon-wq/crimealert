import Header from '@/components/Header';
import { User, Crown, Shield, FileText, Key, Building2 } from 'lucide-react';

const Account = () => (
  <div className="h-screen flex flex-col bg-background">
    <Header />
    <div className="flex-1 overflow-y-auto p-6 grid-overlay">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Konto</h1>
          <p className="text-xs text-muted-foreground">Hantera din profil och prenumeration</p>
        </div>

        {/* Pricing tiers */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-bold text-foreground">Gratis</span>
            </div>
            <div className="text-lg font-bold font-mono text-foreground mb-2">0 kr<span className="text-xs text-muted-foreground font-normal">/mån</span></div>
            <ul className="text-[11px] text-muted-foreground space-y-1.5">
              <li>✓ Livekarta</li>
              <li>✓ Senaste 24h</li>
              <li>✓ Begränsade filter</li>
            </ul>
          </div>

          <div className="bg-card border border-primary/30 rounded-lg p-4 relative glow-red">
            <div className="absolute -top-2 right-3 bg-primary text-primary-foreground text-[9px] font-bold px-2 py-0.5 rounded-full">POPULÄR</div>
            <div className="flex items-center gap-2 mb-3">
              <Crown className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold text-primary">Premium</span>
            </div>
            <div className="text-lg font-bold font-mono text-foreground mb-2">79 kr<span className="text-xs text-muted-foreground font-normal">/mån</span></div>
            <ul className="text-[11px] text-muted-foreground space-y-1.5">
              <li>✓ Full historik</li>
              <li>✓ Pushnotiser</li>
              <li>✓ Riskanalys</li>
              <li>✓ Export PDF/CSV</li>
            </ul>
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="w-4 h-4 text-cr-blue" />
              <span className="text-xs font-bold text-foreground">Företag</span>
            </div>
            <div className="text-lg font-bold font-mono text-foreground mb-2">999 kr<span className="text-xs text-muted-foreground font-normal">/mån</span></div>
            <ul className="text-[11px] text-muted-foreground space-y-1.5">
              <li>✓ Dashboard</li>
              <li>✓ Riskrapporter</li>
              <li>✓ API-nyckel</li>
              <li>✓ Dataexport</li>
            </ul>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <p className="text-xs text-muted-foreground mb-3">Logga in eller skapa konto för att komma igång</p>
          <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-xs font-semibold hover:bg-primary/90 transition mr-2">
            Logga in
          </button>
          <button className="px-4 py-2 bg-muted text-foreground rounded-md text-xs font-semibold hover:bg-muted/80 transition">
            Skapa konto
          </button>
        </div>

        <p className="text-[10px] text-muted-foreground/50 font-mono text-center">
          CrimeRadar följer GDPR. Inga personuppgifter visas. Data från öppna källor.
        </p>
      </div>
    </div>
  </div>
);

export default Account;
