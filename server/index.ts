import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { router } from './router.js';
import { getDb } from '../src/db/client.js';

const app = express();

// Reason: helmet sets safe HTTP headers (X-Content-Type-Options, X-Frame-Options,
// Referrer-Policy, etc.) with a single middleware call.
app.use(helmet());

// Reason: all three distribution targets need CORS — Vite dev, Tauri macOS/Linux, Tauri Windows.
const ALLOWED_ORIGINS = [
  'http://localhost:5173',   // Vite dev
  'tauri://localhost',       // Tauri macOS/Linux
  'http://localhost:1420',   // Tauri Windows
];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) cb(null, true);
    else cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

// Reason: covers/ stores downloaded trip cover photos.
// Located alongside the DB file so it works identically in dev, Tauri, and Docker.
const coversDir = path.join(process.cwd(), 'covers');
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

// Ensure DB is initialised and all migrations run before accepting requests
getDb();

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

const PORT = 3001;
app.listen(PORT, () => {
  console.warn(`The Road So Far — DB bridge running on http://localhost:${PORT}`);
});
