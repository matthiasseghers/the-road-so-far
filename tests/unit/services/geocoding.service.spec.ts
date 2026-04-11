import { describe, it, expect, vi, beforeEach } from 'vitest';
import { geocodePlace, GEOCODE_DELAY_MS } from '@/services/geocoding.service';

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('geocodePlace()', () => {
  it('returns parsed coords on a successful 200 response', async () => {
    const mockResult = [{ lat: '48.8566', lon: '2.3522' }];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResult),
    }));

    const result = await geocodePlace('Paris');
    expect(result).toEqual({ lat: 48.8566, lng: 2.3522 });
  });

  it('returns null when results array is empty', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    }));

    const result = await geocodePlace('xyzzy-not-a-real-place');
    expect(result).toBeNull();
  });

  it('returns null on a non-ok HTTP response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    const result = await geocodePlace('Paris');
    expect(result).toBeNull();
  });

  it('returns null when fetch throws (network error)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    const result = await geocodePlace('Paris');
    expect(result).toBeNull();
  });

  it('sends the correct User-Agent header', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ lat: '1', lon: '2' }]),
    });
    vi.stubGlobal('fetch', mockFetch);

    await geocodePlace('Lisbon');

    expect(mockFetch).toHaveBeenCalledOnce();
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['User-Agent']).toBe('TheRoadSoFar/1.0');
  });

  it('URL-encodes the query string', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ lat: '51.5', lon: '-0.1' }]),
    });
    vi.stubGlobal('fetch', mockFetch);

    await geocodePlace('New York City');

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('New%20York%20City');
  });
});

describe('GEOCODE_DELAY_MS', () => {
  it('is at least 1100ms (Nominatim rate limit requirement)', () => {
    expect(GEOCODE_DELAY_MS).toBeGreaterThanOrEqual(1_100);
  });
});
