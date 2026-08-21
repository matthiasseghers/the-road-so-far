import * as React from 'react';
import { format, parseISO, isValid } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import type { Matcher } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DatePickerProps {
  /** ISO date string YYYY-MM-DD, or empty string when no date is set. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** Shows a destructive border when true. */
  hasError?: boolean;
  /** Disables all dates before this date. */
  minDate?: Date;
  /** Disables all dates after this date. */
  maxDate?: Date;
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  className,
  hasError,
  minDate,
  maxDate,
}: DatePickerProps): JSX.Element {
  const [open, setOpen] = React.useState(false);
  const parsed = value ? parseISO(value) : undefined;
  const selected = parsed && isValid(parsed) ? parsed : undefined;

  // Reason: build disabled matchers only when bounds are provided; DayPicker
  // DateInterval requires non-optional Date values, so split into separate matchers.
  const disabledMatchers: Matcher[] = [];
  if (minDate) disabledMatchers.push({ before: minDate });
  if (maxDate) disabledMatchers.push({ after: maxDate });

  return (
    // Reason: uses standard Portal-based PopoverContent for correct positioning.
    // DialogContent intercepts onPointerDownOutside and prevents close when clicking
    // on [data-radix-popper-content-wrapper] — so the calendar stays open inside dialogs.
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            'w-full justify-start text-left font-normal',
            !selected && 'text-muted-foreground',
            hasError && 'border-destructive',
            className,
          )}
        >
          <CalendarIcon className="mr-2 size-4 opacity-70" />
          {selected ? format(selected, 'd MMM yyyy') : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={date => {
            if (date) {
              onChange(format(date, 'yyyy-MM-dd'));
              setOpen(false);
            }
          }}
          disabled={disabledMatchers.length > 0 ? disabledMatchers : undefined}
          defaultMonth={selected ?? minDate}
        />
      </PopoverContent>
    </Popover>
  );
}
