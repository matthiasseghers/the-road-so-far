import { useState, useEffect, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin as MapPinIcon } from 'lucide-react';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { api } from '@/db/api-client';
import { TYPE_LABELS } from '@/components/map/mapDataUtils';
import type { PinType } from '@/components/map/mapDataUtils';

// ── Trip colour palette ───────────────────────────────────────────────────────
// Reason: global map colours by trip so users can answer "which trip?" at a glance.
// 8 visually distinct hues; cycles after that. Stays readable on OSM tile base.

const TRIP_PALETTE = [
  '#E07B54', // terracotta
  '#5B9BD5', // blue
  '#6DC178', // sage green
  '#C97DC8', // lavender
  '#D4A83A', // amber
  '#5BB8C8', // teal
  '#E06680', // rose
  '#8B7DD8', // purple
];

function buildTripColorMap(tripIds: number[]): Map<number, string> {
  const map = new Map<number, string>();
  tripIds.forEach((id, i) => map.set(id, TRIP_PALETTE[i % TRIP_PALETTE.length]));
  return map;
}

// ── Leaflet icon fix (same as TripMap) ────────────────────────────────────────
import markerIconUrl  from 'leaflet/dist/images/marker-icon.png';
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png';

(L.Icon.Default.prototype as unknown as Record<string, unknown>)['_getIconUrl'] = undefined;
L.Icon.Default.mergeOptions({ iconUrl: markerIconUrl, shadowUrl: markerShadowUrl });

// ── Types ─────────────────────────────────────────────────────────────────────

interface ApiTrip {
  id: number;
  title: string;
  start_date: string | null;
  end_date: string | null;
}

interface GlobalPin {
  id: string;
  type: PinType;
  name: string;
  tripTitle: string;
  tripId: number;
  dayDate: string | null;
  lat: number;
  lng: number;
}

interface ApiResponse {
  trips:        ApiTrip[];
  activities:   Array<{ id: number; title: string; start_time: string | null; lat: number; lng: number; trip_id: number; trip_title: string; day_date: string }>;
  reservations: Array<{ id: number; title: string; type: string; lat: number; lng: number; trip_id: number; trip_title: string; day_date: string | null }>;
}

// ── SVG pin icons (reused from TripMap) ───────────────────────────────────────

const PIN_ICONS: Record<PinType, string> = {
  activity:   `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>`,
  lodging:    `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"/><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/><path d="M2 18h20"/></svg>`,
  flight:     `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21 4 19 2c-2-2-4-2-5.5-.5L10 5 1.8 6.2a1 1 0 0 0-.7 1.4l.9 1.9L5 10v5l2 2h5l1 3.1a1 1 0 0 0 1.4.7l1.9-.9"/></svg>`,
  transit:    `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="13" rx="2"/><line x1="4" y1="11" x2="20" y2="11"/><line x1="8" y1="3" x2="8" y2="11"/><line x1="16" y1="3" x2="16" y2="11"/><path d="M7 20l2-4m8 4-2-4"/></svg>`,
  car:        `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h10l2 5H5l2-5z"/><rect x="2" y="12" width="20" height="5" rx="1"/><circle cx="7" cy="18" r="1.5"/><circle cx="17" cy="18" r="1.5"/></svg>`,
  restaurant: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="2" x2="8" y2="22"/><path d="M5 2v5a3 3 0 0 0 6 0V2"/><line x1="17" y1="2" x2="17" y2="22"/></svg>`,
};

function pinIcon(type: PinType, color: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div class="trip-map__pin" style="background:${color}">${PIN_ICONS[type]}<div class="trip-map__pin-stem"></div></div>`,
    iconSize:    [22, 30],
    iconAnchor:  [11, 30],
    popupAnchor: [0, -32],
  });
}

// ── BoundsFitter ──────────────────────────────────────────────────────────────

