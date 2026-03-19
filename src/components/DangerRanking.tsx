import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown } from 'lucide-react';
import { Incident } from '@/data/mockIncidents';

interface DangerRankingProps {
  incidents: Incident[];
  periodLabel: string;
}

// Crime severity categories with weights and colors
const SEVERITY_CATEGORIES = [
  { key: 'shooting', label: 'Mord/skott', weight: 5, color: 'hsl(0, 100%, 50%)', bgClass: 'bg-cr-red/15 text-cr-red' },
  { key: 'robbery', label: 'Rån', weight: 4, color: 'hsl(0, 80%, 55%)', bgClass: 'bg-cr-red/10 text-cr-red' },
  { key: 'assault_serious', label: 'Grov misshandel', weight: 3, color: 'hsl(25, 100%, 50%)', bgClass: 'bg-cr-orange/15 text-cr-orange' },
  { key: 'assault', label: 'Misshandel', weight: 2, color: 'hsl(25, 80%, 55%)', bgClass: 'bg-cr-orange/10 text-cr-orange' },
  { key: 'high_other', label: 'Hög p. övrigt', weight: 1.5, color: 'hsl(45, 90%, 50%)', bgClass: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400' },
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

  return (
    <div className="bg-card border border-border rounded-lg p-4 md:p-6">
      <div className="flex items-center gap-2 mb-1">
        <AlertTriangle className="w-4 h-4 text-cr-red" />
        <h2 className="text-sm font-bold text-foreground">Farligaste orterna</h2>
      </div>
      <p className="text-[10px] text-muted-foreground mb-4">
        {periodLabel} · viktat efter allvarlighetsgrad
      </p>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mb-4">
        {SEVERITY_CATEGORIES.map((cat) => (
          <span key={cat.key} className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="w-2 h-2 rounded-full" style={{ background: cat.color }} />
            {cat.label}
          </span>
        ))}
      </div>

      <div className="space-y-3">
        {ranking.map((item, index) => (
          <div key={item.area} className="group">
            {/* Top row: rank, name, bar, score */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-muted-foreground w-5 text-right flex-shrink-0">
                {index + 1}
              </span>
              <span className="text-xs font-medium text-foreground w-24 md:w-28 truncate flex-shrink-0">
                {item.area}
              </span>
              <div className="flex-1 h-4 bg-muted rounded-sm overflow-hidden">
                <div
                  className="h-full rounded-sm transition-all duration-500"
                  style={{
                    width: `${Math.max((item.score / maxScore) * 100, 4)}%`,
                    background: `linear-gradient(90deg, hsl(0, 100%, 50%), hsl(25, 100%, 55%))`,
                    opacity: Math.max(0.4, item.score / maxScore),
                  }}
                />
              </div>
              <span className="text-[11px] font-mono font-bold text-muted-foreground w-7 text-right flex-shrink-0">
                {Math.round(item.score)}p
              </span>
            </div>
            {/* Bottom row: category badges */}
            <div className="flex flex-wrap gap-1 ml-7 mt-1">
              {SEVERITY_CATEGORIES.map((cat) => {
                const count = item.categories[cat.key];
                if (!count) return null;
                return (
                  <span
                    key={cat.key}
                    className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${cat.bgClass}`}
                  >
                    {count > 1 ? `${count}× ` : ''}{cat.label}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DangerRanking;
