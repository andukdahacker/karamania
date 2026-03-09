import Fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import { Server as SocketIOServer } from 'socket.io';
import {
  serializerCompiler,
  validatorCompiler,
  jsonSchemaTransform,
  jsonSchemaTransformObject,
} from 'fastify-type-provider-zod';
import { config } from './config.js';
import { db } from './db/connection.js';
import { initializeFirebaseAdmin } from './integrations/firebase-admin.js';
import { authRoutes } from './routes/auth.js';
import { healthRoutes } from './routes/health.js';
import { sessionRoutes } from './routes/sessions.js';
import { webLandingRoutes } from './routes/web-landing.js';
import { errorHandler } from './shared/errors.js';
import { setupSocketHandlers } from './socket-handlers/connection-handler.js';

const fastify = Fastify({
  logger: {
    level: config.NODE_ENV === 'production' ? 'info' : 'debug',
  },
});

fastify.setValidatorCompiler(validatorCompiler);
fastify.setSerializerCompiler(serializerCompiler);

await fastify.register(cors);
// Import schema files so they register in z.globalRegistry before swagger init
await import('./shared/schemas/common-schemas.js');
await import('./shared/schemas/auth-schemas.js');
await import('./shared/schemas/session-schemas.js');

await fastify.register(swagger, {
  openapi: {
    info: {
      title: 'Karamania API',
      version: '1.0.0',
    },
  },
  transform: jsonSchemaTransform,
  transformObject: jsonSchemaTransformObject,
});

fastify.setErrorHandler(errorHandler);

await fastify.register(healthRoutes);
await fastify.register(authRoutes);
await fastify.register(sessionRoutes);
await fastify.register(webLandingRoutes);

const io = new SocketIOServer(fastify.server, {
  cors: {
    origin: config.NODE_ENV === 'production'
      ? [] // TODO: Configure allowed origins for production deployment
      : '*',
  },
  pingInterval: 10000,  // 10s between pings (default 25s)
  pingTimeout: 5000,    // 5s to respond (default 20s)
  // Total disconnect detection: ~15s (vs default ~45s)
});

const shutdown = async () => {
  io.close();
  await fastify.close();
  await db.destroy();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Serve OpenAPI spec JSON (available after ready)
fastify.get('/openapi.json', { schema: { hide: true } }, async (_request, reply) => {
  return reply.send(fastify.swagger());
});

try {
  initializeFirebaseAdmin();
  setupSocketHandlers(io, fastify.log);
  await fastify.listen({ port: config.PORT, host: '0.0.0.0' });
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}

export { fastify, io };
