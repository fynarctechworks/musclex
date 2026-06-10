import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';
import type { Coords } from '../../lib/geo';

export type LocationStatus =
  | 'prompting' // asking / fetching
  | 'granted' // have coords
  | 'denied' // user said no
  | 'unavailable'; // services off or lookup failed

/**
 * Foreground device location for the branch finder. Requests permission on
 * mount; `request()` lets the UI retry after the user enables access. Never
 * throws — failures collapse into a status the screen renders gracefully.
 */
export function useDeviceLocation() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [status, setStatus] = useState<LocationStatus>('prompting');

  const request = useCallback(async () => {
    setStatus('prompting');
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        setStatus('denied');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCoords({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      setStatus('granted');
    } catch {
      // Location services disabled, timeout, etc.
      setStatus('unavailable');
    }
  }, []);

  useEffect(() => {
    void request();
  }, [request]);

  return { coords, status, request };
}
