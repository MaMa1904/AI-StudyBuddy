/**
 * env.ts — reads validated config from process.env.
 * dotenv is loaded BEFORE this module via src/register.ts (ts-node --require).
 */

function required(key: string): string {
  const val = process.env[key];
  if (!val || val.trim() === '' || val === `your_${key.toLowerCase()}_here`) {
    throw new Error(
      `\n❌  Missing environment variable: ${key}\n` +
      `   → Open server/.env and set ${key}\n` +
      `   → Get a free Gemini key at: https://aistudio.google.com/app/apikey\n`
    );
  }
  return val.trim();
}

function optional(key: string, fallback: string): string {
  return (process.env[key] || fallback).trim();
}

export const config = {
  port:          parseInt(optional('PORT', '3000'), 10),
  nodeEnv:       optional('NODE_ENV', 'development'),
  allowedOrigin: optional('ALLOWED_ORIGIN', 'http://localhost:4200'),

  gemini: {
    apiKey: required('GEMINI_API_KEY'),
    model:  optional('GEMINI_MODEL', 'gemini-2.5-flash'),
  },

  rateLimit: {
    windowMs: parseInt(optional('RATE_LIMIT_WINDOW_MS', '60000'), 10),
    max:      parseInt(optional('RATE_LIMIT_MAX', '30'), 10),
  },

  upload: {
    maxFileSizeBytes: parseInt(optional('MAX_FILE_SIZE_BYTES', String(20 * 1024 * 1024)), 10),
    dir: optional('UPLOAD_DIR', process.env.NODE_ENV === 'production' ? '/tmp/uploads' : './uploads'),
  },
} as const;
