import { useCallback, useEffect, useRef, useState } from 'react';

export interface MyPosition {
  lat: number;
  lng: number;
  /** How sure the phone is, in metres */
  accuracy: number;
}

export type MyLocationStatus = 'off' | 'locating' | 'on' | 'denied' | 'unavailable';

/**
 * Where the visitor is, for the blue dot on the map. Nothing is asked until start() (the locate
 * button), and the position follows them while the map is open. It stays in the browser: it is
 * never stored or sent anywhere.
 */
export function useMyLocation(onFirstFix?: (position: MyPosition) => void) {
  const [position, setPosition] = useState<MyPosition | null>(null);
  const [status, setStatus] = useState<MyLocationStatus>('off');
  const watch = useRef<number | null>(null);
  const first = useRef(onFirstFix);
  first.current = onFirstFix;

  const stop = useCallback(() => {
    if (watch.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) navigator.geolocation.clearWatch(watch.current);
    watch.current = null;
    setStatus('off');
    setPosition(null);
  }, []);

  const start = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('unavailable');
      return;
    }
    if (watch.current !== null) return;
    setStatus('locating');
    let fixed = false;
    watch.current = navigator.geolocation.watchPosition(
      (p) => {
        const next = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy };
        setPosition(next);
        setStatus('on');
        if (!fixed) {
          fixed = true;
          first.current?.(next);
        }
      },
      (error) => {
        if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
        watch.current = null;
        setPosition(null);
        setStatus(error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable');
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );
  }, []);

  // No watching once the map is gone
  useEffect(() => () => {
    if (watch.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) navigator.geolocation.clearWatch(watch.current);
  }, []);

  return { position, status, start, stop };
}
