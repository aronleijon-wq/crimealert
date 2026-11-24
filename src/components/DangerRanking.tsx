import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Card, MUTED } from '@/native/StatCard';
import { Incident } from '@/data/mockIncidents';

interface DangerRankingProps {
  incidents: Incident[];
  periodLabel: string;
}

// Crime severity categories with weights and colors
const SEVERITY_CATEGORIES = [
  { key: 'shooting', label: 'Skjutning eller mord', weight: 5, color: 'hsl(0, 100%, 50%)', bgClass: 'bg-cr-red/15 text-cr-red' },
  { key: 'robbery', label: 'Rån', weight: 4, color: 'hsl(0, 80%, 55%)', bgClass: 'bg-cr-red/10 text-cr-red' },
  { key: 'assault_serious', label: 'Grov misshandel', weight: 3, color: 'hsl(25, 100%, 50%)', bgClass: 'bg-cr-orange/15 text-cr-orange' },
  { key: 'assault', label: 'Misshandel', weight: 2, color: 'hsl(25, 80%, 55%)', bgClass: 'bg-cr-orange/10 text-cr-orange' },
  { key: 'high_other', label: 'Annat allvarligt', weight: 1.5, color: 'hsl(45, 90%, 50%)', bgClass: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400' },
] as const;

type CategoryKey = typeof SEVERITY_CATEGORIES[number]['key'];

function classifyIncident(inc: Incident): CategoryKey | null {
  const title = (inc.title || '').toLowerCase();
  const orig = (inc.originalType || '').toLowerCase();
  const combined = `${title} ${orig}`;

  if (/mord|skott|skjut|dödl|avloss/.test(combined)) return 'shooting';
  if (/rån|robbery/.test(combined)) return 'robbery';
  if (/grov misshandel/.test(combined)) return 'assault_serious';
  if (/misshandel/.test(combined)) return 'assault';
  if (inc.risk === 'high') return 'high_other';
  return null;
}

interface AreaData {
  area: string;
  score: number;
  categories: Record<CategoryKey, number>;
}

const DangerRanking = ({ incidents, periodLabel }: DangerRankingProps) => {
  const [expanded, setExpanded] = useState(false);
  const ranking = useMemo(() => {
    const areaMap: Record<string, Record<CategoryKey, number>> = {};

    incidents.forEach((inc) => {
      if (!inc.area) return;
      const cat = classifyIncident(inc);
      if (!cat) return;
      if (!areaMap[inc.area]) {
        areaMap[inc.area] = { shooting: 0, robbery: 0, assault_serious: 0, assault: 0, high_other: 0 };
      }
      areaMap[inc.area][cat]++;
    });

    const weightMap = Object.fromEntries(SEVERITY_CATEGORIES.map((c) => [c.key, c.weight]));

    const ranked: AreaData[] = Object.entries(areaMap)
      .map(([area, categories]) => {
        const score = Object.entries(categories).reduce(
          (sum, [key, count]) => sum + count * (weightMap[key as CategoryKey] || 1),
          0
        );
        return { area, score, categories };
      })
      .filter((a) => a.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 15);

    return ranked;
  }, [incidents]);

  if (!ranking.length) return null;

  const maxScore = ranking[0]?.score || 1;

  // A list in words, as on the app's Statistik: the place, how many serious events and of what kind
  return (
    <Card title="Flest allvarliga händelser" footer={`${periodLabel[0].toUpperCase()}${periodLabel.slice(1)}. Skjutningar och rån väger tyngst.`}>
      <ol className="-my-1">
        {(expanded ? ranking : ranking.slice(0, 5)).map((item, index) => {
          const kinds = SEVERITY_CATEGORIES.filter((cat) => item.categories[cat.key] > 0);
          return (
            <li key={item.area} className="border-b border-[rgba(84,84,88,0.65)] py-2.5 last:border-0">
              <div className="flex items-center gap-3">
                <span className={`w-5 text-[15px] tabular-nums ${MUTED}`}>{index + 1}</span>
                <span className="min-w-0 flex-1 truncate text-[17px]">{item.area}</span>
                <span className="h-2 w-16 shrink-0 overflow-hidden rounded-full bg-[#2c2c2e]" aria-hidden>
                  <span className="block h-full rounded-full bg-[#ff453a]" style={{ width: `${Math.max((item.score / maxScore) * 100, 6)}%` }} />
                </span>
              </div>
              <p className={`ml-8 mt-0.5 text-[13px] leading-snug ${MUTED}`}>
                {kinds.map((cat) => `${item.categories[cat.key]} ${cat.label.toLowerCase()}`).join(' · ')}
              </p>
            </li>
          );
        })}
      </ol>
      {ranking.length > 5 && (
        <button type="button" onClick={() => setExpanded(!expanded)} className="mt-2 flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-[#2c2c2e] text-[16px] font-semibold text-[#0a84ff] active:opacity-60">
          {expanded ? 'Visa färre' : `Visa ${ranking.length - 5} till`}
          <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden />
        </button>
      )}
    </Card>
  );
};

export default DangerRanking;
