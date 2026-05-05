// Internal primitives shared by CoverLayout and DayLayout in the Default layout.
// Not part of the public PdfLayout contract. Import only from within this layout.

import {
  Page, View, Text, Image, Svg, Circle, Line, Rect, G,
  Text as SvgText, StyleSheet,
} from '@react-pdf/renderer';
import { projectPoints, projectToMapPixels } from '../../helpers';
import type { StaticMapData } from '../../helpers';
import { C } from './colours';

const s = StyleSheet.create({
  page:              { paddingHorizontal: '20mm', fontFamily: 'Helvetica' },
  sectionHeader:     { borderBottomWidth: 2, paddingBottom: 1.5, marginBottom: 4 },
  sectionHeaderText: { fontSize: 7, fontFamily: 'Helvetica-Bold', letterSpacing: 1 },
  divider:           { height: 0.5 },
  pill:              { borderRadius: 99, paddingVertical: 1.5, paddingHorizontal: 6, alignSelf: 'flex-start' },
  pillText:          { fontFamily: 'Helvetica-Bold' },
  notesRow:          { flexDirection: 'row', borderRadius: 3, overflow: 'hidden', marginBottom: 4 },
  notesAccent:       { width: 3 },
  notesBody:         { padding: 4, flex: 1 },
  notesLabel:        { fontSize: 6.5, fontFamily: 'Helvetica-Bold', letterSpacing: 0.6, marginBottom: 2 },
  notesText:         { fontSize: 8, fontFamily: 'Helvetica-Oblique', lineHeight: 1.55 },
  lodgingStrip:      { flexDirection: 'row', marginBottom: '5mm', borderRadius: 2, overflow: 'hidden' },
  lodgingAccent:     { width: 3 },
  lodgingText:       { fontSize: 8.5, padding: '2mm', paddingLeft: 4 },
});

// ── PageWrapper ───────────────────────────────────────────────────────────────

interface PageWrapperProps {
  children:       React.ReactNode;
  paddingTop?:    string;
  paddingBottom?: string;
}

export function PageWrapper({ children, paddingTop = '20mm', paddingBottom = '20mm' }: PageWrapperProps): JSX.Element {
  return (
    <Page size="A4" style={[s.page, { backgroundColor: C.pageBg, paddingTop, paddingBottom }]}>
      {children}
    </Page>
  );
}

// ── SectionHeader ─────────────────────────────────────────────────────────────

