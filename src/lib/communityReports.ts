// Citizen reports ("Rapportera" in the app, CommunityReports on the website): what neighbours
// have seen, sent through submit-community-report by anyone signed in, and read by everyone
// signed in. A report sent from a police event ("Är du på plats?") carries its id.
import { Construction, Eye, Flame, Hammer, Lightbulb, MoreHorizontal, ShieldAlert, Siren, Volume2, Zap, type LucideIcon } from 'lucide-react';
import { REPORT_CATEGORY_LABELS, type ReportCategoryValue } from '../../supabase/functions/_shared/reportCategories';
import { supabase } from '@/integrations/supabase/client';
import { BLOCKED_WORDS_MESSAGE, hasBlockedWords } from '@/lib/moderation';

export interface ReportCategory {
  value: ReportCategoryValue;
  label: string;
  /** One line on what belongs here */
  hint: string;
  color: string;
  icon: LucideIcon;
  /** Something happening now, which people on the spot report (and an event's "Är du på plats?" offers) */
  now?: boolean;
}

const L = REPORT_CATEGORY_LABELS;

export const REPORT_CATEGORIES: ReportCategory[] = [
  { value: 'police_here', label: L.police_here, hint: 'Polisbilar, poliser på plats', color: '#0a84ff', icon: Siren, now: true },
  { value: 'sirens', label: L.sirens, hint: 'Utryckning, helikopter, många sirener', color: '#5e5ce6', icon: Volume2, now: true },
  { value: 'smoke_fire', label: L.smoke_fire, hint: 'Rök, eld eller brandkår', color: '#ff6b35', icon: Flame, now: true },
  { value: 'bangs', label: L.bangs, hint: 'Smällar eller knallar', color: '#ff375f', icon: Zap, now: true },
  { value: 'cordon', label: L.cordon, hint: 'Avspärrat område, blockerad väg', color: '#ffd60a', icon: Construction, now: true },
  { value: 'suspicious_activity', label: 'Misstänkt aktivitet', hint: 'Någon som beter sig konstigt, bilar som cirkulerar', color: '#bf5af2', icon: Eye },
  { value: 'unsafe_area', label: 'Otrygg plats', hint: 'En plats där det känns otryggt att gå', color: '#ff9f0a', icon: ShieldAlert },
  { value: 'vandalism', label: 'Skadegörelse', hint: 'Klotter, krossade rutor, förstörda saker', color: '#ff453a', icon: Hammer },
  { value: 'broken_lighting', label: 'Trasig belysning', hint: 'Gatlampor som inte lyser', color: '#ffcc00', icon: Lightbulb },
  { value: 'other', label: 'Annat', hint: 'Något annat grannarna bör veta', color: '#8e8e93', icon: MoreHorizontal },
];

export const reportCategory = (value: string) => REPORT_CATEGORIES.find((c) => c.value === value) ?? REPORT_CATEGORIES[REPORT_CATEGORIES.length - 1];

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const stripHtml = (value: string) => value.replace(/<[^>]*>/g, '').trim();

export interface ReportDraft {
  category: string;
  title: string;
  description: string;
  area: string;
  lat: number | null;
  lng: number | null;
  /** The police event it is about, when reported from one */
  eventId?: string | null;
}

/** What's missing before the report can be sent, or null when it's ready */
export function draftProblem(draft: ReportDraft): string | null {
  if (!REPORT_CATEGORIES.some((c) => c.value === draft.category)) return 'Välj vad det gäller.';
  if (draft.lat === null || draft.lng === null) return 'Välj var det är.';
  // Rubrik and words are optional: a report can be just what it is and where (the category
  // names it), so someone on the spot can send it in a couple of taps
  if (hasBlockedWords(`${draft.title} ${draft.description}`)) return BLOCKED_WORDS_MESSAGE;
  return null;
}

