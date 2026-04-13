import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import GlobalCalendar from '@/components/calendar/GlobalCalendar';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { MONTH_NAMES } from '@/utils/calendar';
import './CalendarPage.css';

export default function CalendarPage(): JSX.Element {
  const today = new Date();
  const [month, setMonth] = useState<Date>(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );

  function goToPrev(): void {
    setMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  }

  function goToNext(): void {
    setMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  }

  function goToToday(): void {
    setMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  }

  return (
    <div className="calendar-page">
      <div className="cal-page__toolbar">
        <span className="cal-page__month-label">
          {MONTH_NAMES[month.getMonth()]} {month.getFullYear()}
        </span>
        <ButtonGroup aria-label="Navigate calendar">
          <Button variant="outline" size="sm" className="w-8 px-0" onClick={goToPrev} aria-label="Previous month">
            <ChevronLeft size={14} />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
          <Button variant="outline" size="sm" className="w-8 px-0" onClick={goToNext} aria-label="Next month">
            <ChevronRight size={14} />
          </Button>
        </ButtonGroup>
      </div>
      <GlobalCalendar month={month} />
    </div>
  );
}
