// Shared PDF primitive components used by both CoverPage and DayPage.
// All components receive `theme` — never hardcode colours here.

import { View, Text, Svg, Circle, Line, Rect, G, Text as SvgText, Image } from '@react-pdf/renderer';
import { StyleSheet } from '@react-pdf/renderer';
import type { PdfTheme } from './theme';
import { projectPoints, projectToMapPixels } from './helpers';
import type { GeoPoint, StaticMapData } from './helpers';

// ── Style factories (called with theme at runtime) ────────────────────────────
// Reason: react-pdf StyleSheet.create() doesn't accept dynamic values, so we
// build style objects inline when theme is needed.

export const baseStyles = StyleSheet.create({
  row:    { flexDirection: 'row' },
  col:    { flexDirection: 'column' },
  spacer: { flex: 1 },
});

// ── Pill ──────────────────────────────────────────────────────────────────────

interface PillProps {
  label:   string;
  bg:      string;
  fg:      string;
  size?:   number;
}

export function Pill({ label, bg, fg, size = 7 }: PillProps): JSX.Element {
  return (
    <View style={{ backgroundColor: bg, borderRadius: 99, paddingVertical: 1.5, paddingHorizontal: 6, alignSelf: 'flex-start' }}>
      <Text style={{ fontSize: size, color: fg, fontFamily: 'Helvetica-Bold' }}>{label}</Text>
    </View>
  );
}

// ── Confirmed / Pending / Cancelled pill (pre-wired to theme) ─────────────────

interface StatusPillProps { status: string; theme: PdfTheme; size?: number; }

export function StatusPill({ status, theme, size }: StatusPillProps): JSX.Element {
  const confirmed = status === 'confirmed';
  const bg = confirmed ? '#dcf5e9' : '#f5f3e0';
  const fg = confirmed ? theme.green : theme.amber;
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return <Pill label={label} bg={bg} fg={fg} size={size} />;
}

// ── Section heading (accent triangle + label + rule) ──────────────────────────

interface SectionHeadingProps { label: string; theme: PdfTheme; }

export function SectionHeading({ label, theme }: SectionHeadingProps): JSX.Element {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: '3mm' }}>
      <Text style={{ fontSize: 9, color: theme.accent, fontFamily: 'Helvetica-Bold', marginRight: 3 }}>
        {'>'}
      </Text>
      <Text style={{ fontSize: 9, color: theme.dark, fontFamily: 'Helvetica-Bold', marginRight: 3 }}>
        {label}
      </Text>
      <View style={{ flex: 1, height: 0.5, backgroundColor: theme.line }} />
    </View>
  );
}

// ── Horizontal rule ───────────────────────────────────────────────────────────

export function HRule({ theme, marginV = 4 }: { theme: PdfTheme; marginV?: number }): JSX.Element {
  return <View style={{ height: 0.5, backgroundColor: theme.line, marginVertical: marginV }} />;
}

// ── Notes block (accent left border + label + italic text) ───────────────────

interface NotesBlockProps { label: string; text: string; theme: PdfTheme; }

export function NotesBlock({ label, text, theme }: NotesBlockProps): JSX.Element {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: theme.surface, borderRadius: 3, overflow: 'hidden', marginBottom: 4 }}>
      <View style={{ width: 3, backgroundColor: theme.accent }} />
      <View style={{ padding: 4, flex: 1 }}>
        <Text style={{ fontSize: 6.5, color: theme.vmuted, fontFamily: 'Helvetica-Bold', letterSpacing: 0.6, marginBottom: 2 }}>
          {label.toUpperCase()}
        </Text>
        <Text style={{ fontSize: 8, color: theme.mid, fontFamily: 'Helvetica-Oblique', lineHeight: 1.55 }}>
          {text}
        </Text>
      </View>
    </View>
  );
}

// ── Lodging strip ─────────────────────────────────────────────────────────────

interface LodgingStripProps { text: string; theme: PdfTheme; }

export function LodgingStrip({ text, theme }: LodgingStripProps): JSX.Element {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: '#eeecfa', marginBottom: '5mm', borderRadius: 2, overflow: 'hidden' }}>
      <View style={{ width: 3, backgroundColor: theme.accent }} />
      <Text style={{ fontSize: 8.5, color: theme.accent, padding: '2mm', paddingLeft: 4 }}>
        {'\u2022  '}{text}
      </Text>
    </View>
  );
}

// ── MapPinOverlay ─────────────────────────────────────────────────────────────
// Renders a TomTom static map image with numbered SVG pin markers precisely
// overlaid using Web Mercator projection matching TomTom's tile coordinate system.

