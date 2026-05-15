import React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import type { Trip } from '@/types/domain';
import { formatDate, timeAgo, getDaysBetween } from '@/utils/dates';
import './TripCard.css';

// Map cover_gradient key → CSS variable
const GRADIENT_MAP: Record<string, string> = {
  'warm-brown': 'var(--gradient-warm-brown)',
  'cool-blue':  'var(--gradient-cool-blue)',
  'sage':       'var(--gradient-sage)',
  'dusk':       'var(--gradient-dusk)',
  'sand':       'var(--gradient-sand)',
  'slate':      'var(--gradient-slate)',
};

interface TripCardProps {
  trip: Trip;
  onEdit: (trip: Trip) => void;
  onDelete: (trip: Trip) => void;
  onClick: (trip: Trip) => void;
}

export default function TripCard({ trip, onEdit, onDelete, onClick }: TripCardProps): JSX.Element {
  // Reason: gradient is dynamic data — must use inline style, not a CSS class
  const gradient = GRADIENT_MAP[trip.cover_gradient] ?? GRADIENT_MAP['warm-brown'];
  const hasPhoto = trip.cover_type === 'photo' && trip.cover_image_path;
  const bannerStyle: React.CSSProperties = hasPhoto
    ? { backgroundImage: `url(/covers/${encodeURIComponent(trip.cover_image_path)})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: gradient };

  const dateRange =
    trip.start_date && trip.end_date
      ? `${formatDate(trip.start_date, 'd MMM')} – ${formatDate(trip.end_date, 'd MMM yyyy')}`
      : trip.start_date
        ? `From ${formatDate(trip.start_date, 'd MMM yyyy')}`
        : null;

  const totalDays =
    trip.start_date && trip.end_date
      ? getDaysBetween(trip.start_date, trip.end_date) + 1
      : null;

  const progress = trip.computeProgress();

  function handleEdit(e: React.MouseEvent): void {
    e.stopPropagation();
    onEdit(trip);
  }

  function handleDelete(e: React.MouseEvent): void {
    e.stopPropagation();
    onDelete(trip);
  }

  return (
    <article className="trip-card" onClick={() => onClick(trip)}>

      {/* ── Banner ─────────────────────────────────────────── */}
      {/* Reason: gradient applied as inline style — dynamic data-driven colour */}
      <div
        className="trip-card__banner"
        style={bannerStyle}
        title={hasPhoto && trip.cover_image_attribution ? trip.cover_image_attribution : undefined}
      >
        <div className="trip-card__banner-overlay" />
        <span className="trip-card__emoji" role="img" aria-label="trip emoji">
          {trip.emoji}
        </span>
        {/* Status badge sits bottom-left of the banner, overlaid on the gradient */}
        <div className="trip-card__status">
          <Badge className={`trip-card__badge--${trip.status}`}>{trip.status}</Badge>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────── */}
      <div className="trip-card__body">
        <h3 className="trip-card__title">{trip.title}</h3>

        <p className="trip-card__meta">
          {dateRange ?? 'No dates set'}
          {totalDays !== null && ` · ${totalDays}d`}
        </p>

        {trip.tags.length > 0 && (
          <div className="trip-card__tags">
            {trip.tags.map(tag => (
              <Badge key={tag} variant="secondary" className="trip-card__tag">{tag}</Badge>
            ))}
          </div>
        )}

        <div className="trip-card__progress">
          <div className="trip-card__progress-header">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          {/* Reason: shadcn Progress handles accessible aria-valuenow/aria-valuemax automatically */}
          <Progress value={progress} className="trip-card__progress-bar" />
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────── */}
      <div className="trip-card__footer">
        <span className="trip-card__footer-meta">Edited {timeAgo(trip.updated_at)}</span>
        <div className="trip-card__footer-actions">
          <Button size="icon-xs" variant="ghost" onClick={handleEdit} aria-label="Edit trip">
            <Pencil size={12} />
          </Button>
          <Button size="icon-xs" variant="destructive" onClick={handleDelete} aria-label="Delete trip">
            <Trash2 size={12} />
          </Button>
        </div>
      </div>

    </article>
  );
}

