import { Luggage, Plus } from 'lucide-react';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyContent } from '@/components/ui/empty';
import { Button } from '@/components/ui/button';
import TripCard from './TripCard';
import type { Trip } from '@/types/domain';
import './TripGrid.css';

interface TripGridProps {
  trips: Trip[];
  onEdit: (trip: Trip) => void;
  onDelete: (trip: Trip) => void;
  onClick: (trip: Trip) => void;
  emptyLabel?: string;
  onAdd?: () => void;
}

export default function TripGrid({ trips, onEdit, onDelete, onClick, emptyLabel = 'No trips here yet.', onAdd }: TripGridProps): JSX.Element {
  if (trips.length === 0) {
    return (
      <Empty className="py-12">
        <EmptyHeader>
          <EmptyMedia variant="icon"><Luggage /></EmptyMedia>
          <EmptyTitle>{emptyLabel}</EmptyTitle>
        </EmptyHeader>
        {onAdd && (
          <EmptyContent>
            <Button size="sm" onClick={onAdd} type="button"><Plus size={14} />New trip</Button>
          </EmptyContent>
        )}
      </Empty>
    );
  }

  return (
    <div className="trip-grid">
      {trips.map(trip => (
        <TripCard
          key={trip.id}
          trip={trip}
          onEdit={onEdit}
          onDelete={onDelete}
          onClick={onClick}
        />
      ))}
    </div>
  );
}
