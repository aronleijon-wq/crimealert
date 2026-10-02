import { useEffect, useMemo, useState } from 'react';
import { incidentTypeConfig, type Incident } from '@/data/mockIncidents';
import { usePoliceEvents } from '@/hooks/usePoliceEvents';
import { parseIncidentTime } from '@/lib/incidentTime';
import type { OpsEvent, OpsTone } from './OpsMap';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_EVENTS = 36;
const FOCUS_COUNT = 8;
const FOCUS_MS = 4200;

const TONES: Partial<Record<Incident['type'], OpsTone>> = {
  police: 'red',
  fire: 'amber',
  traffic: 'amber',
  ambulance: 'steel',
  other: 'steel',
  crisis: 'violet',
};

const clock = (date: Date) =>
  date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' });

const inSweden = (i: Incident) => i.lat > 55 && i.lat < 69.5 && i.lng > 10.5 && i.lng < 24.5;
const isSummary = (i: Incident) => /sammanfattning/i.test(`${i.originalType ?? ''} ${i.title}`);

export interface LandingLive {
  events: OpsEvent[];
  focus: number | null;
  loading: boolean;
  failed: boolean;
  lastDay: number | null;
  kommuner: number | null;
  updatedAt: string | null;
}

/** Polisen's latest events for the landing page, and which one the map is locked on to. */
export function useLandingLive(): LandingLive {
  const { incidents, loading, error, updatedAt } = usePoliceEvents({ quiet: true });

  const { events, lastDay, kommuner } = useMemo(() => {
    const now = Date.now();
    const dated = incidents
      .filter((i) => inSweden(i) && !isSummary(i))
      .map((i) => ({ i, at: parseIncidentTime(i.time) }))
      .filter((x): x is { i: Incident; at: Date } => x.at !== null)
      .sort((a, b) => b.at.getTime() - a.at.getTime());
    const recent = dated.filter((x) => now - x.at.getTime() < DAY_MS);
    return {
      events: dated.slice(0, MAX_EVENTS).map(({ i, at }) => ({
        id: i.id,
        lat: i.lat,
        lng: i.lng,
        tone: TONES[i.type] ?? 'steel',
        label: i.originalType ?? incidentTypeConfig[i.type]?.label ?? 'Händelse',
        area: i.area,
        time: clock(at),
      })),
      lastDay: recent.length,
      kommuner: new Set(recent.map((x) => x.i.area)).size,
    };
  }, [incidents]);

  // Step through the newest events, one at a time
  const [step, setStep] = useState(0);
  const cycle = Math.min(FOCUS_COUNT, events.length);
  useEffect(() => {
    if (cycle < 2) return;
    const id = setInterval(() => setStep((s) => s + 1), FOCUS_MS);
    return () => clearInterval(id);
  }, [cycle]);

  const hasData = events.length > 0;
  return {
    events,
    focus: hasData ? step % cycle : null,
    loading: loading && !hasData,
    failed: !!error && !hasData,
    lastDay: hasData ? lastDay : null,
    kommuner: hasData ? kommuner : null,
    updatedAt: updatedAt ? clock(new Date(updatedAt)) : null,
  };
}
