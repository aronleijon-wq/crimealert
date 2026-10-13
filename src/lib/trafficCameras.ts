// The map's camera layer: Trafikverket's road cameras from trafikverket-cameras, kept in the
// browser for half an hour so turning the layer on and off doesn't ask again.
import { supabase } from '@/integrations/supabase/client';
import type { TrafficCamera } from '../../supabase/functions/_shared/sources/trafikverketCameras';

export type { TrafficCamera };

const KEY = 'crimealert-cameras';
const LAYER_KEY = 'crimealert-camera-layer';
const MAX_AGE = 30 * 60 * 1000;

export async function loadCameras(now = Date.now()): Promise<TrafficCamera[]> {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { at: number; cameras: TrafficCamera[] } | null;
    if (saved && now - saved.at < MAX_AGE && Array.isArray(saved.cameras) && saved.cameras.length) return saved.cameras;
  } catch {
    // Not saved, or not readable: ask
  }
  const { data, error } = await supabase.functions.invoke('trafikverket-cameras');
  if (error || !data?.success || !Array.isArray(data.data)) throw new Error(error?.message ?? data?.error ?? 'Kamerorna kunde inte hämtas');
  const cameras = data.data as TrafficCamera[];
  try {
    localStorage.setItem(KEY, JSON.stringify({ at: now, cameras }));
  } catch {
    // Full or private mode: ask again next time
  }
  return cameras;
}

/** Whether the visitor had the camera layer on last time. */
export function cameraLayerWanted(): boolean {
  try {
    return localStorage.getItem(LAYER_KEY) === '1';
  } catch {
    return false;
  }
}

export function rememberCameraLayer(on: boolean) {
  try {
    if (on) localStorage.setItem(LAYER_KEY, '1');
    else localStorage.removeItem(LAYER_KEY);
  } catch {
    // Not remembered
  }
}
