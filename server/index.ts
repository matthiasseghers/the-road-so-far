import express from 'express';
import cors from 'cors';
import { router } from './router.js';
import { getDb } from '../src/db/client.js';

const app = express();

// Reason: restrict CORS to Vite dev server only — this bridge is never public-facing
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());
app.use('/api', router);

// Ensure DB is initialised and all migrations run before accepting requests
getDb();

const PORT = 3001;
app.listen(PORT, () => {
  console.warn(`The Road So Far — DB bridge running on http://localhost:${PORT}`);
});
