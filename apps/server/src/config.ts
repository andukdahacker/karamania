import { z } from 'zod/v4';

if (process.env['NODE_ENV'] !== 'production') {
  await import('dotenv/config');
}

export const envSchema = z.object({
  DATABASE_URL: z.url(),
  DATABASE_URL_TEST: z.url().optional(),
  JWT_SECRET: z.string().min(32),
  YOUTUBE_API_KEY: z.string(),
  SPOTIFY_CLIENT_ID: z.string(),
  SPOTIFY_CLIENT_SECRET: z.string(),
  FIREBASE_PROJECT_ID: z.string(),
  FIREBASE_CLIENT_EMAIL: z.email(),
  FIREBASE_PRIVATE_KEY: z.string(),
  FIREBASE_STORAGE_BUCKET: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  SENTRY_DSN: z.string().optional(),
});

export type Config = z.infer<typeof envSchema>;
export const config = envSchema.parse(process.env);
