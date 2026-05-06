// Minimal layout — LegSummary.
// Single italic grey line — no chip/badge styling.
import { Text, StyleSheet } from '@react-pdf/renderer';
import type { LegSummaryProps } from '../index';
import { M } from './colours';

const s = StyleSheet.create({
  text: { fontSize: 8, fontFamily: 'Helvetica-Oblique', marginBottom: '2mm' },
});

export function LegSummary({ vm }: LegSummaryProps): JSX.Element {
  return (
    <Text style={[s.text, { color: M.muted }]}>
      {vm.from}{' → '}{vm.to}{'  ·  '}{vm.modeLabel}{'  ·  '}{vm.duration}{'  ·  '}{vm.distance}
    </Text>
  );
}
