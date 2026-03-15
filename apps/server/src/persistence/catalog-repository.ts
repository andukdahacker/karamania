import { sql } from 'kysely';
import { db } from '../db/connection.js';
import type { KaraokeCatalogTable } from '../db/types.js';

export async function findAll(options?: {
  limit?: number;
  offset?: number;
  channel?: string;
}): Promise<KaraokeCatalogTable[]> {
  let query = db
    .selectFrom('karaoke_catalog')
    .selectAll()
    .orderBy('created_at', 'desc');

  if (options?.channel) {
    query = query.where('channel', '=', options.channel);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.offset(options.offset);
  }

  return query.execute();
}

export async function findByYoutubeVideoId(videoId: string): Promise<KaraokeCatalogTable | undefined> {
  return db
    .selectFrom('karaoke_catalog')
    .selectAll()
    .where('youtube_video_id', '=', videoId)
    .executeTakeFirst();
}

function escapeIlike(value: string): string {
  return value.replace(/[%_\\]/g, '\\$&');
}

export async function searchByTitleOrArtist(query: string, limit = 20, offset = 0): Promise<KaraokeCatalogTable[]> {
  const escaped = escapeIlike(query);
  return db
    .selectFrom('karaoke_catalog')
    .selectAll()
    .where((eb) => eb.or([
      eb('song_title', 'ilike', `%${escaped}%`),
      eb('artist', 'ilike', `%${escaped}%`),
    ]))
    .limit(limit)
    .offset(offset)
    .execute();
}

export async function countByTitleOrArtist(query: string): Promise<number> {
  const escaped = escapeIlike(query);
  const result = await db
    .selectFrom('karaoke_catalog')
    .select(sql<number>`count(*)::int`.as('count'))
    .where((eb) => eb.or([
      eb('song_title', 'ilike', `%${escaped}%`),
      eb('artist', 'ilike', `%${escaped}%`),
    ]))
    .executeTakeFirstOrThrow();
  return result.count;
}

export async function getClassicsCount(): Promise<number> {
  const result = await db
    .selectFrom('karaoke_catalog')
    .select(sql<number>`count(*)::int`.as('count'))
    .where('is_classic', '=', true)
    .executeTakeFirstOrThrow();
  return result.count;
}

export async function findClassics(): Promise<KaraokeCatalogTable[]> {
  return db
    .selectFrom('karaoke_catalog')
    .selectAll()
    .where('is_classic', '=', true)
    .execute();
}

export async function upsertBatch(tracks: Array<{
  song_title: string;
  artist: string;
  youtube_video_id: string;
  channel?: string | null;
  is_classic?: boolean;
}>): Promise<void> {
  const BATCH_SIZE = 500;
  for (let i = 0; i < tracks.length; i += BATCH_SIZE) {
    const batch = tracks.slice(i, i + BATCH_SIZE);
    const values = batch.map((track) => ({
      id: crypto.randomUUID(),
      song_title: track.song_title,
      artist: track.artist,
      youtube_video_id: track.youtube_video_id,
      channel: track.channel ?? null,
      is_classic: track.is_classic ?? false,
      created_at: new Date(),
      updated_at: new Date(),
    }));

    await db
      .insertInto('karaoke_catalog')
      .values(values)
      .onConflict((oc) =>
        oc.column('youtube_video_id').doUpdateSet({
          song_title: sql`excluded.song_title`,
          artist: sql`excluded.artist`,
          channel: sql`excluded.channel`,
          updated_at: sql`now()`,
        })
      )
      .execute();
  }
}

export async function getCount(): Promise<number> {
  const result = await db
    .selectFrom('karaoke_catalog')
    .select(sql<number>`count(*)::int`.as('count'))
    .executeTakeFirstOrThrow();
  return result.count;
}

export async function findByIds(ids: string[]): Promise<KaraokeCatalogTable[]> {
  if (ids.length === 0) return [];
  return db
    .selectFrom('karaoke_catalog')
    .selectAll()
    .where('id', 'in', ids)
    .execute();
}

export async function intersectWithSongs(
  songTitles: string[],
  artists: string[],
): Promise<KaraokeCatalogTable[]> {
  if (songTitles.length === 0 || songTitles.length !== artists.length) return [];

  return db
    .selectFrom('karaoke_catalog')
    .selectAll()
    .where((eb) =>
      eb.or(
        songTitles.map((title, idx) =>
          eb.and([
            eb('song_title', 'ilike', escapeIlike(title)),
            eb('artist', 'ilike', escapeIlike(artists[idx]!)),
          ])
        )
      )
    )
    .execute();
}
