import { generateUniquePartyCode } from '../services/party-code.js';
import * as sessionRepo from '../persistence/session-repository.js';
import { DEFAULT_VIBE } from '../shared/constants.js';
import { createAppError } from '../shared/errors.js';
import { createDJContext, processTransition } from '../dj-engine/machine.js';
import { deserializeDJContext, serializeDJContext } from '../dj-engine/serializer.js';
import { calculateRemainingMs } from '../dj-engine/timers.js';
import type { DJContext, DJTransition, DJSideEffect } from '../dj-engine/types.js';
import { getSessionDjState, setSessionDjState, removeSessionDjState } from '../services/dj-state-store.js';
import { scheduleSessionTimer, cancelSessionTimer } from '../services/timer-scheduler.js';
import { broadcastDjState } from '../services/dj-broadcaster.js';
import { removeSession } from '../services/connection-tracker.js';

// Set of session IDs that failed recovery — checked during client reconnection
const failedRecoverySessionIds = new Set<string>();

export function isRecoveryFailed(sessionId: string): boolean {
  return failedRecoverySessionIds.has(sessionId);
}

export function clearRecoveryFailed(sessionId: string): void {
  failedRecoverySessionIds.delete(sessionId);
}

export async function recoverActiveSessions(
  now: number = Date.now(),
): Promise<{ recovered: string[]; failed: string[] }> {
  const recovered: string[] = [];
  const failed: string[] = [];

  const activeSessions = await sessionRepo.findActiveSessions();

  for (const session of activeSessions) {
    // Skip sessions with no DJ state (lobby state — no recovery needed)
    if (session.dj_state === null || session.dj_state === undefined) {
      continue;
    }

    try {
      // Deserialize and validate DJ state
      const context = deserializeDJContext(session.dj_state);

      // Reconcile timers
      const remaining = calculateRemainingMs(context, now);

      if (remaining > 0) {
        // Timer still active — store state and reschedule with remaining duration
        setSessionDjState(session.id, context);
        scheduleSessionTimer(session.id, remaining, () => {
          void handleRecoveryTimeout(session.id);
        });
      } else if (context.timerStartedAt !== null && context.timerDurationMs !== null) {
        // Timer expired during downtime — trigger TIMEOUT to advance state
        const { newContext, sideEffects } = processTransition(context, { type: 'TIMEOUT' }, now);
        setSessionDjState(session.id, newContext);

        // Persist the new state
        const persistEffect = sideEffects.find(
          (e): e is Extract<DJSideEffect, { type: 'persist' }> => e.type === 'persist',
        );
        if (persistEffect) {
          void persistDjState(session.id, persistEffect.data.context);
        }

        // Check if new state also has a timer — schedule it fresh from now
        const scheduleEffect = sideEffects.find(
          (e): e is Extract<DJSideEffect, { type: 'scheduleTimer' }> => e.type === 'scheduleTimer',
        );
        if (scheduleEffect) {
          scheduleSessionTimer(session.id, scheduleEffect.data.durationMs, () => {
            void handleRecoveryTimeout(session.id);
          });
        }
      } else {
        // No timer to reconcile (paused or no-timeout state) — just store
        setSessionDjState(session.id, context);
      }

      recovered.push(session.id);
    } catch (error) {
      // Deserialization failed — gracefully end session
      console.error(`[session-manager] Recovery failed for session ${session.id}:`, error);
      failed.push(session.id);
      failedRecoverySessionIds.add(session.id);
      await sessionRepo.updateStatus(session.id, 'ended');
    }
  }

  return { recovered, failed };
}

async function handleRecoveryTimeout(sessionId: string): Promise<void> {
  const context = getSessionDjState(sessionId);
  if (!context) return;

  await processDjTransition(sessionId, context, { type: 'TIMEOUT' });
}

export async function createSession(params: {
  hostUserId: string;
  displayName: string;
  vibe?: string;
  venueName?: string;
}): Promise<{ sessionId: string; partyCode: string }> {
  const partyCode = await generateUniquePartyCode();
  const resolvedVibe = params.vibe ?? DEFAULT_VIBE;

  const session = await sessionRepo.create({
    hostUserId: params.hostUserId,
    partyCode,
    vibe: resolvedVibe,
    venueName: params.venueName,
  });

  await sessionRepo.addParticipant({
    sessionId: session.id,
    userId: params.hostUserId,
  });

  return { sessionId: session.id, partyCode: session.party_code };
}

export async function persistDjState(sessionId: string, serializedState: unknown): Promise<void> {
  try {
    await sessionRepo.updateDjState(sessionId, serializedState);
  } catch (error) {
    console.warn(`[session-manager] Failed to persist DJ state for session ${sessionId}:`, error);
  }
}

export async function initializeDjState(
  sessionId: string,
  participantCount: number,
): Promise<{ djContext: DJContext; sideEffects: DJSideEffect[] }> {
  const context = createDJContext(sessionId, participantCount);
  const { newContext, sideEffects } = processTransition(context, { type: 'SESSION_STARTED' }, Date.now());

  setSessionDjState(sessionId, newContext);

  const persistEffect = sideEffects.find((e): e is Extract<DJSideEffect, { type: 'persist' }> => e.type === 'persist');
  if (persistEffect) {
    void persistDjState(sessionId, persistEffect.data.context);
  }

  return { djContext: newContext, sideEffects };
}

export async function loadDjState(sessionId: string): Promise<DJContext | null> {
  const session = await sessionRepo.findById(sessionId);
  if (!session || session.dj_state === null || session.dj_state === undefined) {
    return null;
  }

  try {
    return deserializeDJContext(session.dj_state);
  } catch (error) {
    console.error(`[session-manager] Failed to deserialize DJ state for session ${sessionId}:`, error);
    return null;
  }
}

