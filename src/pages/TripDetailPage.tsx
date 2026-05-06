// TripDetailPage — Phase 4 rebuild.
// Own topbar, compact hero, five-tab bar, itinerary with reservations.

import React, { useState, useCallback, useMemo, useEffect, useRef, Suspense, lazy } from 'react';
import { toast } from 'sonner';
import { Pencil, Trash2, GripVertical, BedDouble, AlertTriangle, Plus, LayoutGrid, FileText, CalendarDays, CheckSquare, Map, Plane, Bus, Car, UtensilsCrossed, MapPin, NotebookPen, CalendarPlus, Footprints, Bike, Check, X, Route, Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator, BreadcrumbPage } from '@/components/ui/breadcrumb';
import { SidebarTrigger } from '@/components/ui/sidebar';
import Topbar from '@/components/layout/Topbar';
import { useTrip } from '@/hooks/useTrip';
import { useTrips } from '@/hooks/useTrips';
import { useReservations } from '@/hooks/useReservations';
import { useMapData } from '@/hooks/useMapData';
import { Activity as ActivityClass } from '@/domain/Activity';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
// Reason: leaflet + react-leaflet is ~200 KB; split into its own chunk and only
// downloaded when the Map tab is first activated.
const TripMap = lazy(() => import('@/components/map/TripMap'));
import type { CreateReservationInput } from '@/hooks/useReservations';
import ActivityFormModal from '@/components/itinerary/ActivityFormModal';
import ReservationFormModal from '@/components/itinerary/ReservationFormModal';
import TripFormModal from '@/components/trips/TripFormModal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { formatDate } from '@/utils/dates';
import { formatDateRange, nightCount, formatActivityTime, formatDuration, formatDistance } from '@/utils/format';
import { sortActivities } from '@/utils/activity';
import { isCheckinDay } from '@/utils/lodging';
import { RESERVATION_SORT_OFFSET } from '@/utils/sort';
import type { Activity, Trip as TripType, TripWithDays, DayWithActivities } from '@/types/domain';
import type { Reservation } from '@/domain/Reservation';
import type { LodgingDetails } from '@/schemas/reservation.schema';
import type { ActivityRow } from '@/types/db';
import type { CreateActivityInput, UpdateActivityInput } from '@/db/repositories/activities.repo';
import type { UpdateTripInput } from '@/db/repositories/trips.repo';
import { findLeg, findLegMode } from '@/domain/RouteLeg';
import { api } from '@/db/api-client';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorScreen } from '@/components/ui/ErrorScreen';
import ChecklistPanel from '@/components/checklist/ChecklistPanel';
import TripCalendar from '@/components/calendar/TripCalendar';
import ExportButton from '@/components/export/ExportButton';
import { useRouteLegs } from '@/hooks/useRouteLegs';
import { useChecklist } from '@/hooks/useChecklist';
import { usePreferences } from '@/hooks/usePreferences';
import type { RouteLegTravelMode, LegModeRow } from '@/types/db';


const TRAVEL_MODE_ICON: Record<RouteLegTravelMode, LucideIcon> = {
  car:        Car,
  pedestrian: Footprints,
  bicycle:    Bike,
};

const TRAVEL_MODES: RouteLegTravelMode[] = ['car', 'pedestrian', 'bicycle'];

const TRAVEL_MODE_LABEL: Record<RouteLegTravelMode, string> = {
  car:        'Car',
  pedestrian: 'Walking',
  bicycle:    'Cycling',
};

