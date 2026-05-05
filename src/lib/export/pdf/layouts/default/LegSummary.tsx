import { View, Text, StyleSheet } from '@react-pdf/renderer';
import type { LegSummaryProps } from '../index';
import { C } from './colours';

const s = StyleSheet.create({
  row:       { paddingVertical: 3, paddingHorizontal: 4, borderRadius: 2, marginBottom: 1 },
  fromTo:    { flexDirection: 'row', marginBottom: 1.5 },
  place:     { flex: 1 },
  placeName: { fontSize: 7.5, fontFamily: 'Helvetica-Bold' },
  placeLoc:  { fontSize: 6.5, fontFamily: 'Helvetica-Oblique' },
  arrow:     { fontSize: 8, fontFamily: 'Helvetica-Bold', paddingHorizontal: 4, paddingTop: 1 },
  meta:      { flexDirection: 'row', alignItems: 'center' },
  modeBar:   { width: 3, height: 8, borderRadius: 1.5, marginRight: 5 },
  modeLabel: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', width: '16mm', letterSpacing: 0.2 },
  duration:  { fontSize: 7.5, fontFamily: 'Helvetica-Bold', flex: 1 },
  distance:  { fontSize: 7.5 },
});

export function LegSummary({ vm, index }: LegSummaryProps): JSX.Element {
  return (
    <View style={[s.row, { backgroundColor: index % 2 === 0 ? C.surface : 'transparent' }]}>
      <View style={s.fromTo}>
        <View style={s.place}>
          <Text style={[s.placeName, { color: C.dark  }]}>{vm.from}</Text>
          {vm.fromLocation !== null && vm.fromLocation.length > 0 && (
            <Text style={[s.placeLoc, { color: C.muted }]}>{vm.fromLocation}</Text>
          )}
        </View>
        <Text style={[s.arrow, { color: C.accent }]}>{'>'}</Text>
        <View style={s.place}>
          <Text style={[s.placeName, { color: C.dark  }]}>{vm.to}</Text>
          {vm.toLocation !== null && vm.toLocation.length > 0 && (
            <Text style={[s.placeLoc, { color: C.muted }]}>{vm.toLocation}</Text>
          )}
        </View>
      </View>
      <View style={s.meta}>
        <View style={[s.modeBar, { backgroundColor: C.accent }]} />
        <Text style={[s.modeLabel, { color: C.accent }]}>{vm.modeLabel}</Text>
        <Text style={[s.duration,  { color: C.dark   }]}>{vm.duration}</Text>
        <Text style={[s.distance,  { color: C.muted  }]}>{vm.distance}</Text>
      </View>
    </View>
  );
}
