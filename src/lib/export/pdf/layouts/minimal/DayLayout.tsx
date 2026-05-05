// Minimal layout — Day page.
// Single-column layout: DayHeader, lodging strips, activities (time + title),
// reservations (grey-rule cards), notes, travel legs as plain text.

import { View, Text, StyleSheet } from '@react-pdf/renderer';
import type { DayViewModel } from '../index';
import { M } from './colours';
import { PageWrapper }    from './_shared';
import { ActivityRow }    from './ActivityRow';
import { ReservationCard } from './ReservationCard';
import { DayHeader }      from './DayHeader';
import { LodgingStrip }   from './LodgingStrip';
import { LegSummary }     from './LegSummary';
import { FooterBar }      from './FooterBar';

const s = StyleSheet.create({
  subtitle:    { fontSize: 9, fontFamily: 'Helvetica-Oblique', marginBottom: '3mm' },
  sectionLabel:{ fontSize: 7, fontFamily: 'Helvetica-Bold', letterSpacing: 1, marginBottom: '3mm', color: '#6B7280' },
  section:     { marginBottom: '5mm' },
  emptyText:   { fontSize: 8.5, fontFamily: 'Helvetica-Oblique' },
  rule:        { height: 0.5, marginVertical: '3mm' },
  notesWrap:   { flexDirection: 'row', marginBottom: '4mm' },
  notesRule:   { width: 2, marginRight: 6, borderRadius: 1 },
  notesBody:   {},
  notesLabel:  { fontSize: 6.5, fontFamily: 'Helvetica-Bold', letterSpacing: 0.6, marginBottom: 2 },
  notesText:   { fontSize: 8, fontFamily: 'Helvetica-Oblique', lineHeight: 1.5 },
});

export function DayLayout(vm: DayViewModel): JSX.Element {
  return (
    <PageWrapper paddingBottom="15mm">

      <DayHeader
        dayNumberLabel={vm.dayNumberLabel}
        totalDays={vm.totalDays}
        dateLabel={vm.dateLabel}
        title={vm.title}
      />

      {vm.subtitle !== null && (
        <Text style={[s.subtitle, { color: M.muted }]}>{vm.subtitle}</Text>
      )}

      {vm.lodgingStrips.map((strip, i) => (
        <LodgingStrip key={i} vm={strip} />
      ))}

      {/* Activities */}
      {vm.activities.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionLabel}>SCHEDULE</Text>
          {vm.activities.map((act, i) => (
            <ActivityRow key={act.id} vm={act} isLast={i === vm.activities.length - 1} />
          ))}
        </View>
      )}

      {vm.activities.length === 0 && vm.reservations.length === 0 && (
        <Text style={[s.emptyText, { color: M.muted }]}>No activities planned for this day.</Text>
      )}

      {/* Travel */}
      {vm.legs.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionLabel}>TRAVEL</Text>
          {vm.legs.map((leg, i) => (
            <LegSummary key={i} vm={leg} index={i} />
          ))}
        </View>
      )}

      {/* Reservations */}
      {vm.reservations.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionLabel}>BOOKINGS</Text>
          {vm.reservations.map(res => (
            <ReservationCard key={res.id} vm={res} />
          ))}
        </View>
      )}

      {/* Notes */}
      {vm.noteText !== null && (
        <View style={[s.notesWrap, { marginBottom: 0 }]}>
          <View style={[s.notesRule, { backgroundColor: M.rule }]} />
          <View style={s.notesBody}>
            <Text style={[s.notesLabel, { color: M.muted }]}>DAY NOTES</Text>
            <Text style={[s.notesText,  { color: M.muted }]}>{vm.noteText}</Text>
          </View>
        </View>
      )}

      <FooterBar left="" right={vm.footerLabel} />

    </PageWrapper>
  );
}
