/**
 * Bootstrap file — loaded via ts-node --require BEFORE any other module.
 * This ensures dotenv populates process.env before env.ts is evaluated.
 */
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const envFile = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envFile)) {
  const result = dotenv.config({ path: envFile });
  if (result.error) {
    console.error('[register] dotenv error:', result.error.message);
  }
} else {
  console.warn('[register] .env not found at', envFile);
}
