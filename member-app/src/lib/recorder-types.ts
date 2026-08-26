/**
 * The one shared coordinate type.
 *
 * Split out so `route.ts` does not have to import `recorder.ts` — the recorder
 * pulls in timing and state machinery that a read-only route preview has no
 * business loading.
 */
export interface LatLng {
  lat: number;
  lng: number;
}
