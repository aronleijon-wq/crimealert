import { useMemo } from 'react';
import { Incident } from '@/data/mockIncidents';

interface RiskMeterProps {
  incidents: Incident[];
}

const parseTime = (s: string) =>
  new Date(s.replace(/\s(?=\+|-)/, 'T').replace(' ', 'T')).getTime();

const SEVERE = /mord|dråp|skott|skjut|rån|våldtäkt|knivdåd|grov misshandel|spräng|explosion/i;

const LEVELS = [
  { key: 'low', label: 'Lugnt läge', desc: 'Få händelser senaste dygnet', color: 'var(--ca-green, 145 70% 45%)' },
  { key: 'medium', label: 'Normal aktivitet', desc: 'Ungefär vanlig händelsenivå', color: '38 92% 55%' },
  { key: 'elevated', label: 'Förhöjd aktivitet', desc: 'Fler händelser än vanligt senaste dygnet', color: '0 85% 55%' },
] as const;

const RiskMeter = ({ incidents }: RiskMeterProps) => {
  const { score, level, count24h, severe } = useMemo(() => {
    const now = Date.now();
    const cutoff = now - 24 * 3600 * 1000;
    const recent = incidents.filter((i) => {
      const t = parseTime(i.time);
      return !isNaN(t) && t >= cutoff;
    });
    let s = 0;
    let sev = 0;
    recent.forEach((i) => {
      const isSevere = SEVERE.test(`${i.title} ${i.originalType || ''}`);
      if (isSevere) sev++;
      s += isSevere ? 4 : i.risk === 'high' ? 2.5 : i.risk === 'medium' ? 1.2 : 0.6;
    });
    const normalized = Math.min(100, Math.round((s / 60) * 100));
    const lvl = normalized < 33 ? 0 : normalized < 66 ? 1 : 2;
    return { score: normalized, level: lvl, count24h: recent.length, severe: sev };
  }, [incidents]);

  const current = LEVELS[level];

  return (
    <div className="border-b border-[hsl(var(--ca-line))] bg-[hsl(var(--ca-base-2))] px-3 py-2">
      <div className="flex items-center gap-3">
        <div className="flex flex-col leading-none shrink-0">
          <span className="ca-mono text-[8.5px] uppercase tracking-[0.22em] text-[hsl(var(--ca-text-3))]">
            Lägesbild · 24h
          </span>
          <span
            className="text-[12px] md:text-[13px] font-semibold mt-1"
            style={{ color: `hsl(${current.color})` }}
          >
            {current.label}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex gap-1" role="img" aria-label={`Risknivå: ${current.label}`}>
            {LEVELS.map((l, idx) => (
              <div
                key={l.key}
                className="h-1.5 flex-1 rounded-full transition-all duration-700"
                style={{
                  background:
                    idx <= level ? `hsl(${current.color})` : 'hsl(var(--ca-line))',
                  opacity: idx <= level ? 0.85 - (level - idx) * 0.25 : 1,
                }}
              />
            ))}
          </div>
          <p className="ca-mono text-[9px] tracking-[0.1em] text-[hsl(var(--ca-text-3))] mt-1.5 truncate">
            {count24h} händelser
            {severe > 0 ? ` · ${severe} allvarliga` : ''} · {current.desc}
          </p>
        </div>

        <span className="ca-mono text-[15px] font-bold tabular-nums shrink-0" style={{ color: `hsl(${current.color})` }}>
          {score}
          <span className="text-[9px] text-[hsl(var(--ca-text-3))] font-normal">/100</span>
        </span>
      </div>
    </div>
  );
};

export default RiskMeter;
