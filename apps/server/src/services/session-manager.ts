import { generateUniquePartyCode } from '../services/party-code.js';
import * as sessionRepo from '../persistence/session-repository.js';
import { DEFAULT_VIBE } from '../shared/constants.js';
import { createAppError } from '../shared/errors.js';
import { createDJContext, processTransition } from '../dj-engine/machine.js';
import { deserializeDJContext, serializeDJContext } from '../dj-engine/serializer.js';
import { calculateRemainingMs } from '../dj-engine/timers.js';
import type { DJContext, DJTransition, DJSideEffect } from '../dj-engine/types.js';
import { getSessionDjState, setSessionDjState, removeSessionDjState } from '../services/dj-state-store.js';
import { scheduleSessionTimer, cancelSessionTimer, pauseSessionTimer, resumeSessionTimer } from '../services/timer-scheduler.js';
import { broadcastDjState, broadcastDjPause, broadcastDjResume } from '../services/dj-broadcaster.js';
import { removeSession } from '../services/connection-tracker.js';
import { removeSession as removeActivitySession } from '../services/activity-tracker.js';
import { DJState } from '../dj-engine/types.js';
import { appendEvent, flushEventStream } from '../services/event-stream.js';
import { calculateScoreIncrement, ACTION_TIER_MAP } from '../services/participation-scoring.js';

// In-memory score cache — avoids DB read race condition with fire-and-forget writes
const scoreCache = new Map<string, number>();

function getScoreCacheKey(sessionId: string, userId: string): string {
  return `${sessionId}:${userId}`;
}

export function clearScoreCache(sessionId?: string): void {
  if (sessionId) {
    for (const key of scoreCache.keys()) {
      if (key.startsWith(`${sessionId}:`)) {
        scoreCache.delete(key);
      }
    }
  } else {
    scoreCache.clear();
  }
}

export async function recordParticipationAction(
  sessionId: string,
  userId: string,
  action: string,
  rewardMultiplier: number = 1.0
): Promise<{ points: number; totalScore: number } | null> {
  const increment = calculateScoreIncrement(action, rewardMultiplier);
  if (increment === 0) return null;

  // Fire-and-forget DB update (same pattern as DJ state persistence)
  sessionRepo.incrementParticipationScore(sessionId, userId, increment).catch((err) => {
    console.error(`[session-manager] Failed to persist score for ${userId}:`, err);
  });

  // Track score in memory to avoid read-after-write race condition
  const cacheKey = getScoreCacheKey(sessionId, userId);
  const cachedScore = scoreCache.get(cacheKey) ?? 0;
  const totalScore = cachedScore + increment;
  scoreCache.set(cacheKey, totalScore);

  // Log to event stream
  const tier = ACTION_TIER_MAP[action];
  if (tier) {
    appendEvent(sessionId, {
      type: 'participation:scored',
      ts: Date.now(),
      userId,
      data: {
        action,
        tier,
        points: increment,
        rewardMultiplier,
        totalScore,
      },
    });
  }

  return { points: increment, totalScore };
}

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

      // If paused, skip all timer reconciliation — store as-is
      if (context.isPaused) {
        setSessionDjState(session.id, context);
        console.log(`[session-manager] Session ${session.id} recovered in paused state`);
        appendEvent(session.id, {
          type: 'system:recovery',
          ts: Date.now(),
          data: { recoveredState: context.state, songCount: context.songCount },
        });
        recovered.push(session.id);
        continue;
      }

      // Reconcile timers
      const remaining = calculateRemainingMs(context, now);
      let recoveredContext = context;

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
        recoveredContext = newContext;

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

      appendEvent(session.id, {
        type: 'system:recovery',
        ts: Date.now(),
        data: { recoveredState: recoveredContext.state, songCount: recoveredContext.songCount },
      });

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
  userId?: string,
): Promise<{ newContext: DJContext; sideEffects: DJSideEffect[] }> {
  const { newContext, sideEffects } = processTransition(context, event, Date.now());

  setSessionDjState(sessionId, newContext);

  appendEvent(sessionId, {
    type: 'dj:stateChanged',
    ts: Date.now(),
    userId,
    data: { from: context.state, to: newContext.state, trigger: event.type },
  });

  if (newContext.state === DJState.ceremony) {
    appendEvent(sessionId, {
      type: 'ceremony:typeSelected',
      ts: Date.now(),
      data: {
        ceremonyType: (newContext.metadata.ceremonyType === 'full' || newContext.metadata.ceremonyType === 'quick')
          ? newContext.metadata.ceremonyType
          : 'quick',
        songCount: newContext.songCount,
        participantCount: newContext.participantCount,
      },
    });
  }

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

  appendEvent(params.sessionId, {
    type: 'party:started',
    ts: Date.now(),
    userId: params.hostUserId,
    data: { participantCount: participants.length },
  });

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

  appendEvent(sessionId, {
    type: 'party:hostTransferred',
    ts: Date.now(),
    data: { fromUserId: session.host_user_id, toUserId: newHostUserId },
  });

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

  // 2. Log join event
  appendEvent(params.sessionId, {
    type: 'party:joined',
    ts: Date.now(),
    userId: params.userId,
    data: { displayName: params.displayName, role: params.role },
  });

  // 3. Score the join action (passive tier, 1pt) — only for authenticated users
  if (params.role !== 'guest') {
    recordParticipationAction(params.sessionId, params.userId, 'party:joined', 1.0).catch(() => {});
  }

  // 4. Get current participants + session metadata
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

  // Clear pause state if paused — ending party while paused is valid
  const contextForTransition: DJContext = context.isPaused
    ? { ...context, isPaused: false, pausedAt: null, pausedFromState: null, timerRemainingMs: null }
    : context;

  // Transition to finale — automatically broadcasts, persists, cancels timers
  // Note: processDjTransition appends a dj:stateChanged event for END_PARTY internally,
  // followed by the party:ended event below. This ordering is intentional.
  const { newContext } = await processDjTransition(sessionId, contextForTransition, { type: 'END_PARTY' });

  // Step A: Append party:ended event (DJ context still available)
  const endTs = Date.now();
  appendEvent(sessionId, {
    type: 'party:ended',
    ts: endTs,
    userId: hostUserId,
    data: {
      songCount: context.songCount ?? 0,
      duration: context.sessionStartedAt ? endTs - context.sessionStartedAt : 0,
    },
  });

  // Step B: Flush and write event stream to DB (BEFORE cleanup)
  const events = flushEventStream(sessionId);
  if (events.length > 0) {
    sessionRepo.writeEventStream(sessionId, events).catch((err) => {
      console.error('[session-manager] Failed to write event stream:', err);
    });
  }

  // Step C: Update DB status + ended_at
  await sessionRepo.updateStatus(sessionId, 'ended');

  // Clean up in-memory state
  removeSessionDjState(sessionId);
  cancelSessionTimer(sessionId);
  removeSession(sessionId);
  removeActivitySession(sessionId);
  clearScoreCache(sessionId);

  return newContext;
}

