// Day page PDF component — matches the B2 mockup design.
// Dark band header + lodging strip + two-column layout (timeline left, map+bookings right).

import { Page, View, Text } from '@react-pdf/renderer';
import { format, parseISO } from 'date-fns';
import type { PdfTheme } from './theme';
import type { DayWithActivities } from '@/types/domain';
import type { Reservation } from '@/domain/Reservation';
import { StatusPill, SectionHeading, LodgingStrip, NotesBlock, MapSvg } from './shared';
import { activityTypeLabel, reservationTypeLabel, buildLodgingStripText, stripTiptapJson } from './helpers';
import { formatActivityTime } from '@/utils/format';
import type { GeoPoint } from './helpers';

const PAD = '20mm';

// ── Timeline item ─────────────────────────────────────────────────────────────

interface TimelineItemProps {
  title:    string;
  type:     string;
  time:     string;   // "" = no time
  location: string | null;
  notes:    string | null;
  isLast:   boolean;
  theme:    PdfTheme;
}

function TimelineItem({ title, type, time, location, notes, isLast, theme }: TimelineItemProps): JSX.Element {
  const hasTme = time.length > 0;

  return (
    <View style={{ flexDirection: 'row', gap: '2.5mm', marginBottom: '4mm' }}>
      {/* Time or empty spacer */}
      <View style={{ width: '10mm', alignItems: 'flex-end', paddingTop: 1 }}>
        {hasTme && (
          <Text style={{ fontSize: 7, color: theme.accent, fontFamily: 'Helvetica-Bold', textAlign: 'right' }}>{time}</Text>
        )}
      </View>

      {/* Dot + connector */}
      <View style={{ width: '6mm', alignItems: 'center' }}>
        <View style={{
          width: 8, height: 8, borderRadius: 4, marginTop: 2,
          backgroundColor:  hasTme ? theme.accent : theme.line,
          borderWidth:      hasTme ? 0 : 1.5,
          borderColor:      hasTme ? theme.accent : theme.muted,
        }} />
        {!isLast && (
          <View style={{ flex: 1, width: 1, backgroundColor: theme.line, marginTop: 2 }} />
        )}
      </View>

      {/* Card */}
      <View style={{ flex: 1, border: `0.5 solid ${theme.line}`, borderRadius: 3, padding: 3, backgroundColor: 'white' }}>
        <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: theme.dark, marginBottom: 0.5 }}>
          {title}
        </Text>
        <Text style={{ fontSize: 7, color: theme.vmuted, fontFamily: 'Helvetica-Oblique', letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 1 }}>
          {activityTypeLabel(type)}
        </Text>
        {location !== null && location.length > 0 && (
          <Text style={{ fontSize: 7.5, color: theme.muted, marginBottom: 1 }}>
            {'\u2022  '}{location}
          </Text>
        )}
        {notes !== null && notes.length > 0 && (
          <View style={{ borderLeftWidth: 2, borderLeftColor: theme.line, marginTop: '1.5mm', paddingLeft: '2mm' }}>
            <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Oblique', color: theme.mid, lineHeight: 1.45 }}>
              {notes}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ── Booking card ──────────────────────────────────────────────────────────────

interface BookingCardProps { res: Reservation; theme: PdfTheme; }

function BookingCard({ res, theme }: BookingCardProps): JSX.Element {
  return (
    <View style={{ border: `0.5 solid ${theme.line}`, borderRadius: 3, padding: 2.5, marginBottom: 3, backgroundColor: theme.surface }}>
      <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: theme.vmuted, letterSpacing: 0.6, marginBottom: 1, textTransform: 'uppercase' }}>
        {reservationTypeLabel(res.type)}
      </Text>
      <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: theme.dark, marginBottom: 0.5 }}>
        {res.title}
      </Text>
      {res.confirmation_ref !== null && (
        <Text style={{ fontSize: 7, color: theme.muted, fontFamily: 'Helvetica', marginBottom: 1.5 }}>
          {res.confirmation_ref}
        </Text>
      )}
      <StatusPill status={res.status} theme={theme} size={6.5} />
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface DayPageProps {
  day:          DayWithActivities;
  dayIndex:     number;
  totalDays:    number;
  pageNumber:   number;
  totalPages:   number;
  reservations: Reservation[]; // all trip reservations
  lodgings:     Reservation[]; // pre-filtered lodging reservations
  theme:        PdfTheme;
}

