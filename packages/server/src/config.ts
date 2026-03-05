import { config as dotenvConfig } from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: path.resolve(__dirname, '../../../.env') });

const REQUIRED_NOW = ['PORT', 'NODE_ENV', 'LOG_LEVEL'] as const;

for (const key of REQUIRED_NOW) {
  if (!process.env[key]) throw new Error(`Missing required env var: ${key}`);
}

export const config = {
  PORT: parseInt(process.env.PORT!, 10),
  NODE_ENV: process.env.NODE_ENV! as 'development' | 'production' | 'test',
  LOG_LEVEL: process.env.LOG_LEVEL! as 'debug' | 'info' | 'warn' | 'error',
  DATABASE_URL: process.env.DATABASE_URL,
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
  FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET,
  FIREBASE_SERVICE_ACCOUNT_KEY: process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
  YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY,
  SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET,
};
