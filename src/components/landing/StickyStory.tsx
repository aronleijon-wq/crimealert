import { useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform, useReducedMotion, MotionValue } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import SwedenMap from './SwedenMap';

const stages = [
  {
    tag: 'ÖVERBLICK',
    heading: 'Allt som händer, på samma karta',
    text: 'Polisärenden, olyckor och räddningsinsatser hämtas löpande från Polisen.se och placeras där de inträffat.',
  },
  {
    tag: 'FILTER',
    heading: 'Visa bara det du bryr dig om',
    text: 'Slå av och på polisinsats, brand, ambulans eller trafikolycka. Kartan uppdateras direkt.',
  },
  {
    tag: 'LOKALT',
    heading: 'Zooma in på din kommun',
    text: 'Sök på kommun eller adress och se vad som hänt i närheten de senaste dygnen.',
  },
  {
    tag: 'UPPFÖLJNING',
    heading: 'Notiser när något händer',
    text: 'Spara en bevakning och få en notis direkt i mobilen när en ny händelse dyker upp i ditt område.',
  },
];

const StageText = ({
  progress,
  index,
  total,
  stage,
}: {
  progress: MotionValue<number>;
  index: number;
  total: number;
  stage: (typeof stages)[number];
}) => {
  const span = 1 / total;
  const start = index * span;
  const opacity = useTransform(
    progress,
    [start - span * 0.35, start + span * 0.18, start + span * 0.72, start + span * 1.15],
    [0, 1, 1, 0]
  );
  const y = useTransform(progress, [start - span * 0.4, start + span * 1.2], [56, -56]);

  return (
    <motion.div style={{ opacity, y }} className="absolute inset-x-0 top-0">
      <div className="ca-mono text-[10px] tracking-[0.24em] text-[hsl(var(--ca-red))] mb-4">
        0{index + 1} — {stage.tag}
      </div>
      <h3 className="ca-display text-[clamp(1.8rem,4vw,3.1rem)] uppercase max-w-[540px]">
        {stage.heading}
      </h3>
      <p className="mt-5 max-w-[460px] text-[15px] leading-relaxed text-[hsl(var(--ca-text-2))]">
        {stage.text}
      </p>
    </motion.div>
  );
};

const StickyStory = () => {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });

  const mapScale = useTransform(scrollYProgress, [0, 0.55, 1], [1, 1.28, 1.55]);
  const mapX = useTransform(scrollYProgress, [0, 1], ['0%', '-8%']);
  const mapY = useTransform(scrollYProgress, [0, 1], ['0%', '-14%']);
  const reveal = useTransform(scrollYProgress, [0.05, 0.6], [0.25, 1]);
  const overlay = useTransform(scrollYProgress, [0.55, 0.95], [0, 1]);
  const ctaOpacity = useTransform(scrollYProgress, [0.86, 0.97], [0, 1]);
  const barWidth = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);

  if (reduced) {
    return (
      <section id="hur-det-fungerar" className="relative py-24 px-5 md:px-10 border-t border-[hsla(0,0%,100%,0.08)]">
        <div className="max-w-[1400px] mx-auto grid gap-12 md:grid-cols-2">
          {stages.map((s, i) => (
            <div key={s.heading}>
              <div className="ca-mono text-[10px] tracking-[0.24em] text-[hsl(var(--ca-red))] mb-3">
                0{i + 1} — {s.tag}
              </div>
              <h3 className="ca-display text-2xl uppercase">{s.heading}</h3>
              <p className="mt-4 text-[15px] text-[hsl(var(--ca-text-2))]">{s.text}</p>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section
      id="hur-det-fungerar"
      ref={ref}
      className="relative border-t border-[hsla(0,0%,100%,0.08)]"
      style={{ height: `${stages.length * 100 + 60}vh` }}
    >
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        <div className="absolute inset-0 ca-gridlines opacity-40" />
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(90% 70% at 70% 40%, hsla(200,38%,65%,0.07), transparent 70%)' }}
        />

        {/* Visuell scen */}
        <motion.div
          style={{ scale: mapScale, x: mapX, y: mapY }}
          className="absolute right-[-25%] md:right-[2%] top-1/2 -translate-y-1/2 h-[75%] md:h-[86%] opacity-40 md:opacity-90 will-change-transform"
        >
          <MapStage reveal={reveal} />
        </motion.div>

        {/* Analyslager som glider in mot slutet */}
        <motion.div
          style={{ opacity: overlay }}
          className="hidden md:block absolute right-[6%] bottom-[12%] w-[300px] ca-panel rounded-lg p-4"
        >
          <div className="ca-mono text-[9px] tracking-[0.2em] text-[hsl(var(--ca-text-3))] mb-3">
            ANALYS • SENASTE 7 DYGNEN
          </div>
          {[
            ['Polisinsats', 62],
            ['Trafikolycka', 41],
            ['Brand', 28],
            ['Ambulans', 17],
          ].map(([label, v]) => (
            <div key={label as string} className="mb-2.5">
              <div className="flex justify-between text-[11px] text-[hsl(var(--ca-text-2))] mb-1">
                <span>{label}</span>
                <span className="ca-mono">{v}</span>
              </div>
              <div className="h-1 rounded-full bg-[hsla(0,0%,100%,0.08)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[hsl(var(--ca-red))]"
                  style={{ width: `${(v as number) / 0.7}%`, opacity: 0.8 }}
                />
              </div>
            </div>
          ))}
        </motion.div>

        {/* Text som följer scrollen */}
        <div className="relative h-full max-w-[1400px] mx-auto px-5 md:px-10 flex items-center">
          <div className="relative w-full md:w-1/2 h-[320px]">
            {stages.map((s, i) => (
              <StageText key={s.heading} progress={scrollYProgress} index={i} total={stages.length} stage={s} />
            ))}
            <motion.div style={{ opacity: ctaOpacity }} className="absolute inset-x-0 bottom-0">
              <Link
                to="/karta"
                className="group inline-flex items-center gap-2 px-6 py-3.5 rounded-md bg-[hsl(var(--ca-red))] text-white text-sm font-medium hover:brightness-110 transition"
              >
                Öppna livekartan
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </motion.div>
          </div>
        </div>

        {/* Förloppsindikator */}
        <div className="absolute bottom-0 inset-x-0 h-px bg-[hsla(0,0%,100%,0.08)]">
          <motion.div style={{ width: barWidth }} className="h-px bg-[hsl(var(--ca-red))]" />
        </div>
      </div>
    </section>
  );
};

function useMotionSnapshot(mv: MotionValue<number>) {
  const [v, setV] = useState(mv.get());
  useEffect(() => mv.on('change', (latest) => setV(Math.round(latest * 10) / 10)), [mv]);
  return v;
}

const MapStage = ({ reveal }: { reveal: MotionValue<number> }) => {
  const value = useMotionSnapshot(reveal);
  return <SwedenMap className="h-full w-auto" reveal={value} />;
};


export default StickyStory;
