// Minimal layout — ReservationCard.
// Indented block with grey left rule; type in small caps above title. No border card.
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import type { ReservationCardProps } from '../index';
import { M } from './colours';

const s = StyleSheet.create({
  block:    { flexDirection: 'row', marginBottom: '3mm' },
  rule:     { width: 2, marginRight: 6, borderRadius: 1 },
  body:     { flex: 1 },
  type:     { fontSize: 6.5, fontFamily: 'Helvetica-Bold', letterSpacing: 0.8, marginBottom: 1.5 },
  title:    { fontSize: 8.5, fontFamily: 'Helvetica-Bold', marginBottom: 1 },
  detail:   { fontSize: 7, marginBottom: 1 },
  status:   { fontSize: 6.5, fontFamily: 'Helvetica-Oblique', marginTop: 1 },
});

export function ReservationCard({ vm }: ReservationCardProps): JSX.Element {
  return (
    <View style={s.block} wrap={false}>
      <View style={[s.rule, { backgroundColor: M.rule }]} />
      <View style={s.body}>
        <Text style={[s.type,   { color: M.muted }]}>{vm.typeLabel.toUpperCase()}</Text>
        <Text style={[s.title,  { color: M.text  }]}>{vm.title}</Text>
        {vm.confirmationCode !== null && (
          <Text style={[s.detail, { color: M.muted }]}>{vm.confirmationCode}</Text>
        )}
        {vm.detailLines.map((line, i) => (
          <Text key={i} style={[s.detail, { color: M.muted }]}>{line}</Text>
        ))}
        <Text style={[s.status, { color: M.muted }]}>{vm.status}</Text>
      </View>
    </View>
  );
}
