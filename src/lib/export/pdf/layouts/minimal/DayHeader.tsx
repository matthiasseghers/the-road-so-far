// Minimal layout — DayHeader.
// Date and day number as plain text, separated from content by a thin grey rule.
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import type { DayHeaderProps } from '../index';
import { M } from './colours';

const s = StyleSheet.create({
  header:   { marginBottom: '6mm' },
  dayNum:   { fontSize: 10, fontFamily: 'Helvetica-Bold', marginBottom: 1 },
  date:     { fontSize: 9 },
  rule:     { height: 0.5, marginTop: '4mm' },
});

export function DayHeader({ dayNumberLabel, totalDays, dateLabel, title }: DayHeaderProps): JSX.Element {
  return (
    <View style={s.header}>
      <Text style={[s.dayNum, { color: M.text  }]}>Day {dayNumberLabel} / {totalDays}{title ? `  \u2014  ${title}` : ''}</Text>
      <Text style={[s.date,   { color: M.muted }]}>{dateLabel}</Text>
      <View style={[s.rule, { backgroundColor: M.rule }]} />
    </View>
  );
}
