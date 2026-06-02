import crypto from 'crypto';
import type { ServerResponse } from 'http';
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { router } from './router.js';
import { getDb } from '../src/db/client.js';

const app = express();

// Reason: generate a cryptographic nonce per request so the inline theme script
// in index.html can execute without 'unsafe-inline', and the nonce cannot be
// predicted or reused across requests.
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.locals['cspNonce'] = crypto.randomBytes(16).toString('base64');
  next();
});

// Reason: helmet sets safe HTTP headers (X-Content-Type-Options, X-Frame-Options,
// Referrer-Policy, etc.) with a single middleware call.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", (_req, res) => `'nonce-${(res as ServerResponse & { locals: Record<string, string> }).locals['cspNonce']}'`],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: ["'self'", "https:"],
      },
    },
  }),
);

// Reason: CORS whitelist for local development - allows any localhost port.
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      cb(null, true);
    } else {
      cb(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

// Reason: covers/ stores downloaded trip cover photos.
// Located alongside the DB file so it works identically in dev and Docker.
const dataDir = process.env['DB_PATH'] ? path.dirname(process.env['DB_PATH']) : process.cwd();
const coversDir = path.join(dataDir, 'covers');
if (!fs.existsSync(coversDir)) fs.mkdirSync(coversDir, { recursive: true });

// Reason: serve covers before /api so the static middleware short-circuits correctly.
app.use('/covers', express.static(coversDir));

// Reason: a broad rate limit guards against runaway local scripts and accidental
// request loops. 300 req/min is far above normal interactive use.
const apiLimiter = rateLimit({
  windowMs: 60_000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down' },
});
app.use('/api', apiLimiter);

app.use('/api', router);

// Reason: return JSON 404 for any /api route that didn't match a handler so
// api-client.ts gets a parseable ApiError instead of an HTML Express 404 page.
app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Reason: catch synchronous throws from routes (e.g. SqliteError from the import route)
// and return JSON instead of the default HTML error page, which api-client.ts cannot parse.
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(`[server] ${err.name}: ${err.message}`);
  res.status(500).json({ error: err.message });
});

// ── Production static file serving ───────────────────────────────────────────
// In Docker (and any non-dev environment), Express serves the Vite build output.
// SPA fallback: any non-API, non-covers request returns index.html with a nonce
// injected into the inline theme script.
const distDir = path.join(process.cwd(), 'dist');
if (fs.existsSync(distDir)) {
  // Serve all static assets except index.html (JS, CSS, images, etc.).
  app.use(express.static(distDir, { index: false }));

  const indexPath = path.join(distDir, 'index.html');
  const indexTemplate = fs.readFileSync(indexPath, 'utf-8');

  // For every page request, inject the per-request nonce into the inline <script>.
  app.get('{*path}', (_req: Request, res: Response) => {
    const nonce = res.locals['cspNonce'] as string;
    const html = indexTemplate.replace('<script>', `<script nonce="${nonce}">`);
    res.type('html').send(html);
  });
}

export { app };

const PORT = Number(process.env['PORT'] ?? 3001);
getDb();
app.listen(PORT, () => {
  console.warn(`The Road So Far — running on http://localhost:${PORT}`);
});
