import { View, Text, StyleSheet } from '@react-pdf/renderer';
import type { StatBadgeProps } from '../index';
import { C } from './colours';

const s = StyleSheet.create({
  badge: { alignItems: 'center', paddingHorizontal: 8 },
  value: { fontSize: 18, fontFamily: 'Helvetica-Bold' },
  label: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5 },
});

export function StatBadge({ value, label }: StatBadgeProps): JSX.Element {
  return (
    <View style={s.badge}>
      <Text style={[s.value, { color: C.accent }]}>{String(value)}</Text>
      <Text style={[s.label, { color: C.vmuted }]}>{label.toUpperCase()}</Text>
    </View>
  );
}
