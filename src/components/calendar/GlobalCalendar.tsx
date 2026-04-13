import { useTrips } from '@/hooks/useTrips';
import { Skeleton } from '@/components/ui/skeleton';
import { buildMonthGrid, WEEKDAY_HEADERS } from '@/utils/calendar';
import type { Trip } from '@/domain/Trip';
import './GlobalCalendar.css';

// ── Trip block colour palette ────────────────────────────────────────────────

const TRIP_PALETTE = [
  'var(--res-lodging)',
  'var(--res-flight)',
  'var(--res-transit)',
  'var(--res-car)',
  'var(--res-restaurant)',
] as const;

function tripColor(index: number): string {
  return TRIP_PALETTE[index % TRIP_PALETTE.length] as string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function toLocalISO(date: Date): string {
  // Reason: toISOString() returns UTC which can shift the date by ±1 day
  // depending on timezone — always use local date components for display.
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const TODAY_ISO = toLocalISO(new Date());

function tripsForDay(trips: Trip[], iso: string): Array<{ trip: Trip; colorIdx: number }> {
  return trips
    .map((trip, idx) => ({ trip, colorIdx: idx }))
    .filter(({ trip }) => {
      if (!trip.start_date || !trip.end_date) return false;
      return iso >= trip.start_date && iso <= trip.end_date;
    });
}

// ── Props ────────────────────────────────────────────────────────────────────

interface GlobalCalendarProps {
  month: Date;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function GlobalCalendar({ month }: GlobalCalendarProps): JSX.Element {
  const { trips, loading } = useTrips();
  const cells = buildMonthGrid(month.getFullYear(), month.getMonth());

  return (
    <div className="gcal">
      {/* ── Trip legend ── */}
      {trips.length > 0 && (
        <div className="gcal__legend">
          {trips.map((trip, idx) => (
            <span key={trip.id} className="gcal__legend-item">
              <span className="gcal__legend-dot" style={{ background: tripColor(idx) }} />
              {trip.title}
            </span>
          ))}
        </div>
      )}

      {/* ── Grid ── */}
      <div className="gcal__grid">
        {WEEKDAY_HEADERS.map(h => (
          <div key={h} className="gcal__weekday">{h}</div>
        ))}
        {loading ? (
          Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={i} className="min-h-[80px] rounded-[var(--radius-sm)]" />
          ))
        ) : (
          cells.map((cell, i) => {
            if (cell.isPadding) {
              return <div key={i} className="gcal__cell gcal__cell--pad" />;
            }
            const dayTrips = tripsForDay(trips, cell.iso);
            return (
              <div
                key={cell.iso}
                className={`gcal__cell${cell.iso === TODAY_ISO ? ' gcal__cell--today' : ''}`}
              >
                <span className="gcal__day-num">{cell.dayOfMonth}</span>
                <div className="gcal__blocks">
                  {dayTrips.map(({ trip, colorIdx }) => (
                    <div
                      key={trip.id}
                      className="gcal__trip-block"
                      style={{ background: tripColor(colorIdx) }}
                      title={trip.title}
                    >
                      <span className="gcal__trip-block-title">{trip.emoji} {trip.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
