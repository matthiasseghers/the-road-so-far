// Minimal layout — FooterBar.
// Page number only, right-aligned, small grey text.
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import type { FooterBarProps } from '../index';
import { M } from './colours';

const s = StyleSheet.create({
  bar:  { position: 'absolute', bottom: '8mm', left: '20mm', right: '20mm' },
  text: { fontSize: 7, textAlign: 'right' },
});

export function FooterBar({ right }: FooterBarProps): JSX.Element {
  return (
    <View style={s.bar}>
      <Text style={[s.text, { color: M.muted }]}>{right}</Text>
    </View>
  );
}
