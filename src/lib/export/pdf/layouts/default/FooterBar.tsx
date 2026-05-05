import { View, Text, StyleSheet } from '@react-pdf/renderer';
import type { FooterBarProps } from '../index';
import { C } from './colours';

const s = StyleSheet.create({
  bar:  { position: 'absolute', bottom: '8mm', flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, paddingTop: 3 },
  text: { fontSize: 7.5 },
});

export function FooterBar({ left, right, leftPos = '20mm', rightPos = '20mm' }: FooterBarProps): JSX.Element {
  return (
    <View style={[s.bar, { left: leftPos, right: rightPos, borderTopColor: C.line }]}>
      <Text style={[s.text, { color: C.vmuted }]}>{left}</Text>
      <Text style={[s.text, { color: C.vmuted }]}>{right}</Text>
    </View>
  );
}
