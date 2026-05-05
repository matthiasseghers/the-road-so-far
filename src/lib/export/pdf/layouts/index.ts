// PdfLayout — the contract every layout must satisfy.
// Each layout is a self-contained set of components that own their own colour palette.
// To add a new layout: create layouts/newname/ implementing PdfLayout and add it to
// LAYOUT_OPTIONS in PdfExportModal and PdfPreviewPage.

import type { FC } from 'react';
import type {
  CoverViewModel,
  DayViewModel,
  ActivityViewModel,
  ReservationViewModel,
  LodgingStripViewModel,
  PdfLegViewModel,
} from '../pdf.viewmodel';

export type { CoverViewModel, DayViewModel };

// ── Per-element prop types ────────────────────────────────────────────────────

export interface ActivityRowProps {
  vm:     ActivityViewModel;
  isLast: boolean;
}

export interface ReservationCardProps {
  vm: ReservationViewModel;
}

export interface DayHeaderProps {
  dayNumberLabel: string;
  totalDays:      number;
  dateLabel:      string;
  title:          string | null;
}

export interface LodgingStripProps {
  vm: LodgingStripViewModel;
}

export interface LegSummaryProps {
  vm:    PdfLegViewModel;
  index: number;
}

export interface FooterBarProps {
  left:      string;
  right:     string;
  leftPos?:  string;
  rightPos?: string;
}

export interface StatBadgeProps {
  value: string | number;
  label: string;
}

// ── Layout contract ───────────────────────────────────────────────────────────

export interface PdfLayout {
  // Page-level components — receive the full view model as props
  CoverLayout:     FC<CoverViewModel>;
  DayLayout:       FC<DayViewModel>;

  // Primitives — exposed so they can be inspected or composed externally
  ActivityRow:     FC<ActivityRowProps>;
  ReservationCard: FC<ReservationCardProps>;
  DayHeader:       FC<DayHeaderProps>;
  LodgingStrip:    FC<LodgingStripProps>;
  LegSummary:      FC<LegSummaryProps>;
  FooterBar:       FC<FooterBarProps>;
  StatBadge:       FC<StatBadgeProps>;

  // Layout metadata — shown in the layout picker UI
  meta: {
    id:          string;
    label:       string;       // e.g. "Classic"
    description: string;       // one sentence shown below the label
  };
}
