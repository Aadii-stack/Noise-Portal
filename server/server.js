import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import reportRoutes from './routes/reports.js';
import uploadRoutes from './routes/upload.js';
import { initDatabase } from './services/database.js';
import { initSupabase } from './services/supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = Number(process.env.PORT || 5001);
const host = process.env.HOST || '127.0.0.1';

const allowedOrigins = new Set(
  [
    'http://127.0.0.1:5173',
    'http://localhost:5173',
    'https://noise-portal-client.vercel.app',
    ...(process.env.CLIENT_ORIGIN || '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
  ].filter(Boolean)
);

initDatabase();
initSupabase();

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);
app.use(
  cors({
    origin(origin, callback) {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) {
        callback(null, true);
        return;
      }

      // Check for exact matches
      if (allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      // Allow Vercel preview deployments
      if (origin.endsWith('.vercel.app')) {
        callback(null, true);
        return;
      }

      callback(new Error(`Not allowed by CORS: ${origin}`));
    },
    credentials: true
  })
);
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const submissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many submissions from this network. Please try later.' }
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'noise-portal-api' });
});

// Create a router for all API routes to handle prefixing flexibly
const apiRouter = express.Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/reports', submissionLimiter, reportRoutes);
apiRouter.use('/upload', submissionLimiter, uploadRoutes);

// Mount the router both at /api and at root /
// This ensures that whether Vercel passes /api/reports or just /reports, it works.
app.use('/api', apiRouter);
app.use('/', apiRouter);

app.use((err, _req, res, _next) => {
  const message = err.message || 'Server error';
  const status = err.status || err.statusCode || (message.includes('Only MP4') ? 400 : 500);
  res.status(status).json({ message });
});

export function startServer() {
  return app.listen(port, host, () => {
    console.log(`Noise portal API running on http://${host}:${port}`);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  startServer();
}

export { app };
export default app;
