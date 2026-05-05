// PDF theme system — add new themes by extending PdfTheme and exporting a constant.
// Thread `theme` through every draw component; never hardcode colours in components.

// ── Spacing scale (pt) ────────────────────────────────────────────────────────
// Use these named values in layout components instead of magic numbers.
export const SPACING = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
} as const;

// ── Type scale (pt) ───────────────────────────────────────────────────────────
// All text in PDF components must reference one of these sizes.
export const FONT_SIZE = {
  xs:  7,
  sm:  8,
  md:  9,
  lg:  10,
  xl:  14,
  xxl: 24,
  h1:  34,
} as const;

// ── Theme interface ───────────────────────────────────────────────────────────

export interface PdfTheme {
  // Text
  dark:      string; // headings, body
  mid:       string; // secondary text
  muted:     string; // metadata
  vmuted:    string; // section labels, rules

  // Accent
  accent:    string; // primary accent — day bands, pills, dots

  // Surfaces
  surface:   string; // subtle tinted background
  line:      string; // dividers, borders

  // Semantic
  green:     string; // confirmed status
  amber:     string; // pending status

  // Page
  pageBg:    string; // always white for print

  // Map — SVG schematic map colours
  mapBg:     string; // background fill
  mapGrid:   string; // grid lines

  // Lodging strip
  lodgingBg: string; // strip background (tinted accent)
}

// Alias so components in this folder can import { Theme } without conflicting
// with the app-level Theme ('light' | 'dark' | 'auto') from @/types/domain.
export type Theme = PdfTheme;

// ── Themes ────────────────────────────────────────────────────────────────────

/** Warm parchment — default theme matching the B2 mockup. */
export const THEME_WARM: PdfTheme = {
  dark:      '#1a1612',
  mid:       '#5a5048',
  muted:     '#9a9088',
  vmuted:    '#bdb5ad',
  accent:    '#6458af',
  surface:   '#f5f2ef',
  line:      '#d8d0c8',
  green:     '#3a9e6f',
  amber:     '#b88929',
  pageBg:    '#ffffff',
  mapBg:     '#f0ece4',
  mapGrid:   '#e5e0d8',
  lodgingBg: '#eeecfa',
};

/** High-contrast black & white — for printing at a kiosk, minimal ink. */
export const THEME_PRINT: PdfTheme = {
  dark:      '#000000',
  mid:       '#333333',
  muted:     '#666666',
  vmuted:    '#999999',
  accent:    '#000000',
  surface:   '#f4f4f4',
  line:      '#cccccc',
  green:     '#1a7a40',
  amber:     '#8a6000',
  pageBg:    '#ffffff',
  mapBg:     '#f0f0f0',
  mapGrid:   '#dddddd',
  lodgingBg: '#f0f0f0',
};

/** Clean black-on-white — no tints, zero colour, purely print-safe. */
export const THEME_MINIMAL: PdfTheme = {
  dark:      '#000000',
  mid:       '#444444',
  muted:     '#888888',
  vmuted:    '#aaaaaa',
  accent:    '#222222',
  surface:   '#fafafa',
  line:      '#e0e0e0',
  green:     '#2e7d32',
  amber:     '#795548',
  pageBg:    '#ffffff',
  mapBg:     '#f8f8f8',
  mapGrid:   '#e8e8e8',
  lodgingBg: '#f0f0f0',
};
