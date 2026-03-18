import { db } from '../db/connection.js';
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

export async function findByUserId(userId: string, sessionId: string): Promise<MediaCapturesTable[]> {
  return db
    .selectFrom('media_captures')
    .selectAll()
    .where('user_id', '=', userId)
    .where('session_id', '=', sessionId)
    .orderBy('created_at', 'asc')
    .execute();
}
