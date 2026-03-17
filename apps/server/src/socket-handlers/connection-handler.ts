import type { Server as SocketIOServer } from 'socket.io';
import type { FastifyBaseLogger } from 'fastify';
import { createAuthMiddleware } from './auth-middleware.js';
import { registerPartyHandlers } from './party-handlers.js';
import { registerHostHandlers } from './host-handlers.js';
import { registerReactionHandlers } from './reaction-handlers.js';
import { registerSoundboardHandlers } from './soundboard-handlers.js';
import { registerCardHandlers } from './card-handlers.js';
import { registerLightstickHandlers } from './lightstick-handlers.js';
import { registerSongHandlers } from './song-handlers.js';
import { registerTvHandlers } from './tv-handlers.js';
import { registerCaptureHandlers } from './capture-handlers.js';
import { handleParticipantJoin, transferHost, isRecoveryFailed, clearRecoveryFailed } from '../services/session-manager.js';
import { getSessionDjState } from '../services/dj-state-store.js';
import {
  trackConnection,
  trackDisconnection,
  getActiveConnections,
  getLongestConnected,
  removeDisconnectedEntry,
  updateHostStatus,
} from '../services/connection-tracker.js';
import { EVENTS } from '../shared/events.js';
import type { AuthenticatedSocket } from '../shared/socket-types.js';
import { initDjBroadcaster, buildDjStatePayload } from '../services/dj-broadcaster.js';
import { recordActivity } from '../services/activity-tracker.js';
import { appendEvent } from '../services/event-stream.js';

// Module-level timer maps for cleanup
const hostTransferTimers = new Map<string, NodeJS.Timeout>();
const cleanupTimers = new Map<string, Map<string, NodeJS.Timeout>>();

