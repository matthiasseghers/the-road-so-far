import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TomTomRouteResponse } from '@/types/api';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTomTomResponse(distanceM: number, durationS: number): TomTomRouteResponse {
  const summary = {
    lengthInMeters: distanceM,
    travelTimeInSeconds: durationS,
    trafficDelayInSeconds: 0,
    departureTime: '2025-06-01T08:00:00Z',
    arrivalTime: '2025-06-01T22:00:00Z',
  };
  return {
    routes: [
      {
        summary,
        legs: [
          {
            summary,
            points: [
              { latitude: 38.7, longitude: -9.1 },
              { latitude: 48.8, longitude: 2.3 },
            ],
          },
        ],
      },
    ],
  };
}

function stubFetch(response: unknown, ok = true): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(response),
  }));
}

// ── fetchRouteLeg ─────────────────────────────────────────────────────────────

describe('fetchRouteLeg()', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  const from = { lat: 38.7167, lng: -9.1333 };
  const to   = { lat: 48.8566, lng: 2.3522 };

  it('returns a RouteLegResult with distance, duration and polyline on success', async () => {
    stubFetch(makeTomTomResponse(1_450_000, 50_400));
    const { fetchRouteLeg } = await import('@/services/routing.service');
    const result = await fetchRouteLeg(from, to, 'test-api-key');

    expect(result).not.toBeNull();
    expect(result?.distance_m).toBe(1_450_000);
    expect(result?.duration_s).toBe(50_400);
    // Polyline is a JSON array of {lat,lng}
    const polyline = JSON.parse(result!.polyline) as unknown[];
    expect(polyline.length).toBeGreaterThan(0);
  });

  it('returns null when apiKey is empty', async () => {
    vi.resetModules();
    const { fetchRouteLeg } = await import('@/services/routing.service');
    const result = await fetchRouteLeg(from, to, '');
    expect(result).toBeNull();
  });

  it('returns null when the HTTP response is not ok', async () => {
    stubFetch(null, false);
    vi.resetModules();
    const { fetchRouteLeg } = await import('@/services/routing.service');
    const result = await fetchRouteLeg(from, to, 'test-api-key');
    expect(result).toBeNull();
  });

  it('returns null when fetch throws a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
    vi.resetModules();
    const { fetchRouteLeg } = await import('@/services/routing.service');
    const result = await fetchRouteLeg(from, to, 'test-api-key');
    expect(result).toBeNull();
  });

  it('returns null when the TomTom response has no routes', async () => {
    stubFetch({ routes: [] });
    vi.resetModules();
    const { fetchRouteLeg } = await import('@/services/routing.service');
    const result = await fetchRouteLeg(from, to, 'test-api-key');
    expect(result).toBeNull();
  });

  it('uses the supplied travel mode in the URL', async () => {
    const spy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makeTomTomResponse(100_000, 3_600)),
    });
    vi.stubGlobal('fetch', spy);
    vi.resetModules();
    const { fetchRouteLeg } = await import('@/services/routing.service');
    await fetchRouteLeg(from, to, 'key', 'bicycle');
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('travelMode=bicycle'),
      expect.any(Object),
    );
  });
});
