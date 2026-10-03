import { stages } from './storyStages';

/** The "Hur det fungerar" steps as a plain list: for phones and for reduced motion. */
const StoryStatic = () => (
  <section id="hur-det-fungerar" className="relative border-t border-[hsl(var(--ca-line))] px-5 py-24 md:px-10">
    <div className="mx-auto grid max-w-[1400px] gap-12 md:grid-cols-2">
      {stages.map((s, i) => (
        <div key={s.heading}>
          <div className="mb-3 ca-mono text-[10px] tracking-[0.24em] text-[hsl(var(--ca-red))]">
            0{i + 1} — {s.tag}
          </div>
          <h3 className="ca-display text-2xl uppercase">{s.heading}</h3>
          <p className="mt-4 text-[15px] text-[hsl(var(--ca-text-2))]">{s.text}</p>
        </div>
      ))}
    </div>
  </section>
);

export default StoryStatic;
