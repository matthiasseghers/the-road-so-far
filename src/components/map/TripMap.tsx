import { useState, useEffect, useMemo } from 'react';
import { MapPin as MapPinIcon } from 'lucide-react';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './TripMap.css';
import type { MapPin, MapDay } from './mapDataUtils';
import { TYPE_COLORS, TYPE_LABELS, resolveTypeColors } from './mapDataUtils';

// ── Leaflet default marker icon fix ──────────────────────────────────────────
// Reason: Vite/webpack removes _getIconUrl; mergeOptions re-points to bundled assets.
import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png';

(L.Icon.Default.prototype as unknown as Record<string, unknown>)['_getIconUrl'] = undefined;
L.Icon.Default.mergeOptions({ iconUrl: markerIconUrl, shadowUrl: markerShadowUrl });

// Re-export types so consumers import from one place.
export type { MapPin, MapDay };

// ── SVG icon strings for each pin type ───────────────────────────────────────
// Reason: DivIcon takes HTML strings; inline SVG avoids react-dom/server dependency.

const PIN_ICONS: Record<MapPin['type'], string> = {
  activity:   `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>`,
  lodging:    `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"/><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/><path d="M2 18h20"/></svg>`,
  flight:     `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21 4 19 2c-2-2-4-2-5.5-.5L10 5 1.8 6.2a1 1 0 0 0-.7 1.4l.9 1.9L5 10v5l2 2h5l1 3.1a1 1 0 0 0 1.4.7l1.9-.9"/></svg>`,
  transit:    `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="13" rx="2"/><line x1="4" y1="11" x2="20" y2="11"/><line x1="8" y1="3" x2="8" y2="11"/><line x1="16" y1="3" x2="16" y2="11"/><path d="M7 20l2-4m8 4-2-4"/></svg>`,
  car:        `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h10l2 5H5l2-5z"/><rect x="2" y="12" width="20" height="5" rx="1"/><circle cx="7" cy="18" r="1.5"/><circle cx="17" cy="18" r="1.5"/></svg>`,
  restaurant: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="2" x2="8" y2="22"/><path d="M5 2v5a3 3 0 0 0 6 0V2"/><line x1="17" y1="2" x2="17" y2="22"/></svg>`,
};

function pinIcon(type: MapPin['type'], color: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div class="trip-map__pin" style="background:${color}">${PIN_ICONS[type]}<div class="trip-map__pin-stem"></div></div>`,
    iconSize:    [22, 30],
    iconAnchor:  [11, 30],
    popupAnchor: [0, -32],
  });
}

// ── BoundsFitter — fit map to visible pins on change ─────────────────────────

function BoundsFitter({ positions }: { positions: [number, number][] }): null {
  const map = useMap();
  useEffect(() => {
    if (positions.length === 0) return;
    map.fitBounds(L.latLngBounds(positions), { padding: [48, 48], maxZoom: 15 });
  // Reason: stringify so the effect only re-runs when coordinates actually change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, JSON.stringify(positions)]);
  return null;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface TripMapProps {
  pins: MapPin[];
  mapDays: MapDay[];
  lodgingRoute: { lat: number; lng: number }[];
  missingCount?: number;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TripMap({ pins, mapDays, lodgingRoute, missingCount = 0 }: TripMapProps): JSX.Element {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const visiblePins = useMemo(
    () => selectedDay === null ? pins : pins.filter(p => p.dayNumber === selectedDay),
    [pins, selectedDay],
  );

  // Reason: read computed CSS vars here (not in mapDataUtils) so colors update
  // after a theme switch, which triggers a re-render of this component.
  const colors = resolveTypeColors();

  const positions: [number, number][] = visiblePins.map(p => [p.lat, p.lng]);
  const showPolyline = selectedDay === null && lodgingRoute.length > 1;

  // Types present in visible pins (for legend)
  const presentTypes = useMemo(
    () => [...new Set(visiblePins.map(p => p.type))],
    [visiblePins],
  );

  if (pins.length === 0) {
    return (
      <div className="trip-map">
        <Empty className="py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon"><MapPinIcon /></EmptyMedia>
            <EmptyTitle>No locations on the map</EmptyTitle>
            <EmptyDescription>Add a location to an activity or reservation to see it pinned here.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div className="trip-map">
      {/* ── Toolbar ── */}
      <div className="trip-map__toolbar">
        <span className="trip-map__toolbar-label">Showing</span>
        <Select
          value={selectedDay !== null ? String(selectedDay) : 'all'}
          onValueChange={v => setSelectedDay(v === 'all' ? null : Number(v))}
        >
          <SelectTrigger className="w-48 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          {/* Reason: Leaflet controls sit at z-index 1000; must exceed that so the
              dropdown isn't clipped behind the map canvas. */}
          <SelectContent className="z-[1100]">
            <SelectItem value="all">All days</SelectItem>
            {mapDays.map(d => (
              <SelectItem key={d.dayNumber} value={String(d.dayNumber)}>
                Day {d.dayNumber} · {d.title} ({d.pinCount} pin{d.pinCount !== 1 ? 's' : ''})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {missingCount > 0 && (
          <span className="trip-map__missing">
            {missingCount} day{missingCount !== 1 ? 's' : ''} missing locations
          </span>
        )}
      </div>

      {/* ── Map ── */}
      <div className="trip-map__container">
        <MapContainer
          center={[20, 0]}
          zoom={2}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <BoundsFitter positions={positions} />

          {visiblePins.map(pin => (
            <Marker
              key={pin.id}
              position={[pin.lat, pin.lng]}
              icon={pinIcon(pin.type, colors[pin.type] ?? pin.color)}
            >
              <Popup>
                <div className="trip-map__popup">
                  <span
                    className="trip-map__popup-badge"
                    style={{ background: colors[pin.type] ?? pin.color }}
                  >
                    {TYPE_LABELS[pin.type]}
                  </span>
                  <div className="trip-map__popup-name">{pin.name}</div>
                  {pin.meta && <div className="trip-map__popup-meta">{pin.meta}</div>}
                  <div className="trip-map__popup-day">Day {pin.dayNumber} · {pin.dayDate}</div>
                </div>
              </Popup>
            </Marker>
          ))}

          {showPolyline && (
            <Polyline
              positions={lodgingRoute.map(p => [p.lat, p.lng] as [number, number])}
              pathOptions={{ color: colors.restaurant, weight: 2, opacity: 0.8, dashArray: '6 4' }}
            />
          )}
        </MapContainer>

        {/* ── Legend ── */}
        {presentTypes.length > 0 && (
          <div className="trip-map__legend">
            {presentTypes.map(type => (
              <div key={type} className="trip-map__legend-row">
                <span className="trip-map__legend-dot" style={{ background: colors[type] ?? TYPE_COLORS[type] }} />
                <span>{TYPE_LABELS[type]}</span>
              </div>
            ))}
            {showPolyline && (
              <div className="trip-map__legend-row">
                <svg width="20" height="4" className="trip-map__legend-line">
                  <line x1="0" y1="2" x2="20" y2="2" stroke={colors.restaurant} strokeWidth="2" strokeDasharray="4 3" />
                </svg>
                <span>Lodging route</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
