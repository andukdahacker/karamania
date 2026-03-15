import { describe, it, expect, vi, beforeEach } from 'vitest';
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

const mockExecuteTakeFirst = vi.fn();
const mockExecuteTakeFirstOrThrow = vi.fn();
const mockExecute = vi.fn();
const mockWhere = vi.fn();
const mockValues = vi.fn();
const mockLimit = vi.fn();
const mockOffset = vi.fn();
const mockOrderBy = vi.fn();
const mockOnConflict = vi.fn();

vi.mock('../../src/db/connection.js', () => {
  // Fully chainable mock - every method returns an object with all methods
  const createChain = (): Record<string, unknown> => ({
    executeTakeFirst: mockExecuteTakeFirst,
    executeTakeFirstOrThrow: mockExecuteTakeFirstOrThrow,
    execute: mockExecute,
    where: (...args: unknown[]) => { mockWhere(...args); return createChain(); },
    limit: (...args: unknown[]) => { mockLimit(...args); return createChain(); },
    offset: (...args: unknown[]) => { mockOffset(...args); return createChain(); },
    orderBy: (...args: unknown[]) => { mockOrderBy(...args); return createChain(); },
    onConflict: (...args: unknown[]) => { mockOnConflict(...args); return createChain(); },
    as: () => createChain(),
  });

  return {
    db: {
      selectFrom: vi.fn().mockReturnValue({
        selectAll: () => createChain(),
        select: () => createChain(),
      }),
      insertInto: vi.fn().mockReturnValue({
        values: (...args: unknown[]) => {
          mockValues(...args);
          return createChain();
        },
      }),
    },
  };
});

