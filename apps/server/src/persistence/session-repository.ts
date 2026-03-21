import { sql } from 'kysely';
import { db } from '../db/connection.js';
import type { SessionsTable, SessionParticipantsTable } from '../db/types.js';
import type { SessionSummary } from '../shared/schemas/finale-schemas.js';

export async function findByPartyCode(partyCode: string): Promise<SessionsTable | undefined> {
  return db
    .selectFrom('sessions')
    .selectAll()
    .where('party_code', '=', partyCode)
    .where('status', '!=', 'ended')
    .executeTakeFirst();
}

export async function findById(id: string): Promise<SessionsTable | undefined> {
  return db
    .selectFrom('sessions')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst();
}

export async function findActiveSessions(): Promise<SessionsTable[]> {
  return db
    .selectFrom('sessions')
    .selectAll()
    .where('status', '=', 'active')
    .execute();
}

export async function create(params: {
  hostUserId: string;
  partyCode: string;
  vibe: string;
  venueName?: string;
}): Promise<SessionsTable> {
  return db
    .insertInto('sessions')
    .values({
      id: crypto.randomUUID(),
      host_user_id: params.hostUserId,
      party_code: params.partyCode,
      status: 'lobby',
      vibe: params.vibe,
      venue_name: params.venueName ?? null,
      dj_state: null,
      event_stream: null,
      created_at: new Date(),
      ended_at: null,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function addParticipant(params: {
  sessionId: string;
  userId?: string;
  guestName?: string;
}): Promise<SessionParticipantsTable> {
  return db
    .insertInto('session_participants')
    .values({
      id: crypto.randomUUID(),
      session_id: params.sessionId,
      user_id: params.userId ?? null,
      guest_name: params.guestName ?? null,
      participation_score: 0,
      top_award: null,
      feedback_score: null,
      joined_at: new Date(),
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function getParticipants(sessionId: string) {
  return db
    .selectFrom('session_participants')
    .leftJoin('users', 'users.id', 'session_participants.user_id')
    .select([
      'session_participants.id',
      'session_participants.user_id',
      'session_participants.guest_name',
      'users.display_name',
      'session_participants.joined_at',
    ])
    .where('session_participants.session_id', '=', sessionId)
    .orderBy('session_participants.joined_at', 'asc')
    .execute();
}

export async function addParticipantIfNotExists(params: {
  sessionId: string;
  userId?: string;
  guestName?: string;
}): Promise<void> {
  try {
    await addParticipant(params);
  } catch (error: unknown) {
    // Ignore unique constraint violation (participant already exists)
    if (
      error instanceof Error &&
      'code' in error &&
      (error as Error & { code: string }).code === '23505'
    ) {
      return;
    }
    throw error;
  }
}

export async function updateVibe(sessionId: string, vibe: string): Promise<void> {
  await db
    .updateTable('sessions')
    .set({ vibe })
    .where('id', '=', sessionId)
    .execute();
}

export async function updateHost(sessionId: string, newHostUserId: string) {
  return db
    .updateTable('sessions')
    .set({ host_user_id: newHostUserId })
    .where('id', '=', sessionId)
    .executeTakeFirst();
}

export async function updateDjState(sessionId: string, djState: unknown): Promise<void> {
  await db
    .updateTable('sessions')
    .set({ dj_state: djState })
    .where('id', '=', sessionId)
    .execute();
}

export async function writeEventStream(sessionId: string, events: unknown[]): Promise<void> {
  await db
    .updateTable('sessions')
    .set({ event_stream: JSON.stringify(events) })
    .where('id', '=', sessionId)
    .execute();
}

export async function persistSessionSummary(sessionId: string, summary: SessionSummary): Promise<void> {
  await db
    .updateTable('sessions')
    .set({ summary: JSON.stringify(summary) })
    .where('id', '=', sessionId)
    .execute();
}

export async function removeParticipant(sessionId: string, userId: string): Promise<void> {
  await db
    .deleteFrom('session_participants')
    .where('session_id', '=', sessionId)
    .where('user_id', '=', userId)
    .execute();
}

export async function incrementParticipationScore(
  sessionId: string,
  userId: string,
  increment: number
): Promise<void> {
  await db
    .updateTable('session_participants')
    .set((eb) => ({
      participation_score: eb('participation_score', '+', increment),
    }))
    .where('session_id', '=', sessionId)
    .where('user_id', '=', userId)
    .execute();
}

export async function getParticipantScore(
  sessionId: string,
  userId: string
): Promise<number | undefined> {
  const result = await db
    .selectFrom('session_participants')
    .select('participation_score')
    .where('session_id', '=', sessionId)
    .where('user_id', '=', userId)
    .executeTakeFirst();
  return result?.participation_score;
}

export async function updateTopAward(
  sessionId: string,
  userId: string,
  award: string
): Promise<void> {
  await db
    .updateTable('session_participants')
    .set({ top_award: award })
    .where('session_id', '=', sessionId)
    .where('user_id', '=', userId)
    .execute();
}

export async function updateFeedbackScore(
  sessionId: string,
  userId: string,
  score: number,
): Promise<void> {
  await db
    .updateTable('session_participants')
    .set({ feedback_score: score })
    .where('session_id', '=', sessionId)
    .where('user_id', '=', userId)
    .execute();
}

export async function isSessionParticipant(sessionId: string, userId: string): Promise<boolean> {
  const participant = await db
    .selectFrom('session_participants')
    .select('id')
    .where('session_id', '=', sessionId)
    .where('user_id', '=', userId)
    .executeTakeFirst();

  if (participant) return true;

  const host = await db
    .selectFrom('sessions')
    .select('id')
    .where('id', '=', sessionId)
    .where('host_user_id', '=', userId)
    .executeTakeFirst();

  return !!host;
}

export async function linkGuestParticipant(
  sessionId: string,
  guestName: string,
  userId: string,
): Promise<void> {
  await db
    .updateTable('session_participants')
    .set({ user_id: userId, guest_name: null })
    .where('session_id', '=', sessionId)
    .where('guest_name', '=', guestName)
    .where('user_id', 'is', null)
    .execute();
}

export async function updateStatus(sessionId: string, status: string) {
  const values: Record<string, unknown> = { status };
  if (status === 'ended') {
    values.ended_at = new Date();
  }
  return db
    .updateTable('sessions')
    .set(values)
    .where('id', '=', sessionId)
    .executeTakeFirst();
}

export interface TimelineRow {
  id: string;
  venue_name: string | null;
  ended_at: Date | null;
  participant_count: number;
  top_award: string | null;
  thumbnail_storage_path: string | null;
}

export async function findUserSessions(
  userId: string,
  limit: number,
  offset: number,
): Promise<TimelineRow[]> {
  const rows = await db
    .selectFrom('sessions')
    .select([
      'sessions.id',
      'sessions.venue_name',
      'sessions.ended_at',
      sql<number>`(sessions.summary->'stats'->>'participantCount')::int`.as('participant_count'),
    ])
    .select((eb) => [
      eb
        .selectFrom('session_participants as sp')
        .select('sp.top_award')
        .whereRef('sp.session_id', '=', 'sessions.id')
        .where('sp.user_id', '=', userId)
        .as('top_award'),
      eb
        .selectFrom('media_captures as mc')
        .select('mc.storage_path')
        .whereRef('mc.session_id', '=', 'sessions.id')
        .orderBy('mc.created_at', 'asc')
        .limit(1)
        .as('thumbnail_storage_path'),
    ])
    .where('sessions.id', 'in',
      db.selectFrom('sessions')
        .select('sessions.id')
        .where('sessions.host_user_id', '=', userId)
        .unionAll(
          db.selectFrom('session_participants')
            .select('session_participants.session_id as id')
            .where('session_participants.user_id', '=', userId)
        )
    )
    .where('sessions.status', '=', 'ended')
    .where('sessions.summary', 'is not', null)
    .orderBy('sessions.ended_at', 'desc')
    .limit(limit)
    .offset(offset)
    .execute();

  return rows as TimelineRow[];
}

export async function countUserSessions(userId: string): Promise<number> {
  const result = await db
    .selectFrom('sessions')
    .select(sql<number>`count(*)::int`.as('count'))
    .where('sessions.id', 'in',
      db.selectFrom('sessions')
        .select('sessions.id')
        .where('sessions.host_user_id', '=', userId)
        .unionAll(
          db.selectFrom('session_participants')
            .select('session_participants.session_id as id')
            .where('session_participants.user_id', '=', userId)
        )
    )
    .where('sessions.status', '=', 'ended')
    .where('sessions.summary', 'is not', null)
    .executeTakeFirstOrThrow();
  return result.count;
}
