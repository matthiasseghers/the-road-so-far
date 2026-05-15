// Modal for configuring and downloading a PDF itinerary export.
// Shows an "Include map" toggle that is disabled when no TomTom API key is set.

import { useState, useEffect } from 'react';
import { FileDown, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogBody,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { generateTripPDF } from '@/lib/export/pdf/pdf';
import type { PdfLayout } from '@/lib/export/pdf/layouts';
import type { StaticMapData } from '@/lib/export/pdf/helpers';
import { DefaultLayout } from '@/lib/export/pdf/layouts/default';
import { MinimalLayout } from '@/lib/export/pdf/layouts/minimal';
import { api, getCoverBase64 } from '@/db/api-client';
import type { TripWithDays } from '@/types/domain';
import type { Reservation } from '@/domain/Reservation';
import type { RouteLegRow } from '@/types/db';
import { formatDuration, formatDistance } from '@/utils/format';
import { usePreferences } from '@/hooks/usePreferences';
import type { DayLegSummary } from '@/lib/export/pdf/pdf.viewmodel';
import { RESERVATION_SORT_OFFSET } from '@/utils/sort';

interface PdfExportModalProps {
  open:         boolean;
  onClose:      () => void;
  trip:         TripWithDays;
  reservations: Reservation[];
  safeFilename: (title: string) => string;
}

interface SettingsResponse {
  has_tomtom_api_key: boolean;
}

interface GeoPointCounts {
  totalPoints:    number;
  geocodedPoints: number;
}

// ─────────────────────────────────────────────────────────────────────────────

type GeoPoint = { lat: number; lng: number; sort_order: number; name: string; location: string | null };

function findLegByCoords(legs: RouteLegRow[], fromLat: number, fromLng: number, toLat: number, toLng: number): RouteLegRow | null {
  return legs.find(l =>
    Math.abs(l.from_lat - fromLat) < 1e-5 &&
    Math.abs(l.from_lng - fromLng) < 1e-5 &&
    Math.abs(l.to_lat   - toLat)   < 1e-5 &&
    Math.abs(l.to_lng   - toLng)   < 1e-5,
  ) ?? null;
}

const LAYOUT_OPTIONS: PdfLayout[] = [DefaultLayout, MinimalLayout];

export default function PdfExportModal({
  open,
  onClose,
  trip,
  reservations,
  safeFilename,
}: PdfExportModalProps): JSX.Element {
  const { distanceUnit } = usePreferences();
  const [hasApiKey,              setHasApiKey]              = useState<boolean | null>(null);
  const [geoCounts,              setGeoCounts]              = useState<GeoPointCounts | null>(null);
  const [includeMap,             setIncludeMap]             = useState(false);
  const [includeTravelSummary,   setIncludeTravelSummary]   = useState(true);
  const [includeBookings,        setIncludeBookings]        = useState(true);
  const [routeLegs,              setRouteLegs]              = useState<RouteLegRow[]>([]);
  const [exporting,              setExporting]              = useState(false);
  const [selectedLayout,         setSelectedLayout]         = useState<PdfLayout>(DefaultLayout);
  const [coverDataUrl,           setCoverDataUrl]           = useState<string | undefined>(undefined);

  // Reason: fetch API key status, geo counts, and route legs each time the modal
  // opens so toggles reflect any changes made in Settings without remounting.
  /* eslint-disable react-hooks/set-state-in-effect -- reset state when modal opens */
  useEffect(() => {
    if (!open) return;
    setHasApiKey(null);
    setGeoCounts(null);
    setRouteLegs([]);
    setCoverDataUrl(undefined);
    Promise.all([
      api.get<SettingsResponse>('/settings'),
      api.get<GeoPointCounts>(`/trips/${trip.id}/geo-point-counts`),
      api.get<{ legs: RouteLegRow[] }>(`/trips/${trip.id}/route-legs`),
    ]).then(([settings, counts, legsRes]) => {
      setHasApiKey(settings.has_tomtom_api_key);
      setIncludeMap(settings.has_tomtom_api_key && counts.geocodedPoints > 0);
      setGeoCounts(counts);
      setRouteLegs(legsRes.legs);
    }).catch(() => {
      setHasApiKey(false);
      setIncludeMap(false);
    });

    // Prefetch cover photo base64 if this trip has a photo cover.
    if (trip.cover_type === 'photo' && trip.cover_image_path) {
      getCoverBase64(trip.cover_image_path)
        .then(r => setCoverDataUrl(r.dataUrl))
        .catch(() => setCoverDataUrl(undefined));
    }
  }, [open, trip.id, trip.cover_type, trip.cover_image_path]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Reason: build an ordered list of legs for each day by following the geocoded
  // points in sort_order sequence (intra-day pairs, then the departing inter-day
  // leg). This matches computeExpectedLegs in route-legs.repo.ts exactly.
  function computeDayLegSummaries(distUnit: 'km' | 'mi'): Record<number, DayLegSummary> {
    const summaries: Record<number, DayLegSummary> = {};
    const days = trip.days ?? [];

    function getOrderedPoints(day: typeof days[number]): GeoPoint[] {
      return [
        ...day.activities
          .filter(a => a.isGeocoded())
          .map(a => ({ lat: a.lat!, lng: a.lng!, sort_order: a.sort_order, name: a.title, location: a.location ?? null })),
        ...reservations
          .filter(r => r.day_id === day.id && !r.isLodging() && r.lat != null && r.lng != null)
          .map(r => ({ lat: r.lat!, lng: r.lng!, sort_order: r.sort_order + RESERVATION_SORT_OFFSET, name: r.title, location: r.location ?? null })),
      ].sort((a, b) => a.sort_order - b.sort_order);
    }

    for (let dayIdx = 0; dayIdx < days.length; dayIdx++) {
      const day  = days[dayIdx];
      const pts  = getOrderedPoints(day);
      if (pts.length === 0) continue;

      // Intra-day legs: consecutive geocoded points within the same day
      const orderedLegs: Array<{ row: RouteLegRow; from: string; to: string; fromLocation: string | null; toLocation: string | null }> = [];

      for (let i = 0; i < pts.length - 1; i++) {
        const leg = findLegByCoords(routeLegs, pts[i].lat, pts[i].lng, pts[i + 1].lat, pts[i + 1].lng);
        if (leg) orderedLegs.push({ row: leg, from: pts[i].name, to: pts[i + 1].name, fromLocation: pts[i].location, toLocation: pts[i + 1].location });
      }

      // Departing inter-day leg: last point of this day > first point of next day
      const nextDay = days[dayIdx + 1];
      if (nextDay) {
        const nextPts = getOrderedPoints(nextDay);
        if (nextPts.length > 0) {
          const last  = pts[pts.length - 1];
          const first = nextPts[0];
          const leg   = findLegByCoords(routeLegs, last.lat, last.lng, first.lat, first.lng);
          if (leg) orderedLegs.push({ row: leg, from: last.name, to: first.name, fromLocation: last.location, toLocation: first.location });
        }
      }

      if (orderedLegs.length === 0) continue;

      summaries[day.id] = {
        legs: orderedLegs.map(l => ({
          mode:         l.row.travel_mode,
          duration:     formatDuration(l.row.duration_s),
          distance:     formatDistance(l.row.distance_m, distUnit),
          from:         l.from,
          to:           l.to,
          fromLocation: l.fromLocation,
          toLocation:   l.toLocation,
        })),
        totalDuration: formatDuration(orderedLegs.reduce((s, l) => s + l.row.duration_s, 0)),
        totalDistance: formatDistance(orderedLegs.reduce((s, l) => s + l.row.distance_m, 0), distUnit),
      };
    }

    return summaries;
  }

  async function handleExport(): Promise<void> {
    setExporting(true);
    try {
      let staticMap: StaticMapData | undefined;
      let dayStaticMaps: Record<number, StaticMapData> | undefined;

      if (includeMap) {
        // Reason: all map images must be pre-fetched before react-pdf renders because
        // react-pdf cannot perform async operations during document rendering.
        // Cover: 800×200 wide banner; day maps: 400×200 square-ish for right column.
        // Points are computed client-side from trip data (same source as the Map tab)
        // and used to overlay Mercator-projected SVG pins on the static raster image.
        type MapResponse = { dataUrl: string | null; mapParams: { centerLat: number; centerLng: number; zoom: number; imgW: number; imgH: number } | null };
        const days = trip.days ?? [];

        // Cover geo points: all geocoded activities + reservations across the trip.
        const coverPoints = [
          ...days.flatMap(d => d.activities)
            .filter(a => a.isGeocoded())
            .map(a => ({ lat: a.lat!, lng: a.lng! })),
          ...reservations
            .filter(r => r.lat != null && r.lng != null)
            .map(r => ({ lat: r.lat!, lng: r.lng! })),
        ];

// Reason: Minimal layout is single-column full-width; Default uses a 40% right column.
          // Request wider maps for layouts that need more horizontal space.
          const dayMapW = selectedLayout.meta.id === 'default' ? 400 : 800;
          const [coverRes, dayResponses] = await Promise.all([
            api.get<MapResponse>(`/trips/${trip.id}/static-map-image?w=800&h=200`),
            Promise.all(days.map(day =>
              api.get<MapResponse>(
                `/trips/${trip.id}/static-map-image?dayId=${day.id}&w=${dayMapW}&h=200`,
            ),
          )),
        ]);

        if (coverRes.dataUrl && coverRes.mapParams) {
          staticMap = { dataUrl: coverRes.dataUrl, meta: coverRes.mapParams, points: coverPoints };
        }

        const maps: Record<number, StaticMapData> = {};
        days.forEach((day, i) => {
          const r = dayResponses[i];
          if (!r?.dataUrl || !r.mapParams) return;
          // Day geo points: activities of this day + non-lodging reservations of this day.
          const dayPoints = [
            ...day.activities
              .filter(a => a.isGeocoded())
              .map(a => ({ lat: a.lat!, lng: a.lng! })),
            ...reservations
              .filter(res => res.day_id === day.id && !res.isLodging() && res.lat != null && res.lng != null)
              .map(res => ({ lat: res.lat!, lng: res.lng! })),
          ];
          maps[day.id] = { dataUrl: r.dataUrl, meta: r.mapParams, points: dayPoints };
        });
        dayStaticMaps = maps;
      }

      const dayLegSummaries = includeTravelSummary && routeLegs.length > 0
        ? computeDayLegSummaries(distanceUnit)
        : undefined;

      const blob     = await generateTripPDF(trip, reservations, { layout: selectedLayout, staticMap, dayStaticMaps, dayLegSummaries, includeBookings, coverImageDataUrl: coverDataUrl, coverImageAttribution: trip.cover_image_attribution ?? undefined });
      const filename = `${safeFilename(trip.title)}-itinerary.pdf`;
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('PDF exported');
      onClose();
    } catch {
      toast.error('Failed to generate PDF');
    } finally {
      setExporting(false);
    }
  }

  const partiallyGeocoded = geoCounts !== null
    && geoCounts.totalPoints > 0
    && geoCounts.geocodedPoints < geoCounts.totalPoints;

  const hasRouteLegs = routeLegs.length > 0;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent style={{ maxWidth: 400 }}>
        <DialogHeader>
          <DialogTitle>Export PDF</DialogTitle>
        </DialogHeader>

        <DialogBody>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 0' }}>
          {/* Layout selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Label>Layout</Label>
            {LAYOUT_OPTIONS.map(layout => (
              <button
                key={layout.meta.id}
                type="button"
                onClick={() => setSelectedLayout(layout)}
                style={{
                  padding: '10px 12px', borderRadius: 6, textAlign: 'left', cursor: 'pointer',
                  border: `1.5px solid ${selectedLayout.meta.id === layout.meta.id ? 'var(--primary)' : 'var(--border)'}`,
                  background: selectedLayout.meta.id === layout.meta.id ? 'var(--primary-foreground)' : 'transparent',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 13 }}>{layout.meta.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{layout.meta.description}</div>
              </button>
            ))}
          </div>
          {/* Map toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <Label
              htmlFor="pdf-include-map"
              style={{ opacity: hasApiKey === false ? 0.45 : 1, cursor: hasApiKey === false ? 'not-allowed' : 'pointer' }}
            >
              Include route map
            </Label>
            <Switch
              id="pdf-include-map"
              checked={includeMap}
              onCheckedChange={setIncludeMap}
              disabled={!hasApiKey}
            />
          </div>

          {/* Travel summary toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <Label
              htmlFor="pdf-include-travel"
              style={{ opacity: !hasRouteLegs ? 0.45 : 1, cursor: !hasRouteLegs ? 'not-allowed' : 'pointer' }}
            >
              Include travel summary
            </Label>
            <Switch
              id="pdf-include-travel"
              checked={includeTravelSummary}
              onCheckedChange={setIncludeTravelSummary}
              disabled={!hasRouteLegs}
            />
          </div>

          {/* Bookings toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <Label htmlFor="pdf-include-bookings">
              Include booking details
            </Label>
            <Switch
              id="pdf-include-bookings"
              checked={includeBookings}
              onCheckedChange={setIncludeBookings}
            />
          </div>

          {/* No API key warning */}
          {hasApiKey === false && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              padding: '10px 12px', borderRadius: 6,
              background: 'var(--bg-raised)', border: '1px solid var(--border)',
            }}>
              <AlertCircle size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                No TomTom API key configured. Add one in{' '}
                <strong style={{ color: 'var(--text-primary)' }}>Settings → General</strong>
                {' '}to include a real map in your export.
              </span>
            </div>
          )}

          {/* Partial geocoding warning — only shown when map toggle is on and some locations are missing */}
          {includeMap && partiallyGeocoded && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              padding: '10px 12px', borderRadius: 6,
              background: 'var(--bg-raised)', border: '1px solid var(--border)',
            }}>
              <AlertCircle size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {geoCounts.geocodedPoints} of {geoCounts.totalPoints} activities and reservations have a location.
                {' '}The map will only show geocoded entries.
              </span>
            </div>
          )}
        </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={exporting}>
            Cancel
          </Button>
          <Button onClick={() => { void handleExport(); }} disabled={exporting || hasApiKey === null}>
            <FileDown size={14} />
            {exporting ? 'Exporting\u2026' : 'Export PDF'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
