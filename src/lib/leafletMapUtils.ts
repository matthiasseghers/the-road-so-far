import L from 'leaflet';
import type { PinType } from '@/utils/mapData';
import { PIN_ICONS } from '@/utils/mapData';

// Reason: createPinIcon lives here (not mapData.ts) because it imports Leaflet,
// which would break node-environment tests that import mapData.ts for buildMapData etc.
export function createPinIcon(type: PinType, color: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div class="trip-map__pin" style="background:${color}">${PIN_ICONS[type]}<div class="trip-map__pin-stem"></div></div>`,
    iconSize:    [22, 30],
    iconAnchor:  [11, 30],
    popupAnchor: [0, -32],
  });
}
