import { View, Text, StyleSheet } from '@react-pdf/renderer';
import type { ReservationCardProps } from '../index';
import { StatusPill } from './_shared';
import { C } from './colours';

const s = StyleSheet.create({
  card:         { borderWidth: 0.5, borderRadius: 3, padding: 2.5, marginBottom: 3 },
  type:         { fontSize: 6.5, fontFamily: 'Helvetica-Bold', letterSpacing: 0.6, marginBottom: 1 },
  title:        { fontSize: 8, fontFamily: 'Helvetica-Bold', marginBottom: 0.5 },
  confirmation: { fontSize: 7, marginBottom: 1.5 },
  detailLine:   { fontSize: 7, marginBottom: 1 },
});

export function ReservationCard({ vm }: ReservationCardProps): JSX.Element {
  return (
    <View style={[s.card, { borderColor: C.line, backgroundColor: C.surface }]} wrap={false}>
      <Text style={[s.type,         { color: C.vmuted }]}>{vm.typeLabel.toUpperCase()}</Text>
      <Text style={[s.title,        { color: C.dark   }]}>{vm.title}</Text>
      {vm.confirmationCode !== null && (
        <Text style={[s.confirmation, { color: C.muted }]}>{vm.confirmationCode}</Text>
      )}
      {vm.detailLines.map((line, i) => (
        <Text key={i} style={[s.detailLine, { color: C.mid }]}>{line}</Text>
      ))}
      <StatusPill status={vm.status} size={6.5} />
    </View>
  );
}
