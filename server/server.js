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
const port = process.env.PORT || 5001;

initDatabase();
initSupabase();

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || 'http://127.0.0.1:5173',
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
app.use('/api/auth', authRoutes);
app.use('/api/reports', submissionLimiter, reportRoutes);
app.use('/api/upload', submissionLimiter, uploadRoutes);

app.use((err, _req, res, _next) => {
  const message = err.message || 'Server error';
  const status = message.includes('Only MP4') ? 400 : 500;
  res.status(status).json({ message });
});

app.listen(port, '127.0.0.1', () => {
  console.log(`Noise portal API running on http://127.0.0.1:${port}`);
});
