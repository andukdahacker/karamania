import type { Server as SocketIOServer } from 'socket.io';
import type { AuthenticatedSocket } from '../shared/socket-types.js';
import { EVENTS } from '../shared/events.js';
import * as sessionRepo from '../persistence/session-repository.js';
import { getSessionDjState } from '../services/dj-state-store.js';
import { processDjTransition, endSession, kickPlayer, pauseSession, resumeSession } from '../services/session-manager.js';
import { recordActivity } from '../services/activity-tracker.js';
import { appendEvent } from '../services/event-stream.js';
import { getActiveConnections } from '../services/connection-tracker.js';
import { isValidOverrideTarget } from '../dj-engine/states.js';
import type { DJState } from '../dj-engine/types.js';

function isValidationError(error: unknown): boolean {
  return error instanceof Error && error.message === 'Not host';
}

export async function validateHost(socket: AuthenticatedSocket): Promise<void> {
  const session = await sessionRepo.findById(socket.data.sessionId);
  if (!session || session.host_user_id !== socket.data.userId) {
    socket.emit('error', { code: 'NOT_HOST', message: 'Only the host can perform this action' });
    throw new Error('Not host');
  }
}

export function registerHostHandlers(socket: AuthenticatedSocket, io: SocketIOServer): void {
  // host:pause — pause the session
  socket.on(EVENTS.HOST_PAUSE, async () => {
    try {
      await validateHost(socket);
      recordActivity(socket.data.sessionId);
      await pauseSession(socket.data.sessionId, socket.data.userId);
    } catch (error) {
      if (!isValidationError(error)) {
        const appErr = error as { code?: string; message?: string };
        if (appErr.code) {
          socket.emit('error', { code: appErr.code, message: appErr.message });
        } else {
          console.error('[host-handlers] host:pause error:', error);
        }
      }
    }
  });

  // host:resume — resume the session
  socket.on(EVENTS.HOST_RESUME, async () => {
    try {
      await validateHost(socket);
      recordActivity(socket.data.sessionId);
      await resumeSession(socket.data.sessionId, socket.data.userId);
    } catch (error) {
      if (!isValidationError(error)) {
        const appErr = error as { code?: string; message?: string };
        if (appErr.code) {
          socket.emit('error', { code: appErr.code, message: appErr.message });
        } else {
          console.error('[host-handlers] host:resume error:', error);
        }
      }
    }
  });

  // host:skip — skip current activity
  socket.on(EVENTS.HOST_SKIP, async () => {
    try {
      await validateHost(socket);
      recordActivity(socket.data.sessionId);
      const context = getSessionDjState(socket.data.sessionId);
      if (!context) return;
      if (context.isPaused) {
        socket.emit('error', { code: 'SESSION_PAUSED', message: 'Cannot skip while paused — resume first' });
        return;
      }
      appendEvent(socket.data.sessionId, { type: 'host:skip', ts: Date.now(), userId: socket.data.userId, data: { fromState: context.state } });
      await processDjTransition(socket.data.sessionId, context, { type: 'HOST_SKIP' }, socket.data.userId);
    } catch (error) {
      if (!isValidationError(error)) {
        console.error('[host-handlers] host:skip error:', error);
      }
    }
  });

  // host:override — override next activity
  socket.on(EVENTS.HOST_OVERRIDE, async (data: { targetState: string }) => {
    try {
      await validateHost(socket);
      recordActivity(socket.data.sessionId);
      const targetState = data.targetState as DJState;
      if (!isValidOverrideTarget(targetState)) {
        socket.emit('error', { code: 'INVALID_OVERRIDE_TARGET', message: `Cannot override to '${data.targetState}'` });
        return;
      }
      const context = getSessionDjState(socket.data.sessionId);
      if (!context) return;
      if (context.isPaused) {
        socket.emit('error', { code: 'SESSION_PAUSED', message: 'Cannot override while paused — resume first' });
        return;
      }
      appendEvent(socket.data.sessionId, { type: 'host:override', ts: Date.now(), userId: socket.data.userId, data: { fromState: context.state, toState: targetState } });
      await processDjTransition(socket.data.sessionId, context, { type: 'HOST_OVERRIDE', targetState }, socket.data.userId);
    } catch (error) {
      if (!isValidationError(error)) {
        console.error('[host-handlers] host:override error:', error);
      }
    }
  });

  // host:songOver — signal song has ended
  socket.on(EVENTS.HOST_SONG_OVER, async () => {
    try {
      await validateHost(socket);
      recordActivity(socket.data.sessionId);
      const context = getSessionDjState(socket.data.sessionId);
      if (!context) return;
      if (context.state !== 'song') {
        socket.emit('error', { code: 'INVALID_STATE', message: 'Song over is only valid during song state' });
        return;
      }
      appendEvent(socket.data.sessionId, { type: 'host:songOver', ts: Date.now(), userId: socket.data.userId, data: { fromState: context.state } });
      await processDjTransition(socket.data.sessionId, context, { type: 'SONG_ENDED' }, socket.data.userId);
    } catch (error) {
      if (!isValidationError(error)) {
        console.error('[host-handlers] host:songOver error:', error);
      }
    }
  });

  // host:endParty — end the party
  socket.on(EVENTS.HOST_END_PARTY, async () => {
    try {
      await validateHost(socket);
      recordActivity(socket.data.sessionId);
      await endSession(socket.data.sessionId, socket.data.userId);
      io.to(socket.data.sessionId).emit(EVENTS.PARTY_ENDED, { reason: 'host_ended' });
    } catch (error) {
      if (!isValidationError(error)) {
        console.error('[host-handlers] host:endParty error:', error);
      }
    }
  });

  // host:kickPlayer — remove a participant
  socket.on(EVENTS.HOST_KICK_PLAYER, async (data: { userId: string }) => {
    try {
      await validateHost(socket);
      recordActivity(socket.data.sessionId);
      await kickPlayer(socket.data.sessionId, socket.data.userId, data.userId);

      // Find kicked user's socket and disconnect
      const connections = getActiveConnections(socket.data.sessionId);
      const kickedConn = connections.find(c => c.userId === data.userId);
      if (kickedConn) {
        io.to(kickedConn.socketId).emit(EVENTS.PARTY_PARTICIPANT_REMOVED, { userId: data.userId });
        io.sockets.sockets.get(kickedConn.socketId)?.disconnect(true);
      }

      // Broadcast updated participant count to room
      socket.to(socket.data.sessionId).emit(EVENTS.PARTY_PARTICIPANT_REMOVED, {
        userId: data.userId,
        reason: 'kicked',
      });
    } catch (error) {
      if (!isValidationError(error)) {
        console.error('[host-handlers] host:kickPlayer error:', error);
      }
    }
  });
}
