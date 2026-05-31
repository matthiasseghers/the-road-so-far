import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createTestDb } from '../helpers/db';
import type Database from 'better-sqlite3';

let db: Database.Database;

vi.mock('@/db/client', () => ({
  getDb: () => db,
}));

// ── Import after mock is registered ──────────────────────────────────────────
// server/index.ts calls getDb() at module level, so the mock must exist first.

const { app } = await import('../../../server/index.js');

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('server middleware', () => {
  beforeEach(() => {
    db = createTestDb();
  });

  // ── CSP ──────────────────────────────────────────────────────────────────

  describe('Content-Security-Policy', () => {
    it('includes a nonce in the script-src directive', async () => {
      const res = await request(app).get('/api/trips');
      const csp = res.headers['content-security-policy'];

      expect(csp).toBeDefined();
      expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+'/);
    });

    it('generates a different nonce per request', async () => {
      const [res1, res2] = await Promise.all([
        request(app).get('/api/trips'),
        request(app).get('/api/trips'),
      ]);

      const nonce1 = res1.headers['content-security-policy'].match(/'nonce-([^']+)'/)?.[1];
      const nonce2 = res2.headers['content-security-policy'].match(/'nonce-([^']+)'/)?.[1];

      expect(nonce1).toBeDefined();
      expect(nonce2).toBeDefined();
      expect(nonce1).not.toBe(nonce2);
    });

    it('does not use unsafe-inline for scripts', async () => {
      const res = await request(app).get('/api/trips');
      const csp = res.headers['content-security-policy'];
      const scriptSrc = csp.split(';').find((d: string) => d.trim().startsWith('script-src'));

      expect(scriptSrc).not.toContain("'unsafe-inline'");
    });

    it('does not allow unsafe-eval', async () => {
      const res = await request(app).get('/api/trips');
      const csp = res.headers['content-security-policy'];
      const scriptSrc = csp.split(';').find((d: string) => d.trim().startsWith('script-src'));

      expect(scriptSrc).not.toContain("'unsafe-eval'");
    });
  });

  // ── Security headers ────────────────────────────────────────────────────

  describe('security headers', () => {
    it('sets X-Content-Type-Options to nosniff', async () => {
      const res = await request(app).get('/api/trips');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('sets X-Frame-Options', async () => {
      const res = await request(app).get('/api/trips');
      expect(res.headers['x-frame-options']).toBeDefined();
    });

    it('removes the X-Powered-By header', async () => {
      const res = await request(app).get('/api/trips');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });
  });

  // ── CORS ─────────────────────────────────────────────────────────────────

  describe('CORS', () => {
    it('allows requests from the Vite dev server origin', async () => {
      const res = await request(app)
        .get('/api/trips')
        .set('Origin', 'http://localhost:5173');

      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    });

    it('blocks requests from unknown origins', async () => {
      const res = await request(app)
        .get('/api/trips')
        .set('Origin', 'http://evil.example.com');

      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  // ── API fallback ────────────────────────────────────────────────────────

  describe('API 404 fallback', () => {
    it('returns JSON for unmatched /api routes', async () => {
      const res = await request(app).get('/api/nonexistent-route');

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Not found' });
    });
  });
});
