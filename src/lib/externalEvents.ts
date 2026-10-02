import type { Incident } from '@/data/mockIncidents';
import type { ExternalEvent } from '../../supabase/functions/_shared/sources/types';

export type { ExternalEvent };

export const SOURCE_NAMES: Record<string, string> = {
  'sr-vma': 'Sveriges Radio (VMA)',
  krisinformation: 'Krisinformation.se',
  trafikverket: 'Trafikverket',
  svt: 'SVT Nyheter',
  aftonbladet: 'Aftonbladet',
  expressen: 'Expressen',
};

export const sourceName = (source: string) => SOURCE_NAMES[source] ?? source;

/** A VMA or Krisinformation event as a map incident, or null if it has no position. */
export function crisisToIncident(e: ExternalEvent): Incident | null {
  if ((e.kind !== 'vma' && e.kind !== 'crisis') || e.lat === null || e.lng === null) return null;
  return {
    id: e.id,
    type: 'crisis',
    title: e.title,
    description: e.summary,
    lat: e.lat,
    lng: e.lng,
    area: e.area ?? 'Sverige',
    time: e.published_at,
    status: 'active',
    risk: e.severity,
    source: sourceName(e.source),
    approximate: true,
    url: e.url ?? undefined,
    originalType: e.kind === 'vma' ? 'VMA' : e.category ?? 'Krisinformation',
    endTime: e.ends_at,
  };
}
