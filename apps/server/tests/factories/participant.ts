import type { SessionParticipantsTable } from '../../src/db/types.js';

let counter = 0;

export function createTestParticipant(
  overrides?: Partial<SessionParticipantsTable>
): SessionParticipantsTable {
  counter++;
  return {
    id: overrides?.id ?? `20000000-0000-0000-0000-${String(counter).padStart(12, '0')}`,
    session_id: overrides?.session_id ?? `10000000-0000-0000-0000-${String(counter).padStart(12, '0')}`,
    user_id: overrides?.user_id ?? null,
    guest_name: overrides?.guest_name ?? `Guest ${counter}`,
    participation_score: overrides?.participation_score ?? 0,
    top_award: overrides?.top_award ?? null,
    feedback_score: overrides?.feedback_score ?? null,
    joined_at: overrides?.joined_at ?? new Date('2026-01-01T00:00:00Z'),
  };
}
