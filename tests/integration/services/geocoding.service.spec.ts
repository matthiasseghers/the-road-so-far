import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb } from '../helpers/db';
import type Database from 'better-sqlite3';

let db: Database.Database;

vi.mock('@/db/client', () => ({
  getDb: () => db,
}));

// ── Import after mock is registered ──────────────────────────────────────────

const { geocodePlace } = await import('@/services/geocoding.service');
const { setSetting }   = await import('@/db/repositories/settings.repo');

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockFetch(response: unknown, ok = true): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(response),
  }));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('geocodePlace()', () => {
  beforeEach(() => {
    db = createTestDb();
    vi.unstubAllGlobals();
    // Reason: reset the rate-limit queue state between tests by re-importing.
    // The queue depth counter is module-level state in geocoding.service.ts.
    vi.resetModules();
  });

  it('returns lat/lng on a successful provider response', async () => {
    mockFetch([{ display_name: 'Lisbon, Portugal', lat: '38.7167', lon: '-9.1333' }]);
    const result = await geocodePlace('Lisbon');
    expect(result).toEqual({ lat: 38.7167, lng: -9.1333 });
  });

  it('returns null when the provider returns an empty results array', async () => {
    mockFetch([]);
    const result = await geocodePlace('NowhereXYZ');
    expect(result).toBeNull();
  });

  it('returns null when the HTTP response is not ok', async () => {
    mockFetch(null, false);
    const result = await geocodePlace('Lisbon');
    expect(result).toBeNull();
  });

  it('returns null when fetch throws a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
    const result = await geocodePlace('Lisbon');
    expect(result).toBeNull();
  });

  it('uses nominatim by default (no geocoding_provider setting)', async () => {
    const spy = mockFetchSpy([{ display_name: 'Paris', lat: '48.8566', lon: '2.3522' }]);
    await geocodePlace('Paris');
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('nominatim.openstreetmap.org'),
      expect.any(Object),
    );
  });

  it('uses the provider stored in settings', async () => {
    // Set geocoding_provider to 'tomtom' in the in-memory DB
    setSetting('geocoding_provider', 'tomtom');
    setSetting('tomtom_api_key', 'test-key');

    const spy = mockFetchSpy({
      results: [{ position: { lat: 38.7167, lon: -9.1333 }, address: { freeformAddress: 'Lisbon' } }],
    });
    // geocodePlace reads settings at enqueue time, so the spy URL will contain tomtom
    await geocodePlace('Lisbon').catch(() => {/* ignore result shape mismatch */});
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('api.tomtom.com'),
      expect.any(Object),
    );
  });
});

describe('geocodePlace() — queue depth cap', () => {
  it('rejects with a clear error when QUEUE_MAX_DEPTH is exceeded', async () => {
    vi.useFakeTimers();
    // Reason: fake timers prevent the 1100ms rateLimitMs delays from blocking the test.

    db = createTestDb();
    vi.resetModules();
    vi.mock('@/db/client', () => ({ getDb: () => db }));

    // Fetch returns immediately (fake timers bypass setTimeout delays below)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ display_name: 'X', lat: '0', lon: '0' }]),
    }));

    const { geocodePlace: gp } = await import('@/services/geocoding.service');

    // Enqueue 20 calls to fill the queue (QUEUE_MAX_DEPTH = 20)
    const pending: Promise<unknown>[] = [];
    for (let i = 0; i < 20; i++) {
      pending.push(gp(`q${i}`).catch(() => null));
    }

    // 21st call must reject synchronously (before any timers run)
    await expect(gp('overflow')).rejects.toThrow('Geocode queue full');

    // Drain all pending timers so the test doesn't leak
    await vi.runAllTimersAsync();
    await Promise.all(pending);

    vi.useRealTimers();
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockFetchSpy(response: unknown): ReturnType<typeof vi.fn> {
  const spy = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(response) });
  vi.stubGlobal('fetch', spy);
  return spy;
}
