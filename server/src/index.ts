// ── Load .env FIRST — must be before any other local imports ──
// Using require() so it runs synchronously before ES module hoisting
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// ── Now safe to import modules that read process.env ──────────
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config/env';
import aiRoutes, { cleanupDocStore } from './routes/ai.routes';

const app = express();

// ── Request logging (development) ─────────────────────────────
if (config.nodeEnv === 'development') {
  app.use((req, _res, next) => {
    const start = Date.now();
    _res.on('finish', () => {
      const duration = Date.now() - start;
      const status = _res.statusCode;
      const color = status >= 400 ? '\x1b[31m' : status >= 300 ? '\x1b[33m' : '\x1b[32m';
      console.log(`${color}${req.method}\x1b[0m ${req.path} → ${status} (${duration}ms)`);
    });
    next();
  });
}

// ── Security headers ──────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// ── CORS — only allow Angular dev server ─────────────────────
app.use(cors({
  origin: config.allowedOrigin,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Body parsers ──────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Global rate limiter ───────────────────────────────────────
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait a moment before trying again.' },
});
app.use('/api', limiter);

// ── Routes ────────────────────────────────────────────────────
app.use('/api', aiRoutes);

// ── 404 handler ───────────────────────────────────────────────
app.use((_req: express.Request, res: express.Response) => {
  res.status(404).json({ error: 'Route not found.' });
});

// ── Global error handler (must have exactly 4 params for Express) ──
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Server Error]', err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.message || 'Internal server error.',
    ...(config.nodeEnv === 'development' && { stack: err.stack }),
  });
});

// ── Start ─────────────────────────────────────────────────────
const server = app.listen(config.port, () => {
  console.log('\n🚀 StudyBuddy Server running');
  console.log(`   ➜  Local:  http://localhost:${config.port}`);
  console.log(`   ➜  Health: http://localhost:${config.port}/api/health`);
  console.log(`   ➜  Model:  ${config.gemini.model}`);
  console.log(`   ➜  CORS:   ${config.allowedOrigin}\n`);
});

// ── Graceful shutdown ─────────────────────────────────────────
function shutdown(signal: string) {
  console.log(`\n⏳ ${signal} received — shutting down gracefully…`);
  cleanupDocStore();
  server.close(() => {
    console.log('✅ Server closed.');
    process.exit(0);
  });
  // Force exit after 5s if connections won't close
  setTimeout(() => {
    console.error('⚠️  Forced exit after timeout.');
    process.exit(1);
  }, 5000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
