import { useState, useMemo } from 'react';
import { MapPin as MapPinIcon, Route, Loader2, AlertTriangle } from 'lucide-react';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './TripMap.css';
import type { MapPin, MapDay } from '@/utils/mapData';
import { TYPE_COLORS, TYPE_LABELS, resolveTypeColors } from '@/utils/mapData';
import type { RouteLeg } from '@/domain/RouteLeg';
import type { ExpectedLeg } from '@/db/repositories/route-legs.repo';
import { createPinIcon } from '@/lib/leafletMapUtils';
import BoundsFitter from '@/components/common/BoundsFitter';
import { patchLeafletDefaultIcon } from '@/lib/leafletIconFix';
patchLeafletDefaultIcon();

// Re-export types so consumers import from one place.
export type { MapPin, MapDay };

// ── Props ─────────────────────────────────────────────────────────────────────

interface TripMapProps {
  pins:          MapPin[];
  mapDays:       MapDay[];
  routeLegs?:    RouteLeg[];
  expectedLegs?: ExpectedLeg[];
  isStale?:      boolean;
  missingCount?: number;
  isSyncing?:    boolean;
  onSyncRoutes?: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function TripMap({ pins, mapDays, routeLegs = [], expectedLegs = [], isStale = false, missingCount = 0, isSyncing = false, onSyncRoutes }: TripMapProps): JSX.Element {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const visiblePins = useMemo(
    () => selectedDay === null ? pins : pins.filter(p => p.dayNumber === selectedDay),
    [pins, selectedDay],
  );

  // Reason: read computed CSS vars here (not in mapDataUtils) so colors update
  // after a theme switch, which triggers a re-render of this component.
  const colors = resolveTypeColors();

  const positions: [number, number][] = visiblePins.map(p => [p.lat, p.lng]);
  // Reason: build a lookup from coord-pair key → stored RouteLeg so expected
  // legs can find their polyline in O(1). Dedup by latest fetched_at when
  // multiple travel modes exist for the same pair.
  const legByKey = useMemo(() => {
    const best = new Map<string, RouteLeg>();
    for (const leg of routeLegs) {
      const key = `${leg.from_lat},${leg.from_lng},${leg.to_lat},${leg.to_lng}`;
      const prev = best.get(key);
      if (!prev || leg.fetched_at > prev.fetched_at) best.set(key, leg);
    }
    return best;
  }, [routeLegs]);

  // Reason: drive rendering from expectedLegs (ground truth) not stored legs.
  // Each expected leg is either:
  //   - synced:   has a stored polyline → draw solid road route
  //   - unsynced: not yet fetched       → draw dashed straight line
  // Only show legs whose both endpoints are among currently visible pins.
  const pinCoords = useMemo(
    () => new Set(visiblePins.map(p => `${p.lat},${p.lng}`)),
    [visiblePins],
  );

  const { syncedLegs, unsyncedLegs } = useMemo(() => {
    const synced:   { leg: RouteLeg;    from: [number,number]; to: [number,number] }[] = [];
    const unsynced: { from: [number,number]; to: [number,number] }[]                  = [];

    for (const el of expectedLegs) {
      const fromVisible = pinCoords.has(`${el.from_lat},${el.from_lng}`);
      const toVisible   = pinCoords.has(`${el.to_lat},${el.to_lng}`);
      if (!fromVisible || !toVisible) continue;

      const key = `${el.from_lat},${el.from_lng},${el.to_lat},${el.to_lng}`;
      const stored = legByKey.get(key);
      if (stored) {
        synced.push({ leg: stored, from: [el.from_lat, el.from_lng], to: [el.to_lat, el.to_lng] });
      } else {
        unsynced.push({ from: [el.from_lat, el.from_lng], to: [el.to_lat, el.to_lng] });
      }
    }
    return { syncedLegs: synced, unsyncedLegs: unsynced };
  }, [expectedLegs, legByKey, pinCoords]);

  const hasExpectedLegs = expectedLegs.length > 0;
  // Reason: fall back to a simple pin-order dashed line only when there are no
  // expected legs at all (trip has no geo points synced yet).
  const showFallbackPolyline = visiblePins.length > 1 && !hasExpectedLegs;

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
        {onSyncRoutes && (
          <Button
            variant={isStale ? 'default' : 'outline'}
            size="sm"
            className="ml-auto h-7 text-xs"
            onClick={onSyncRoutes}
            disabled={isSyncing}
          >
            {isSyncing
              ? <Loader2 size={12} className="animate-spin" />
              : isStale
                ? <AlertTriangle size={12} />
                : <Route size={12} />}
            {isSyncing ? 'Syncing…' : isStale ? 'Routes outdated — sync' : 'Sync routes'}
          </Button>
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
          <BoundsFitter positions={positions} maxZoom={15} />

          {visiblePins.map(pin => (
            <Marker
              key={pin.id}
              position={[pin.lat, pin.lng]}
              icon={createPinIcon(pin.type, colors[pin.type] ?? pin.color)}
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

          {/* Fallback: no geo points at all — connect pins in display order */}
          {showFallbackPolyline && (
            <Polyline
              positions={visiblePins.map(p => [p.lat, p.lng] as [number, number])}
              pathOptions={{ color: '#7C3AED', weight: 2, opacity: 0.6, dashArray: '6 5' }}
            />
          )}

          {/* Unsynced expected legs — dashed straight line (not yet fetched from TomTom) */}
          {unsyncedLegs.map((el, i) => (
            <Polyline
              key={`u-${i}`}
              positions={[el.from, el.to]}
              pathOptions={{ color: '#7C3AED', weight: 2, opacity: 0.55, dashArray: '6 5' }}
            />
          ))}

          {/* Synced expected legs — solid TomTom road polyline */}
          {syncedLegs.map((sl, i) => (
            <Polyline
              key={`s-${i}`}
              positions={sl.leg.points().map(p => [p.lat, p.lng] as [number, number])}
              pathOptions={{ color: '#7C3AED', weight: 4, opacity: 0.85 }}
            />
          ))}
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
            {(showFallbackPolyline || unsyncedLegs.length > 0) && (
              <div className="trip-map__legend-row">
                <svg width="20" height="4" className="trip-map__legend-line">
                  <line x1="0" y1="2" x2="20" y2="2" stroke={colors.restaurant} strokeWidth="2" strokeDasharray="4 3" />
                </svg>
                <span>Route not yet synced</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
