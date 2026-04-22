// Cover page PDF component — matches the B2 mockup design.
// Editorial masthead + trip hero + route map + accommodation + day list.

import { Page, View, Text, Svg, Circle, Line, Rect, G, Text as SvgText } from '@react-pdf/renderer';
import { format, parseISO } from 'date-fns';
import type { PdfTheme } from './theme';
import type { TripWithDays } from '@/types/domain';
import type { Reservation } from '@/domain/Reservation';
import { StatusPill, HRule, NotesBlock } from './shared';
import { stripTiptapJson, projectPoints } from './helpers';
import type { GeoPoint } from './helpers';

// ── Page-level layout constants (mm) ─────────────────────────────────────────
const PAD = '20mm';

// ── Route map helpers ─────────────────────────────────────────────────────────

const COVER_MAP_W = 515;  // SVG viewBox width (pt-ish, doesn't matter — scales)
const COVER_MAP_H = 140;

function buildTripRoutePoints(reservations: Reservation[]): GeoPoint[] {
  const lodgings = reservations.filter(r => r.isLodging() && r.lat !== null && r.lng !== null);
  return lodgings.map(r => ({
    lat:   r.lat!,
    lng:   r.lng!,
    label: r.parsedDetails<{ property_name?: string }>().property_name ?? r.title,
  }));
}

interface CoverRouteMapProps { reservations: Reservation[]; theme: PdfTheme; }

