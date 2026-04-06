import { Navigation } from 'lucide-react';
import type { Trip } from '@/types/domain';
import { formatDate } from '@/utils/dates';
import './OngoingTripBanner.css';

interface OngoingTripBannerProps {
  trip: Trip;
  onClick: (trip: Trip) => void;
}

export default function OngoingTripBanner({ trip, onClick }: OngoingTripBannerProps): JSX.Element {
  return (
    <button className="ongoing-banner" onClick={() => onClick(trip)} type="button">
      <div className="ongoing-banner__icon">
        <Navigation size={18} />
      </div>
      <div className="ongoing-banner__content">
        <span className="ongoing-banner__label">Currently on the road</span>
        <span className="ongoing-banner__title">
          {trip.emoji} {trip.title}
        </span>
      </div>
      {trip.start_date && trip.end_date && (
        <span className="ongoing-banner__dates">
          {formatDate(trip.start_date)} – {formatDate(trip.end_date)}
        </span>
      )}
      <span className="ongoing-banner__cta">Open →</span>
    </button>
  );
}
