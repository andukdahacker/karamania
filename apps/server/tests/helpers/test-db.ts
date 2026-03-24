// Test database helpers — seed data and cleanup for integration tests
// Uses real PostgreSQL via Kysely (same connection as production code)

import { db } from '../../src/db/connection.js';

export interface SeededSession {
  sessionId: string;
  hostUserId: string;
  partyCode: string;
}

export interface SeededUser {
  id: string;
  firebaseUid: string | null;
  displayName: string;
}

// Track all entities created in this test file for targeted cleanup
export const trackedSessionIds: string[] = [];
export const trackedUserIds: string[] = [];

/**
 * Creates a test user directly in the database.
 * Returns the created user's ID for use in session setup.
 */
export async function seedUser(overrides?: {
  id?: string;
  displayName?: string;
  firebaseUid?: string | null;
}): Promise<SeededUser> {
  const id = overrides?.id ?? crypto.randomUUID();
  const displayName = overrides?.displayName ?? `Test User ${Date.now()}`;
  const firebaseUid = overrides?.firebaseUid ?? null;

  await db
    .insertInto('users')
    .values({
      id,
      firebase_uid: firebaseUid,
      display_name: displayName,
      avatar_url: null,
      created_at: new Date(),
    })
    .execute();

  trackedUserIds.push(id);
  return { id, firebaseUid, displayName };
}

/**
 * Creates a test session in lobby status with a host user.
 * The host user is created automatically if not already in DB.
 */
export async function seedSession(overrides?: {
  hostUserId?: string;
  partyCode?: string;
  vibe?: string;
  status?: string;
}): Promise<SeededSession> {
  const partyCode = overrides?.partyCode ?? generatePartyCode();
  const hostUserId = overrides?.hostUserId ?? crypto.randomUUID();

  // Ensure host user exists
  const existingUser = await db
    .selectFrom('users')
    .where('id', '=', hostUserId)
    .selectAll()
    .executeTakeFirst();

  if (!existingUser) {
    await seedUser({ id: hostUserId, displayName: 'Test Host' });
  }

  const sessionId = crypto.randomUUID();
  await db
    .insertInto('sessions')
    .values({
      id: sessionId,
      host_user_id: hostUserId,
      party_code: partyCode,
      status: overrides?.status ?? 'lobby',
      dj_state: null,
      event_stream: null,
      summary: null,
      vibe: overrides?.vibe ?? 'general',
      venue_name: null,
      created_at: new Date(),
      ended_at: null,
    })
    .execute();

  trackedSessionIds.push(sessionId);
  return { sessionId, hostUserId, partyCode };
}

/**
 * Adds a participant to a session. Guest participants (no user_id) or
 * registered users (with user_id).
 */
export async function seedParticipant(
  sessionId: string,
  overrides?: {
    userId?: string;
    guestName?: string;
  },
): Promise<void> {
  await db
    .insertInto('session_participants')
    .values({
      id: crypto.randomUUID(),
      session_id: sessionId,
      user_id: overrides?.userId ?? null,
      guest_name: overrides?.guestName ?? 'Test Guest',
      participation_score: 0,
      top_award: null,
      feedback_score: null,
      joined_at: new Date(),
    })
    .execute();
}

/**
 * Seeds catalog tracks for song selection tests.
 */
export async function seedCatalogTracks(count = 5): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const id = crypto.randomUUID();
    ids.push(id);
    await db
      .insertInto('karaoke_catalog')
      .values({
        id,
        song_title: `Test Song ${i + 1}`,
        artist: `Test Artist ${i + 1}`,
        youtube_video_id: `yt-${id.slice(0, 8)}`,
        is_classic: false,
        channel: 'test-channel',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .execute();
  }
  return ids;
}

/**
 * Updates the session host to a new user. Used to make a bot the host
 * after it connects and receives its guestId.
 * Ensures the user exists in the DB (creates guest user if missing).
 */
export async function setSessionHost(sessionId: string, newHostUserId: string): Promise<void> {
  // Ensure user exists (guest bots may not have a DB row yet)
  const existingUser = await db
    .selectFrom('users')
    .where('id', '=', newHostUserId)
    .selectAll()
    .executeTakeFirst();

  if (!existingUser) {
    await db
      .insertInto('users')
      .values({
        id: newHostUserId,
        firebase_uid: null,
        display_name: 'Test Host (bot)',
        avatar_url: null,
        created_at: new Date(),
      })
      .execute();
    trackedUserIds.push(newHostUserId);
  }

  await db
    .updateTable('sessions')
    .set({ host_user_id: newHostUserId })
    .where('id', '=', sessionId)
    .execute();
}

/**
 * Cleans up only entities created by this test file (tracked via seedSession/seedUser).
 * Safe for parallel test execution — doesn't delete other files' data.
 */
export async function cleanupTestData(): Promise<void> {
  // Clean sessions and their dependent data
  if (trackedSessionIds.length > 0) {
    await db.deleteFrom('media_captures').where('session_id', 'in', trackedSessionIds).execute();
    await db.deleteFrom('session_participants').where('session_id', 'in', trackedSessionIds).execute();
    await db.deleteFrom('sessions').where('id', 'in', trackedSessionIds).execute();
  }
  // Clean users (must come after sessions due to FK)
  if (trackedUserIds.length > 0) {
    // Only delete users not referenced by remaining sessions
    await db.deleteFrom('users').where('id', 'in', trackedUserIds).execute().catch(() => {
      // Ignore FK violations — user may still be referenced by a session from another test file
    });
  }
  // Reset tracking
  trackedSessionIds.length = 0;
  trackedUserIds.length = 0;
}

/**
 * Cleans up a specific session and its related data.
 */
export async function cleanupSession(sessionId: string): Promise<void> {
  await db.deleteFrom('media_captures').where('session_id', '=', sessionId).execute();
  await db.deleteFrom('session_participants').where('session_id', '=', sessionId).execute();
  await db.deleteFrom('sessions').where('id', '=', sessionId).execute();
}

/**
 * Destroys the database connection pool. Call in global teardown.
 */
export async function destroyDb(): Promise<void> {
  await db.destroy();
}

/**
 * Polls a condition until it returns a truthy value, or times out.
 * Use instead of hard waits (setTimeout) for fire-and-forget operations.
 */
export async function waitForCondition<T>(
  check: () => Promise<T | null | undefined>,
  opts: { timeout?: number; interval?: number } = {},
): Promise<T> {
  const timeout = opts.timeout ?? 3000;
  const interval = opts.interval ?? 100;
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const result = await check();
    if (result) return result;
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error(`waitForCondition timed out after ${timeout}ms`);
}

function generatePartyCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
