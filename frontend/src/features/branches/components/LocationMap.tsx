"use client";

import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/**
 * Inner Leaflet map. Imports `leaflet` at module load (touches `window`), so it
 * MUST be dynamically imported with `{ ssr: false }` — see BranchLocationPicker.
 */

// Leaflet's default marker icon paths break under bundlers; point them at the
// CDN copies explicitly so the pin renders.
const markerIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface LatLng {
  lat: number;
  lng: number;
}

/** Pan/zoom the map whenever the selected coordinate changes from outside (detect / search). */
function Recenter({ lat, lng }: LatLng) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], Math.max(map.getZoom(), 15));
  }, [lat, lng, map]);
  return null;
}

/** Clicking anywhere on the map drops the pin there. */
function ClickHandler({ onPick }: { onPick: (p: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

export default function LocationMap({
  lat,
  lng,
  onPick,
}: {
  lat: number;
  lng: number;
  onPick: (p: LatLng) => void;
}) {
  const markerRef = useRef<L.Marker>(null);

  const dragHandlers = useMemo(
    () => ({
      dragend() {
        const m = markerRef.current;
        if (m) {
          const p = m.getLatLng();
          onPick({ lat: p.lat, lng: p.lng });
        }
      },
    }),
    [onPick],
  );

  return (
    <MapContainer
      center={[lat, lng]}
      zoom={15}
      scrollWheelZoom
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker
        draggable
        eventHandlers={dragHandlers}
        position={[lat, lng]}
        ref={markerRef}
        icon={markerIcon}
      />
      <Recenter lat={lat} lng={lng} />
      <ClickHandler onPick={onPick} />
    </MapContainer>
  );
}