function CoverRouteMap({ reservations, theme }: CoverRouteMapProps): JSX.Element | null {
  const pts = buildTripRoutePoints(reservations);
  if (pts.length < 2) return null;

  const projected = projectPoints(pts, COVER_MAP_W, COVER_MAP_H);

  return (
    <View style={{ width: '100%', border: `0.5 solid ${theme.line}`, borderRadius: 3, overflow: 'hidden', marginBottom: 5 }}>
      <Svg width="100%" viewBox={`0 0 ${COVER_MAP_W} ${COVER_MAP_H}`}>
        <Rect x={0} y={0} width={COVER_MAP_W} height={COVER_MAP_H} fill="#f0ece4" />
        {/* Grid */}
        <G stroke="#e5e0d8" strokeWidth={0.4}>
          <Line x1={0} y1={COVER_MAP_H / 3} x2={COVER_MAP_W} y2={COVER_MAP_H / 3} />
          <Line x1={0} y1={(COVER_MAP_H * 2) / 3} x2={COVER_MAP_W} y2={(COVER_MAP_H * 2) / 3} />
          {[1, 2, 3, 4].map(i => (
            <Line key={i} x1={(COVER_MAP_W / 5) * i} y1={0} x2={(COVER_MAP_W / 5) * i} y2={COVER_MAP_H} />
          ))}
        </G>
        {/* Route */}
        {projected.slice(0, -1).map((pt, i) => (
          <Line key={i} x1={pt.x} y1={pt.y} x2={projected[i + 1].x} y2={projected[i + 1].y}
            stroke={theme.accent} strokeWidth={2} strokeDasharray="6,4" />
        ))}
        {/* Pins */}
        {projected.map((pt, i) => (
          <G key={i}>
            <Circle cx={pt.x} cy={pt.y} r={9} fill={theme.accent} opacity={0.88} />
            <Circle cx={pt.x} cy={pt.y} r={3.5} fill="white" />
            <SvgText x={pt.x} y={Math.min(pt.y + 18, COVER_MAP_H - 4)} textAnchor="middle"
              style={{ fontSize: 8, fontWeight: 'bold' }} fill="#3c3434">
              {pt.label.length > 18 ? pt.label.slice(0, 17) + '\u2026' : pt.label}
            </SvgText>
            {/* Numbered badge */}
            <Circle cx={pt.x + 10} cy={pt.y - 10} r={7} fill="white" stroke={theme.accent} strokeWidth={0.8} />
            <SvgText x={pt.x + 10} y={pt.y - 7} textAnchor="middle" style={{ fontSize: 7, fontWeight: 'bold' }} fill={theme.accent}>
              {String(i + 1)}
            </SvgText>
          </G>
        ))}
      </Svg>
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface CoverPageProps {
  trip:         TripWithDays;
  reservations: Reservation[];
  theme:        PdfTheme;
  generated:    Date;
}

export function CoverPage({ trip, reservations, theme, generated }: CoverPageProps): JSX.Element {
  const days      = trip.days ?? [];
  const lodgings  = reservations.filter(r => r.isLodging());
  const dayCount  = trip.durationDays();
  const noteText  = stripTiptapJson(trip.notes);

  const startLabel = trip.start_date ? format(parseISO(trip.start_date), 'd MMM yyyy') : '\u2014';
  const endLabel   = trip.end_date   ? format(parseISO(trip.end_date),   'd MMM yyyy') : '\u2014';
  const durationStr = dayCount > 0 ? `${dayCount} day${dayCount === 1 ? '' : 's'}` : '';

  return (
    <Page size="A4" style={{ backgroundColor: theme.pageBg, paddingHorizontal: PAD, paddingVertical: PAD, fontFamily: 'Helvetica' }}>

      {/* ── Masthead ── */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderTopWidth: 4, borderTopColor: theme.dark, borderBottomWidth: 1, borderBottomColor: theme.dark, paddingVertical: '3mm', marginBottom: '5mm' }}>
        <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', letterSpacing: 1.5, color: theme.dark }}>
          THE ROAD SO FAR
        </Text>
        <Text style={{ fontSize: 7.5, color: theme.muted }}>
          Generated {format(generated, 'd MMMM yyyy')}
        </Text>
      </View>

      {/* ── Hero: eyebrow + title + subtitle + meta ── */}
      <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', letterSpacing: 1, color: theme.accent, marginBottom: 2, textTransform: 'uppercase' }}>
        Travel Itinerary
      </Text>
      <Text style={{ fontSize: 34, fontFamily: 'Helvetica-Bold', color: theme.dark, lineHeight: 1.0, letterSpacing: -0.5, marginBottom: '3mm' }}>
        {trip.title}
      </Text>
      {noteText.length > 0 && (
        <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Oblique', color: theme.mid, marginBottom: '4mm', lineHeight: 1.45 }}>
          {noteText.split('\n')[0]}
        </Text>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: '4mm', marginBottom: '6mm' }}>
        <Text style={{ fontSize: 8.5, color: theme.muted }}>{startLabel}{' \u2013 '}{endLabel}</Text>
        {durationStr !== '' && (
          <>
            <Text style={{ fontSize: 8.5, color: theme.line }}>{' \u00B7 '}</Text>
            <Text style={{ fontSize: 8.5, color: theme.muted }}>{durationStr}</Text>
          </>
        )}
        <Text style={{ fontSize: 8.5, color: theme.line }}>{' \u00B7 '}</Text>
        <StatusPill status={trip.status} theme={theme} />
      </View>

      <HRule theme={theme} marginV={14} />

      {/* ── Trip route map (only if lodgings are geocoded) ── */}
      <CoverRouteMap reservations={reservations} theme={theme} />

      {/* ── Two-column body ── */}
      <View style={{ flexDirection: 'row', gap: '6mm' }}>

        {/* LEFT: Accommodation + trip notes */}
        <View style={{ flex: 1 }}>
          <View style={{ borderBottomWidth: 2, borderBottomColor: theme.accent, paddingBottom: '1.5mm', marginBottom: '3mm' }}>
            <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', letterSpacing: 1, color: theme.vmuted, textTransform: 'uppercase' }}>Accommodation</Text>
          </View>
          {lodgings.length === 0 && (
            <Text style={{ fontSize: 8, color: theme.muted, fontFamily: 'Helvetica-Oblique' }}>No accommodation added yet.</Text>
          )}
          {lodgings.map(res => {
            const d = res.parsedDetails<{ property_name?: string; check_in_date?: string; check_out_date?: string }>();
            const name    = d.property_name ?? res.title;
            const inDate  = d.check_in_date  ? format(parseISO(d.check_in_date),  'd MMM') : '?';
            const outDate = d.check_out_date ? format(parseISO(d.check_out_date), 'd MMM') : '?';
            const nights  = d.check_in_date && d.check_out_date
              ? Math.round((parseISO(d.check_out_date).getTime() - parseISO(d.check_in_date).getTime()) / 86_400_000)
              : 0;
            return (
              <View key={res.id} style={{ marginBottom: '4mm' }}>
                <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: theme.dark }}>{name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 }}>
                  <Text style={{ fontSize: 8, color: theme.muted }}>
                    {`${inDate} \u2013 ${outDate}${nights > 0 ? ` \u00B7 ${nights} night${nights > 1 ? 's' : ''}` : ''}`}
                  </Text>
                  <StatusPill status={res.status} theme={theme} size={6.5} />
                </View>
              </View>
            );
          })}

          {noteText.length > 0 && (
            <View style={{ marginTop: 4 }}>
              <NotesBlock label="Trip Notes" text={noteText} theme={theme} />
            </View>
          )}
        </View>

        {/* RIGHT: Day-by-day list */}
        <View style={{ flex: 1 }}>
          {/* Section label matching col-section-label from mockup */}
          <View style={{ borderBottomWidth: 2, borderBottomColor: theme.accent, paddingBottom: '1.5mm', marginBottom: '3mm' }}>
            <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', letterSpacing: 1, color: theme.vmuted, textTransform: 'uppercase' }}>
              Day-by-Day
            </Text>
          </View>
          {days.map((day, i) => (
            <View key={day.id} style={{ flexDirection: 'row', gap: '2.5mm', paddingVertical: '1.5mm', borderBottomWidth: 0.5, borderBottomColor: theme.line, alignItems: 'flex-start' }}>
              <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: theme.accent, width: '8mm' }}>
                Day {i + 1}
              </Text>
              <Text style={{ fontSize: 7.5, color: theme.muted, width: '14mm' }}>
                {format(parseISO(day.date), 'EEE d MMM')}
              </Text>
              <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: theme.dark, flex: 1 }}>
                {day.title ?? '\u2014'}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── Footer ── */}
      <View style={{ position: 'absolute', bottom: '8mm', left: PAD, right: PAD, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: theme.line, paddingTop: 3 }}>
        <Text style={{ fontSize: 7.5, color: theme.vmuted }}>{' \u2022  The Road So Far'}</Text>
        <Text style={{ fontSize: 7.5, color: theme.vmuted }}>Page 1</Text>
      </View>
    </Page>
  );
}