export function setupSocketHandlers(io: SocketIOServer, logger: FastifyBaseLogger): void {
  initDjBroadcaster(io);
  io.use(createAuthMiddleware(logger));

  io.on('connection', async (socket) => {
    const s = socket as AuthenticatedSocket;
    const { sessionId, userId, displayName, role } = s.data;
    logger.info({ userId, sessionId }, 'Socket connected');

    // Task 7: Check if session failed recovery — notify and disconnect
    if (isRecoveryFailed(sessionId)) {
      s.emit(EVENTS.PARTY_ENDED, { reason: 'session_recovery_failed' });
      clearRecoveryFailed(sessionId);
      s.disconnect(true);
      return;
    }

    recordActivity(sessionId);
    registerPartyHandlers(s);
    registerHostHandlers(s, io);
    registerReactionHandlers(s, io);
    registerSoundboardHandlers(s, io);
    registerCardHandlers(s, io);
    registerLightstickHandlers(s, io);
    registerSongHandlers(s, io);
    registerTvHandlers(s, io);
    registerCaptureHandlers(s, io);

    try {
      const joinResult = await handleParticipantJoin({
        sessionId,
        userId,
        role,
        displayName,
      });

      // Determine if this user is the host
      const isHost = userId === joinResult.hostUserId;

      // Track connection and detect reconnection
      const { isReconnection } = trackConnection(sessionId, {
        socketId: s.id,
        userId,
        displayName,
        connectedAt: Date.now(),
        isHost,
      });

      if (isReconnection) {
        // Cancel any pending host transfer timer
        if (isHost && hostTransferTimers.has(sessionId)) {
          clearTimeout(hostTransferTimers.get(sessionId)!);
          hostTransferTimers.delete(sessionId);
          logger.info({ sessionId, userId }, 'Host reconnected, transfer cancelled');
        }

        // Cancel any pending cleanup timer
        const sessionCleanups = cleanupTimers.get(sessionId);
        if (sessionCleanups?.has(userId)) {
          clearTimeout(sessionCleanups.get(userId)!);
          sessionCleanups.delete(userId);
        }

        // Broadcast reconnection to others
        s.to(sessionId).emit(EVENTS.PARTY_PARTICIPANT_RECONNECTED, {
          userId,
          displayName,
        });
        logger.info({ userId, sessionId }, 'Participant reconnected');
      } else {
        // Normal new join — broadcast to others (existing behavior)
        s.to(sessionId).emit(EVENTS.PARTY_JOINED, {
          userId,
          displayName,
          participantCount: joinResult.participantCount,
        });
      }

      // Enrich participant list with online status from connection tracker
      const activeUsers = getActiveConnections(sessionId);
      const activeUserIds = new Set(activeUsers.map(c => c.userId));
      const enrichedParticipants = joinResult.participants.map(p => ({
        ...p,
        isOnline: activeUserIds.has(p.userId),
      }));

      // Send full state sync to the connecting/reconnecting client
      s.emit(EVENTS.PARTY_PARTICIPANTS, {
        participants: enrichedParticipants,
        participantCount: joinResult.participantCount,
        vibe: joinResult.vibe,
        status: joinResult.status,
        hostUserId: joinResult.hostUserId,
      });

      // Task 6: Send recovered DJ state if session has active DJ context
      const djState = getSessionDjState(sessionId);
      if (djState) {
        s.emit(EVENTS.DJ_STATE_CHANGED, buildDjStatePayload(djState));
      }
    } catch (error) {
      logger.error({ userId, sessionId, error }, 'Failed to handle participant join');
    }

    // Enhanced disconnect handler
    socket.on('disconnect', (reason: string) => {
      logger.info({ userId, sessionId, reason }, 'Socket disconnected');

      const entry = trackDisconnection(sessionId, userId);
      if (!entry) return;

      // Broadcast disconnection to remaining participants (use io.to, not s.to — socket already left room)
      io.to(sessionId).emit(EVENTS.PARTY_PARTICIPANT_DISCONNECTED, {
        userId,
        displayName,
      });

      // If host disconnected, start 60s transfer timer (AC #4)
      if (entry.isHost) {
        logger.info({ sessionId, userId }, 'Host disconnected, starting 60s transfer timer');
        const timer = setTimeout(async () => {
          hostTransferTimers.delete(sessionId);
          try {
            const candidate = getLongestConnected(sessionId, userId);
            if (!candidate) {
              logger.warn({ sessionId }, 'No active participants for host transfer');
              return;
            }

            const result = await transferHost(sessionId, candidate.userId);
            if (result) {
              updateHostStatus(sessionId, userId, candidate.userId);
              io.to(sessionId).emit(EVENTS.PARTY_HOST_TRANSFERRED, {
                previousHostId: userId,
                newHostId: result.newHostId,
                newHostName: result.newHostName,
              });
              logger.info(
                { sessionId, previousHost: userId, newHost: result.newHostId },
                'Host transferred',
              );
            }
          } catch (err) {
            logger.error({ sessionId, error: err }, 'Host transfer failed');
          }
        }, 60_000);
        hostTransferTimers.set(sessionId, timer);
      }

      // 5-minute cleanup timer — remove from disconnected tracker
      if (!cleanupTimers.has(sessionId)) {
        cleanupTimers.set(sessionId, new Map());
      }
      const disconnectedDisplayName = displayName;
      const cleanupTimer = setTimeout(() => {
        appendEvent(sessionId, {
          type: 'party:left',
          ts: Date.now(),
          userId,
          data: { displayName: disconnectedDisplayName },
        });
        removeDisconnectedEntry(sessionId, userId);
        cleanupTimers.get(sessionId)?.delete(userId);
        if (cleanupTimers.get(sessionId)?.size === 0) {
          cleanupTimers.delete(sessionId);
        }
        logger.info({ userId, sessionId }, 'Disconnected participant cleanup after 5min');
      }, 5 * 60 * 1000);
      cleanupTimers.get(sessionId)!.set(userId, cleanupTimer);
    });
  });
}

// Exported for testing
export { hostTransferTimers, cleanupTimers };