/** "Södermalm, Stockholm" for a point, from OpenStreetMap; null if it can't be found */
export async function placeName(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=14&lat=${lat}&lon=${lng}`, { headers: { 'Accept-Language': 'sv' } });
    if (!res.ok) return null;
    const { address } = await res.json() as { address?: Record<string, string> };
    if (!address) return null;
    const near = address.suburb || address.neighbourhood || address.city_district || address.quarter || address.village;
    const town = address.city || address.town || address.municipality;
    return [near, town].filter(Boolean).filter((v, i, all) => all.indexOf(v) === i).join(', ') || null;
  } catch {
    return null;
  }
}

export interface PlaceResult { name: string; lat: number; lng: number }

/** Addresses and places in Sweden matching what was typed */
export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  if (query.trim().length < 3) return [];
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&countrycodes=se&limit=6&q=${encodeURIComponent(query)}`, { headers: { 'Accept-Language': 'sv' } });
    const data = await res.json() as { display_name: string; lat: string; lon: string }[];
    return data.map((d) => ({ name: d.display_name, lat: Number(d.lat), lng: Number(d.lon) }));
  } catch {
    return [];
  }
}

async function uploadImage(userId: string, file: File): Promise<string | null> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('community-reports').upload(path, file, { contentType: file.type });
  if (error) return null;
  return supabase.storage.from('community-reports').getPublicUrl(path).data.publicUrl;
}

/** Sends the report. The error is in words for the person sending it; imageFailed when only the picture didn't go */
export async function submitReport(userId: string, draft: ReportDraft, image: File | null): Promise<{ ok: true; imageFailed: boolean } | { ok: false; error: string }> {
  const problem = draftProblem(draft);
  if (problem) return { ok: false, error: problem };
  const image_url = image ? await uploadImage(userId, image) : null;
  const { data, error } = await supabase.functions.invoke<{ id?: string; error?: string }>('submit-community-report', {
    body: {
      category: draft.category,
      title: stripHtml(draft.title).slice(0, 200),
      description: stripHtml(draft.description).slice(0, 1000),
      area: stripHtml(draft.area).slice(0, 200) || null,
      lat: draft.lat,
      lng: draft.lng,
      image_url,
      event_id: draft.eventId ?? null,
    },
  });
  if (!error && !data?.error) {
    // Tells those nearby who asked for reports (send-push-notifications, mode "report"); a failure
    // here doesn't touch the report itself
    if (data?.id) supabase.functions.invoke('send-push-notifications', { body: { mode: 'report', reportId: data.id } }).catch(() => {});
    return { ok: true, imageFailed: !!image && !image_url };
  }
  let message = data?.error ?? 'Kunde inte skicka rapporten. Försök igen.';
  const context = (error as { context?: { json?: () => Promise<{ error?: string }> } } | null)?.context;
  if (!data?.error && context?.json) {
    try { message = (await context.json())?.error ?? message; } catch { /* the words above */ }
  }
  return { ok: false, error: message };
}

export interface PublicReport {
  id: string;
  category: string;
  title: string;
  description: string;
  area: string | null;
  created_at: string;
  status: string;
  image_url: string | null;
  event_id?: string | null;
}

/** The latest reports, as everyone can read them (community_reports_public) */
export async function latestReports(limit = 20): Promise<PublicReport[]> {
  const { data } = await supabase.from('community_reports_public').select('*').order('created_at', { ascending: false }).limit(limit);
  return (data ?? []) as PublicReport[];
}

/** A report about a police event ("Är du på plats?"): the event and where it is, for the form */
export interface EventPrefill {
  eventId: string;
  title: string;
  area: string;
  lat: number;
  lng: number;
}

/** /rapportera with the event filled in: its id, place and title ride in the address */
export function reportFromEventUrl(event: { id: string; title: string; area: string; lat: number; lng: number }): string {
  const q = new URLSearchParams({
    handelse: event.id,
    rubrik: event.title.slice(0, 120),
    plats: event.area.slice(0, 120),
    lat: event.lat.toFixed(5),
    lng: event.lng.toFixed(5),
  });
  return `/rapportera?${q.toString()}`;
}

/** The event /rapportera was opened from, or null */
export function readEventPrefill(search: string): EventPrefill | null {
  const q = new URLSearchParams(search);
  const eventId = q.get('handelse');
  const lat = Number(q.get('lat'));
  const lng = Number(q.get('lng'));
  if (!eventId || !/^[A-Za-z0-9:._-]{1,100}$/.test(eventId)) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) return null;
  return { eventId, title: (q.get('rubrik') ?? '').slice(0, 120), area: (q.get('plats') ?? '').slice(0, 120), lat, lng };
}