describe('catalog-repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns all tracks with default ordering', async () => {
      const tracks = [createTestCatalogTrack(), createTestCatalogTrack()];
      mockExecute.mockResolvedValue(tracks);

      const { findAll } = await import('../../src/persistence/catalog-repository.js');
      const result = await findAll();

      expect(mockOrderBy).toHaveBeenCalledWith('created_at', 'desc');
      expect(result).toEqual(tracks);
    });

    it('applies limit and offset when provided', async () => {
      mockExecute.mockResolvedValue([]);

      const { findAll } = await import('../../src/persistence/catalog-repository.js');
      await findAll({ limit: 10, offset: 20 });

      expect(mockLimit).toHaveBeenCalledWith(10);
      expect(mockOffset).toHaveBeenCalledWith(20);
    });

    it('filters by channel when provided', async () => {
      mockExecute.mockResolvedValue([]);

      const { findAll } = await import('../../src/persistence/catalog-repository.js');
      await findAll({ channel: 'Sing King' });

      expect(mockWhere).toHaveBeenCalledWith('channel', '=', 'Sing King');
    });
  });

  describe('findByYoutubeVideoId', () => {
    it('returns track when found', async () => {
      const track = createTestCatalogTrack({ youtube_video_id: 'abc123' });
      mockExecuteTakeFirst.mockResolvedValue(track);

      const { findByYoutubeVideoId } = await import('../../src/persistence/catalog-repository.js');
      const result = await findByYoutubeVideoId('abc123');

      expect(mockWhere).toHaveBeenCalledWith('youtube_video_id', '=', 'abc123');
      expect(result).toEqual(track);
    });

    it('returns undefined when not found', async () => {
      mockExecuteTakeFirst.mockResolvedValue(undefined);

      const { findByYoutubeVideoId } = await import('../../src/persistence/catalog-repository.js');
      const result = await findByYoutubeVideoId('nonexistent');

      expect(result).toBeUndefined();
    });
  });

  describe('searchByTitleOrArtist', () => {
    it('searches using ILIKE with correct query pattern', async () => {
      const tracks = [createTestCatalogTrack({ song_title: 'Bohemian Rhapsody' })];
      mockExecute.mockResolvedValue(tracks);

      const { searchByTitleOrArtist } = await import('../../src/persistence/catalog-repository.js');
      const result = await searchByTitleOrArtist('Bohemian');

      expect(mockWhere).toHaveBeenCalledWith(expect.any(Function));
      expect(mockLimit).toHaveBeenCalledWith(20);
      expect(result).toEqual(tracks);
    });

    it('applies custom limit', async () => {
      mockExecute.mockResolvedValue([]);

      const { searchByTitleOrArtist } = await import('../../src/persistence/catalog-repository.js');
      await searchByTitleOrArtist('test', 50);

      expect(mockLimit).toHaveBeenCalledWith(50);
    });

    it('applies offset for pagination', async () => {
      mockExecute.mockResolvedValue([]);

      const { searchByTitleOrArtist } = await import('../../src/persistence/catalog-repository.js');
      await searchByTitleOrArtist('test', 20, 40);

      expect(mockOffset).toHaveBeenCalledWith(40);
    });
  });

  describe('countByTitleOrArtist', () => {
    it('returns count of matching tracks', async () => {
      mockExecuteTakeFirstOrThrow.mockResolvedValue({ count: 5 });

      const { countByTitleOrArtist } = await import('../../src/persistence/catalog-repository.js');
      const result = await countByTitleOrArtist('Queen');

      expect(mockWhere).toHaveBeenCalledWith(expect.any(Function));
      expect(result).toBe(5);
    });
  });

  describe('getClassicsCount', () => {
    it('returns count of classic tracks', async () => {
      mockExecuteTakeFirstOrThrow.mockResolvedValue({ count: 200 });

      const { getClassicsCount } = await import('../../src/persistence/catalog-repository.js');
      const result = await getClassicsCount();

      expect(mockWhere).toHaveBeenCalledWith('is_classic', '=', true);
      expect(result).toBe(200);
    });
  });

  describe('findClassics', () => {
    it('returns only tracks where is_classic is true', async () => {
      const classics = [
        createTestCatalogTrack({ is_classic: true, song_title: 'Bohemian Rhapsody' }),
        createTestCatalogTrack({ is_classic: true, song_title: 'Sweet Caroline' }),
      ];
      mockExecute.mockResolvedValue(classics);

      const { findClassics } = await import('../../src/persistence/catalog-repository.js');
      const result = await findClassics();

      expect(mockWhere).toHaveBeenCalledWith('is_classic', '=', true);
      expect(result).toEqual(classics);
      expect(result.every((t) => t.is_classic)).toBe(true);
    });
  });

  describe('upsertBatch', () => {
    it('inserts tracks with onConflict handler', async () => {
      mockExecute.mockResolvedValue(undefined);

      const { upsertBatch } = await import('../../src/persistence/catalog-repository.js');
      await upsertBatch([
        { song_title: 'Song A', artist: 'Artist A', youtube_video_id: 'vid_a' },
      ]);

      expect(mockValues).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            song_title: 'Song A',
            artist: 'Artist A',
            youtube_video_id: 'vid_a',
          }),
        ])
      );
      expect(mockOnConflict).toHaveBeenCalledWith(expect.any(Function));
    });

    it('handles empty array without error', async () => {
      const { upsertBatch } = await import('../../src/persistence/catalog-repository.js');
      await upsertBatch([]);

      expect(mockValues).not.toHaveBeenCalled();
    });

    it('is idempotent - upserting same tracks twice works', async () => {
      mockExecute.mockResolvedValue(undefined);

      const { upsertBatch } = await import('../../src/persistence/catalog-repository.js');
      const tracks = [
        { song_title: 'Song X', artist: 'Artist X', youtube_video_id: 'vid_x' },
      ];

      await upsertBatch(tracks);
      await upsertBatch(tracks);

      expect(mockValues).toHaveBeenCalledTimes(2);
      expect(mockOnConflict).toHaveBeenCalledTimes(2);
    });
  });

  describe('getCount', () => {
    it('returns total catalog size as number', async () => {
      mockExecuteTakeFirstOrThrow.mockResolvedValue({ count: 10500 });

      const { getCount } = await import('../../src/persistence/catalog-repository.js');
      const result = await getCount();

      expect(result).toBe(10500);
    });
  });

  describe('findByIds', () => {
    it('returns tracks matching provided IDs', async () => {
      const tracks = [createTestCatalogTrack({ id: 'id-1' }), createTestCatalogTrack({ id: 'id-2' })];
      mockExecute.mockResolvedValue(tracks);

      const { findByIds } = await import('../../src/persistence/catalog-repository.js');
      const result = await findByIds(['id-1', 'id-2']);

      expect(mockWhere).toHaveBeenCalledWith('id', 'in', ['id-1', 'id-2']);
      expect(result).toEqual(tracks);
    });

    it('returns empty array for empty input', async () => {
      const { findByIds } = await import('../../src/persistence/catalog-repository.js');
      const result = await findByIds([]);

      expect(result).toEqual([]);
      expect(mockWhere).not.toHaveBeenCalled();
    });
  });

  describe('intersectWithSongs', () => {
    it('returns matching catalog tracks using ILIKE', async () => {
      const tracks = [createTestCatalogTrack({ song_title: 'Bohemian Rhapsody', artist: 'Queen' })];
      mockExecute.mockResolvedValue(tracks);

      const { intersectWithSongs } = await import('../../src/persistence/catalog-repository.js');
      const result = await intersectWithSongs(['Bohemian Rhapsody'], ['Queen']);

      expect(mockWhere).toHaveBeenCalledWith(expect.any(Function));
      expect(result).toEqual(tracks);
    });

    it('returns empty array when inputs are empty', async () => {
      const { intersectWithSongs } = await import('../../src/persistence/catalog-repository.js');
      const result = await intersectWithSongs([], []);

      expect(result).toEqual([]);
    });

    it('returns empty array when arrays have different lengths', async () => {
      const { intersectWithSongs } = await import('../../src/persistence/catalog-repository.js');
      const result = await intersectWithSongs(['Song'], []);

      expect(result).toEqual([]);
    });
  });
});
