// Official crisis information:
// - Krisinformation.se news (Myndigheten för civilt försvar): api.krisinformation.se/v3/news
// - VMA, Viktigt meddelande till allmänheten (Sveriges Radio, CAP format): vmaapi.sr.se/api/v3/alerts

import { placeFromAreaName, type Place } from './geo.ts';
import { htmlToText, toIso, truncate } from './text.ts';
import type { ExternalEvent } from './types.ts';

export const KRISINFORMATION_NEWS_URL = 'https://api.krisinformation.se/v3/news?format=json&allCounties=true&days=7';
export const VMA_ALERTS_URL = 'https://vmaapi.sr.se/api/v3/alerts?format=json';

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const placeFields = (place: Place | null) => ({
  area: place?.name ?? null,
  lat: place?.lat ?? null,
  lng: place?.lng ?? null,
});

/** Krisinformation.se news items (test items skipped). */
export function parseKrisinformationNews(json: unknown): ExternalEvent[] {
  const events: ExternalEvent[] = [];
  for (const raw of asArray(json)) {
    const item = asRecord(raw);
    if (item.IsTest === true) continue;

    const id = String(item.Identifier ?? item.ContentId ?? '').trim();
    const title = htmlToText(item.Headline);
    const published = toIso(item.Published) ?? toIso(item.Updated);
    if (!id || !title || !published) continue;

    const areas = asArray(item.Area).map((a) => String(asRecord(a).Description ?? ''));
    // Several areas: keep the label of the first, unless one of them is the whole country
    const place = areas.map(placeFromAreaName).find((p) => p?.kind === 'land') ?? placeFromAreaName(areas[0]);
    const web = String(item.Web ?? '');

    events.push({
      id: `kris-${id}`,
      source: 'krisinformation',
      kind: 'crisis',
      title: truncate(title, 200),
      summary: truncate(htmlToText(item.Preamble) || htmlToText(item.PushMessage), 600),
      url: /^https?:\/\//.test(web) ? web : 'https://www.krisinformation.se/',
      ...placeFields(place),
      published_at: published,
      ends_at: null,
      severity: item.Push === true ? 'high' : 'medium',
      category: item.Event ? String(item.Event) : null,
    });
  }
  return events;
}

/** Centre of a CAP circle ("lat,lng radius") or polygon ("lat,lng lat,lng ..."). */
function capAreaCentre(area: Record<string, unknown>): { lat: number; lng: number } | null {
  const shapes = [...asArray(area.circle), area.circle, ...asArray(area.polygon), area.polygon]
    .filter((s): s is string => typeof s === 'string');
  for (const shape of shapes) {
    const points = shape.trim().split(/\s+/)
      .map((pair) => pair.split(',').map(Number))
      .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
    if (points.length === 0) continue;
    const lat = points.reduce((sum, [p]) => sum + p, 0) / points.length;
    const lng = points.reduce((sum, [, p]) => sum + p, 0) / points.length;
    if (lat >= 54 && lat <= 70 && lng >= 10 && lng <= 25) return { lat, lng };
  }
  return null;
}

export interface VmaResult {
  events: ExternalEvent[];
  /** Identifiers of earlier alerts that a Cancel message has called off */
  cancelledIds: string[];
}

/** Real VMA alerts (status Actual; exercises and tests skipped). */
export function parseVmaAlerts(json: unknown): VmaResult {
  const root = asRecord(json);
  const alerts = Array.isArray(json) ? json : asArray(root.alerts ?? root.alert);
  const events: ExternalEvent[] = [];
  const cancelledIds: string[] = [];

  for (const raw of alerts) {
    const alert = asRecord(raw);
    if (String(alert.status ?? '').toLowerCase() !== 'actual') continue;

    // CAP references: "sender,identifier,sent" separated by spaces
    const referenced = String(alert.references ?? '').split(/\s+/).map((ref) => ref.split(',')[1]).filter(Boolean);
    if (String(alert.msgType ?? '').toLowerCase() === 'cancel') {
      cancelledIds.push(...referenced.map((id) => `vma-${id}`));
      continue;
    }

    const identifier = String(alert.identifier ?? '').trim();
    const sent = toIso(alert.sent);
    if (!identifier || !sent) continue;

    const infos = asArray(alert.info).map(asRecord);
    const info = infos.find((i) => String(i.language ?? '').toLowerCase().startsWith('sv')) ?? infos[0];
    if (!info) continue;

    const area = asRecord(asArray(info.area)[0]);
    const areaName = String(area.areaDesc ?? '').trim();
    const centre = capAreaCentre(area);
    const place = placeFromAreaName(areaName);
    const web = String(info.web ?? '');

    events.push({
      id: `vma-${identifier}`,
      source: 'sr-vma',
      kind: 'vma',
      title: truncate(htmlToText(info.headline) || `VMA: ${htmlToText(info.event) || areaName}`, 200),
      summary: truncate(htmlToText(info.description), 1000),
      url: /^https?:\/\//.test(web) ? web : 'https://www.sverigesradio.se/vma',
      area: areaName || place?.name || null,
      lat: centre?.lat ?? place?.lat ?? null,
      lng: centre?.lng ?? place?.lng ?? null,
      published_at: sent,
      ends_at: toIso(info.expires),
      severity: 'high',
      category: info.event ? String(info.event) : null,
    });

    // An Update replaces the alerts it references
    if (String(alert.msgType ?? '').toLowerCase() === 'update') {
      cancelledIds.push(...referenced.map((id) => `vma-${id}`));
    }
  }
  return { events, cancelledIds };
}
