// Minimal layout — StatBadge.
// Inline text label rather than a badge component.
import { Text, StyleSheet } from '@react-pdf/renderer';
import type { StatBadgeProps } from '../index';
import { M } from './colours';

const s = StyleSheet.create({
  text: { fontSize: 8.5 },
});

export function StatBadge({ value, label }: StatBadgeProps): JSX.Element {
  return (
    <Text style={[s.text, { color: M.muted }]}>{value} {label.toLowerCase()}</Text>
  );
}
