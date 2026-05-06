// Minimal layout — Cover page.
// White page, trip title centred in large type, date range below, thin grey rule,
// stats as inline text, accommodation and day list in a clean typographic grid.
// No colour bars or accent colours.

import { View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import type { CoverViewModel } from '../index';
import { M } from './colours';
import { PageWrapper } from './_shared';
import { StatBadge }  from './StatBadge';

const s = StyleSheet.create({
  // Hero block — centred typographic title section
  hero:      { alignItems: 'center', marginBottom: '10mm', paddingTop: '8mm' },
  brand:     { fontSize: 7, fontFamily: 'Helvetica-Bold', letterSpacing: 2, marginBottom: '6mm' },
  title:     { fontSize: 36, fontFamily: 'Helvetica-Bold', textAlign: 'center', marginBottom: '3mm', lineHeight: 1.0, letterSpacing: -1 },
  dateRange: { fontSize: 10, textAlign: 'center', marginBottom: '2mm' },
  duration:  { fontSize: 9, textAlign: 'center', marginBottom: '4mm' },
  statsRow:  { flexDirection: 'row', gap: '6mm', marginBottom: '2mm' },
  // Thin rule
  rule:      { height: 0.5, marginVertical: '6mm' },
  // Columns
  columns:   { flexDirection: 'row', gap: '12mm' },
  column:    { flex: 1 },
  colHeader: { fontSize: 7, fontFamily: 'Helvetica-Bold', letterSpacing: 1, marginBottom: '3mm', borderBottomWidth: 0.5, paddingBottom: '1mm' },
  // Lodging item
  lodgingName:  { fontSize: 9, fontFamily: 'Helvetica-Bold', marginBottom: 1 },
  lodgingMeta:  { fontSize: 7.5, marginBottom: '3mm' },
  emptyNote:    { fontSize: 8, fontFamily: 'Helvetica-Oblique' },
  // Day row
  dayRow:     { flexDirection: 'row', gap: '3mm', marginBottom: '2mm' },
  dayNum:     { fontSize: 7.5, width: '10mm' },
  dayDate:    { fontSize: 7.5, width: '16mm' },
  dayTitle:   { fontSize: 7.5, fontFamily: 'Helvetica-Bold', flex: 1 },
});

export function CoverLayout(vm: CoverViewModel): JSX.Element {
  return (
    <PageWrapper>

      {/* ── Centred hero block ── */}
      <View style={s.hero}>
        <Text style={[s.brand,     { color: M.muted }]}>THE ROAD SO FAR</Text>
        {/* Optional cover photo above the title */}
        {vm.coverImageDataUrl && (
          <View style={{ width: '100%', marginBottom: '5mm', position: 'relative' }}>
            <Image src={vm.coverImageDataUrl} style={{ width: '100%', height: '40mm', objectFit: 'cover', borderRadius: 2 }} />
            {vm.coverImageAttribution && (
              <Text style={{ position: 'absolute', bottom: 3, right: 5, fontSize: 6, color: 'rgba(255,255,255,0.75)' }}>
                {vm.coverImageAttribution}
              </Text>
            )}
          </View>
        )}
        <Text style={[s.title,     { color: M.text  }]}>{vm.tripTitle}</Text>
        <Text style={[s.dateRange, { color: M.muted }]}>{vm.dateRangeLabel}</Text>
        {vm.durationLabel.length > 0 && (
          <Text style={[s.duration, { color: M.muted }]}>{vm.durationLabel}{'  ·  '}Generated {vm.generatedLabel}</Text>
        )}
        {(vm.stats.activitiesCount > 0 || vm.stats.reservationsCount > 0) && (
          <View style={s.statsRow}>
            {vm.stats.activitiesCount > 0 && (
              <StatBadge value={vm.stats.activitiesCount} label="Activities" />
            )}
            {vm.stats.reservationsCount > 0 && (
              <StatBadge value={vm.stats.reservationsCount} label="Bookings" />
            )}
          </View>
        )}
      </View>

      <View style={[s.rule, { backgroundColor: M.rule }]} />

      {/* ── Two-column body ── */}
      <View style={s.columns}>

        {/* LEFT: Accommodation */}
        <View style={s.column}>
          <Text style={[s.colHeader, { color: M.muted, borderBottomColor: M.rule }]}>
            ACCOMMODATION
          </Text>
          {vm.lodgings.length === 0 && (
            <Text style={[s.emptyNote, { color: M.muted }]}>No accommodation added.</Text>
          )}
          {vm.lodgings.map(lod => (
            <View key={lod.id}>
              <Text style={[s.lodgingName, { color: M.text  }]}>{lod.name}</Text>
              <Text style={[s.lodgingMeta, { color: M.muted }]}>{lod.dateRange}{'  ·  '}{lod.status}</Text>
            </View>
          ))}
        </View>

        {/* RIGHT: Day-by-day */}
        <View style={s.column}>
          <Text style={[s.colHeader, { color: M.muted, borderBottomColor: M.rule }]}>
            DAY BY DAY
          </Text>
          {vm.days.map(day => (
            <View key={day.dayNumber} style={s.dayRow}>
              <Text style={[s.dayNum,   { color: M.muted }]}>{day.dayNumber}</Text>
              <Text style={[s.dayDate,  { color: M.muted }]}>{day.dateLabel}</Text>
              <Text style={[s.dayTitle, { color: M.text  }]}>{day.title ?? '\u2014'}</Text>
            </View>
          ))}
        </View>

      </View>

      {/* ── Footer: page number only ── */}
      <View style={{ position: 'absolute', bottom: '8mm', left: '20mm', right: '20mm' }}>
        <Text style={{ fontSize: 7, textAlign: 'right', color: M.muted }}>1</Text>
      </View>

    </PageWrapper>
  );
}
