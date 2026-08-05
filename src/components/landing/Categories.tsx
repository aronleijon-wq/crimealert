import { Shield, Flame, Ambulance, Car, CircleDot, Users, BarChart3, Bell } from 'lucide-react';

const items = [
  { icon: Shield, title: 'Polisinsats', text: 'Aktuella polisärenden och operativa händelser.' },
  { icon: Flame, title: 'Brand', text: 'Händelser relaterade till brand, rökutveckling och räddningsinsatser.' },
  { icon: Ambulance, title: 'Ambulans', text: 'Vårdnära eller akuta insatser där ambulans larmats.' },
  { icon: Car, title: 'Trafikolycka', text: 'Trafikrelaterade incidenter och vägrelaterade störningar.' },
  { icon: CircleDot, title: 'Övrigt', text: 'Andra händelser som påverkar den lokala lägesbilden.' },
  { icon: Users, title: 'Medborgarrapporter', text: 'Observationer rapporterade av användare i närområdet.' },
  { icon: BarChart3, title: 'Analys', text: 'Sammanställd statistik per kommun och kategori.' },
  { icon: Bell, title: 'Notiser', text: 'Uppdateringar för valda områden och kategorier.' },
];

const Categories = () => (
  <section className="relative py-24 md:py-32 px-5 md:px-10 border-t border-[hsla(0,0%,100%,0.08)]">
    <div className="max-w-[1400px] mx-auto">
      <div className="ca-mono text-[10px] tracking-[0.24em] text-[hsl(var(--ca-text-3))] mb-4">
        KATEGORIER
      </div>
      <h2 className="ca-display text-[clamp(2rem,5vw,3.6rem)] uppercase max-w-[620px] mb-14">
        Det här kan du följa
      </h2>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-[hsla(0,0%,100%,0.08)] border border-[hsla(0,0%,100%,0.08)] rounded-xl overflow-hidden">
        {items.map(({ icon: Icon, title, text }) => (
          <div
            key={title}
            className="group bg-[hsl(var(--ca-panel))] p-6 md:p-7 min-h-[190px] flex flex-col transition-colors duration-500 hover:bg-[hsl(var(--ca-panel-3))]"
          >
            <Icon className="w-5 h-5 text-[hsl(var(--ca-text-3))] transition-all duration-500 group-hover:text-[hsl(var(--ca-red))] group-hover:-translate-y-0.5" />
            <h3 className="mt-6 text-[15px] font-semibold text-[hsl(var(--ca-text))]">{title}</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-[hsl(var(--ca-text-3))]">{text}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default Categories;
