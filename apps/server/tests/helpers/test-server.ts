// Test server factory — creates a real Fastify + Socket.io instance on a random port
// Used by integration and E2E tests to validate real protocol behavior

import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { Server as SocketIOServer } from 'socket.io';
import {
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';
import { setupSocketHandlers } from '../../src/socket-handlers/connection-handler.js';
import { authRoutes } from '../../src/routes/auth.js';
import { healthRoutes } from '../../src/routes/health.js';
import { sessionRoutes } from '../../src/routes/sessions.js';
import { errorHandler } from '../../src/shared/errors.js';
import { clearAllSessions as clearDjStateStore } from '../../src/services/dj-state-store.js';
import { clearAllTimers } from '../../src/services/timer-scheduler.js';
import { clearRateLimitStore } from '../../src/services/rate-limiter.js';
import { clearStreakStore } from '../../src/services/streak-tracker.js';
import { clearAllStreams } from '../../src/services/event-stream.js';
import { clearAllSessions as clearPeakDetector } from '../../src/services/peak-detector.js';
import { clearAll as clearActivityTracker } from '../../src/services/activity-tracker.js';
import { resetAllRounds as resetQuickPick } from '../../src/services/quick-pick.js';
import { resetAllRounds as resetSpinWheel } from '../../src/services/spin-wheel.js';
import { resetAllRounds as resetActivityVoter } from '../../src/services/activity-voter.js';
import { resetAll as resetQuickVoteDealer } from '../../src/services/quick-vote-dealer.js';
import { resetAllPools } from '../../src/services/song-pool.js';
import { resetDetectionCache } from '../../src/services/song-detection.js';

export interface TestServer {
  fastify: FastifyInstance;
  io: SocketIOServer;
  url: string;
  port: number;
  close: () => Promise<void>;
}

/**
 * Resets all in-memory service state. Call between tests to prevent cross-contamination.
 */
export function resetAllServiceState(): void {
  clearDjStateStore();
  clearAllTimers();
  clearRateLimitStore();
  clearStreakStore();
  clearAllStreams();
  clearPeakDetector();
  clearActivityTracker();
  resetQuickPick();
  resetSpinWheel();
  resetActivityVoter();
  resetQuickVoteDealer();
  resetAllPools();
  resetDetectionCache();
}

/**
 * Creates a real Fastify + Socket.io server bound to a random port.
 * Registers auth, session, and health routes + full socket handler stack.
 * Call close() in afterAll/afterEach to clean up.
 */
export async function createTestServer(): Promise<TestServer> {
  const fastify = Fastify({ logger: false });

  fastify.setValidatorCompiler(validatorCompiler);
  fastify.setSerializerCompiler(serializerCompiler);

  await fastify.register(cors);
  fastify.setErrorHandler(errorHandler);

  // Register only routes needed for integration tests
  await fastify.register(healthRoutes);
  await fastify.register(authRoutes);
  await fastify.register(sessionRoutes);

  const io = new SocketIOServer(fastify.server, {
    cors: { origin: '*' },
    pingInterval: 10000,
    pingTimeout: 5000,
  });

  setupSocketHandlers(io, fastify.log);

  // Bind to random available port
  await fastify.listen({ port: 0, host: '127.0.0.1' });

  const address = fastify.server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const url = `http://127.0.0.1:${port}`;

  return {
    fastify,
    io,
    url,
    port,
    close: async () => {
      // Reset all in-memory service state
      resetAllServiceState();

      // Disconnect all sockets, then close HTTP server
      io.close();
      await fastify.close();
    },
  };
}
