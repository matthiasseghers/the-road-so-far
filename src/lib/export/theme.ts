// PDF theme system — add new themes by extending PdfTheme and exporting a constant.
// Thread `theme` through every draw component; never hardcode colours in components.

export interface PdfTheme {
  // Text
  dark:      string; // headings, body
  mid:       string; // secondary text
  muted:     string; // metadata
  vmuted:    string; // section labels, rules

  // Accent
  accent:    string; // purple — day bands, pills, dots

  // Surfaces
  surface:   string; // subtle tinted background
  line:      string; // dividers, borders

  // Semantic
  green:     string; // confirmed status
  amber:     string; // pending status

  // Page
  pageBg:    string; // always white for print
}

/** Warm parchment — default theme matching the B2 mockup. */
export const THEME_WARM: PdfTheme = {
  dark:    '#1a1612',
  mid:     '#5a5048',
  muted:   '#9a9088',
  vmuted:  '#bdb5ad',
  accent:  '#6458af',
  surface: '#f5f2ef',
  line:    '#d8d0c8',
  green:   '#3a9e6f',
  amber:   '#b88929',
  pageBg:  '#ffffff',
};

/** High-contrast black & white — for printing at a kiosk, minimal ink. */
export const THEME_PRINT: PdfTheme = {
  dark:    '#000000',
  mid:     '#333333',
  muted:   '#666666',
  vmuted:  '#999999',
  accent:  '#000000',
  surface: '#f4f4f4',
  line:    '#cccccc',
  green:   '#1a7a40',
  amber:   '#8a6000',
  pageBg:  '#ffffff',
};
