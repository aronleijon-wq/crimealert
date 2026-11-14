import { Briefcase, GraduationCap, Heart, Home, MapPin, type LucideIcon } from 'lucide-react';
import type { PlaceKind } from '../../supabase/functions/_shared/notifications';

/** The icon for each kind of place in Mina platser */
export const PLACE_ICONS: Record<PlaceKind, LucideIcon> = { home: Home, work: Briefcase, school: GraduationCap, family: Heart, other: MapPin };
