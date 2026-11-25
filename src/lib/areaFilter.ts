import { SWEDISH_KOMMUNER } from '@/data/kommuner';
import { kommunMatcher } from '../../supabase/functions/_shared/notifications';

const KOMMUNER = new Set(SWEDISH_KOMMUNER);

/**
 * Whether an event belongs to the chosen area (Analys, the export): a kommun takes its events
 * however the place is written ("Nacka", "Nacka kommun", a report's "Fisksätra, Nacka"), any
 * other area ("Stockholms län") by its name. No area: everything.
 */
export function areaFilter(selected: string | null): (event: { area?: string | null }) => boolean {
  if (!selected) return () => true;
  if (KOMMUNER.has(selected)) {
    const matches = kommunMatcher(selected);
    return (e) => matches(e.area);
  }
  return (e) => e.area === selected;
}
