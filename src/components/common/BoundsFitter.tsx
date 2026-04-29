import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

interface BoundsFitterProps {
  positions: [number, number][];
  maxZoom: number;
}

// Reason: react-leaflet hook component — must be rendered inside a MapContainer.
// maxZoom differs between trip map (15, single-trip) and global map (10, world overview).
export default function BoundsFitter({ positions, maxZoom }: BoundsFitterProps): null {
  const map = useMap();
  useEffect(() => {
    if (positions.length === 0) return;
    map.fitBounds(L.latLngBounds(positions), { padding: [48, 48], maxZoom });
  // Reason: stringify so the effect only re-runs when coordinates actually change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, JSON.stringify(positions), maxZoom]);
  return null;
}
