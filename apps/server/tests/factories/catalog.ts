import type { KaraokeCatalogTable } from '../../src/db/types.js';

let counter = 0;

export function createTestCatalogTrack(overrides?: Partial<KaraokeCatalogTable>): KaraokeCatalogTable {
  counter++;
  return {
    id: overrides?.id ?? `c0000000-0000-0000-0000-${String(counter).padStart(12, '0')}`,
    song_title: overrides?.song_title ?? `Test Song ${counter}`,
    artist: overrides?.artist ?? `Test Artist ${counter}`,
    youtube_video_id: overrides?.youtube_video_id ?? `yt_video_${counter}`,
    channel: overrides?.channel ?? 'Test Channel',
    is_classic: overrides?.is_classic ?? false,
    created_at: overrides?.created_at ?? new Date('2026-01-01T00:00:00Z'),
    updated_at: overrides?.updated_at ?? new Date('2026-01-01T00:00:00Z'),
  };
}
