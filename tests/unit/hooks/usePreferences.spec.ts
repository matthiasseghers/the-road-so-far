import { describe, it, expect } from 'vitest';

// Pure extraction of the validation logic from usePreferences.
// The hook reads localStorage strings; these helpers validate and default them.
function parseDistanceUnit(raw: string | null): 'km' | 'mi' {
  return raw === 'km' || raw === 'mi' ? raw : 'km';
}

function parseCurrency(raw: string | null): string {
  return raw ?? '€';
}

describe('usePreferences — parseDistanceUnit', () => {
  it('returns km for null (no stored value)', () => {
    expect(parseDistanceUnit(null)).toBe('km');
  });

  it('returns km when stored value is "km"', () => {
    expect(parseDistanceUnit('km')).toBe('km');
  });

  it('returns mi when stored value is "mi"', () => {
    expect(parseDistanceUnit('mi')).toBe('mi');
  });

  it('falls back to km for unrecognised values', () => {
    expect(parseDistanceUnit('furlongs')).toBe('km');
    expect(parseDistanceUnit('')).toBe('km');
    expect(parseDistanceUnit('KM')).toBe('km');
  });
});

describe('usePreferences — parseCurrency', () => {
  it('defaults to € when null', () => {
    expect(parseCurrency(null)).toBe('€');
  });

  it('returns the stored symbol', () => {
    expect(parseCurrency('$')).toBe('$');
    expect(parseCurrency('£')).toBe('£');
    expect(parseCurrency('¥')).toBe('¥');
  });

  it('preserves arbitrary strings (no validation — UI enforces maxLength)', () => {
    expect(parseCurrency('USD')).toBe('USD');
  });
});

