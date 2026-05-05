// Default layout — Day page.
// Visual output is identical to the former Classic + THEME_WARM output.
// Colours come from colours.ts; no theme prop.

import { View, Text, StyleSheet } from '@react-pdf/renderer';
import type { DayViewModel } from '../index';
import { C } from './colours';
import { PageWrapper, SectionHeader, NotesBlock, MapPinOverlay } from './_shared';
import { ActivityRow }     from './ActivityRow';
import { ReservationCard } from './ReservationCard';
import { DayHeader }       from './DayHeader';
import { LodgingStrip }    from './LodgingStrip';
import { LegSummary }      from './LegSummary';
import { FooterBar }       from './FooterBar';

const s = StyleSheet.create({
  subtitle:          { fontSize: 9, fontFamily: 'Helvetica-Oblique', marginBottom: '4mm' },
  columns:           { flexDirection: 'row', gap: '7mm', flex: 1 },
  leftCol:           { flex: 6 },
  rightCol:          { flex: 4 },
  travelSection:     { marginTop: '5mm' },
  legTotalsRow:      { flexDirection: 'row', alignItems: 'center', marginTop: 3, paddingTop: 3, borderTopWidth: 0.5, paddingHorizontal: 4 },
  legTotalsGap:      { width: 3, marginRight: 5 },
  legTotalsLabel:    { fontSize: 7, fontFamily: 'Helvetica-Bold', width: '16mm', letterSpacing: 0.3 },
  legTotalsDuration: { fontSize: 7, fontFamily: 'Helvetica-Bold', flex: 1 },
  legTotalsDistance: { fontSize: 7 },
  bookingsHeader:    { borderBottomWidth: 2, paddingBottom: 1.5, marginBottom: '4mm' },
  bookingsHeaderText:{ fontSize: 7, fontFamily: 'Helvetica-Bold', letterSpacing: 1 },
  emptyText:         { fontSize: 8.5, fontFamily: 'Helvetica-Oblique' },
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
        <Text style={[s.subtitle, { color: C.mid }]}>{vm.subtitle}</Text>
      )}

      {vm.lodgingStrips.map((strip, i) => (
        <LodgingStrip key={i} vm={strip} />
      ))}

      {/* ── Two-column body ── */}
      <View style={s.columns}>

        {/* LEFT (60%): Schedule + Travel */}
        <View style={s.leftCol}>
          {vm.activities.length > 0 && <SectionHeader label="Schedule" />}
          {vm.activities.map((act, i) => (
            <ActivityRow key={act.id} vm={act} isLast={i === vm.activities.length - 1} />
          ))}
          {vm.activities.length === 0 && vm.reservations.length === 0 && (
            <Text style={[s.emptyText, { color: C.muted }]}>No activities planned for this day.</Text>
          )}

          {vm.legs.length > 0 && (
            <View style={s.travelSection}>
              <SectionHeader label="Travel" />
              {vm.legs.map((leg, i) => (
                <LegSummary key={i} vm={leg} index={i} />
              ))}
              {vm.legs.length > 1 && vm.legsTotalDuration !== null && vm.legsTotalDistance !== null && (
                <View style={[s.legTotalsRow, { borderTopColor: C.line }]}>
                  <View style={s.legTotalsGap} />
                  <Text style={[s.legTotalsLabel,    { color: C.vmuted }]}>TOTAL</Text>
                  <Text style={[s.legTotalsDuration, { color: C.dark   }]}>{vm.legsTotalDuration}</Text>
                  <Text style={[s.legTotalsDistance, { color: C.muted  }]}>{vm.legsTotalDistance}</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* RIGHT (40%): Map + Bookings + Notes */}
        <View style={s.rightCol}>
          {vm.staticMap != null && (
            <MapPinOverlay staticMap={vm.staticMap} height={90} />
          )}

          {vm.reservations.length > 0 && (
            <>
              <View style={[s.bookingsHeader, { borderBottomColor: C.dark }]}>
                <Text style={[s.bookingsHeaderText, { color: C.vmuted }]}>Bookings</Text>
              </View>
              {vm.reservations.map(res => (
                <ReservationCard key={res.id} vm={res} />
              ))}
            </>
          )}

          {vm.noteText !== null && (
            <View style={{ marginTop: vm.reservations.length > 0 ? 3 : 0 }}>
              <NotesBlock label="Day Notes" text={vm.noteText} />
            </View>
          )}
        </View>

      </View>

      <FooterBar left={'\u2022  The Road So Far'} right={vm.footerLabel} />

    </PageWrapper>
  );
}