export async function processDjTransition(
  sessionId: string,
  context: DJContext,
  event: DJTransition,
): Promise<{ newContext: DJContext; sideEffects: DJSideEffect[] }> {
  const { newContext, sideEffects } = processTransition(context, event, Date.now());

  setSessionDjState(sessionId, newContext);

  for (const effect of sideEffects) {
    switch (effect.type) {
      case 'persist':
        void persistDjState(sessionId, effect.data.context);
        break;
      case 'scheduleTimer':
        scheduleSessionTimer(sessionId, effect.data.durationMs, () => {
          void handleRecoveryTimeout(sessionId);
        });
        break;
      case 'cancelTimer':
        cancelSessionTimer(sessionId);
        break;
      case 'broadcast':
        broadcastDjState(sessionId, newContext);
        break;
    }
  }

  return { newContext, sideEffects };
}

export async function startSession(params: {
  sessionId: string;
  hostUserId: string;
}): Promise<{ status: string; djContext: DJContext; sideEffects: DJSideEffect[] }> {
  const session = await sessionRepo.findById(params.sessionId);
  if (!session) throw createAppError('SESSION_NOT_FOUND', 'Session not found', 404);
  if (session.status !== 'lobby') throw createAppError('INVALID_STATUS', 'Party already started', 400);

  if (session.host_user_id !== params.hostUserId) {
    throw createAppError('NOT_HOST', 'Only the host can start the party', 403);
  }

  const participants = await sessionRepo.getParticipants(params.sessionId);
  if (participants.length < 3) {
    throw createAppError('INSUFFICIENT_PLAYERS', 'Need at least 3 participants to start', 400);
  }

  await sessionRepo.updateStatus(params.sessionId, 'active');

  const { djContext, sideEffects } = await initializeDjState(params.sessionId, participants.length);

  return { status: 'active', djContext, sideEffects };
}

export async function transferHost(
  sessionId: string,
  newHostUserId: string,
): Promise<{ newHostId: string; newHostName: string } | null> {
  // 1. Verify session exists and is active
  const session = await sessionRepo.findById(sessionId);
  if (!session || session.status === 'ended') return null;

  // 2. Get new host's display name from participants
  const participants = await sessionRepo.getParticipants(sessionId);
  const newHost = participants.find(
    p => (p.user_id ?? p.id) === newHostUserId,
  );
  if (!newHost) return null;

  // 3. Update host in DB
  await sessionRepo.updateHost(sessionId, newHostUserId);

  return {
    newHostId: newHostUserId,
    newHostName: newHost.guest_name ?? newHost.display_name ?? 'Unknown',
  };
}

export async function handleParticipantJoin(params: {
  sessionId: string;
  userId: string;
  role: 'guest' | 'authenticated';
  displayName: string;
}): Promise<{
  participants: Array<{ userId: string; displayName: string }>;
  participantCount: number;
  vibe: string;
  status: string;
  hostUserId: string;
}> {
  // 1. Add participant (idempotent — handles reconnection + host duplicate)
  await sessionRepo.addParticipantIfNotExists({
    sessionId: params.sessionId,
    userId: params.role === 'guest' ? undefined : params.userId,
    guestName: params.role === 'guest' ? params.displayName : undefined,
  });

  // 2. Get current participants + session metadata
  const [participants, session] = await Promise.all([
    sessionRepo.getParticipants(params.sessionId),
    sessionRepo.findById(params.sessionId),
  ]);

  return {
    participants: participants.map(p => ({
      userId: p.user_id ?? p.id,
      displayName: p.guest_name ?? p.display_name ?? 'Unknown',
    })),
    participantCount: participants.length,
    vibe: session?.vibe ?? 'general',
    status: session?.status ?? 'lobby',
    hostUserId: session?.host_user_id ?? '',
  };
}

export async function endSession(
  sessionId: string,
  hostUserId: string,
): Promise<DJContext> {
  // Verify host authorization
  const session = await sessionRepo.findById(sessionId);
  if (!session || session.host_user_id !== hostUserId) {
    throw createAppError('NOT_HOST', 'Only the host can end the party', 403);
  }

  const context = getSessionDjState(sessionId);
  if (!context) {
    throw createAppError('SESSION_NOT_FOUND', 'No active DJ state for session', 404);
  }

  // Transition to finale — automatically broadcasts, persists, cancels timers
  const { newContext } = await processDjTransition(sessionId, context, { type: 'END_PARTY' });

  // Update DB status + ended_at
  await sessionRepo.updateStatus(sessionId, 'ended');

  // Clean up in-memory state
  removeSessionDjState(sessionId);
  cancelSessionTimer(sessionId);
  removeSession(sessionId);

  return newContext;
}

export async function kickPlayer(
  sessionId: string,
  hostUserId: string,
  targetUserId: string,
): Promise<{ kickedUserId: string }> {
  // Verify host
  const session = await sessionRepo.findById(sessionId);
  if (!session || session.host_user_id !== hostUserId) {
    throw createAppError('NOT_HOST', 'Only the host can kick players', 403);
  }

  // Can't kick yourself
  if (targetUserId === hostUserId) {
    throw createAppError('INVALID_ACTION', 'Cannot kick yourself', 400);
  }

  // Remove from DB
  await sessionRepo.removeParticipant(sessionId, targetUserId);

  // Update DJ context participant count
  const context = getSessionDjState(sessionId);
  if (context) {
    const updatedContext: DJContext = {
      ...context,
      participantCount: Math.max(0, context.participantCount - 1),
    };
    setSessionDjState(sessionId, updatedContext);
    void persistDjState(sessionId, serializeDJContext(updatedContext));
  }

  return { kickedUserId: targetUserId };
}
