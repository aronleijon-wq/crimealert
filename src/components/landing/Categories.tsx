import { Shield, Flame, Ambulance, Car, CircleDot, Users, BarChart3, Bell } from 'lucide-react';
import Reveal from './Reveal';

const items = [
  { icon: Shield, title: 'Polisinsats', text: 'Pågående och avslutade polisärenden.' },
  { icon: Flame, title: 'Brand', text: 'Bränder, rökutveckling och räddningsinsatser.' },
  { icon: Ambulance, title: 'Ambulans', text: 'Akuta larm där ambulans är på plats.' },
  { icon: Car, title: 'Trafikolycka', text: 'Olyckor, avstängningar och störningar i trafiken.' },
  { icon: CircleDot, title: 'Övrigt', text: 'Allt annat polisen rapporterar in.' },
  { icon: Users, title: 'Medborgarrapporter', text: 'Observationer inskickade av användare i närheten.', pro: true },
  { icon: BarChart3, title: 'Analys', text: 'Statistik per kommun, kategori och tidsperiod.', pro: true },
  { icon: Bell, title: 'Notiser', text: 'Push till mobilen när något nytt inträffar.' },
];

const Categories = () => (
  <section className="relative py-24 md:py-32 px-5 md:px-10 border-t border-[hsl(var(--ca-line))]">
    <div className="max-w-[1400px] mx-auto">
      <Reveal>
        <div className="ca-mono text-[10px] tracking-[0.24em] text-[hsl(var(--ca-text-3))] mb-4">
          KATEGORIER
        </div>
        <h2 className="ca-display text-[clamp(2rem,5vw,3.6rem)] uppercase max-w-[620px] mb-14">
          Vad du kan följa
        </h2>
      </Reveal>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-[hsl(var(--ca-line))] border border-[hsl(var(--ca-line))] rounded-xl overflow-hidden">
        {items.map(({ icon: Icon, title, text, pro }, i) => (
          <Reveal key={title} delay={(i % 4) * 0.07} className="flex">
            <div className="group flex min-h-[190px] flex-1 flex-col bg-[hsl(var(--ca-panel))] p-6 backdrop-blur-md transition-colors duration-500 hover:bg-[hsl(var(--ca-panel-3))] md:p-7">
              <div className="flex items-start justify-between">
                <Icon className="w-5 h-5 text-[hsl(var(--ca-text-3))] transition-all duration-500 group-hover:text-[hsl(var(--ca-red))] group-hover:-translate-y-0.5" />
                {pro && <span className="rounded border border-[hsl(var(--ca-red)/0.4)] px-1.5 py-0.5 ca-mono text-[9px] tracking-[0.18em] text-[hsl(var(--ca-red))]">PRO</span>}
              </div>
              <h3 className="mt-6 text-[15px] font-semibold text-[hsl(var(--ca-text))]">{title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-[hsl(var(--ca-text-3))]">{text}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  </section>
);

export default Categories;
