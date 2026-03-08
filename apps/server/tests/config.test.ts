import { describe, it, expect, vi, beforeAll } from 'vitest';

vi.mock('dotenv/config', () => ({}));

const validEnv = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/karamania',
  JWT_SECRET: 'test-secret-key-at-least-32-characters-long',
  YOUTUBE_API_KEY: 'test-youtube-key',
  SPOTIFY_CLIENT_ID: 'test-spotify-id',
  SPOTIFY_CLIENT_SECRET: 'test-spotify-secret',
  FIREBASE_PROJECT_ID: 'test-project',
  FIREBASE_CLIENT_EMAIL: 'test@test.iam.gserviceaccount.com',
  FIREBASE_PRIVATE_KEY: 'test-private-key',
};

describe('config validation', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let envSchema: any;

  beforeAll(async () => {
    Object.assign(process.env, validEnv);
    const mod = await import('../../src/config.js');
    envSchema = mod.envSchema;
  });

  it('real envSchema parses valid environment variables successfully', () => {
    const result = envSchema.parse(validEnv);
    expect(result.DATABASE_URL).toBe(validEnv.DATABASE_URL);
    expect(result.NODE_ENV).toBe('development'); // default
    expect(result.PORT).toBe(3000); // default
  });

  it('module-level config is parsed from process.env', async () => {
    const { config } = await import('../../src/config.js');
    expect(config.DATABASE_URL).toBe(validEnv.DATABASE_URL);
    expect(config.JWT_SECRET).toBe(validEnv.JWT_SECRET);
  });

  it('applies defaults for optional fields', () => {
    const result = envSchema.parse(validEnv);
    expect(result.NODE_ENV).toBe('development');
    expect(result.PORT).toBe(3000);
    expect(result.SENTRY_DSN).toBeUndefined();
    expect(result.DATABASE_URL_TEST).toBeUndefined();
  });

  it('coerces PORT from string to number', () => {
    const result = envSchema.parse({ ...validEnv, PORT: '8080' });
    expect(result.PORT).toBe(8080);
  });

  it('fails when DATABASE_URL is missing', () => {
    const { DATABASE_URL: _, ...envWithout } = validEnv;
    expect(() => envSchema.parse(envWithout)).toThrow();
  });

  it('fails when JWT_SECRET is too short', () => {
    expect(() => envSchema.parse({ ...validEnv, JWT_SECRET: 'short' })).toThrow();
  });

  it('fails when FIREBASE_CLIENT_EMAIL is not a valid email', () => {
    expect(() =>
      envSchema.parse({ ...validEnv, FIREBASE_CLIENT_EMAIL: 'not-an-email' })
    ).toThrow();
  });

  it('fails when DATABASE_URL is not a valid URL', () => {
    expect(() =>
      envSchema.parse({ ...validEnv, DATABASE_URL: 'not-a-url' })
    ).toThrow();
  });

  it('fails when NODE_ENV is an invalid value', () => {
    expect(() =>
      envSchema.parse({ ...validEnv, NODE_ENV: 'staging' })
    ).toThrow();
  });

  it('accepts valid NODE_ENV values', () => {
    for (const env of ['development', 'production', 'test']) {
      const result = envSchema.parse({ ...validEnv, NODE_ENV: env });
      expect(result.NODE_ENV).toBe(env);
    }
  });
});
