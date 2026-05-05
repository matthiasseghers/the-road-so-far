import { View, Text, StyleSheet } from '@react-pdf/renderer';
import type { DayHeaderProps } from '../index';
import { C } from './colours';

const s = StyleSheet.create({
  headerBand: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: '5mm',
    // Reason: negative margins bleed the header band to the page edge.
    marginHorizontal: '-20mm',
    marginTop: '-20mm',
    paddingHorizontal: '20mm',
    paddingVertical: '5mm',
    marginBottom: '8mm',
  },
  dayNum: { fontSize: 24, fontFamily: 'Helvetica-Bold', letterSpacing: -0.5 },
  total:  { fontSize: 9 },
  date:   { fontSize: 9 },
  title:  { fontSize: 16, fontFamily: 'Helvetica-Bold', marginLeft: 'auto', textAlign: 'right' },
});

export function DayHeader({ dayNumberLabel, totalDays, dateLabel, title }: DayHeaderProps): JSX.Element {
  return (
    <View style={[s.headerBand, { backgroundColor: C.dark }]}>
      <Text style={[s.dayNum, { color: 'white'                  }]}>{dayNumberLabel}</Text>
      <Text style={[s.total,  { color: 'rgba(255,255,255,0.5)'  }]}>/ {totalDays}</Text>
      <Text style={[s.date,   { color: 'rgba(255,255,255,0.75)' }]}>{dateLabel}</Text>
      {title !== null && (
        <Text style={[s.title, { color: 'white' }]}>{title}</Text>
      )}
    </View>
  );
}
