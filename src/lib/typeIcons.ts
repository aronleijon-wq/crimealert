// The line icon for each kind of event, shared by the feed, the event sheet and the notification
// settings so every page shows the same symbol (the map's popups use the same drawings, svgIcons.ts).

import { Ambulance, Car, Construction, Flame, Megaphone, Shield, TriangleAlert, type LucideIcon } from 'lucide-react';

export const INCIDENT_TYPE_ICONS: Record<string, LucideIcon> = {
  police: Shield,
  fire: Flame,
  ambulance: Ambulance,
  traffic: Car,
  other: TriangleAlert,
  crisis: Megaphone,
  trafikverket: Construction,
};

/** The icon for a kind of event, with a warning sign for kinds it doesn't know. */
export const incidentTypeIcon = (type: string | null | undefined): LucideIcon => (type && INCIDENT_TYPE_ICONS[type]) || TriangleAlert;