function BoundsFitter({ positions }: { positions: [number, number][] }): null {
  const map = useMap();
  useEffect(() => {
    if (positions.length === 0) return;
    map.fitBounds(L.latLngBounds(positions), { padding: [48, 48], maxZoom: 10 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, JSON.stringify(positions)]);
  return null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function reservationPinType(type: string): PinType {
  switch (type) {
    case 'train': case 'bus': case 'ferry': return 'transit';
    case 'rental_car':  return 'car';
    case 'flight':      return 'flight';
    case 'lodging':     return 'lodging';
    case 'restaurant':  return 'restaurant';
    default:            return 'activity';
  }
}

// Reason: Intl avoids importing date-fns just for legend display.
function formatTripDateRange(start: string | null, end: string | null): string | null {
  if (!start) return null;
  const parse = (d: string) => new Date(d + 'T00:00:00');
  const s = parse(start);
  const short = (d: Date) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(d);
  const long  = (d: Date) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
  if (!end) return long(s);
  const e = parse(end);
  return s.getFullYear() === e.getFullYear()
    ? `${short(s)} – ${long(e)}`
    : `${long(s)} – ${long(e)}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MapPage(): JSX.Element {
  const [pins, setPins]       = useState<GlobalPin[]>([]);
  const [trips, setTrips]     = useState<ApiTrip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hiddenTripIds, setHiddenTripIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    api.get<ApiResponse>('/map/pins')
      .then(data => {
        const actPins: GlobalPin[] = data.activities.map(a => ({
          id:         `activity-${a.id}`,
          type:       'activity',
          name:       a.title,
          tripTitle:  a.trip_title,
          tripId:     a.trip_id,
          dayDate:    a.day_date,
          lat:        a.lat,
          lng:        a.lng,
        }));
        const resPins: GlobalPin[] = data.reservations.map(r => ({
          id:         `reservation-${r.id}`,
          type:       reservationPinType(r.type),
          name:       r.title,
          tripTitle:  r.trip_title,
          tripId:     r.trip_id,
          dayDate:    r.day_date,
          lat:        r.lat,
          lng:        r.lng,
        }));
        setPins([...actPins, ...resPins]);
        setTrips(data.trips);
        setIsLoading(false);
      })
      .catch(() => { setIsLoading(false); });
  }, []);

  const tripColorMap = useMemo(() => buildTripColorMap(trips.map(t => t.id)), [trips]);
  // Reason: filter before passing to BoundsFitter so re-fitting respects hidden trips.
  const visiblePins  = useMemo(() => pins.filter(p => !hiddenTripIds.has(p.tripId)), [pins, hiddenTripIds]);
  const positions    = useMemo<[number, number][]>(() => visiblePins.map(p => [p.lat, p.lng]), [visiblePins]);

  const toggleTrip = useCallback((id: number) => {
    setHiddenTripIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {isLoading && (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Loading…</div>
      )}

      {!isLoading && pins.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <Empty className="py-16">
            <EmptyHeader>
              <EmptyMedia variant="icon"><MapPinIcon /></EmptyMedia>
              <EmptyTitle>No locations yet</EmptyTitle>
              <EmptyDescription>Add a location to an activity or reservation inside a trip to see it here.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      )}

      {!isLoading && pins.length > 0 && (
        <div className="flex-1 relative overflow-hidden">
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
            {visiblePins.map(pin => {
              const tripColor = tripColorMap.get(pin.tripId) ?? TRIP_PALETTE[0];
              return (
                <Marker
                  key={pin.id}
                  position={[pin.lat, pin.lng]}
                  icon={pinIcon(pin.type, tripColor)}
                >
                  <Popup>
                    <div className="trip-map__popup">
                      {/* Type label — small text, muted; trip colour gives context */}
                      <div className="trip-map__popup-day">{TYPE_LABELS[pin.type]}</div>
                      <div className="trip-map__popup-name">{pin.name}</div>
                      {/* Trip title with a colour dot matching the pin */}
                      <div className="trip-map__popup-meta" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: tripColor, flexShrink: 0, display: 'inline-block' }} />
                        {pin.tripTitle}
                      </div>
                      {pin.dayDate && <div className="trip-map__popup-day">{pin.dayDate}</div>}
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>

          {trips.length > 0 && (
            // Reason: pointer-events: none on .trip-map__legend; override here so clicks register.
            <div className="trip-map__legend" style={{ pointerEvents: 'auto' }}>
              {trips.map(trip => {
                const hidden  = hiddenTripIds.has(trip.id);
                const color   = tripColorMap.get(trip.id);
                const range   = formatTripDateRange(trip.start_date, trip.end_date);
                return (
                  <button
                    key={trip.id}
                    className={`trip-map__legend-btn${hidden ? ' trip-map__legend-btn--hidden' : ''}`}
                    onClick={() => toggleTrip(trip.id)}
                    aria-pressed={!hidden}
                    title={hidden ? 'Show trip' : 'Hide trip'}
                  >
                    <span className="trip-map__legend-dot" style={{ background: color, marginTop: 3, flexShrink: 0 }} />
                    <span>
                      <div>{trip.title}</div>
                      {range && <div className="trip-map__legend-range">{range}</div>}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
