import type { Server as SocketIOServer } from 'socket.io';
import type { AuthenticatedSocket } from '../shared/socket-types.js';
import { EVENTS } from '../shared/events.js';
import { getSessionDjState } from '../services/dj-state-store.js';
import { DJState } from '../dj-engine/types.js';
import { checkRateLimit, recordUserEvent } from '../services/rate-limiter.js';
import { recordParticipationAction } from '../services/session-manager.js';
import { recordActivity } from '../services/activity-tracker.js';
import { appendEvent } from '../services/event-stream.js';

const VALID_SOUNDS = [
  'sbAirHorn',
  'sbCrowdCheer',
  'sbDrumRoll',
  'sbRecordScratch',
  'sbRimshot',
  'sbWolfWhistle',
] as const;

export function registerSoundboardHandlers(
  socket: AuthenticatedSocket,
  io: SocketIOServer
): void {
  socket.on(EVENTS.SOUND_PLAY, async (data: { soundId: string }) => {
    const { sessionId, userId } = socket.data;
    if (!sessionId || !userId) return;
    if (typeof data?.soundId !== 'string') return;
    if (!VALID_SOUNDS.includes(data.soundId as typeof VALID_SOUNDS[number])) return;

    // State guard: soundboard only during song state (AC #4)
    const context = getSessionDjState(sessionId);
    if (!context || context.state !== DJState.song) return;

    recordActivity(sessionId);

    // Rate limiting — reuse same infrastructure as reactions (AC #2)
    const now = Date.now();
    const timestamps = recordUserEvent(userId, now);
    const { rewardMultiplier } = checkRateLimit(timestamps, now);

    // Broadcast to all OTHER participants (sender plays locally for 50ms target)
    socket.to(sessionId).emit(EVENTS.SOUND_PLAY, {
      userId,
      soundId: data.soundId,
      rewardMultiplier,
    });

    // Participation scoring (fire-and-forget) — already mapped as active tier (AC #3)
    recordParticipationAction(sessionId, userId, 'sound:play', rewardMultiplier).catch(() => {});

    // Log to event stream
    appendEvent(sessionId, {
      type: 'sound:play',
      ts: now,
      userId,
      data: { soundId: data.soundId },
    });
  });
}
