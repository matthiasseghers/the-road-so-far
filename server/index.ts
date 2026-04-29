import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { router } from './router.js';
import { getDb } from '../src/db/client.js';

const app = express();

// Reason: helmet sets safe HTTP headers (X-Content-Type-Options, X-Frame-Options,
// Referrer-Policy, etc.) with a single middleware call.
app.use(helmet());

// Reason: restrict CORS to Vite dev server only — this bridge is never public-facing
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

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

// Reason: catch synchronous throws from routes (e.g. SqliteError from the import route)
// and return JSON instead of the default HTML error page, which api-client.ts cannot parse.
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.warn(`The Road So Far — DB bridge running on http://localhost:${PORT}`);
});
