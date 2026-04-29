import { useState, useEffect, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin as MapPinIcon } from 'lucide-react';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { api } from '@/db/api-client';
import { TYPE_LABELS, reservationPinType } from '@/utils/mapData';
import type { PinType } from '@/utils/mapData';
import { formatTripDateRange } from '@/utils/format';
import { createPinIcon } from '@/lib/leafletMapUtils';
import BoundsFitter from '@/components/common/BoundsFitter';
import { patchLeafletDefaultIcon } from '@/lib/leafletIconFix';
patchLeafletDefaultIcon();

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
            <BoundsFitter positions={positions} maxZoom={10} />
            {visiblePins.map(pin => {
              const tripColor = tripColorMap.get(pin.tripId) ?? TRIP_PALETTE[0];
              return (
                <Marker
                  key={pin.id}
                  position={[pin.lat, pin.lng]}
                  icon={createPinIcon(pin.type, tripColor)}
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
