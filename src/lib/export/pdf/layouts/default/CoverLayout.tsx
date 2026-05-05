// Default layout — Cover page.
// Visual output is identical to the former Classic + THEME_WARM output.
// Colours come from colours.ts; no theme prop.

import { View, Text, StyleSheet } from '@react-pdf/renderer';
import type { CoverViewModel } from '../index';
import { C } from './colours';
import { PageWrapper, SectionHeader, Divider, StatusPill, NotesBlock, MapPinOverlay, MapSvg } from './_shared';
import { StatBadge } from './StatBadge';

const s = StyleSheet.create({
  masthead:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderTopWidth: 4, borderBottomWidth: 1, paddingVertical: '3mm', marginBottom: '5mm' },
  mastheadBrand:     { fontSize: 8, fontFamily: 'Helvetica-Bold', letterSpacing: 1.5 },
  mastheadDate:      { fontSize: 7.5 },
  eyebrow:           { fontSize: 7.5, fontFamily: 'Helvetica-Bold', letterSpacing: 1, marginBottom: 2 },
  heroTitle:         { fontSize: 34, fontFamily: 'Helvetica-Bold', lineHeight: 1.0, letterSpacing: -0.5, marginBottom: '3mm' },
  heroSubtitle:      { fontSize: 11, fontFamily: 'Helvetica-Oblique', marginBottom: '4mm', lineHeight: 1.45 },
  metaRow:           { flexDirection: 'row', alignItems: 'center', gap: '4mm', marginBottom: '4mm' },
  metaText:          { fontSize: 8.5 },
  statsRow:          { flexDirection: 'row', gap: '6mm', marginBottom: '5mm' },
  columns:           { flexDirection: 'row', gap: '6mm' },
  column:            { flex: 1 },
  columnHeader:      { borderBottomWidth: 2, paddingBottom: '1.5mm', marginBottom: '3mm' },
  columnHeaderLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', letterSpacing: 1 },
  lodgingItem:       { marginBottom: '4mm' },
  lodgingName:       { fontSize: 10, fontFamily: 'Helvetica-Bold' },
  lodgingMetaRow:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  lodgingMeta:       { fontSize: 8 },
  dayRow:            { flexDirection: 'row', gap: '2.5mm', paddingVertical: '1.5mm', borderBottomWidth: 0.5, alignItems: 'flex-start' },
  dayNumber:         { fontSize: 7, fontFamily: 'Helvetica-Bold', width: '8mm' },
  dayDate:           { fontSize: 7.5, width: '14mm' },
  dayTitle:          { fontSize: 8, fontFamily: 'Helvetica-Bold', flex: 1 },
  emptyNote:         { fontSize: 8, fontFamily: 'Helvetica-Oblique' },
});

export function CoverLayout(vm: CoverViewModel): JSX.Element {
  return (
    <PageWrapper>

      {/* ── Masthead ── */}
      <View style={[s.masthead, { borderTopColor: C.dark, borderBottomColor: C.dark }]}>
        <Text style={[s.mastheadBrand, { color: C.dark  }]}>THE ROAD SO FAR</Text>
        <Text style={[s.mastheadDate,  { color: C.muted }]}>Generated {vm.generatedLabel}</Text>
      </View>

      {/* ── Hero ── */}
      <Text style={[s.eyebrow,    { color: C.accent }]}>Travel Itinerary</Text>
      <Text style={[s.heroTitle,  { color: C.dark   }]}>{vm.tripTitle}</Text>
      {vm.noteSubtitle !== null && (
        <Text style={[s.heroSubtitle, { color: C.mid }]}>{vm.noteSubtitle}</Text>
      )}
      <View style={s.metaRow}>
        <Text style={[s.metaText, { color: C.muted }]}>{vm.dateRangeLabel}</Text>
        {vm.durationLabel.length > 0 && (
          <>
            <Text style={[s.metaText, { color: C.line }]}>{' \u00B7 '}</Text>
            <Text style={[s.metaText, { color: C.muted }]}>{vm.durationLabel}</Text>
          </>
        )}
        <Text style={[s.metaText, { color: C.line }]}>{' \u00B7 '}</Text>
        <StatusPill status={vm.status} />
      </View>

      {/* ── Stats ── */}
      {(vm.stats.activitiesCount > 0 || vm.stats.reservationsCount > 0) && (
        <View style={s.statsRow}>
          {vm.stats.activitiesCount > 0 && (
            <StatBadge value={vm.stats.activitiesCount} label="Activities" />
          )}
          {vm.stats.reservationsCount > 0 && (
            <StatBadge value={vm.stats.reservationsCount} label="Bookings" />
          )}
          {vm.stats.countriesLabel !== null && (
            <StatBadge value={vm.stats.countriesLabel} label="Countries" />
          )}
        </View>
      )}

      <Divider marginV={14} />

      {/* ── Map — real static map or SVG schematic ── */}
      {vm.staticMap != null ? (
        <MapPinOverlay staticMap={vm.staticMap} height={120} />
      ) : (
        <MapSvg points={vm.routePoints} />
      )}

      {/* ── Two-column body ── */}
      <View style={s.columns}>

        {/* LEFT: Accommodation */}
        <View style={s.column}>
          <SectionHeader label="Accommodation" />
          {vm.lodgings.length === 0 && (
            <Text style={[s.emptyNote, { color: C.muted }]}>No accommodation added yet.</Text>
          )}
          {vm.lodgings.map(lod => (
            <View key={lod.id} style={s.lodgingItem}>
              <Text style={[s.lodgingName, { color: C.dark }]}>{lod.name}</Text>
              <View style={s.lodgingMetaRow}>
                <Text style={[s.lodgingMeta, { color: C.muted }]}>{lod.dateRange}</Text>
                <StatusPill status={lod.status} size={6.5} />
              </View>
            </View>
          ))}
          {vm.noteSubtitle !== null && (
            <View style={{ marginTop: 4 }}>
              <NotesBlock label="Trip Notes" text={vm.noteSubtitle} />
            </View>
          )}
        </View>

        {/* RIGHT: Day-by-day */}
        <View style={s.column}>
          <SectionHeader label="Day-by-Day" />
          {vm.days.map(day => (
            <View key={day.dayNumber} style={[s.dayRow, { borderBottomColor: C.line }]}>
              <Text style={[s.dayNumber, { color: C.accent }]}>Day {day.dayNumber}</Text>
              <Text style={[s.dayDate,   { color: C.muted  }]}>{day.dateLabel}</Text>
              <Text style={[s.dayTitle,  { color: C.dark   }]}>{day.title ?? '\u2014'}</Text>
            </View>
          ))}
        </View>

      </View>

      {/* eslint-disable-next-line react/jsx-curly-brace-presence */}
      <View style={{ position: 'absolute', bottom: '8mm', left: '20mm', right: '20mm', borderTopWidth: 0.5, borderTopColor: C.line, paddingTop: 3, flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 7.5, color: C.vmuted }}>{'\u2022  The Road So Far'}</Text>
        <Text style={{ fontSize: 7.5, color: C.vmuted }}>Page 1</Text>
      </View>

    </PageWrapper>
  );
}
