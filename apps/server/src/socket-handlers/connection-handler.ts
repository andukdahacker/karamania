import type { Server as SocketIOServer } from 'socket.io';
import type { FastifyBaseLogger } from 'fastify';
import { createAuthMiddleware } from './auth-middleware.js';
import { registerPartyHandlers } from './party-handlers.js';
import { handleParticipantJoin } from '../services/session-manager.js';
import { EVENTS } from '../shared/events.js';
import type { AuthenticatedSocket } from '../shared/socket-types.js';

export function setupSocketHandlers(io: SocketIOServer, logger: FastifyBaseLogger): void {
  io.use(createAuthMiddleware(logger));

  io.on('connection', async (socket) => {
    const s = socket as AuthenticatedSocket;
    logger.info({ userId: s.data.userId, sessionId: s.data.sessionId }, 'Socket connected');

    registerPartyHandlers(s);

    try {
      const joinResult = await handleParticipantJoin({
        sessionId: s.data.sessionId,
        userId: s.data.userId,
        role: s.data.role,
        displayName: s.data.displayName,
      });

      // Broadcast to ALL other sockets in the room
      s.to(s.data.sessionId).emit(EVENTS.PARTY_JOINED, {
        userId: s.data.userId,
        displayName: s.data.displayName,
        participantCount: joinResult.participantCount,
      });

      // Send full participant list to the NEWLY connected socket
      s.emit(EVENTS.PARTY_PARTICIPANTS, {
        participants: joinResult.participants,
        participantCount: joinResult.participantCount,
        vibe: joinResult.vibe,
        status: joinResult.status,
      });
    } catch (error) {
      logger.error({ error, userId: s.data.userId, sessionId: s.data.sessionId }, 'Failed to handle participant join');
    }

    socket.on('disconnect', (reason: string) => {
      logger.info({ userId: s.data.userId, sessionId: s.data.sessionId, reason }, 'Socket disconnected');
    });
  });
}
