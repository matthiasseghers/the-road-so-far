import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTestDb } from '../../helpers/db';
import type Database from 'better-sqlite3';

let db: Database.Database;

vi.mock('@/db/client', () => ({
  getDb: () => db,
}));

// Reason: import after the mock is registered so the service never touches the
// real road-so-far.db file.
const { geocodePlace } = await import('@/services/geocoding.service');
const { nominatimGeocoding } = await import('@/services/providers/nominatim');

// Reason: the rate-limit queue adds a real 1100ms delay to every call; fake
// timers keep this spec fast and remove any sensitivity to slow CI runners.

async function run<T>(promise: Promise<T>): Promise<T> {
  await vi.runAllTimersAsync();
  return promise;
}

beforeEach(() => {
  db = createTestDb();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('geocodePlace()', () => {
  it('returns parsed coords on a successful 200 response', async () => {
    const mockResult = [{ lat: '48.8566', lon: '2.3522' }];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResult),
      }),
    );

    const result = await run(geocodePlace('Paris'));
    expect(result).toEqual({ lat: 48.8566, lng: 2.3522 });
  });

  it('returns null when results array is empty', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      }),
    );

    const result = await run(geocodePlace('xyzzy-not-a-real-place'));
    expect(result).toBeNull();
  });

  it('returns null on a non-ok HTTP response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    const result = await run(geocodePlace('Paris'));
    expect(result).toBeNull();
  });

  it('returns null when fetch throws (network error)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    const result = await run(geocodePlace('Paris'));
    expect(result).toBeNull();
  });

  it('sends the correct User-Agent header', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ lat: '1', lon: '2' }]),
    });
    vi.stubGlobal('fetch', mockFetch);

    await run(geocodePlace('Lisbon'));

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

    await run(geocodePlace('New York City'));

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('New%20York%20City');
  });
});

describe('Nominatim rate limit', () => {
  it('rateLimitMs is at least 1100ms per Nominatim usage policy', () => {
    expect(nominatimGeocoding.rateLimitMs).toBeGreaterThanOrEqual(1_100);
  });
});
