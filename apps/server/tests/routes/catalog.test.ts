import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { validatorCompiler, serializerCompiler } from 'fastify-type-provider-zod';
import { errorHandler } from '../../src/shared/errors.js';
import { createTestCatalogTrack } from '../factories/catalog.js';

vi.mock('../../src/config.js', () => ({
  config: {
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    JWT_SECRET: 'test-secret-key-at-least-32-characters-long',
    YOUTUBE_API_KEY: 'test-key',
    SPOTIFY_CLIENT_ID: 'test-id',
    SPOTIFY_CLIENT_SECRET: 'test-secret',
    FIREBASE_PROJECT_ID: 'test-project',
    FIREBASE_CLIENT_EMAIL: 'test@test.iam.gserviceaccount.com',
    FIREBASE_PRIVATE_KEY: 'test-key',
    NODE_ENV: 'test',
    PORT: 3000,
  },
}));

vi.mock('../../src/db/connection.js', () => ({
  db: {},
}));

const mockSearchByTitleOrArtist = vi.fn();
const mockCountByTitleOrArtist = vi.fn();
const mockGetCount = vi.fn();
const mockGetClassicsCount = vi.fn();
const mockFindClassics = vi.fn();

vi.mock('../../src/persistence/catalog-repository.js', () => ({
  searchByTitleOrArtist: mockSearchByTitleOrArtist,
  countByTitleOrArtist: mockCountByTitleOrArtist,
  getCount: mockGetCount,
  getClassicsCount: mockGetClassicsCount,
  findClassics: mockFindClassics,
}));

describe('catalog routes', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    app.setErrorHandler(errorHandler);
    const { catalogRoutes } = await import('../../src/routes/catalog.js');
    await app.register(catalogRoutes);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /api/catalog/search', () => {
    it('returns search results with pagination', async () => {
      const tracks = [createTestCatalogTrack({ song_title: 'Bohemian Rhapsody', artist: 'Queen' })];
      mockSearchByTitleOrArtist.mockResolvedValue(tracks);
      mockCountByTitleOrArtist.mockResolvedValue(1);

      const response = await app.inject({
        method: 'GET',
        url: '/api/catalog/search?q=Bohemian',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body) as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['total']).toBe(1);
      expect(data['offset']).toBe(0);
      expect(data['limit']).toBe(20);
      const resultTracks = data['tracks'] as Array<Record<string, unknown>>;
      expect(resultTracks).toHaveLength(1);
      expect(resultTracks[0]!['songTitle']).toBe('Bohemian Rhapsody');
      expect(resultTracks[0]!['artist']).toBe('Queen');
    });

    it('applies custom limit and offset', async () => {
      mockSearchByTitleOrArtist.mockResolvedValue([]);
      mockCountByTitleOrArtist.mockResolvedValue(0);

      const response = await app.inject({
        method: 'GET',
        url: '/api/catalog/search?q=test&limit=50&offset=10',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body) as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['limit']).toBe(50);
      expect(data['offset']).toBe(10);
    });

    it('returns 400 when q parameter is missing', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/catalog/search',
      });

      expect(response.statusCode).toBe(400);
    });

    it('returns 400 when q parameter is empty', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/catalog/search?q=',
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/catalog/stats', () => {
    it('returns total and classic track counts', async () => {
      mockGetCount.mockResolvedValue(10500);
      mockGetClassicsCount.mockResolvedValue(200);

      const response = await app.inject({
        method: 'GET',
        url: '/api/catalog/stats',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body) as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['totalTracks']).toBe(10500);
      expect(data['classicTracks']).toBe(200);
    });

    it('returns zero counts for empty catalog', async () => {
      mockGetCount.mockResolvedValue(0);
      mockGetClassicsCount.mockResolvedValue(0);

      const response = await app.inject({
        method: 'GET',
        url: '/api/catalog/stats',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body) as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['totalTracks']).toBe(0);
      expect(data['classicTracks']).toBe(0);
    });
  });

  describe('GET /api/catalog/classics', () => {
    it('returns all classic tracks', async () => {
      const classics = [
        createTestCatalogTrack({ is_classic: true, song_title: 'Bohemian Rhapsody', artist: 'Queen' }),
        createTestCatalogTrack({ is_classic: true, song_title: 'Sweet Caroline', artist: 'Neil Diamond' }),
      ];
      mockFindClassics.mockResolvedValue(classics);

      const response = await app.inject({
        method: 'GET',
        url: '/api/catalog/classics',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body) as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      const resultTracks = data['tracks'] as Array<Record<string, unknown>>;
      expect(resultTracks).toHaveLength(2);
      expect(resultTracks[0]!['songTitle']).toBe('Bohemian Rhapsody');
      expect(resultTracks[1]!['songTitle']).toBe('Sweet Caroline');
    });

    it('returns empty array when no classics exist', async () => {
      mockFindClassics.mockResolvedValue([]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/catalog/classics',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body) as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      const resultTracks = data['tracks'] as Array<Record<string, unknown>>;
      expect(resultTracks).toHaveLength(0);
    });
  });
});
