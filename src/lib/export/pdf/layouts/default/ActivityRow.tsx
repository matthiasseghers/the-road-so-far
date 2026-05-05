import { View, Text, StyleSheet } from '@react-pdf/renderer';
import type { ActivityRowProps } from '../index';
import { C } from './colours';

const s = StyleSheet.create({
  row:           { flexDirection: 'row', gap: '2.5mm', marginBottom: '4mm' },
  timeCol:       { width: '10mm', alignItems: 'flex-end', paddingTop: 1 },
  timeText:      { fontSize: 7, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  dotCol:        { width: '6mm', alignItems: 'center' },
  dot:           { width: 8, height: 8, borderRadius: 4, marginTop: 2 },
  connector:     { flex: 1, width: 1, marginTop: 2 },
  card:          { flex: 1, borderWidth: 0.5, borderRadius: 3, padding: 3, backgroundColor: 'white' },
  title:         { fontSize: 9, fontFamily: 'Helvetica-Bold', marginBottom: 0.5 },
  type:          { fontSize: 7, fontFamily: 'Helvetica-Oblique', letterSpacing: 0.3, marginBottom: 1 },
  location:      { fontSize: 7.5, marginBottom: 1 },
  notesWrap:     { borderLeftWidth: 2, marginTop: 1.5, paddingLeft: 2 },
  notesText:     { fontSize: 7.5, fontFamily: 'Helvetica-Oblique', lineHeight: 1.45 },
});

export function ActivityRow({ vm, isLast }: ActivityRowProps): JSX.Element {
  const hasTime = vm.timeLabel !== null;
  return (
    <View style={s.row} wrap={false}>
      <View style={s.timeCol}>
        {hasTime && <Text style={[s.timeText, { color: C.accent }]}>{vm.timeLabel}</Text>}
      </View>
      <View style={s.dotCol}>
        <View style={[s.dot, {
          backgroundColor: hasTime ? C.accent : C.line,
          borderWidth:      hasTime ? 0 : 1.5,
          borderColor:      hasTime ? C.accent : C.muted,
        }]} />
        {!isLast && <View style={[s.connector, { backgroundColor: C.line }]} />}
      </View>
      <View style={[s.card, { borderColor: C.line }]}>
        <Text style={[s.title, { color: C.dark   }]}>{vm.title}</Text>
        <Text style={[s.type,  { color: C.vmuted }]}>{vm.typeLabel.toUpperCase()}</Text>
        {vm.hasLocation && vm.locationLabel !== null && (
          <Text style={[s.location, { color: C.muted }]}>{'\u2022  '}{vm.locationLabel}</Text>
        )}
        {vm.notes !== null && (
          <View style={[s.notesWrap, { borderLeftColor: C.line }]}>
            <Text style={[s.notesText, { color: C.mid }]}>{vm.notes}</Text>
          </View>
        )}
      </View>
    </View>
  );
}
