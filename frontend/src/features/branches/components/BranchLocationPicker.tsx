"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Loader2, LocateFixed, MapPin, Search, X } from "lucide-react";

// Leaflet touches `window`, so the map can only render client-side.
const LocationMap = dynamic(() => import("./LocationMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-canvas-soft-2 text-muted-foreground text-sm">
      <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading map…
    </div>
  ),
});

/** Address fields resolved by reverse-geocoding, plus the coordinate. */
export interface ResolvedLocation {
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
}

interface SearchResult {
  lat: string;
  lon: string;
  display_name: string;
}

// Fallback view (geographic centre of India) used only when no location is
// selected yet — it is NOT written into the form until the user picks a spot.
const DEFAULT_CENTER = { lat: 20.5937, lng: 78.9629 };

const NOMINATIM = "https://nominatim.openstreetmap.org";

interface NominatimAddress {
  road?: string;
  suburb?: string;
  city?: string;
  town?: string;
  village?: string;
  county?: string;
  state?: string;
  country?: string;
  postcode?: string;
}

function mapAddress(display_name: string, a: NominatimAddress = {}): Omit<ResolvedLocation, "latitude" | "longitude"> {
  return {
    address: display_name,
    city: a.city || a.town || a.village || a.suburb || a.county,
    state: a.state,
    country: a.country,
    postal_code: a.postcode,
  };
}

async function reverseGeocode(lat: number, lng: number): Promise<Omit<ResolvedLocation, "latitude" | "longitude">> {
  const res = await fetch(
    `${NOMINATIM}/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1`,
    { headers: { Accept: "application/json" } },
  );
  if (!res.ok) throw new Error("reverse geocode failed");
  const data = await res.json();
  return mapAddress(data.display_name ?? "", data.address);
}

export function BranchLocationPicker({
  value,
  onChange,
}: {
  value: { latitude?: number | null; longitude?: number | null };
  onChange: (loc: ResolvedLocation) => void;
}) {
  const hasLocation =
    typeof value.latitude === "number" && typeof value.longitude === "number";
  const center = hasLocation
    ? { lat: value.latitude as number, lng: value.longitude as number }
    : DEFAULT_CENTER;

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resolve a coordinate: store it + reverse-geocode the address fields.
  const pick = useCallback(
    async (lat: number, lng: number) => {
      onChange({ latitude: lat, longitude: lng });
      try {
        const addr = await reverseGeocode(lat, lng);
        onChange({ latitude: lat, longitude: lng, ...addr });
      } catch {
        // Coordinate is already saved; address auto-fill is best-effort.
      }
    },
    [onChange],
  );

  // Debounced forward-geocode search.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `${NOMINATIM}/search?format=jsonv2&q=${encodeURIComponent(q)}&addressdetails=1&limit=5`,
          { headers: { Accept: "application/json" } },
        );
        setResults(res.ok ? await res.json() : []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const detect = useCallback(() => {
    setGeoError(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoError("Your browser doesn't support location detection. Search or drag the pin instead.");
      return;
    }
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDetecting(false);
        pick(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        setDetecting(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGeoError(
            "Location access is blocked. Allow location for this site in your browser settings, then try again — or search / drag the pin below.",
          );
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setGeoError("Couldn't determine your location. Search or drag the pin instead.");
        } else {
          setGeoError("Location request timed out. Try again, or search / drag the pin.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }, [pick]);

  const selectResult = (r: SearchResult) => {
    setQuery(r.display_name);
    setResults([]);
    pick(parseFloat(r.lat), parseFloat(r.lon));
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-foreground leading-5">
        Location <span className="text-muted-foreground font-normal">(for member-app gym finder)</span>
      </label>

      {/* Search + detect controls */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for an address or place…"
            className="w-full h-10 pl-9 pr-9 rounded-md border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {searching ? (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
          ) : query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setResults([]);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          ) : null}

          {results.length > 0 && (
            <ul className="absolute z-[1000] mt-1 w-full max-h-56 overflow-auto rounded-md border border-border bg-card shadow-lg">
              {results.map((r, i) => (
                <li key={`${r.lat}-${r.lon}-${i}`}>
                  <button
                    type="button"
                    onClick={() => selectResult(r)}
                    className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted flex items-start gap-2"
                  >
                    <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                    <span className="line-clamp-2">{r.display_name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="button"
          onClick={detect}
          disabled={detecting}
          className="h-10 px-3 rounded-md border border-border bg-background text-sm font-medium text-foreground hover:bg-muted transition-colors flex items-center gap-1.5 disabled:opacity-50 whitespace-nowrap"
          title="Detect my current location"
        >
          {detecting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <LocateFixed className="w-4 h-4" />
          )}
          Detect
        </button>
      </div>

      {geoError && (
        <p className="text-xs text-error-deep leading-4">{geoError}</p>
      )}

      {/* Map */}
      <div className="h-56 w-full overflow-hidden rounded-md border border-border">
        <LocationMap
          lat={center.lat}
          lng={center.lng}
          onPick={(p) => pick(p.lat, p.lng)}
        />
      </div>

      <p className="text-xs text-muted-foreground leading-4">
        {hasLocation ? (
          <>
            Pinned at{" "}
            <span className="text-foreground font-medium">
              {(value.latitude as number).toFixed(6)}, {(value.longitude as number).toFixed(6)}
            </span>{" "}
            — drag the pin or click the map to fine-tune.
          </>
        ) : (
          "Search, hit Detect, or click the map to drop a pin. Coordinates are saved so members can find the nearest gym."
        )}
      </p>
    </div>
  );
}
