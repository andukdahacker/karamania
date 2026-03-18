import type { MediaCapturesTable } from '../../src/db/types.js';

let counter = 0;

export function createTestMediaCapture(overrides?: Partial<MediaCapturesTable>): MediaCapturesTable {
  counter++;
  return {
    id: overrides?.id ?? `m0000000-0000-0000-0000-${String(counter).padStart(12, '0')}`,
    session_id: overrides?.session_id ?? `10000000-0000-0000-0000-${String(counter).padStart(12, '0')}`,
    user_id: overrides?.user_id ?? null,
    storage_path: overrides?.storage_path ?? `session-1/capture-${counter}.jpg`,
    trigger_type: overrides?.trigger_type ?? 'manual',
    dj_state_at_capture: overrides?.dj_state_at_capture ?? null,
    created_at: overrides?.created_at ?? new Date('2026-01-01T00:00:00Z'),
  };
}