export function DayPage({ day, dayIndex, totalDays, pageNumber, totalPages, reservations, lodgings, theme }: DayPageProps): JSX.Element {
  const activities   = day.activities ?? [];
  const dayRes       = reservations.filter(r => !r.isLodging() && r.day_id === day.id);
  const dayLodgings  = lodgings.filter(r => r.coversDay(day.date));
  const noteText     = stripTiptapJson(day.notes);

  // Build geocoded points for the day map (activities + lodging with lat/lng).
  const mapPoints: GeoPoint[] = activities
    .filter(a => a.lat !== null && a.lng !== null)
    .map(a => ({ lat: a.lat!, lng: a.lng!, label: a.title }));

  const dayNumStr = String(dayIndex + 1).padStart(2, '0');

  return (
    <Page size="A4" style={{ backgroundColor: theme.pageBg, paddingHorizontal: PAD, paddingTop: PAD, paddingBottom: '15mm', fontFamily: 'Helvetica' }}>

      {/* ── Dark band header — bleeds to page edge via negative margins ── */}
      <View style={{ backgroundColor: theme.dark, flexDirection: 'row', alignItems: 'flex-end', gap: '5mm', marginHorizontal: '-20mm', marginTop: '-20mm', paddingHorizontal: '20mm', paddingVertical: '5mm', marginBottom: '8mm' }}>
        <Text style={{ fontSize: 24, fontFamily: 'Helvetica-Bold', color: 'white', letterSpacing: -0.5 }}>
          {dayNumStr}
        </Text>
        <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>
          / {totalDays}
        </Text>
        <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.75)' }}>
          {format(parseISO(day.date), 'EEEE, d MMMM yyyy')}
        </Text>
        {day.title !== null && (
          <Text style={{ fontSize: 16, fontFamily: 'Helvetica-Bold', color: 'white', marginLeft: 'auto', textAlign: 'right' }}>
            {day.title}
          </Text>
        )}
      </View>

      {/* Subtitle */}
      {day.subtitle !== null && (
        <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Oblique', color: theme.mid, marginBottom: '4mm' }}>
          {day.subtitle}
        </Text>
      )}

      {/* Lodging strips */}
      {dayLodgings.map(res => {
        const txt = buildLodgingStripText(res, day.date);
        return txt ? <LodgingStrip key={res.id} text={txt} theme={theme} /> : null;
      })}

      {/* ── Two-column body ── */}
      <View style={{ flexDirection: 'row', gap: '7mm', flex: 1 }}>

        {/* LEFT (60%): Schedule timeline */}
        <View style={{ flex: 6 }}>
          {activities.length > 0 && <SectionHeading label="Schedule" theme={theme} />}
          {activities.map((act, i) => (
            <TimelineItem
              key={act.id}
              title={act.title}
              type={act.activity_type}
              time={formatActivityTime(act.start_time, act.end_time)}
              location={act.location}
              notes={act.notes}
              isLast={i === activities.length - 1}
              theme={theme}
            />
          ))}
          {activities.length === 0 && dayRes.length === 0 && (
            <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Oblique', color: theme.muted }}>
              No activities planned for this day.
            </Text>
          )}
        </View>

        {/* RIGHT (40%): Map + bookings + notes */}
        <View style={{ flex: 4 }}>
          {mapPoints.length >= 2 && (
            <>
              <View style={{ borderBottomWidth: 2, borderBottomColor: theme.dark, paddingBottom: 1.5, marginBottom: '4mm' }}>
                <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', letterSpacing: 1, color: theme.vmuted, textTransform: 'uppercase' }}>
                  Today's Locations
                </Text>
              </View>
              <MapSvg points={mapPoints} theme={theme} />
            </>
          )}

          {dayRes.length > 0 && (
            <>
              <View style={{ borderBottomWidth: 2, borderBottomColor: theme.dark, paddingBottom: 1.5, marginBottom: '4mm', marginTop: mapPoints.length >= 2 ? '3mm' : 0 }}>
                <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', letterSpacing: 1, color: theme.vmuted, textTransform: 'uppercase' }}>
                  Bookings
                </Text>
              </View>
              {dayRes.map(res => <BookingCard key={res.id} res={res} theme={theme} />)}
            </>
          )}

          {noteText.length > 0 && (
            <View style={{ marginTop: dayRes.length > 0 ? 3 : 0 }}>
              <NotesBlock label="Day Notes" text={noteText} theme={theme} />
            </View>
          )}
        </View>
      </View>

      {/* ── Footer ── */}
      <View style={{ position: 'absolute', bottom: '8mm', left: PAD, right: PAD, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: theme.line, paddingTop: 3 }}>
        <Text style={{ fontSize: 7.5, color: theme.vmuted }}>{'\u2022  The Road So Far'}</Text>
        <Text style={{ fontSize: 7.5, color: theme.vmuted }}>
          Day {dayIndex + 1} of {totalDays} {'\u00B7'} Page {pageNumber} of {totalPages}
        </Text>
      </View>
    </Page>
  );
}