export function SectionHeader({ label }: { label: string }): JSX.Element {
  return (
    <View style={[s.sectionHeader, { borderBottomColor: C.accent }]}>
      <Text style={[s.sectionHeaderText, { color: C.vmuted }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

// ── Divider ───────────────────────────────────────────────────────────────────

export function Divider({ marginV = 4 }: { marginV?: number }): JSX.Element {
  return <View style={[s.divider, { backgroundColor: C.line, marginVertical: marginV }]} />;
}

// ── Pill / StatusPill ─────────────────────────────────────────────────────────

interface PillProps { label: string; bg: string; fg: string; size?: number; }

export function Pill({ label, bg, fg, size = 7 }: PillProps): JSX.Element {
  return (
    <View style={[s.pill, { backgroundColor: bg }]}>
      <Text style={[s.pillText, { fontSize: size, color: fg }]}>{label}</Text>
    </View>
  );
}

interface StatusPillProps { status: string; size?: number; }

export function StatusPill({ status, size }: StatusPillProps): JSX.Element {
  const confirmed = status === 'confirmed';
  const bg = confirmed ? '#dcf5e9' : '#f5f3e0';
  const fg = confirmed ? C.green   : C.amber;
  return <Pill label={status.charAt(0).toUpperCase() + status.slice(1)} bg={bg} fg={fg} size={size} />;
}

// ── NotesBlock ────────────────────────────────────────────────────────────────

interface NotesBlockProps { label: string; text: string; }

export function NotesBlock({ label, text }: NotesBlockProps): JSX.Element {
  return (
    <View style={[s.notesRow, { backgroundColor: C.surface }]}>
      <View style={[s.notesAccent, { backgroundColor: C.accent }]} />
      <View style={s.notesBody}>
        <Text style={[s.notesLabel, { color: C.vmuted }]}>{label.toUpperCase()}</Text>
        <Text style={[s.notesText,  { color: C.mid    }]}>{text}</Text>
      </View>
    </View>
  );
}

// ── LodgingStrip (internal — used by CoverLayout) ─────────────────────────────

interface InternalLodgingStripProps { displayText: string; }

export function LodgingStripInternal({ displayText }: InternalLodgingStripProps): JSX.Element {
  return (
    <View style={[s.lodgingStrip, { backgroundColor: C.lodgingBg }]}>
      <View style={[s.lodgingAccent, { backgroundColor: C.accent }]} />
      <Text style={[s.lodgingText, { color: C.accent }]}>{'\u2022  '}{displayText}</Text>
    </View>
  );
}

// ── MapPinOverlay ─────────────────────────────────────────────────────────────

interface MapPinOverlayProps { staticMap: StaticMapData; height: number; }

export function MapPinOverlay({ staticMap, height }: MapPinOverlayProps): JSX.Element {
  const { dataUrl, meta, points } = staticMap;
  const projected = projectToMapPixels(points, meta);

  return (
    <View style={{ width: '100%', height, border: `0.5 solid ${C.line}`, borderRadius: 3, overflow: 'hidden', marginBottom: 5, position: 'relative' }}>
      <Image src={dataUrl} style={{ width: '100%', height: '100%' }} />
      {projected.length > 0 && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <Svg viewBox={`0 0 ${meta.imgW} ${meta.imgH}`} width="100%" height="100%">
            {projected.map((pt, i) => (
              <G key={i}>
                <Circle cx={pt.x + 1} cy={pt.y + 1} r={10} fill="rgba(0,0,0,0.25)" />
                <Circle cx={pt.x}     cy={pt.y}     r={10} fill={C.accent} />
                <SvgText
                  x={pt.x} y={pt.y + 4}
                  textAnchor="middle"
                  style={{ fontSize: 9, fontFamily: 'Helvetica-Bold' }}
                  fill="white"
                >
                  {String(i + 1)}
                </SvgText>
              </G>
            ))}
          </Svg>
        </View>
      )}
    </View>
  );
}

// ── MapSvg ────────────────────────────────────────────────────────────────────

const MAP_W = 200;
const MAP_H = 110;

interface MapSvgProps { points: Array<{ lat: number; lng: number; label: string }>; width?: string | number; }

export function MapSvg({ points, width = '100%' }: MapSvgProps): JSX.Element | null {
  if (points.length < 2) return null;
  const projected = projectPoints(points, MAP_W, MAP_H);

  return (
    <View style={{ width, border: `0.5 solid ${C.line}`, borderRadius: 3, overflow: 'hidden', marginBottom: 4 }}>
      <Svg width="100%" viewBox={`0 0 ${MAP_W} ${MAP_H}`}>
        <Rect x={0} y={0} width={MAP_W} height={MAP_H} fill={C.mapBg} />
        <G stroke={C.mapGrid} strokeWidth={0.4}>
          <Line x1={0}             y1={MAP_H / 3}        x2={MAP_W} y2={MAP_H / 3} />
          <Line x1={0}             y1={(MAP_H * 2) / 3}  x2={MAP_W} y2={(MAP_H * 2) / 3} />
          <Line x1={MAP_W / 3}     y1={0}                x2={MAP_W / 3}     y2={MAP_H} />
          <Line x1={(MAP_W * 2)/3} y1={0}                x2={(MAP_W * 2)/3} y2={MAP_H} />
        </G>
        {projected.slice(0, -1).map((pt, i) => (
          <Line key={i} x1={pt.x} y1={pt.y} x2={projected[i+1].x} y2={projected[i+1].y}
            stroke={C.accent} strokeWidth={1.5} strokeDasharray="4,3" />
        ))}
        {projected.map((pt, i) => (
          <G key={i}>
            <Circle cx={pt.x} cy={pt.y} r={6}   fill={C.accent} opacity={0.9 - i * 0.07} />
            <Circle cx={pt.x} cy={pt.y} r={2.5} fill="white" />
            <Circle cx={pt.x - 9} cy={pt.y - 9} r={5} fill="white" stroke={C.accent} strokeWidth={0.8} />
            <SvgText x={pt.x - 9} y={pt.y - 6.5} textAnchor="middle" style={{ fontSize: 6, fontWeight: 'bold' }} fill={C.accent}>
              {String(i + 1)}
            </SvgText>
          </G>
        ))}
        {projected.map((pt, i) => (
          <SvgText key={`lbl-${i}`} x={pt.x} y={Math.min(pt.y + 14, MAP_H - 3)} textAnchor="middle" style={{ fontSize: 6 }} fill={C.muted}>
            {pt.label.length > 16 ? pt.label.slice(0, 15) + '\u2026' : pt.label}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}
