import Header from '@/components/Header';
import { User, Zap, Building2, Check, X, Sun, Moon } from 'lucide-react';
import { useState } from 'react';
import { useTheme } from '@/hooks/useTheme';

const Account = () => {
  const { theme, setTheme } = useTheme();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  const tiers = [
    {
      name: 'Gratis',
      icon: User,
      iconColor: 'text-muted-foreground',
      price: '0 kr',
      period: '',
      border: 'border-border',
      badge: null,
      features: [
        { text: 'Karta med 15 min fördröjning', included: true },
        { text: 'Begränsade filter', included: true },
        { text: 'Pushnotiser (15 min delay)', included: true },
        { text: 'Senaste 24h historik', included: true },
        { text: 'Grundläggande heatmaps', included: true },
        { text: 'Reklam i app/webb', included: true },
        { text: 'Realtidsdata', included: false },
        { text: 'Riskanalys', included: false },
        { text: 'Full historik', included: false },
      ],
      cta: 'Nuvarande plan',
      ctaStyle: 'bg-muted text-muted-foreground cursor-default',
    },
    {
      name: 'Pro',
      icon: Zap,
      iconColor: 'text-primary',
      price: billingCycle === 'monthly' ? '19 kr' : '119 kr',
      period: billingCycle === 'monthly' ? '/mån' : '/år',
      savings: billingCycle === 'yearly' ? 'Spara 109 kr' : null,
      border: 'border-primary/30',
      badge: 'POPULÄR',
      features: [
        { text: 'Realtidsdata – direkt', included: true },
        { text: 'Alla filter & risknivåer', included: true },
        { text: 'Pushnotiser i realtid', included: true },
        { text: 'Full historik (30+ dagar)', included: true },
        { text: 'Heatmaps & riskanalys', included: true },
        { text: 'Ingen reklam', included: true },
        { text: 'Detaljerade brottsbeskrivningar', included: true },
        { text: 'Export PDF/CSV', included: true },
        { text: 'API-access', included: false },
        { text: 'White-label', included: false },
      ],
      cta: 'Uppgradera till Pro',
      ctaStyle: 'bg-primary text-primary-foreground hover:bg-primary/90',
    },
    {
      name: 'Företag',
      icon: Building2,
      iconColor: 'text-cr-blue',
      price: 'Offert',
      period: '',
      border: 'border-border',
      badge: 'B2B',
      features: [
        { text: 'Allt i Pro', included: true },
        { text: 'API-access', included: true },
        { text: 'Riskrapporter & statistik', included: true },
        { text: 'Flera områden/städer', included: true },
        { text: 'White-label vid behov', included: true },
        { text: 'Dedikerad support', included: true },
        { text: 'Avancerade notiser', included: true },
      ],
      cta: 'Kontakta oss',
      ctaStyle: 'bg-muted text-foreground hover:bg-muted/80',
    },
  ];

  return (
    <div className="h-screen flex flex-col bg-background">
      <Header />
      <div className="flex-1 overflow-y-auto p-6 grid-overlay">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Theme toggle */}
          <div className="bg-card border border-border rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {theme === 'dark' ? <Moon className="w-4 h-4 text-muted-foreground" /> : <Sun className="w-4 h-4 text-cr-orange" />}
              <div>
                <span className="text-xs font-bold text-foreground">Utseende</span>
                <p className="text-[10px] text-muted-foreground">{theme === 'dark' ? 'Mörkt läge' : 'Ljust läge'}</p>
              </div>
            </div>
            <div className="flex gap-1 bg-muted rounded-md p-0.5">
              <button
                onClick={() => setTheme('light')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-[11px] font-medium transition ${
                  theme === 'light' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Sun className="w-3 h-3" /> Ljust
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-[11px] font-medium transition ${
                  theme === 'dark' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Moon className="w-3 h-3" /> Mörkt
              </button>
            </div>
          </div>

          <div>
            <h1 className="text-xl font-bold text-foreground">Medlemskap</h1>
            <p className="text-xs text-muted-foreground">Välj den plan som passar dig</p>
          </div>

          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                billingCycle === 'monthly'
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Månad
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                billingCycle === 'yearly'
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              År
              <span className="ml-1.5 text-[9px] bg-cr-green/20 text-cr-green px-1.5 py-0.5 rounded-full font-bold">
                -48%
              </span>
            </button>
          </div>

          {/* Pricing tiers */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {tiers.map((tier) => {
              const Icon = tier.icon;
              return (
                <div
                  key={tier.name}
                  className={`bg-card border ${tier.border} rounded-lg p-4 relative flex flex-col ${
                    tier.badge === 'POPULÄR' ? 'glow-red' : ''
                  }`}
                >
                  {tier.badge && (
                    <div className={`absolute -top-2 right-3 text-[9px] font-bold px-2 py-0.5 rounded-full ${
                      tier.badge === 'POPULÄR'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-cr-blue/20 text-cr-blue'
                    }`}>
                      {tier.badge}
                    </div>
                  )}

                  <div className="flex items-center gap-2 mb-3">
                    <Icon className={`w-4 h-4 ${tier.iconColor}`} />
                    <span className={`text-xs font-bold ${tier.badge === 'POPULÄR' ? 'text-primary' : 'text-foreground'}`}>
                      {tier.name}
                    </span>
                  </div>

                  <div className="mb-3">
                    <span className="text-lg font-bold font-mono text-foreground">{tier.price}</span>
                    {tier.period && <span className="text-xs text-muted-foreground">{tier.period}</span>}
                    {tier.savings && (
                      <div className="text-[10px] text-cr-green font-medium mt-0.5">{tier.savings}</div>
                    )}
                  </div>

                  <ul className="text-[11px] text-muted-foreground space-y-1.5 flex-1 mb-4">
                    {tier.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        {f.included ? (
                          <Check className="w-3 h-3 text-cr-green shrink-0 mt-0.5" />
                        ) : (
                          <X className="w-3 h-3 text-muted-foreground/30 shrink-0 mt-0.5" />
                        )}
                        <span className={f.included ? '' : 'text-muted-foreground/30'}>{f.text}</span>
                      </li>
                    ))}
                  </ul>

                  <button className={`w-full px-4 py-2 rounded-md text-xs font-semibold transition ${tier.ctaStyle}`}>
                    {tier.cta}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Login CTA */}
          <div className="bg-card border border-border rounded-lg p-4 text-center">
            <p className="text-xs text-muted-foreground mb-3">Logga in eller skapa konto för att komma igång</p>
            <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-xs font-semibold hover:bg-primary/90 transition mr-2">
              Logga in
            </button>
            <button className="px-4 py-2 bg-muted text-foreground rounded-md text-xs font-semibold hover:bg-muted/80 transition">
              Skapa konto
            </button>
          </div>

          {/* Comparison table */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <span className="text-xs font-bold text-foreground">Notiser & Fördröjning</span>
            </div>
            <div className="divide-y divide-border text-[11px]">
              {[
                ['Gratis', '15 min delay på händelser & push'],
                ['Pro', 'Realtid – direkt utan fördröjning'],
                ['Företag', 'Realtid + avancerade notiser & API'],
              ].map(([plan, desc]) => (
                <div key={plan} className="flex items-center px-4 py-2.5">
                  <span className="font-medium text-foreground w-20">{plan}</span>
                  <span className="text-muted-foreground">{desc}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground/50 font-mono text-center">
            CrimeRadar följer GDPR. Inga personuppgifter visas. Data från öppna källor.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Account;
