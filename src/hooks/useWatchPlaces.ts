// Mina platser: the signed-in account's named places to watch (watch_places), oldest first,
// as send-push-notifications counts them.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { placeFromRow, type PlaceKind, type WatchPlace } from '../../supabase/functions/_shared/notifications';

export interface PlaceDraft {
  label: string;
  kind: PlaceKind;
  lat: number;
  lng: number;
  radiusKm: number;
}

const COLUMNS = 'id, label, kind, lat, lng, radius_km, created_at';
const toRow = (d: PlaceDraft) => ({ label: d.label.trim().slice(0, 40) || 'Min plats', kind: d.kind, lat: d.lat, lng: d.lng, radius_km: d.radiusKm });

export function useWatchPlaces() {
  const { user } = useAuth();
  const [places, setPlaces] = useState<WatchPlace[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user) { setPlaces([]); return; }
    setLoading(true);
    const { data } = await supabase.from('watch_places').select(COLUMNS).eq('user_id', user.id).order('created_at');
    setPlaces((data ?? []).map(placeFromRow).filter((p): p is WatchPlace => p !== null));
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  /** Adds or changes a place; the error's message, or null */
  const savePlace = async (draft: PlaceDraft, id?: string): Promise<string | null> => {
    if (!user) return 'Logga in för att spara platser.';
    const query = id
      ? supabase.from('watch_places').update(toRow(draft)).eq('id', id).eq('user_id', user.id).select(COLUMNS).single()
      : supabase.from('watch_places').insert({ ...toRow(draft), user_id: user.id }).select(COLUMNS).single();
    const { data, error } = await query;
    if (error || !data) return /too_many_places/.test(error?.message ?? '') ? 'Du har redan tio platser.' : 'Kunde inte spara platsen. Försök igen.';
    const place = placeFromRow(data);
    if (place) setPlaces((prev) => (id ? prev.map((p) => (p.id === id ? place : p)) : [...prev, place]));
    return null;
  };

  const removePlace = async (id: string) => {
    if (!user) return;
    const { error } = await supabase.from('watch_places').delete().eq('id', id).eq('user_id', user.id);
    if (!error) setPlaces((prev) => prev.filter((p) => p.id !== id));
  };

  return { places, loading, savePlace, removePlace, refetch: load };
}
