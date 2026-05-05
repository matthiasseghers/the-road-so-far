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

export const MinimalLayout: PdfLayout = {
  meta: {
    id:          'minimal',
    label:       'Minimal',
    description: 'Clean black-and-white typography, print-safe',
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
