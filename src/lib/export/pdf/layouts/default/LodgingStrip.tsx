import { View, Text, StyleSheet } from '@react-pdf/renderer';
import type { LodgingStripProps } from '../index';
import { C } from './colours';

const s = StyleSheet.create({
  strip:  { flexDirection: 'row', marginBottom: '5mm', borderRadius: 2, overflow: 'hidden' },
  accent: { width: 3 },
  text:   { fontSize: 8.5, padding: '2mm', paddingLeft: 4 },
});

export function LodgingStrip({ vm }: LodgingStripProps): JSX.Element {
  return (
    <View style={[s.strip, { backgroundColor: C.lodgingBg }]}>
      <View style={[s.accent, { backgroundColor: C.accent }]} />
      <Text style={[s.text, { color: C.accent }]}>{'\u2022  '}{vm.displayText}</Text>
    </View>
  );
}
