import { db } from '../db/connection.js';
import { sql } from 'kysely';
import type { MediaCapturesTable } from '../db/types.js';

export async function create(params: {
  id: string;
  sessionId: string;
  userId: string | null;
  storagePath: string;
  triggerType: string;
  djStateAtCapture: unknown | null;
}): Promise<MediaCapturesTable> {
  return db
    .insertInto('media_captures')
    .values({
      id: params.id,
      session_id: params.sessionId,
      user_id: params.userId,
      storage_path: params.storagePath,
      trigger_type: params.triggerType,
      dj_state_at_capture: params.djStateAtCapture != null
        ? JSON.stringify(params.djStateAtCapture)
        : null,
      created_at: new Date(),
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function findBySessionId(sessionId: string): Promise<MediaCapturesTable[]> {
  return db
    .selectFrom('media_captures')
    .selectAll()
    .where('session_id', '=', sessionId)
    .orderBy('created_at', 'asc')
    .execute();
}

export async function findById(id: string): Promise<MediaCapturesTable | undefined> {
  return db
    .selectFrom('media_captures')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst();
}

export async function relinkCaptures(
  captureIds: string[],
  userId: string,
): Promise<number> {
  if (captureIds.length === 0) return 0;
  const result = await db
    .updateTable('media_captures')
    .set({ user_id: userId })
    .where('id', 'in', captureIds)
    .where('user_id', 'is', null)
    .executeTakeFirst();
  return Number(result.numUpdatedRows);
}

export async function findAllByUserId(
  userId: string,
  limit: number = 40,
  offset: number = 0,
): Promise<{ captures: Array<MediaCapturesTable & { venue_name: string | null; session_created_at: Date }>; total: number }> {
  const [captures, countResult] = await Promise.all([
    db
      .selectFrom('media_captures')
      .innerJoin('sessions', 'sessions.id', 'media_captures.session_id')
      .select([
        'media_captures.id',
        'media_captures.session_id',
        'media_captures.user_id',
        'media_captures.storage_path',
        'media_captures.trigger_type',
        'media_captures.dj_state_at_capture',
        'media_captures.created_at',
        'sessions.venue_name',
      ])
      .select((eb) => eb.ref('sessions.created_at').as('session_created_at'))
      .where('media_captures.user_id', '=', userId)
      .orderBy('media_captures.created_at', 'desc')
      .limit(limit)
      .offset(offset)
      .execute(),
    db
      .selectFrom('media_captures')
      .select(sql<number>`count(*)::int`.as('count'))
      .where('user_id', '=', userId)
      .executeTakeFirstOrThrow(),
  ]);
  return { captures: captures as Array<MediaCapturesTable & { venue_name: string | null; session_created_at: Date }>, total: countResult.count };
}

export async function findByUserId(userId: string, sessionId: string): Promise<MediaCapturesTable[]> {
  return db
    .selectFrom('media_captures')
    .selectAll()
    .where('user_id', '=', userId)
    .where('session_id', '=', sessionId)
    .orderBy('created_at', 'asc')
    .execute();
}
