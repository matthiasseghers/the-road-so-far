import { useCalendarDays } from '@/hooks/useCalendarDays';
import { buildMonthGrid, getMonthsForRange, WEEKDAY_HEADERS, MONTH_NAMES } from '@/utils/calendar';
import type { CalendarDayRow } from '@/types/db';
import { Skeleton } from '@/components/ui/skeleton';
import './TripCalendar.css';

interface TripCalendarProps {
  tripId: number;
  startDate: string | null;
  endDate: string | null;
}

// ── Day cell content ──────────────────────────────────────────────────────────

const MAX_VISIBLE_ACTIVITIES = 3;

function DayCellContent({ day }: { day: CalendarDayRow }): JSX.Element {
  const isTravel = day.status === 'travel';
  const showActWarning    = !isTravel && day.activity_count === 0;
  const showLodgingWarning = !isTravel && !day.has_lodging;

  const visibleTitles = day.activity_titles.slice(0, MAX_VISIBLE_ACTIVITIES);
  const extraCount    = day.activity_count - visibleTitles.length;

  return (
    <>
      {day.lodging_title && (
        <div className="trip-cal__lodging-bar">{day.lodging_title}</div>
      )}
      {isTravel && (
        <span className="trip-cal__badge trip-cal__badge--travel">Travel</span>
      )}
      {visibleTitles.map((title, i) => (
        <div key={i} className="trip-cal__activity">{title}</div>
      ))}
      {extraCount > 0 && (
        <div className="trip-cal__more">+{extraCount} more</div>
      )}
      {showActWarning && (
        <span className="trip-cal__badge trip-cal__badge--warn">No activities</span>
      )}
      {showLodgingWarning && (
        <span className="trip-cal__badge trip-cal__badge--warn">No lodging</span>
      )}
    </>
  );
}

// ── Month grid section ────────────────────────────────────────────────────────

const TODAY_ISO = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
})();

function MonthGrid({
  year,
  month,
  byDate,
  startISO,
  endISO,
}: {
  year: number;
  month: number;
  byDate: Record<string, CalendarDayRow>;
  startISO: string;
  endISO: string;
}): JSX.Element {
  const cells = buildMonthGrid(year, month);

  return (
    <section className="trip-cal__month">
      <h3 className="trip-cal__month-heading">
        {MONTH_NAMES[month]} {year}
      </h3>
      <div className="trip-cal__grid">
        {WEEKDAY_HEADERS.map(h => (
          <div key={h} className="trip-cal__weekday">{h}</div>
        ))}
        {cells.map((cell, i) => {
          if (cell.isPadding) {
            return <div key={i} className="trip-cal__cell trip-cal__cell--pad" />;
          }
          const inRange = cell.iso >= startISO && cell.iso <= endISO;
          const calDay = byDate[cell.iso];
          const isToday = cell.iso === TODAY_ISO;
          return (
            <div
              key={cell.iso}
              className={[
                'trip-cal__cell',
                !inRange && 'trip-cal__cell--out',
                isToday && 'trip-cal__cell--today',
              ].filter(Boolean).join(' ')}
            >
              <span className="trip-cal__day-num">{cell.dayOfMonth}</span>
              {inRange && calDay && (
                <>
                  {calDay.label && <span className="trip-cal__label">{calDay.label}</span>}
                  <DayCellContent day={calDay} />
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TripCalendar({ tripId, startDate, endDate }: TripCalendarProps): JSX.Element {
  const { byDate, isLoading } = useCalendarDays(tripId);

  if (!startDate || !endDate) {
    return (
      <div className="trip-cal trip-cal--empty">
        <p>No dates set for this trip.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="trip-cal">
        <section className="trip-cal__month">
          <Skeleton className="h-4 w-28 mb-3" />
          <div className="trip-cal__grid">
            {WEEKDAY_HEADERS.map(h => (
              <Skeleton key={h} className="h-5" />
            ))}
            {Array.from({ length: 35 }).map((_, i) => (
              <Skeleton key={i} className="min-h-[90px] rounded-[var(--radius-sm)]" />
            ))}
          </div>
        </section>
      </div>
    );
  }

  const months = getMonthsForRange(startDate, endDate);

  return (
    <div className="trip-cal">
      {months.map(({ year, month }) => (
        <MonthGrid
          key={`${year}-${month}`}
          year={year}
          month={month}
          byDate={byDate}
          startISO={startDate}
          endISO={endDate}
        />
      ))}
    </div>
  );
}
