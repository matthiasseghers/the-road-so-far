import { useState, useMemo } from 'react';
import { Plane, CalendarDays, Archive } from 'lucide-react';
import TripGrid from '@/components/trips/TripGrid';
import TripFilterBar from '@/components/trips/TripFilterBar';
import OngoingTripBanner from '@/components/trips/OngoingTripBanner';
import TripFormModal from '@/components/trips/TripFormModal';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useTrips } from '@/hooks/useTrips';
import type { Trip, Screen } from '@/types/domain';
import './TripsPage.css';

interface TripsPageProps {
  onNavigate: (screen: Screen, tripId?: number) => void;
  /** Controlled by App when Topbar "New trip" is clicked */
  newTripOpen?: boolean;
  onNewTripOpenChange?: (open: boolean) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TripsPage({ onNavigate, newTripOpen = false, onNewTripOpenChange }: TripsPageProps): JSX.Element {
  const { trips, loading, error, createTrip, updateTrip, deleteTrip } = useTrips();

  const [search, setSearch] = useState('');
  const [activeTags, setActiveTags] = useState<string[]>([]);
  // formOpen is true when either the parent opens it (new trip via Topbar) or when edit is triggered locally
  const [localFormOpen, setLocalFormOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | undefined>(undefined);
  const [tripToDelete, setTripToDelete] = useState<Trip | null>(null);

  // Merge controlled (Topbar new-trip) and local (edit) open state
  const formOpen = newTripOpen || localFormOpen;

  // All unique tags across all trips
  const allTags = useMemo(() => {
    const tagSet = new Set(trips.flatMap(t => t.tags));
    return Array.from(tagSet).sort();
  }, [trips]);

  // Filter trips by search text + active tag chips
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return trips.filter(trip => {
      const matchesSearch = !q || trip.title.toLowerCase().includes(q);
      const matchesTags = activeTags.length === 0 || activeTags.every(tag => trip.tags.includes(tag));
      return matchesSearch && matchesTags;
    });
  }, [trips, search, activeTags]);

  // Bucket filtered trips using domain methods — no inline logic
  const ongoing  = useMemo(() => filtered.filter(t => t.isOngoing()),  [filtered]);
  const upcoming = useMemo(() => filtered.filter(t => t.isUpcoming()), [filtered]);
  const past     = useMemo(() => filtered.filter(t => t.isPast()),     [filtered]);

  function handleEdit(trip: Trip): void {
    setEditingTrip(trip);
    setLocalFormOpen(true);
  }

  function handleDelete(trip: Trip): void {
    setTripToDelete(trip);
  }

  function confirmDelete(): void {
    if (!tripToDelete) return;
    void deleteTrip(tripToDelete.id);
    setTripToDelete(null);
  }

  function handleCloseForm(): void {
    setLocalFormOpen(false);
    onNewTripOpenChange?.(false);
    setEditingTrip(undefined);
  }

  if (loading) {
    return (
      <div className="trips-page">
        <div className="trip-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="trip-card" style={{ pointerEvents: 'none' }}>
              <Skeleton className="h-[88px] rounded-b-none" />
              <div className="trip-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-2 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="trips-page__error">Error: {error}</div>;
  }

  const hasFilters = search.trim().length > 0 || activeTags.length > 0;

  return (
    <div className="trips-page">
      <TripFilterBar
        search={search}
        onSearchChange={setSearch}
        allTags={allTags}
        activeTags={activeTags}
        onTagsChange={setActiveTags}
      />

      {/* Ongoing section */}
      {ongoing.length > 0 && (
        <section className="trips-page__section">
          {ongoing.length === 1 ? (
            <OngoingTripBanner
              trip={ongoing[0]}
              onClick={t => onNavigate('trip', t.id)}
            />
          ) : (
            <>
              <h2 className="trips-page__section-title"><Plane size={12} />  On the road</h2>
              <TripGrid
                trips={ongoing}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onClick={t => onNavigate('trip', t.id)}
              />
            </>
          )}
        </section>
      )}

      {/* Upcoming section */}
      <section className="trips-page__section">
        <h2 className="trips-page__section-title"><CalendarDays size={12} />  Upcoming</h2>
        <TripGrid
          trips={upcoming}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onClick={t => onNavigate('trip', t.id)}
          emptyLabel={hasFilters ? 'No upcoming trips match your filter.' : 'No upcoming trips yet.'}
          onAdd={!hasFilters && trips.length === 0 ? () => { setLocalFormOpen(true); } : undefined}
        />
      </section>

      {/* Past section — only shown if there are past trips, or a filter is applied */}
      {(past.length > 0 || (hasFilters && trips.some(t => t.isPast()))) && (
        <section className="trips-page__section">
          <h2 className="trips-page__section-title"><Archive size={12} />  Past trips</h2>
          <TripGrid
            trips={past}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onClick={t => onNavigate('trip', t.id)}
            emptyLabel="No past trips match your filter."
          />
        </section>
      )}

      {/* Create / Edit modal */}
      <TripFormModal
        key={editingTrip?.id ?? 'new'}
        open={formOpen}
        onClose={handleCloseForm}
        trip={editingTrip}
        onCreate={createTrip}
        onUpdate={updateTrip}
      />

      {/* Delete confirmation */}
      <AlertDialog open={tripToDelete !== null} onOpenChange={o => { if (!o) setTripToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete trip</AlertDialogTitle>
            <AlertDialogDescription>
              {tripToDelete && tripToDelete.isOngoing()
                ? 'This trip is currently in progress. Are you sure you want to delete it? This cannot be undone.'
                : 'Delete this trip? This cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTripToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