interface MapPinOverlayProps {
  staticMap: StaticMapData;
  theme:     PdfTheme;
  height:    number;  // fixed display height in pt
}

export function MapPinOverlay({ staticMap, theme, height }: MapPinOverlayProps): JSX.Element {
  const { dataUrl, meta, points } = staticMap;
  const projected = projectToMapPixels(points, meta);

  return (
    <View style={{ width: '100%', height, border: `0.5 solid ${theme.line}`, borderRadius: 3, overflow: 'hidden', marginBottom: 5, position: 'relative' }}>
      <Image src={dataUrl} style={{ width: '100%', height: '100%' }} />
      {/* Reason: absolutely-positioned View + Svg overlay lets us draw pins at
          precise Mercator-projected pixel positions on top of the raster image.
          The viewBox matches the image's original pixel dimensions so coordinates
          align correctly at any display scale. */}
      {projected.length > 0 && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <Svg viewBox={`0 0 ${meta.imgW} ${meta.imgH}`} width="100%" height="100%">
            {projected.map((pt, i) => (
              <G key={i}>
                {/* Drop shadow */}
                <Circle cx={pt.x + 1} cy={pt.y + 1} r={10} fill="rgba(0,0,0,0.25)" />
                {/* Pin body */}
                <Circle cx={pt.x} cy={pt.y} r={10} fill={theme.accent} />
                {/* Number */}
                <SvgText
                  x={pt.x}
                  y={pt.y + 4}
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
// Renders a simple dot-map SVG from geocoordinates.
// Returns null if fewer than 2 points are available (not useful to show).

const MAP_W = 200;
const MAP_H = 110;
const GRID_COLOR = '#e5e0d8';
const BG_COLOR   = '#f0ece4';

interface MapSvgProps {
  points:    GeoPoint[];
  theme:     PdfTheme;
  /** Full width of the map in mm (used for the View wrapper). */
  width?:    string | number;
}

export function MapSvg({ points, theme, width = '100%' }: MapSvgProps): JSX.Element | null {
  if (points.length < 2) return null;
  const projected = projectPoints(points, MAP_W, MAP_H);

  return (
    <View style={{ width, border: `0.5 solid ${theme.line}`, borderRadius: 3, overflow: 'hidden', marginBottom: 4 }}>
      <Svg width="100%" viewBox={`0 0 ${MAP_W} ${MAP_H}`}>
        {/* Background */}
        <Rect x={0} y={0} width={MAP_W} height={MAP_H} fill={BG_COLOR} />

        {/* Grid */}
        <G stroke={GRID_COLOR} strokeWidth={0.4}>
          <Line x1={0}       y1={MAP_H / 3}     x2={MAP_W} y2={MAP_H / 3} />
          <Line x1={0}       y1={(MAP_H * 2) / 3} x2={MAP_W} y2={(MAP_H * 2) / 3} />
          <Line x1={MAP_W / 3}     y1={0} x2={MAP_W / 3}     y2={MAP_H} />
          <Line x1={(MAP_W * 2) / 3} y1={0} x2={(MAP_W * 2) / 3} y2={MAP_H} />
        </G>

        {/* Route line between consecutive points */}
        {projected.slice(0, -1).map((pt, i) => (
          <Line
            key={i}
            x1={pt.x} y1={pt.y}
            x2={projected[i + 1].x} y2={projected[i + 1].y}
            stroke={theme.accent}
            strokeWidth={1.5}
            strokeDasharray="4,3"
          />
        ))}

        {/* Point pins */}
        {projected.map((pt, i) => (
          <G key={i}>
            <Circle cx={pt.x} cy={pt.y} r={6} fill={theme.accent} opacity={0.9 - i * 0.07} />
            <Circle cx={pt.x} cy={pt.y} r={2.5} fill="white" />
            {/* Numbered badge */}
            <Circle cx={pt.x - 9} cy={pt.y - 9} r={5} fill="white" stroke={theme.accent} strokeWidth={0.8} />
            <SvgText x={pt.x - 9} y={pt.y - 6.5} textAnchor="middle" style={{ fontSize: 6, fontWeight: 'bold' }} fill={theme.accent}>
              {String(i + 1)}
            </SvgText>
          </G>
        ))}

        {/* Labels — placed below pin, truncated to avoid overflow */}
        {projected.map((pt, i) => (
          <SvgText
            key={`lbl-${i}`}
            x={pt.x}
            y={Math.min(pt.y + 14, MAP_H - 3)}
            textAnchor="middle"
            style={{ fontSize: 6 }}
            fill={theme.muted}
          >
            {pt.label.length > 16 ? pt.label.slice(0, 15) + '\u2026' : pt.label}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}
