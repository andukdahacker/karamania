import type { UsersTable } from '../../src/db/types.js';

let counter = 0;

export function createTestUser(overrides?: Partial<UsersTable>): UsersTable {
  counter++;
  return {
    id: overrides?.id ?? `00000000-0000-0000-0000-${String(counter).padStart(12, '0')}`,
    firebase_uid: overrides?.firebase_uid ?? `firebase-uid-${counter}`,
    display_name: overrides?.display_name ?? `Test User ${counter}`,
    avatar_url: overrides?.avatar_url ?? null,
    created_at: overrides?.created_at ?? new Date('2026-01-01T00:00:00Z'),
  };
}
