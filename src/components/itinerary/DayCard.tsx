import { Plus, ChevronDown, CalendarPlus } from 'lucide-react';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Button } from '@/components/ui/button';
import { formatDate, todayISO } from '@/utils/dates';
import { buildDayViewModel } from '@/utils/activity';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import ActivityItem from './ActivityItem';
import type { DayWithActivities } from '@/types/domain';
import type { Activity } from '@/types/domain';
import './DayCard.css';

interface DayCardProps {
  day: DayWithActivities;
  onAddActivity: (dayId: number) => void;
  onEditActivity: (activity: Activity) => void;
  onDeleteActivity: (id: number) => void;
}

export default function DayCard({ day, onAddActivity, onEditActivity, onDeleteActivity }: DayCardProps): JSX.Element {
  const vm = buildDayViewModel(day, day.activities);

  const timedActivities = vm.activities.filter(a => a.hasTime());
  const untimedActivities = vm.activities.filter(a => !a.hasTime());
  const isEmpty = vm.activities.length === 0;

  // Reason: both day.date and todayISO() are YYYY-MM-DD strings — direct comparison is timezone-safe.
  const isToday = day.date === todayISO();

  return (
    <article className={`day-card${isToday ? ' day-card--today' : ''}`}>
      <header className="day-card__header">
        <div className={`day-card__date-block${isToday ? ' day-card__date-block--today' : ''}`}>
          <span className="day-card__weekday">{isToday ? 'Today' : formatDate(day.date, 'EEE')}</span>
          <span className="day-card__day-num">{formatDate(day.date, 'd')}</span>
        </div>
        <div className="day-card__title-row">
          <span className="day-card__date-full">{formatDate(day.date, 'MMM d, yyyy')}</span>
          {day.notes && <p className="day-card__notes">{day.notes}</p>}
        </div>
        <Button
          variant="ghost"
          className="day-card__add-btn"
          onClick={() => onAddActivity(day.id)}
          type="button"
          aria-label={`Add activity on ${day.date}`}
        >
          <Plus size={14} />
          Add
        </Button>
      </header>

      <div className="day-card__body">
        {isEmpty && (
          <Empty className="py-4">
            <EmptyHeader>
              <EmptyMedia variant="icon"><CalendarPlus /></EmptyMedia>
              <EmptyTitle>Nothing planned yet</EmptyTitle>
            </EmptyHeader>
          </Empty>
        )}

        {timedActivities.length > 0 && (
          <section className="day-card__section">
            <h4 className="day-card__section-label">Scheduled</h4>
            <ul className="day-card__activity-list">
              {timedActivities.map(a => (
                <li key={a.id}>
                  <ActivityItem activity={a} onEdit={onEditActivity} onDelete={onDeleteActivity} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {untimedActivities.length > 0 && (
          // Reason: Collapsible handles open state and aria-expanded automatically;
          // data-[state=open] on the trigger drives the chevron rotation via CSS.
          <Collapsible>
            <section className="day-card__section day-card__section--maybe">
              <CollapsibleTrigger className="day-card__maybe-toggle" type="button">
                <span className="day-card__section-label">Unscheduled ({untimedActivities.length})</span>
                <ChevronDown size={14} className="day-card__maybe-chevron" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ul className="day-card__activity-list day-card__activity-list--maybe">
                  {untimedActivities.map(a => (
                    <li key={a.id}>
                      <ActivityItem activity={a} onEdit={onEditActivity} onDelete={onDeleteActivity} />
                    </li>
                  ))}
                </ul>
              </CollapsibleContent>
            </section>
          </Collapsible>
        )}
      </div>
    </article>
  );
}