/** Small popover that lets the user pick a travel mode for a day's legs. */
function LegChipModePicker({
  mode,
  iconSize,
  onPick,
}: {
  mode: RouteLegTravelMode;
  iconSize: number;
  onPick: (m: RouteLegTravelMode) => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="tdp__leg-chip-mode-btn" title={`Travel mode: ${TRAVEL_MODE_LABEL[mode]}. Click to change.`}>
          {React.createElement(TRAVEL_MODE_ICON[mode], { size: iconSize })}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-1" side="top" align="start">
        <ToggleGroup
          type="single"
          value={mode}
          onValueChange={(v) => {
            if (!v || v === mode) return;
            onPick(v as RouteLegTravelMode);
            setOpen(false);
          }}
          className="gap-0.5"
        >
          {TRAVEL_MODES.map(m => (
            <ToggleGroupItem key={m} value={m} className="h-8 w-8 p-0" title={TRAVEL_MODE_LABEL[m]}>
              {React.createElement(TRAVEL_MODE_ICON[m], { size: 14 })}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </PopoverContent>
    </Popover>
  );
}
import './TripDetailPage.css';
import '@/components/trips/TripFormModal.css';

// ── Tab definitions ───────────────────────────────────────────────────────────

type TripTab = 'overview' | 'itinerary' | 'calendar' | 'checklist' | 'map';

const TABS: { id: TripTab; label: string; icon: JSX.Element }[] = [
  { id: 'overview',  label: 'Overview',  icon: <LayoutGrid  size={13} /> },
  { id: 'itinerary', label: 'Itinerary', icon: <FileText    size={13} /> },
  { id: 'calendar',  label: 'Calendar',  icon: <CalendarDays size={13} /> },
  { id: 'checklist', label: 'Checklist', icon: <CheckSquare size={13} /> },
  { id: 'map',       label: 'Map',       icon: <Map         size={13} /> },
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface TripDetailPageProps {
  tripId: number;
  onBack: () => void;
  onDelete: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TripDetailPage({ tripId, onBack, onDelete }: TripDetailPageProps): JSX.Element {
  const { trip, isLoading, error, refetch, updateTrip, deleteTrip } = useTrip(tripId);
  // Reason: allTrips is passed to TripFormModal for the date-overlap check.
  // Fetching here (rather than inside TripFormModal) avoids a redundant useTrips call
  // from a modal that is always mounted even when closed.
  const { trips: allTrips } = useTrips();
  const {
    reservations,
    lodgingsForDate,
    createReservation,
    updateReservation,
    deleteReservation,
  } = useReservations(tripId);
  const { pins, mapDays, missingCount, error: mapDataError, refetch: refetchMapData } = useMapData(tripId);
  const { legs: routeLegs, expectedLegs, isStale: routesStale, legModes, isSyncing: isRouteSyncing, sync: syncRoutes, setLegMode, error: routeLegsError } = useRouteLegs(tripId);
  const { distanceUnit } = usePreferences();
  // Reason: useChecklist is called here (in addition to inside ChecklistPanel) so
  // the error state is available at the page level for inline tab error handling.
  // React Query deduplicates the identical query key — no extra network request.
  const { error: checklistError } = useChecklist(tripId);

  // Reason: expectedLegs is the server-authoritative set of pairs that should exist;
  // routeLegs is what's cached. The difference is what still needs syncing.
  const unroutedPairCount = useMemo(() => {
    const cachedKeys = new Set(
      routeLegs.map(l => `${l.from_lat},${l.from_lng},${l.to_lat},${l.to_lng}`),
    );
    return expectedLegs.filter(
      el => !cachedKeys.has(`${el.from_lat},${el.from_lng},${el.to_lat},${el.to_lng}`),
    ).length;
  }, [expectedLegs, routeLegs]);

  const [activeTab, setActiveTab] = useState<TripTab>('overview');

  // ── Trip edit / delete modals ─────────────────────────────────────────────
  const [tripEditOpen,       setTripEditOpen]       = useState(false);
  const [deleteConfirmOpen,  setDeleteConfirmOpen]  = useState(false);

  async function handleDeleteTrip(): Promise<void> {
    await deleteTrip();
    onDelete();
  }

  async function handleTripUpdate(_id: number, input: UpdateTripInput): Promise<TripType> {
    // Reason: updateTrip() already fetches /trips/:id/full and calls setTrip(); refetch() would be a redundant second GET.
    return updateTrip(input);
  }

  // ── Day edit modal ────────────────────────────────────────────────────────
  const [dayEditOpen,   setDayEditOpen]   = useState(false);
  const [editingDay,    setEditingDay]    = useState<DayWithActivities | null>(null);

  const handleSaveDay = useCallback(
    async (input: { title: string | null; subtitle: string | null; notes: string | null }): Promise<void> => {
      if (!editingDay) return;
      try {
        await api.patch(`/days/${editingDay.id}`, input);
        setDayEditOpen(false);
        refetch();
        toast.success('Day updated');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to update day');
      }
    },
    [editingDay, refetch],
  );

  // ── Delete confirmations (activity + reservation) ─────────────────────────
  const [deleteActTarget, setDeleteActTarget]     = useState<{ id: number; title: string } | null>(null);
  const [deleteResTarget, setDeleteResTarget]     = useState<{ id: number; title: string } | null>(null);

  async function confirmDeleteActivity(): Promise<void> {
    if (!deleteActTarget) return;
    try {
      await api.delete(`/activities/${deleteActTarget.id}`);
      setDeleteActTarget(null);
      refetch();
      toast.success('Activity deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete activity');
    }
  }

  async function confirmDeleteReservation(): Promise<void> {
    if (!deleteResTarget) return;
    try {
      await deleteReservation(deleteResTarget.id);
      setDeleteResTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete reservation');
    }
  }

  // ── Activity modal ─────────────────────────────────────────────────────────
  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const [pendingDayId,      setPendingDayId]      = useState<number | null>(null);
  const [editingActivity,   setEditingActivity]   = useState<Activity | null>(null);

  function openEditActivity(activity: Activity): void {
    setPendingDayId(activity.day_id);
    setEditingActivity(activity);
    setActivityModalOpen(true);
  }

  const handleSaveActivity = useCallback(
    async (input: CreateActivityInput | UpdateActivityInput, id?: number): Promise<ActivityRow> => {
      let row: ActivityRow;
      if (id !== undefined) {
        row = await api.patch<ActivityRow>(`/activities/${id}`, input);
      } else {
        row = await api.post<ActivityRow>('/activities', input);
      }
      // Reason: refetch is called in the modal's onClose so the itinerary only
      // updates after the modal is fully closed (avoids visible flash during geocoding).
      return row;
    },
    [],
  );

  const handleDeleteActivity = useCallback(
    (activityId: number, title: string): void => {
      setDeleteActTarget({ id: activityId, title });
    },
    [],
  );

  // ── Reservation + entry modal ──────────────────────────────────────────────
  const [entryModalOpen,       setEntryModalOpen]       = useState(false);
  const [entryDayId,           setEntryDayId]           = useState<number | null>(null);
  const [entryDefaultCategory, setEntryDefaultCategory] = useState<'activity' | 'reservation' | null>(null);
  const [entryInitialType,     setEntryInitialType]     = useState<import('@/types/db').ReservationType | null>(null);
  const [editingReservation,   setEditingReservation]   = useState<Reservation | null>(null);

  function openAddEntry(dayId: number | null): void {
    setEntryDayId(dayId);
    setEntryDefaultCategory(null);
    setEntryInitialType(null);
    setEditingReservation(null);
    setEditingActivity(null);
    setEntryModalOpen(true);
  }

  function openAddActivity(dayId: number | null): void {
    setEntryDayId(dayId);
    setEntryDefaultCategory('activity');
    setEntryInitialType(null);
    setEditingReservation(null);
    setEditingActivity(null);
    setEntryModalOpen(true);
  }

  function openAddReservation(dayId: number | null): void {
    setEntryDayId(dayId);
    setEntryDefaultCategory('reservation');
    setEntryInitialType(null);
    setEditingReservation(null);
    setEditingActivity(null);
    setEntryModalOpen(true);
  }

  function openAddLodging(): void {
    setEntryDayId(null);
    setEntryDefaultCategory(null);
    setEntryInitialType('lodging');
    setEditingReservation(null);
    setEditingActivity(null);
    setEntryModalOpen(true);
  }

  function openEditReservation(reservation: Reservation): void {
    setEditingReservation(reservation);
    setEditingActivity(null);
    setEntryDayId(reservation.day_id);
    setEntryDefaultCategory(null);
    setEntryInitialType(null);
    setEntryModalOpen(true);
  }

  const handleDeleteReservation = useCallback(
    (reservationId: number, title: string): void => {
      setDeleteResTarget({ id: reservationId, title });
    },
    [],
  );

  const handleUpdateReservation = useCallback(
    async (id: number, input: CreateReservationInput): Promise<Reservation> => {
      // Reason: modal passes full CreateReservationInput; repo accepts the partial UpdateReservationInput.
      const { trip_id: _tripId, ...rest } = input;
      const updated = await updateReservation(id, { ...rest, id });
      return updated;
    },
    [updateReservation],
  );

  const handleReorderDayItems = useCallback(
    async (dayId: number, items: { id: number; itemType: 'activity' | 'reservation' }[]): Promise<void> => {
      await api.patch(`/days/${dayId}/reorder`, { items });
      refetch();
    },
    [refetch],
  );

  const handleSetLegMode = useCallback(
    async (fromLat: number, fromLng: number, toLat: number, toLng: number, mode: RouteLegTravelMode): Promise<void> => {
      await setLegMode(fromLat, fromLng, toLat, toLng, mode);
    },
    [setLegMode],
  );

  // ── Loading / error states ────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="tdp">
        {/* Skeleton mimics: topbar chrome + hero banner + hero body + tab bar + content */}
        <div style={{ height: 48, borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }} />
        <div className="tdp__hero">
          <Skeleton className="h-[72px] rounded-[var(--radius-md)] mb-[14px]" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-3.5 w-36" />
          </div>
        </div>
        <div className="tdp__tab-wrap">
          <div className="view-tabs" style={{ pointerEvents: 'none' }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-20 rounded-[7px]" />
            ))}
          </div>
        </div>
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-[var(--radius-lg)]" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="tdp">
        <ErrorScreen
          message={error ?? 'The trip could not be found.'}
          onRetry={refetch}
          onGoBack={onBack}
        />
      </div>
    );
  }

  const isOngoing = trip.isOngoing();

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <div className="tdp">

      {/* ── Topbar (shared component, breadcrumb left slot) ───────── */}
      <Topbar
        activeScreen="trip"
        left={
          <>
            <SidebarTrigger />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <button type="button" onClick={onBack}>My Trips</button>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{trip.title}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </>
        }
        actions={<ExportButton trip={trip} reservations={reservations} />}
      />

      {/* ── Header card ──────────────────────────────── */}
      <TripHeader
        trip={trip}
        reservationsCount={reservations.length}
        onEdit={() => setTripEditOpen(true)}
        onDelete={() => setDeleteConfirmOpen(true)}
      />

      {/* ── Tab bar ──────────────────────────────────── */}
      <div className="tdp__tab-wrap">
        <div className="view-tabs" role="tablist">
          {TABS.map(tab => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`view-tab${activeTab === tab.id ? ' view-tab--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ──────────────────────────────── */}
      <div className={`tdp__content${activeTab === 'map' ? ' tdp__content--map' : ''}`}>
        {activeTab === 'overview' && (
          <OverviewTab trip={trip} reservations={reservations} onAddEntry={() => openAddEntry(null)} onAddLodging={openAddLodging} onEditReservation={openEditReservation} onDeleteReservation={(id, title) => handleDeleteReservation(id, title)} onSaveNotes={async (notes) => { await updateTrip({ notes }); }} />
        )}
        {activeTab === 'itinerary' && (
          <ItineraryTab
            trip={trip}
            lodgingsForDate={lodgingsForDate}
            reservations={reservations}
            routeLegs={routeLegs}
            legModes={legModes}
            distanceUnit={distanceUnit}
            onAddActivity={openAddActivity}
            onAddReservation={openAddReservation}
            onEditDay={(day) => { setEditingDay(day); setDayEditOpen(true); }}
            onEditActivity={openEditActivity}
            onDeleteActivity={(id, title) => handleDeleteActivity(id, title)}
            onEditReservation={openEditReservation}
            onDeleteReservation={(id, title) => handleDeleteReservation(id, title)}
            onReorderDayItems={(dayId, items) => { void handleReorderDayItems(dayId, items); }}
            onSetLegMode={handleSetLegMode}
            unroutedPairCount={unroutedPairCount}
            isSyncing={isRouteSyncing}
            onSyncRoutes={() => { void syncRoutes(); }}
          />
        )}
        {activeTab === 'calendar'  && (
          <TripCalendar tripId={trip.id} startDate={trip.start_date} endDate={trip.end_date} />
        )}
        {activeTab === 'checklist' && (
          checklistError
            ? (
              <div className="flex flex-col items-center gap-2 py-16 text-center">
                <AlertTriangle size={20} style={{ color: 'var(--destructive)' }} aria-hidden />
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Checklist could not be loaded.
                </p>
              </div>
            )
            : <ChecklistPanel tripId={trip.id} />
        )}
        {activeTab === 'map' && (
          (mapDataError ?? routeLegsError)
            ? (
              <div className="flex flex-col items-center gap-2 py-16 text-center">
                <AlertTriangle size={20} style={{ color: 'var(--destructive)' }} aria-hidden />
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Map data could not be loaded.{' '}
                  <button
                    type="button"
                    className="underline"
                    onClick={() => refetchMapData()}
                  >
                    Retry
                  </button>
                </p>
              </div>
            )
            : (
              <Suspense fallback={<LoadingScreen message="Loading map..." />}>
                <TripMap
                  pins={pins}
                  mapDays={mapDays}
                  routeLegs={routeLegs}
                  expectedLegs={expectedLegs}
                  isStale={routesStale}
                  missingCount={missingCount}
                  isSyncing={isRouteSyncing}
                  onSyncRoutes={() => void syncRoutes()}
                />
              </Suspense>
            )
        )}
      </div>

      {/* ── Modals ───────────────────────────────────── */}
      <DayEditModal
        open={dayEditOpen}
        day={editingDay}
        onClose={() => setDayEditOpen(false)}
        onSave={handleSaveDay}
      />

      <TripFormModal
        open={tripEditOpen}
        onClose={() => setTripEditOpen(false)}
        trip={trip}
        allTrips={allTrips}
        onUpdate={handleTripUpdate}
      />

      <ActivityFormModal
        open={activityModalOpen}
        onClose={() => { setActivityModalOpen(false); refetch(); }}
        activity={editingActivity}
        dayId={pendingDayId ?? undefined}
        tripId={tripId}
        onSave={handleSaveActivity}
        onGeocodeDone={refetch}
      />

      <ReservationFormModal
        open={entryModalOpen}
        onClose={() => { setEntryModalOpen(false); setEntryInitialType(null); setEntryDefaultCategory(null); refetch(); }}
        tripId={tripId}
        dayId={entryDayId}
        days={trip.days}
        editingReservation={editingReservation}
        editingActivity={editingActivity}
        defaultCategory={entryDefaultCategory}
        initialType={entryInitialType}
        onCreateReservation={createReservation}
        onUpdateReservation={handleUpdateReservation}
        onCreateActivity={async (input) => {
          const row = await api.post<ActivityRow>('/activities', input);
          // Reason: refetch is deferred to onClose to avoid flash while modal+geocoding are still active.
          return new ActivityClass(row);
        }}
        onUpdateActivity={async (id, input) => {
          const row = await api.patch<ActivityRow>(`/activities/${id}`, input);
          // Reason: refetch is deferred to onClose to avoid flash while modal+geocoding are still active.
          return new ActivityClass(row);
        }}
        onGeocodeDone={refetch}
      />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={o => { if (!o) setDeleteConfirmOpen(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete trip</AlertDialogTitle>
            <AlertDialogDescription>
              {isOngoing
                ? 'This trip is currently ongoing. Deleting it will permanently remove all days and activities. This cannot be undone.'
                : `This will permanently delete "${trip.title}" and all its days and activities.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmOpen(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => { void handleDeleteTrip(); }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteActTarget !== null} onOpenChange={o => { if (!o) setDeleteActTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete activity</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &ldquo;{deleteActTarget?.title}&rdquo;? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteActTarget(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => { void confirmDeleteActivity(); }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteResTarget !== null} onOpenChange={o => { if (!o) setDeleteResTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete reservation</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &ldquo;{deleteResTarget?.title}&rdquo;? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteResTarget(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => { void confirmDeleteReservation(); }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Trip header card ──────────────────────────────────────────────────────────

function TripHeader({
  trip,
  reservationsCount,
  onEdit,
  onDelete,
}: {
  trip: TripWithDays;
  reservationsCount: number;
  onEdit: () => void;
  onDelete: () => void;
}): JSX.Element {
  const gapCount = useMemo(() => {
    return trip.days.filter(d => d.activities.length === 0).length;
  }, [trip]);

  const hasDates = !!(trip.start_date && trip.end_date);
  const completePct = Math.round(trip.computeProgress());
  const hasPhoto = trip.cover_type === 'photo' && trip.cover_image_path;

  return (
    <div className="tdh">
      {/* Photo strip — shown only for photo-type covers */}
      {hasPhoto && (
        <div
          className="tdh-photo-strip"
          style={{
            backgroundImage: `url(/covers/${encodeURIComponent(trip.cover_image_path!)})`,
          }}
          title={trip.cover_image_attribution ?? undefined}
        />
      )}
      <div className="tdh-top">
        <div className="tdh-title-row">
          <div className="tdh-title">{trip.title}</div>
          <span style={{ fontSize: '22px' }}>{trip.emoji}</span>
        </div>
        <div className="tdh-actions">
          <Button variant="ghost" size="sm" onClick={onEdit} type="button">
            <Pencil size={11} /> Edit
          </Button>
          <Button variant="destructive" size="sm" onClick={onDelete} type="button">
            <Trash2 size={11} /> Delete
          </Button>
        </div>
      </div>

      <div className="tdh-meta">
        {hasDates && <span>{formatDateRange(trip.start_date!, trip.end_date!)}</span>}
        {hasDates && <span className="tdh-meta-sep">·</span>}
        <span>{trip.durationDays()} day{trip.durationDays() !== 1 ? 's' : ''}</span>
        {trip.tags.map(tag => <span key={tag} className="tdh-tag">{tag}</span>)}
      </div>

      <div className="tdh-stats">
        <div className="stat">
          <div className="stat-val">{trip.days.length}</div>
          <div className="stat-lbl">Days planned</div>
        </div>
        <div className="stat">
          <div className="stat-val sage">{reservationsCount}</div>
          <div className="stat-lbl">Bookings</div>
        </div>
        <div className="stat">
          <div className="stat-val amb">{gapCount}</div>
          <div className="stat-lbl">Gaps</div>
        </div>
        <div className="stat">
          <div className="stat-val acc">{completePct}%</div>  {/* completePct is a plain number */}
          <div className="stat-lbl">Complete</div>
        </div>
      </div>
    </div>
  );
}

// ── Overview tab ──────────────────────────────────────────────────────────────

function LodgingCard({
  reservation,
  onEdit,
  onDelete,
}: {
  reservation: Reservation;
  onEdit: (r: Reservation) => void;
  onDelete: (id: number, title: string) => void;
}): JSX.Element {
  const d = reservation.parsedDetails<LodgingDetails>();
  const nights = d.check_in_date && d.check_out_date
    ? nightCount(d.check_in_date, d.check_out_date)
    : null;

  return (
    <div className="tdp__lodging-card">
      <div className="tdp__lc-header">
        <div className="tdp__lc-name-block">
          <div className="tdp__lc-name">{d.property_name ?? reservation.title}</div>
          <Badge className={`tdp__status-badge tdp__status-badge--${reservation.status}`}>
            {reservation.status.charAt(0).toUpperCase() + reservation.status.slice(1)}
          </Badge>
        </div>
        <div className="tdp__lc-actions">
          <Button variant="ghost" size="icon-xs" onClick={() => onEdit(reservation)} type="button" aria-label={`Edit ${reservation.title}`}>
            <Pencil size={11} />
          </Button>
          <Button variant="ghost" size="icon-xs" className="hover:text-destructive hover:bg-destructive/10" onClick={() => onDelete(reservation.id, reservation.title)} type="button" aria-label={`Delete ${reservation.title}`}>
            <Trash2 size={11} />
          </Button>
        </div>
      </div>
      {(reservation.location ?? d.location) && (
        <div className="tdp__lc-loc"><MapPin size={10} /><span>{reservation.location ?? d.location}</span></div>
      )}
      <div className="tdp__lc-dates">
        <div className="tdp__lc-date-col">
          <div className="tdp__lc-date-lbl">Check-in</div>
          <div className="tdp__lc-date-val">{d.check_in_date ? formatDate(d.check_in_date, 'EEE d MMM') : '—'}</div>
          {d.check_in_time && <div className="tdp__lc-time">{d.check_in_time}</div>}
        </div>
        {nights !== null && (
          <div className="tdp__lc-nights">
            <div className="tdp__lc-nights-num">{nights}</div>
            <div className="tdp__lc-nights-lbl">night{nights !== 1 ? 's' : ''}</div>
          </div>
        )}
        <div className="tdp__lc-date-col tdp__lc-date-col--right">
          <div className="tdp__lc-date-lbl">Check-out</div>
          <div className="tdp__lc-date-val">{d.check_out_date ? formatDate(d.check_out_date, 'EEE d MMM') : '—'}</div>
          {d.check_out_time && <div className="tdp__lc-time">{d.check_out_time}</div>}
        </div>
      </div>
      {(reservation.confirmation_ref || reservation.cost_amount != null) && (
        <div className="tdp__lc-meta">
          {reservation.confirmation_ref && (
            <span className="tdp__lc-ref">Ref: {reservation.confirmation_ref}</span>
          )}
          {reservation.cost_amount != null && (
            <span className="tdp__lc-cost">{reservation.cost_currency} {reservation.cost_amount.toFixed(2)}</span>
          )}
        </div>
      )}
    </div>
  );
}

interface OverviewTabProps {  trip: TripWithDays;
  reservations: Reservation[];
  onAddEntry: () => void;
  onAddLodging: () => void;
  onEditReservation: (r: Reservation) => void;
  onDeleteReservation: (id: number, title: string) => void;
  onSaveNotes: (notes: string) => Promise<void>;
}

function OverviewTabSection({ title, icon, items, emptyMsg, onAdd, addLabel, onEdit, onDelete }: {
  title: string;
  icon: React.ReactNode;
  items: Reservation[];
  emptyMsg: string;
  onAdd?: () => void;
  addLabel?: string;
  onEdit: (r: Reservation) => void;
  onDelete: (id: number, title: string) => void;
}): JSX.Element {
  return (
    <div className="tdp__section-card">
      <div className="tdp__section-head">
        <span className="tdp__section-title">{icon}{title}</span>
        {onAdd && (
          <Button size="sm" variant="outline" onClick={onAdd} type="button">
            {addLabel ?? '+ Add'}
          </Button>
        )}
      </div>
      <div className="tdp__section-body">
        {items.length === 0
          ? <p className="tdp__section-empty">{emptyMsg}</p>
          : items.map(r => (
              <div key={r.id} className="tdp__overview-item">
                <div className="tdp__ov-body">
                  <div className="tdp__ov-name">{r.title}</div>
                  <div className="tdp__ov-meta">{r.autoTitle()}</div>
                </div>
                <div className="tdp__act-actions">
                  <Button variant="ghost" size="icon-xs" onClick={() => onEdit(r)} type="button" aria-label={`Edit ${r.title}`}><Pencil size={11} /></Button>
                  <Button variant="ghost" size="icon-xs" className="hover:text-destructive hover:bg-destructive/10" onClick={() => onDelete(r.id, r.title)} type="button" aria-label={`Delete ${r.title}`}><Trash2 size={11} /></Button>
                </div>
              </div>
            ))
        }
      </div>
    </div>
  );
}

function OverviewTab({ trip, reservations, onAddEntry, onAddLodging, onEditReservation, onDeleteReservation, onSaveNotes }: OverviewTabProps): JSX.Element {
  const byType = (type: string): Reservation[] => reservations.filter(r => r.type === type);
  const transitRes = ['train', 'bus', 'ferry'].flatMap(t => byType(t));

  const placeActivities = trip.days.flatMap(d => d.activities).filter(a => a.activity_type === 'attraction');

  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState(trip.notes ?? '');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  async function handleSaveNotes(): Promise<void> {
    setIsSavingNotes(true);
    try {
      await onSaveNotes(notesValue);
      setEditingNotes(false);
    } finally {
      setIsSavingNotes(false);
    }
  }

  function handleCancelNotes(): void {
    setNotesValue(trip.notes ?? '');
    setEditingNotes(false);
  }

  return (
    <>
      {/* Lodging: always shown, with full detail cards */}
      <div className="tdp__section-card">
        <div className="tdp__section-head">
          <span className="tdp__section-title"><BedDouble size={14} />Lodging</span>
          <Button size="sm" variant="outline" onClick={onAddLodging} type="button">
            + Add lodging
          </Button>
        </div>
        <div className="tdp__section-body">
          {byType('lodging').length === 0
            ? <p className="tdp__section-empty">No lodging added yet.</p>
            : byType('lodging').map(r => (
                <LodgingCard key={r.id} reservation={r} onEdit={onEditReservation} onDelete={onDeleteReservation} />
              ))
          }
        </div>
      </div>

      {/* Remaining sections: hidden when empty */}
      {byType('flight').length > 0 && (
        <OverviewTabSection title="Flights" icon={<Plane size={14} />} items={byType('flight')} emptyMsg="" onAdd={onAddEntry} addLabel="+ Add flight" onEdit={onEditReservation} onDelete={onDeleteReservation} />
      )}
      {transitRes.length > 0 && (
        <OverviewTabSection title="Ground transport" icon={<Bus size={14} />} items={transitRes} emptyMsg="" onAdd={onAddEntry} addLabel="+ Add transport" onEdit={onEditReservation} onDelete={onDeleteReservation} />
      )}
      {byType('rental_car').length > 0 && (
        <OverviewTabSection title="Rental cars" icon={<Car size={14} />} items={byType('rental_car')} emptyMsg="" onAdd={onAddEntry} addLabel="+ Add rental car" onEdit={onEditReservation} onDelete={onDeleteReservation} />
      )}
      {byType('restaurant').length > 0 && (
        <OverviewTabSection title="Restaurants" icon={<UtensilsCrossed size={14} />} items={byType('restaurant')} emptyMsg="" onAdd={onAddEntry} addLabel="+ Add restaurant" onEdit={onEditReservation} onDelete={onDeleteReservation} />
      )}

      {/* Places of interest (attraction-type activities) */}
      <div className="tdp__section-card">
        <div className="tdp__section-head">
          <span className="tdp__section-title"><MapPin size={14} />Places of interest</span>
        </div>
        <div className="tdp__section-body">
          {placeActivities.length === 0
            ? <p className="tdp__section-empty">No attraction activities added yet.</p>
            : placeActivities.map(a => (
                <div key={a.id} className="tdp__overview-item">
                  <div className="tdp__ov-body">
                    <div className="tdp__ov-name">{a.title}</div>
                    {a.location && (
                      <div className="tdp__ov-meta tdp__act-loc">
                        <MapPin size={11} /><span>{a.location}</span>
                      </div>
                    )}
                    {a.notes && <div className="tdp__ov-meta">{a.notes}</div>}
                  </div>
                </div>
              ))
          }
        </div>
      </div>

      {/* Trip notes */}
      <div className="tdp__section-card">
        <div className="tdp__section-head">
          <span className="tdp__section-title"><NotebookPen size={14} />Trip notes</span>
          {!editingNotes && (
            <Button size="sm" variant="ghost" onClick={() => setEditingNotes(true)} type="button">
              <Pencil size={13} /> Edit
            </Button>
          )}
        </div>
        <div className="tdp__section-body">
          {editingNotes ? (
            <div className="tdp__notes-editor">
              <Textarea
                value={notesValue}
                onChange={e => setNotesValue(e.target.value)}
                placeholder="Packing reminders, visa info, contacts…"
                rows={5}
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Escape') handleCancelNotes();
                }}
              />
              <div className="tdp__notes-actions">
                <Button size="sm" variant="outline" onClick={handleCancelNotes} type="button" disabled={isSavingNotes}>
                  <X size={13} /> Cancel
                </Button>
                <Button size="sm" variant="default" onClick={() => { void handleSaveNotes(); }} type="button" disabled={isSavingNotes}>
                  <Check size={13} /> Save
                </Button>
              </div>
            </div>
          ) : (
            <div className="tdp__notes-area" onClick={() => setEditingNotes(true)} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') setEditingNotes(true); }} aria-label="Edit notes">
              {trip.notes
                ? <span>{trip.notes}</span>
                : <span className="tdp__notes-placeholder">Click to add notes — packing reminders, visa info, contacts…</span>
              }
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Itinerary tab ─────────────────────────────────────────────────────────────

interface ItineraryTabProps {
  trip: TripWithDays;
  reservations: Reservation[];
  routeLegs: import('@/domain/RouteLeg').RouteLeg[];
  legModes: LegModeRow[];
  distanceUnit: 'km' | 'mi';
  lodgingsForDate: (date: string) => Reservation[];
  onAddActivity: (dayId: number | null) => void;
  onAddReservation: (dayId: number | null) => void;
  onEditDay: (day: DayWithActivities) => void;
  onEditActivity: (activity: Activity) => void;
  onDeleteActivity: (id: number, title: string) => void;
  onEditReservation: (r: Reservation) => void;
  onDeleteReservation: (id: number, title: string) => void;
  onReorderDayItems: (dayId: number, items: { id: number; itemType: 'activity' | 'reservation' }[]) => void;
  onSetLegMode: (fromLat: number, fromLng: number, toLat: number, toLng: number, mode: RouteLegTravelMode) => void;
  unroutedPairCount: number;
  isSyncing: boolean;
  onSyncRoutes: () => void;
}

function ItineraryTab({
  trip,
  reservations,
  routeLegs,
  legModes,
  distanceUnit,
  lodgingsForDate,
  onAddActivity,
  onAddReservation,
  onEditDay,
  onEditActivity,
  onDeleteActivity,
  onEditReservation,
  onDeleteReservation,
  onReorderDayItems,
  onSetLegMode,
  unroutedPairCount,
  isSyncing,
  onSyncRoutes,
}: ItineraryTabProps): JSX.Element {
  if (!trip.start_date || !trip.end_date) {
    return (
      <Empty className="py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon"><CalendarDays /></EmptyMedia>
          <EmptyTitle>No dates set</EmptyTitle>
          <EmptyDescription>Set start and end dates on the trip to see the day-by-day itinerary.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (trip.days.length === 0) {
    return (
      <Empty className="py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon"><CalendarDays /></EmptyMedia>
          <EmptyTitle>No days generated</EmptyTitle>
          <EmptyDescription>Edit the trip to set dates and generate the day-by-day plan.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <>
      {unroutedPairCount > 0 && (
        <div className="tdp__route-nudge">
          <Route size={13} />
          <span>{unroutedPairCount} segment{unroutedPairCount !== 1 ? 's' : ''} not yet routed</span>
          <Button size="sm" variant="outline" onClick={onSyncRoutes} disabled={isSyncing} type="button">
            {isSyncing ? <><Loader2 size={13} className="animate-spin" />Syncing…</> : 'Sync routes'}
          </Button>
        </div>
      )}
      {trip.days.map((day, idx) => {
        const isLastDay = idx === trip.days.length - 1;
        const activities = sortActivities(day.activities);
        const dayReservations = reservations.filter(r => r.day_id === day.id);
        const isGap = activities.length === 0 && dayReservations.length === 0;
        const lodgings = lodgingsForDate(day.date);

        // Reason: use coord-based lookup rather than positional index so the
        // correct inter-day leg is found even when some days have no geocoded points.
        const geocodedInDay = [...activities, ...dayReservations].filter(x => x.lat != null);
        const nextDay = !isLastDay ? trip.days[idx + 1] : null;
        const nextActivities = nextDay ? sortActivities(nextDay.activities) : [];
        const nextReservations = nextDay ? reservations.filter(r => r.day_id === nextDay.id) : [];
        const geocodedInNext = [...nextActivities, ...nextReservations].filter(x => x.lat != null);
        const lastOfDay  = geocodedInDay[geocodedInDay.length - 1] ?? null;
        const firstOfNext = geocodedInNext[0] ?? null;
        // Reason: resolve the travel mode for the inter-day leg before calling findLeg
        // so that after a mode change the correct cached leg is returned (not the old one).
        const interDayMode = (lastOfDay?.lat != null && lastOfDay?.lng != null && firstOfNext?.lat != null && firstOfNext?.lng != null)
          ? findLegMode(legModes, lastOfDay.lat, lastOfDay.lng, firstOfNext.lat, firstOfNext.lng, 'car')
          : 'car';
        const interDayLeg = !isLastDay ? findLeg(routeLegs, lastOfDay, firstOfNext, interDayMode) : null;

        // Reason: mirror backend computeExpectedLegs — sort geocoded points by
        // sort_order (reservations offset by RESERVATION_SORT_OFFSET) then look up each
        // consecutive pair in routeLegs. This avoids counting stale legs or coincidental
        // coord matches that the set-membership filter would incorrectly pick up.
        // Reason: include lodging anchors exactly as the backend does — check-in day
        // lodging sorts to end of day (9999), overnight lodging sorts to start (-1).
        const lodgingAnchorPoints = lodgings
          .filter(l => l.lat != null && l.lng != null)
          .map(l => {
            const d = l.parsedDetails<{ check_in_date?: string }>() ;
            return {
              lat:        l.lat!,
              lng:        l.lng!,
              sort_order: d.check_in_date != null && isCheckinDay(d.check_in_date, day.date) ? 9_999 : -1,
            };
          });
        const sortedInDay = [
          ...activities.map(a => ({ lat: a.lat, lng: a.lng, sort_order: a.sort_order })),
          ...dayReservations.map(r => ({ lat: r.lat, lng: r.lng, sort_order: r.sort_order + RESERVATION_SORT_OFFSET })),
          ...lodgingAnchorPoints,
        ]
          .filter((p): p is { lat: number; lng: number; sort_order: number } => p.lat != null && p.lng != null)
          .sort((a, b) => a.sort_order - b.sort_order);
        const dayLegs = [];
        for (let i = 0; i < sortedInDay.length - 1; i++) {
          const from = sortedInDay[i];
          const to   = sortedInDay[i + 1];
          const leg  = routeLegs.find(l =>
            Math.abs(l.from_lat - from.lat) < 1e-5 &&
            Math.abs(l.from_lng - from.lng) < 1e-5 &&
            Math.abs(l.to_lat   - to.lat)   < 1e-5 &&
            Math.abs(l.to_lng   - to.lng)   < 1e-5,
          );
          if (leg) dayLegs.push(leg);
        }
        const legSummary = dayLegs.length > 0
          ? { distance_m: dayLegs.reduce((s, l) => s + l.distance_m, 0), duration_s: dayLegs.reduce((s, l) => s + l.duration_s, 0) }
          : null;

        return (
          <React.Fragment key={day.id}>
            <div className="tdp__day-row">
              <div className="tl-col">
                <div className={`tl-dot${lodgings.length > 0 ? ' tl-dot--lodging' : isGap ? ' tl-dot--empty' : ''}`} />
                {!isLastDay && <div className="tl-line" />}
              </div>
              <ItineraryDayCard
                day={day}
                dayNumber={idx + 1}
                activities={activities}
                dayReservations={dayReservations}
                lodgings={lodgings}
                isGap={isGap}
                isLastDay={isLastDay}
                routeLegs={routeLegs}
                legModes={legModes}
                distanceUnit={distanceUnit}
                legSummary={legSummary}
                onEditDay={() => onEditDay(day)}
                onAddActivity={() => onAddActivity(day.id)}
                onAddReservation={() => onAddReservation(day.id)}
                onEditActivity={onEditActivity}
                onDeleteActivity={onDeleteActivity}
                onEditReservation={onEditReservation}
                onDeleteReservation={onDeleteReservation}
                onReorderDayItems={onReorderDayItems}
                onSetLegMode={onSetLegMode}
              />
            </div>
            {!isLastDay && interDayLeg && (
              <div className="tdp__leg-chip">
                <LegChipModePicker
                  mode={findLegMode(legModes, interDayLeg.from_lat, interDayLeg.from_lng, interDayLeg.to_lat, interDayLeg.to_lng, interDayLeg.travel_mode)}
                  iconSize={12}
                  onPick={(m) => { void onSetLegMode(interDayLeg.from_lat, interDayLeg.from_lng, interDayLeg.to_lat, interDayLeg.to_lng, m); }}
                />
                <span>{interDayLeg.durationLabel()}</span>
                <span className="tdp__leg-chip-sep">·</span>
                <span>{interDayLeg.distanceLabel(distanceUnit)}</span>
              </div>
            )}
          </React.Fragment>
        );
      })}
    </>
  );
}

// ── Day card: stop exists ─────────────────────────────────────────────────────

interface ItineraryDayCardProps {
  day: DayWithActivities;
  dayNumber: number;
  activities: Activity[];
  dayReservations: Reservation[];
  lodgings: Reservation[];
  isGap: boolean;
  isLastDay: boolean;
  routeLegs: import('@/domain/RouteLeg').RouteLeg[];
  legModes: LegModeRow[];
  distanceUnit: 'km' | 'mi';
  legSummary: { distance_m: number; duration_s: number } | null;
  onEditDay: () => void;
  onAddActivity: () => void;
  onAddReservation: () => void;
  onEditActivity: (activity: Activity) => void;
  onDeleteActivity: (id: number, title: string) => void;
  onEditReservation: (r: Reservation) => void;
  onDeleteReservation: (id: number, title: string) => void;
  onReorderDayItems: (dayId: number, items: { id: number; itemType: 'activity' | 'reservation' }[]) => void;
  onSetLegMode: (fromLat: number, fromLng: number, toLat: number, toLng: number, mode: RouteLegTravelMode) => void;
}

// ── DayInfoBanner ─────────────────────────────────────────────────────────────

interface DayInfoBannerProps {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  text: string;
  borderColor: string;
  gradient: string;
}

function DayInfoBanner({ icon, iconBg, iconColor, text, borderColor, gradient }: DayInfoBannerProps): JSX.Element {
  return (
    <div
      className="tdp__day-banner"
      style={{
        background: gradient,
        borderBottom: `1px solid ${borderColor}`,
      }}
    >
      <div className="tdp__day-banner-icon" style={{ background: iconBg, color: iconColor }}>
        {icon}
      </div>
      <span className="tdp__day-banner-text">{text}</span>
    </div>
  );
}

// ── Day card ──────────────────────────────────────────────────────────────────

function ItineraryDayCard({
  day,
  dayNumber,
  activities,
  dayReservations,
  lodgings,
  isGap,
  isLastDay: _isLastDay,
  routeLegs,
  legModes,
  distanceUnit,
  legSummary,
  onEditDay,
  onAddActivity,
  onAddReservation,
  onEditActivity,
  onDeleteActivity,
  onEditReservation,
  onDeleteReservation,
  onReorderDayItems,
  onSetLegMode,
}: ItineraryDayCardProps): JSX.Element {
  // Reason: on transition days (check-out + check-in same date) both lodgings cover
  // the date. Sort check-out first, check-in second for natural reading order.
  type LodgingBanner = { lodging: Reservation; label: 'check-in' | 'check-out' | 'staying' };
  const lodgingBanners: LodgingBanner[] = lodgings
    .flatMap(l => {
      const label = l.lodgingStripLabel(day.date);
      return label ? [{ lodging: l, label }] : [];
    })
    .sort((a, b) => {
      const order: Record<string, number> = { 'check-out': 0, 'staying': 1, 'check-in': 2 };
      return (order[a.label] ?? 1) - (order[b.label] ?? 1);
    });

  const isEmpty = !day.title && activities.length === 0 && dayReservations.length === 0;

  // ── Unified drag-to-reorder (activities + reservations) ───────────────────
  type DragItem = { id: number; itemType: 'activity' | 'reservation' };
  const draggedItem = useRef<DragItem | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{ id: number; itemType: 'activity' | 'reservation'; position: 'above' | 'below' } | null>(null);

  // Combined list sorted by sort_order for unified rendering
  const combinedItems: DragItem[] = useMemo(() => {
    const acts: (DragItem & { sort_order: number })[] = activities.map(a => ({ id: a.id, itemType: 'activity' as const, sort_order: a.sort_order }));
    const ress: (DragItem & { sort_order: number })[] = dayReservations.map(r => ({ id: r.id, itemType: 'reservation' as const, sort_order: r.sort_order }));
    return [...acts, ...ress].sort((a, b) => a.sort_order - b.sort_order);
  }, [activities, dayReservations]);

  function handleDragStart(item: DragItem): void {
    draggedItem.current = item;
  }

  function handleDragOver(e: React.DragEvent, targetId: number, targetType: 'activity' | 'reservation', position: 'above' | 'below'): void {
    e.preventDefault();
    setDropIndicator({ id: targetId, itemType: targetType, position });
  }

  function handleDragLeave(): void {
    setDropIndicator(null);
  }

  function handleDrop(e: React.DragEvent, targetId: number, targetType: 'activity' | 'reservation', position: 'above' | 'below'): void {
    e.preventDefault();
    setDropIndicator(null);
    const from = draggedItem.current;
    draggedItem.current = null;
    if (!from || (from.id === targetId && from.itemType === targetType)) return;

    const fromIdx = combinedItems.findIndex(i => i.id === from.id && i.itemType === from.itemType);
    const toIdx   = combinedItems.findIndex(i => i.id === targetId && i.itemType === targetType);
    if (fromIdx === -1 || toIdx === -1) return;

    const reordered = [...combinedItems];
    reordered.splice(fromIdx, 1);
    const newToIdx = reordered.findIndex(i => i.id === targetId && i.itemType === targetType);
    const insertAt = position === 'above' ? newToIdx : newToIdx + 1;
    reordered.splice(insertAt, 0, from);
    onReorderDayItems(day.id, reordered.map(({ id, itemType }) => ({ id, itemType })));
  }

  return (
    <div className={`tdp__day-card${isGap ? ' tdp__day-card--gap' : ''}${isEmpty ? ' tdp__day-card--empty' : ''}`}>

      {/* ── Header ─────────────────────────────────── */}
      <div className="tdp__day-header">
        <div>
          <div className="tdp__day-label">Day {dayNumber} · {formatDate(day.date, 'EEE d MMM')}</div>
          {day.title
            ? <div className="tdp__day-title">{day.title}</div>
            : <div className="tdp__day-title tdp__day-title--empty">No title — tap ✏ to add</div>
          }
          {day.subtitle && <div className="tdp__day-subtitle">{day.subtitle}</div>}
          {legSummary && (
            <div className="tdp__day-travel">
              <Route size={10} />
              <span>{formatDuration(legSummary.duration_s)}</span>
              <span className="tdp__leg-chip-sep">·</span>
              <span>{formatDistance(legSummary.distance_m, distanceUnit)}</span>
            </div>
          )}
        </div>
        <div className="tdp__day-header-actions">
          <Button variant="ghost" size="icon-xs" onClick={onEditDay} type="button" aria-label="Edit day">
            <Pencil size={12} />
          </Button>
        </div>
      </div>

      {/* ── Banners (below header) ──────────────────── */}
      {lodgings.length === 0 && (
        <DayInfoBanner
          icon={<AlertTriangle size={12} />}
          iconBg="color-mix(in srgb, var(--toast-warning-border) 15%, transparent)"
          iconColor="var(--toast-warning-text)"
          text="No accommodation for this night"
          borderColor="color-mix(in srgb, var(--toast-warning-border) 15%, transparent)"
          gradient="linear-gradient(to right, color-mix(in srgb, var(--toast-warning-border) 8%, transparent), transparent)"
        />
      )}

      {lodgingBanners.map(({ lodging, label }) => {
        const details = lodging.parsedDetails<LodgingDetails>();
        const propertyName = details.property_name ?? lodging.title;
        const text = label === 'check-in'
          ? `${propertyName} · Check-in${details.check_in_time ? ` · ${details.check_in_time}` : ''}`
          : label === 'check-out'
          ? `${propertyName} · Check-out${details.check_out_time ? ` · ${details.check_out_time}` : ''}`
          : `${propertyName} · Staying tonight`;
        return (
          <DayInfoBanner
            key={lodging.id}
            icon={<BedDouble size={12} />}
            iconBg="rgba(155,145,212,.15)"
            iconColor="var(--res-lodging)"
            text={text}
            borderColor="rgba(155,145,212,.25)"
            gradient="linear-gradient(to right, rgba(184,175,223,.08), transparent)"
          />
        );
      })}

      {/* ── Activity + Reservation list ─────────────── */}
      <div className="tdp__day-acts">
        {combinedItems.length === 0 && (
          <Empty className="py-4">
            <EmptyHeader>
              <EmptyMedia variant="icon"><CalendarPlus /></EmptyMedia>
              <EmptyTitle>Nothing planned yet</EmptyTitle>
            </EmptyHeader>
          </Empty>
        )}
        {combinedItems.map((item, itemIdx) => {
          // Resolve the current and next items to look up an intra-day leg
          const resolveLatLng = (di: typeof item): { lat: number | null; lng: number | null } => {
            if (di.itemType === 'activity') {
              const a = activities.find(x => x.id === di.id);
              return { lat: a?.lat ?? null, lng: a?.lng ?? null };
            }
            const r = dayReservations.find(x => x.id === di.id);
            return { lat: r?.lat ?? null, lng: r?.lng ?? null };
          };
          const nextItem = combinedItems[itemIdx + 1] ?? null;
          // Reason: resolve the travel mode for the intra-day leg before calling findLeg
          // so that after a mode change the correct cached leg is returned (not the old one).
          const fromCoords = resolveLatLng(item);
          const toCoords = nextItem ? resolveLatLng(nextItem) : null;
          const intraMode = (fromCoords.lat != null && fromCoords.lng != null && toCoords?.lat != null && toCoords?.lng != null)
            ? findLegMode(legModes, fromCoords.lat, fromCoords.lng, toCoords.lat, toCoords.lng, 'car')
            : 'car';
          const intraLeg = nextItem
            ? findLeg(routeLegs, fromCoords, toCoords, intraMode)
            : null;

          if (item.itemType === 'activity') {
            const activity = activities.find(a => a.id === item.id)!;
            const actIdx = activities.indexOf(activity);
            return (
              <React.Fragment key={`act-${activity.id}`}>
                <ItineraryActivityCard
                  activity={activity}
                  number={actIdx + 1}
                  onEdit={onEditActivity}
                  onDelete={onDeleteActivity}
                  onDragStart={() => handleDragStart({ id: activity.id, itemType: 'activity' })}
                  onDragOver={(e, position) => handleDragOver(e, activity.id, 'activity', position)}
                  onDrop={(e, position) => handleDrop(e, activity.id, 'activity', position)}
                  onDragLeave={handleDragLeave}
                  isDropTarget={dropIndicator?.id === activity.id && dropIndicator.itemType === 'activity' ? dropIndicator.position : null}
                />
                {intraLeg && (
                  <div className="tdp__leg-chip tdp__leg-chip--intra">
                    <LegChipModePicker
                      mode={findLegMode(legModes, intraLeg.from_lat, intraLeg.from_lng, intraLeg.to_lat, intraLeg.to_lng, intraLeg.travel_mode)}
                      iconSize={11}
                      onPick={(m) => { void onSetLegMode(intraLeg.from_lat, intraLeg.from_lng, intraLeg.to_lat, intraLeg.to_lng, m); }}
                    />
                    <span>{intraLeg.durationLabel()}</span>
                    <span className="tdp__leg-chip-sep">·</span>
                    <span>{intraLeg.distanceLabel(distanceUnit)}</span>
                  </div>
                )}
              </React.Fragment>
            );
          } else {
            const reservation = dayReservations.find(r => r.id === item.id)!;
            const resIdx = dayReservations.indexOf(reservation);
            return (
              <React.Fragment key={`res-${reservation.id}`}>
                <ItineraryReservationCard
                  reservation={reservation}
                  number={resIdx + 1}
                  onEdit={onEditReservation}
                  onDelete={onDeleteReservation}
                  onDragStart={() => handleDragStart({ id: reservation.id, itemType: 'reservation' })}
                  onDragOver={(e, position) => handleDragOver(e, reservation.id, 'reservation', position)}
                  onDrop={(e, position) => handleDrop(e, reservation.id, 'reservation', position)}
                  onDragLeave={handleDragLeave}
                  isDropTarget={dropIndicator?.id === reservation.id && dropIndicator.itemType === 'reservation' ? dropIndicator.position : null}
                />
                {intraLeg && (
                  <div className="tdp__leg-chip tdp__leg-chip--intra">
                    <LegChipModePicker
                      mode={findLegMode(legModes, intraLeg.from_lat, intraLeg.from_lng, intraLeg.to_lat, intraLeg.to_lng, intraLeg.travel_mode)}
                      iconSize={11}
                      onPick={(m) => { void onSetLegMode(intraLeg.from_lat, intraLeg.from_lng, intraLeg.to_lat, intraLeg.to_lng, m); }}
                    />
                    <span>{intraLeg.durationLabel()}</span>
                    <span className="tdp__leg-chip-sep">·</span>
                    <span>{intraLeg.distanceLabel(distanceUnit)}</span>
                  </div>
                )}
              </React.Fragment>
            );
          }
        })}
      </div>

      {/* ── Footer with add buttons ─────────────────── */}
      <div className="tdp__day-footer">
        <Button variant="ghost" className="tdp__add-btn" onClick={onAddActivity} type="button">
          <Plus size={12} /> Add activity
        </Button>
        <Button variant="ghost" className="tdp__add-btn" onClick={onAddReservation} type="button">
          <Plus size={12} /> Add reservation
        </Button>
      </div>
    </div>
  );
}

// ── Activity card ─────────────────────────────────────────────────────────────

function ItineraryActivityCard({ activity, number, onEdit, onDelete, onDragStart, onDragOver, onDrop, onDragLeave, isDropTarget }: {
  activity: Activity;
  number: number;
  onEdit: (activity: Activity) => void;
  onDelete: (id: number, title: string) => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent, position: 'above' | 'below') => void;
  onDrop: (e: React.DragEvent, position: 'above' | 'below') => void;
  onDragLeave: () => void;
  isDropTarget: 'above' | 'below' | null;
}): JSX.Element {
  const timeLabel = formatActivityTime(activity.start_time, activity.end_time) || null;

  return (
    <div
      className={[
        'tdp__act-item',
        `tdp__act-item--${activity.activity_type}`,
        isDropTarget === 'above' ? 'act--drop-above' : '',
        isDropTarget === 'below' ? 'act--drop-below' : '',
      ].filter(Boolean).join(' ')}
      draggable
      onDragStart={onDragStart}
      onDragOver={e => {
        // Reason: compute position at the card level where currentTarget is the card element.
        const rect = e.currentTarget.getBoundingClientRect();
        const position: 'above' | 'below' = e.clientY < rect.top + rect.height / 2 ? 'above' : 'below';
        onDragOver(e, position);
      }}
      onDrop={e => {
        const rect = e.currentTarget.getBoundingClientRect();
        const position: 'above' | 'below' = e.clientY < rect.top + rect.height / 2 ? 'above' : 'below';
        onDrop(e, position);
      }}
      onDragLeave={onDragLeave}
    >
      <span className="tdp__act-drag" aria-hidden="true">
        <GripVertical size={14} />
      </span>
      <span className="tdp__act-num" aria-label={`Activity ${number}`}>{number}</span>
      <div className="tdp__act-body">
        <div className="tdp__act-title">{activity.title}</div>
        <div className="tdp__act-meta">
          {timeLabel && <span className="tdp__act-time">{timeLabel}</span>}
          {activity.location && (
            <span className="tdp__act-loc"><MapPin size={11} /><span>{activity.location}</span></span>
          )}
          <span className={`tdp__type-badge tdp__type-badge--${activity.activity_type}`}>
            {activity.activity_type.charAt(0).toUpperCase() + activity.activity_type.slice(1)}
          </span>
          {activity.notes && (
            <span className="tdp__act-note">{activity.notes}</span>
          )}
        </div>
      </div>
      <div className="tdp__act-actions">
        <Button variant="ghost" size="icon-xs"
          onClick={() => onEdit(activity)}
          type="button"
          aria-label={`Edit ${activity.title}`}
        >
          <Pencil size={11} />
        </Button>
        <Button variant="ghost" size="icon-xs" className="hover:text-destructive hover:bg-destructive/10"
          onClick={() => onDelete(activity.id, activity.title)}
          type="button"
          aria-label={`Delete ${activity.title}`}
        >
          <Trash2 size={11} />
        </Button>
      </div>
    </div>
  );
}

// ── Reservation card ──────────────────────────────────────────────────────────

const RES_TYPE_LABELS: Record<string, string> = {
  lodging: 'Lodging', flight: 'Flight', train: 'Train', bus: 'Bus',
  ferry: 'Ferry', rental_car: 'Car', restaurant: 'Restaurant', other: 'Other',
};

function resTypeBadgeClass(type: string): string {
  if (type === 'rental_car') return 'car';
  if (type === 'train' || type === 'bus' || type === 'ferry') return 'transit';
  return type;
}

function ItineraryReservationCard({ reservation, number, onEdit, onDelete, onDragStart, onDragOver, onDrop, onDragLeave, isDropTarget }: {
  reservation: Reservation;
  number: number;
  onEdit: (r: Reservation) => void;
  onDelete: (id: number, title: string) => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent, position: 'above' | 'below') => void;
  onDrop: (e: React.DragEvent, position: 'above' | 'below') => void;
  onDragLeave: () => void;
  isDropTarget: 'above' | 'below' | null;
}): JSX.Element {
  const subTitle = reservation.autoTitle();

  return (
    <div
      className={[
        'tdp__act-item',
        `tdp__act-item--res-${reservation.type}`,
        isDropTarget === 'above' ? 'act--drop-above' : '',
        isDropTarget === 'below' ? 'act--drop-below' : '',
      ].filter(Boolean).join(' ')}
      draggable
      onDragStart={onDragStart}
      onDragOver={e => {
        const rect = e.currentTarget.getBoundingClientRect();
        const position: 'above' | 'below' = e.clientY < rect.top + rect.height / 2 ? 'above' : 'below';
        onDragOver(e, position);
      }}
      onDrop={e => {
        const rect = e.currentTarget.getBoundingClientRect();
        const position: 'above' | 'below' = e.clientY < rect.top + rect.height / 2 ? 'above' : 'below';
        onDrop(e, position);
      }}
      onDragLeave={onDragLeave}
    >
      <span className="tdp__act-drag" aria-hidden="true">
        <GripVertical size={14} />
      </span>
      <span className="tdp__act-num" aria-label={`Reservation ${number}`}>{number}</span>
      <div className="tdp__act-body">
        <div className="tdp__act-title">{reservation.title}</div>
        <div className="tdp__act-meta">
          <span className={`tdp__res-badge tdp__res-badge--${resTypeBadgeClass(reservation.type)}`}>
            {RES_TYPE_LABELS[reservation.type] ?? reservation.type}
          </span>
          {reservation.location && (
            <span className="tdp__act-loc"><MapPin size={11} /><span>{reservation.location}</span></span>
          )}
          {subTitle && <span className="tdp__act-note">{subTitle}</span>}
          <span className={`tdp__type-badge tdp__type-badge--res-status-${reservation.status}`}>
            {reservation.status.charAt(0).toUpperCase() + reservation.status.slice(1)}
          </span>
        </div>
      </div>
      <div className="tdp__act-actions">
        <Button variant="ghost" size="icon-xs"
          onClick={() => onEdit(reservation)}
          type="button"
          aria-label={`Edit ${reservation.title}`}
        >
          <Pencil size={11} />
        </Button>
        <Button variant="ghost" size="icon-xs" className="hover:text-destructive hover:bg-destructive/10"
          onClick={() => onDelete(reservation.id, reservation.title)}
          type="button"
          aria-label={`Delete ${reservation.title}`}
        >
          <Trash2 size={11} />
        </Button>
      </div>
    </div>
  );
}

// ── Day edit modal ────────────────────────────────────────────────────────────

function DayEditModal({
  open,
  day,
  onClose,
  onSave,
}: {
  open: boolean;
  day: DayWithActivities | null;
  onClose: () => void;
  onSave: (input: { title: string | null; subtitle: string | null; notes: string | null }) => Promise<void>;
}): JSX.Element {
  const [title,    setTitle]    = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [notes,    setNotes]    = useState('');
  const [saving,   setSaving]   = useState(false);

  // Sync fields when the modal opens for a different day
  useEffect(() => {
    setTitle(day?.title ?? '');
    setSubtitle(day?.subtitle ?? '');
    setNotes(day?.notes ?? '');
  }, [day]);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!day) return;
    setSaving(true);
    try {
      await onSave({
        title:    title.trim() || null,
        subtitle: subtitle.trim() || null,
        notes:    notes.trim() || null,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit day</DialogTitle>
        </DialogHeader>
        <form id="day-edit-form" className="trip-form pb-1" onSubmit={(e) => { void handleSubmit(e); }}>
          <div className="trip-form__field">
            <Label htmlFor="day-title">Title</Label>
            <Input
              id="day-title"
              type="text"
              maxLength={200}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Arriving in Paris"
            />
          </div>
          <div className="trip-form__field">
            <Label htmlFor="day-subtitle">Subtitle</Label>
            <Input
              id="day-subtitle"
              type="text"
              maxLength={300}
              value={subtitle}
              onChange={e => setSubtitle(e.target.value)}
              placeholder="e.g. Travel day"
            />
          </div>
          <div className="trip-form__field">
            <Label htmlFor="day-notes">Notes</Label>
            <Textarea
              id="day-notes"
              rows={4}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Notes for this day…"
            />
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="default" onClick={() => { void document.querySelector<HTMLFormElement>('#day-edit-form')?.requestSubmit(); }} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
