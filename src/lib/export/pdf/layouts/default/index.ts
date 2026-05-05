import type { PdfLayout } from '../index';
import { CoverLayout }    from './CoverLayout';
import { DayLayout }      from './DayLayout';
import { ActivityRow }    from './ActivityRow';
import { ReservationCard } from './ReservationCard';
import { DayHeader }      from './DayHeader';
import { LodgingStrip }   from './LodgingStrip';
import { LegSummary }     from './LegSummary';
import { FooterBar }      from './FooterBar';
import { StatBadge }      from './StatBadge';

export const DefaultLayout: PdfLayout = {
  meta: {
    id:          'default',
    label:       'Classic',
    description: 'Structured two-column layout with warm purple accents',
  },
  CoverLayout,
  DayLayout,
  ActivityRow,
  ReservationCard,
  DayHeader,
  LodgingStrip,
  LegSummary,
  FooterBar,
  StatBadge,
};
