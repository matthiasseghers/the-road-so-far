// Minimal layout — ActivityRow.
// Single line: time (grey, fixed-width column) then title. No icons.
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import type { ActivityRowProps } from '../index';
import { M } from './colours';

const s = StyleSheet.create({
  row:      { flexDirection: 'row', marginBottom: '3mm', gap: '4mm' },
  timeCol:  { width: '12mm' },
  timeText: { fontSize: 7.5, color: '#6B7280', textAlign: 'right' },
  title:    { flex: 1, fontSize: 9, fontFamily: 'Helvetica-Bold' },
});

export function ActivityRow({ vm }: ActivityRowProps): JSX.Element {
  return (
    <View style={s.row} wrap={false}>
      <View style={s.timeCol}>
        {vm.timeLabel !== null && (
          <Text style={[s.timeText, { color: M.muted }]}>{vm.timeLabel}</Text>
        )}
      </View>
      <Text style={[s.title, { color: M.text }]}>{vm.title}</Text>
    </View>
  );
}
