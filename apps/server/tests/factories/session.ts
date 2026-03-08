import type { SessionsTable } from '../../src/db/types.js';

let counter = 0;

export function createTestSession(overrides?: Partial<SessionsTable>): SessionsTable {
  counter++;
  return {
    id: overrides?.id ?? `10000000-0000-0000-0000-${String(counter).padStart(12, '0')}`,
    host_user_id: overrides?.host_user_id ?? `00000000-0000-0000-0000-${String(counter).padStart(12, '0')}`,
    party_code: overrides?.party_code ?? 'VIBE',
    status: overrides?.status ?? 'lobby',
    dj_state: overrides?.dj_state ?? null,
    event_stream: overrides?.event_stream ?? null,
    vibe: overrides?.vibe ?? null,
    venue_name: overrides?.venue_name ?? null,
    created_at: overrides?.created_at ?? new Date('2026-01-01T00:00:00Z'),
    ended_at: overrides?.ended_at ?? null,
  };
}
