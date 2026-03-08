import type { Server as SocketIOServer } from 'socket.io';
import type { FastifyBaseLogger } from 'fastify';
import { createAuthMiddleware } from './auth-middleware.js';
import { registerPartyHandlers } from './party-handlers.js';
import type { AuthenticatedSocket } from '../shared/socket-types.js';

export function setupSocketHandlers(io: SocketIOServer, logger: FastifyBaseLogger): void {
  io.use(createAuthMiddleware(logger));

  io.on('connection', (socket) => {
    const s = socket as AuthenticatedSocket;
    logger.info({ userId: s.data.userId, sessionId: s.data.sessionId }, 'Socket connected');

    registerPartyHandlers(s);

    socket.on('disconnect', (reason: string) => {
      logger.info({ userId: s.data.userId, sessionId: s.data.sessionId, reason }, 'Socket disconnected');
    });
  });
}
