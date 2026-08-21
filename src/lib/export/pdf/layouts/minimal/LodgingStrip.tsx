// Minimal layout — LodgingStrip.
// Single grey text line "Staying at [property]" — no coloured strip.
import { Text, StyleSheet } from '@react-pdf/renderer';
import type { LodgingStripProps } from '../index';
import { M } from './colours';

const s = StyleSheet.create({
  text: { fontSize: 8.5, fontFamily: 'Helvetica-Oblique', marginBottom: '3mm' },
});

export function LodgingStrip({ vm }: LodgingStripProps): JSX.Element {
  return <Text style={[s.text, { color: M.muted }]}>{vm.displayText}</Text>;
}
