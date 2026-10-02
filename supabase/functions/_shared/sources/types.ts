// An event from a source other than Polisen.se, stored in public.external_events.
// The shape matches the table row (minus timestamps the database sets).

export type ExternalKind = 'vma' | 'crisis' | 'traffic' | 'news';
export type Severity = 'low' | 'medium' | 'high';

export interface ExternalEvent {
  id: string;
  source: string;
  kind: ExternalKind;
  title: string;
  summary: string;
  url: string | null;
  area: string | null;
  lat: number | null;
  lng: number | null;
  published_at: string;
  ends_at: string | null;
  severity: Severity;
  category: string | null;
  /** The source's own image for this item; only set for sources allowed in NEWS_IMAGES */
  image_url?: string | null;
  image_credit?: string | null;
}
