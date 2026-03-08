import { db } from '../db/connection.js';
import type { SessionsTable } from '../db/types.js';

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