export async function pauseSession(sessionId: string, userId?: string): Promise<DJContext> {
  const context = getSessionDjState(sessionId);
  if (!context) {
    throw createAppError('SESSION_NOT_FOUND', 'No active DJ state for session', 404);
  }

  if (context.state === DJState.lobby || context.state === DJState.finale) {
    throw createAppError('INVALID_STATE', 'Cannot pause in lobby or finale', 400);
  }

  if (context.isPaused) {
    throw createAppError('ALREADY_PAUSED', 'Session is already paused', 400);
  }

  const remainingMs = pauseSessionTimer(sessionId);

  const updatedContext: DJContext = {
    ...context,
    isPaused: true,
    pausedAt: Date.now(),
    pausedFromState: context.state,
    timerRemainingMs: remainingMs,
  };

  setSessionDjState(sessionId, updatedContext);
  void persistDjState(sessionId, serializeDJContext(updatedContext));
  broadcastDjPause(sessionId, updatedContext);

  appendEvent(sessionId, {
    type: 'dj:pause',
    ts: Date.now(),
    userId,
    data: { fromState: context.state },
  });

  return updatedContext;
}

export async function resumeSession(sessionId: string, userId?: string): Promise<DJContext> {
  const context = getSessionDjState(sessionId);
  if (!context) {
    throw createAppError('SESSION_NOT_FOUND', 'No active DJ state for session', 404);
  }

  if (!context.isPaused) {
    throw createAppError('NOT_PAUSED', 'Session is not paused', 400);
  }

  if (context.timerRemainingMs !== null && context.timerRemainingMs > 0) {
    resumeSessionTimer(sessionId, context.timerRemainingMs, () => {
      const ctx = getSessionDjState(sessionId);
      if (ctx) {
        void processDjTransition(sessionId, ctx, { type: 'TIMEOUT' });
      }
    });
  }

  const now = Date.now();
  const updatedContext: DJContext = {
    ...context,
    isPaused: false,
    pausedAt: null,
    pausedFromState: null,
    timerStartedAt: context.timerRemainingMs !== null ? now : context.timerStartedAt,
    timerDurationMs: context.timerRemainingMs !== null ? context.timerRemainingMs : context.timerDurationMs,
    timerRemainingMs: null,
  };

  setSessionDjState(sessionId, updatedContext);
  void persistDjState(sessionId, serializeDJContext(updatedContext));
  broadcastDjResume(sessionId, updatedContext);

  appendEvent(sessionId, {
    type: 'dj:resume',
    ts: Date.now(),
    userId,
    data: { toState: updatedContext.state },
  });

  return updatedContext;
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

  appendEvent(sessionId, {
    type: 'party:kicked',
    ts: Date.now(),
    userId: hostUserId,
    data: { kickedUserId: targetUserId },
  });

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
