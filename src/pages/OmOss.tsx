import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useSEO } from '@/hooks/useSEO';
import { Shield, MapPin, Bell, Users } from 'lucide-react';

const OmOss = () => {
  useSEO({
    title: 'Om oss — CrimeAlert | Säkerhetskarta för Sverige',
    description: 'Lär dig mer om CrimeAlert, Sveriges trygghetskarta med realtidsuppdateringar av polishändelser, bränder och trafikolyckor.',
    canonical: 'https://crimealert.se/om-oss',
  });

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <Header />
      <main className="flex-1 max-w-3xl mx-auto px-4 py-10 space-y-8">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Om CrimeAlert</h1>

        <p className="text-muted-foreground leading-relaxed">
          CrimeAlert är Sveriges trygghetskarta — en tjänst som samlar polishändelser, bränder, trafikolyckor och andra
          säkerhetsrelaterade händelser i realtid. Vårt mål är att göra samhällsinformation tillgänglig och lättförståelig
          för alla medborgare. All vår data är tagen ifrån polisen.se händelser.
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { icon: MapPin, title: 'Realtidskarta', desc: 'Se händelser nära dig direkt på kartan med live-uppdateringar från Polisen.se.' },
            { icon: Shield, title: 'Trygghet först', desc: 'Vi vill hjälpa dig att hålla dig informerad om vad som händer i ditt närområde.' },
            { icon: Bell, title: 'Push-notiser', desc: 'Få notiser om allvarliga händelser i din kommun — direkt till din enhet.' },
            { icon: Users, title: 'Medborgarrapporter', desc: 'Pro-medlemmar kan ta del av rapporter från andra medborgare i realtid.' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="border border-border rounded-lg p-4 bg-card space-y-2">
              <div className="flex items-center gap-2 text-primary">
                <Icon className="w-4 h-4" />
                <span className="font-semibold text-sm text-foreground">{title}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Kontakt</h2>
          <p className="text-sm text-muted-foreground">
            Har du frågor, feedback eller vill samarbeta? Kontakta oss på{' '}
            <a href="mailto:alvejon.staff@gmail.com" className="text-primary hover:underline">
              alvejon.staff@gmail.com
            </a>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default OmOss;
