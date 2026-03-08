import { db } from '../db/connection.js';
import type { UsersTable } from '../db/types.js';

export async function findByFirebaseUid(firebaseUid: string): Promise<UsersTable | undefined> {
  return db
    .selectFrom('users')
    .selectAll()
    .where('firebase_uid', '=', firebaseUid)
    .executeTakeFirst();
}

export async function upsertFromFirebase({ firebaseUid, displayName, avatarUrl }: {
  firebaseUid: string;
  displayName: string;
  avatarUrl?: string;
}): Promise<UsersTable> {
  return db
    .insertInto('users')
    .values({
      id: crypto.randomUUID(),
      firebase_uid: firebaseUid,
      display_name: displayName,
      avatar_url: avatarUrl ?? null,
      created_at: new Date(),
    })
    .onConflict((oc) =>
      oc.column('firebase_uid').doUpdateSet({
        display_name: displayName,
        avatar_url: avatarUrl ?? null,
      })
    )
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function createGuestUser(displayName: string): Promise<UsersTable> {
  return db
    .insertInto('users')
    .values({
      id: crypto.randomUUID(),
      firebase_uid: null,
      display_name: displayName,
      avatar_url: null,
      created_at: new Date(),
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function findById(id: string): Promise<UsersTable | undefined> {
  return db
    .selectFrom('users')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst();
}
