import type { FastifyInstance } from 'fastify';
import { sql } from 'kysely';
import { db } from '../db/connection.js';

export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/health', async (_request, reply) => {
    try {
      await sql`SELECT 1`.execute(db);
      return reply.send({
        data: {
          status: 'ok',
          database: 'connected',
          timestamp: new Date().toISOString(),
        },
      });
    } catch {
      return reply.status(503).send({
        error: {
          code: 'DATABASE_UNREACHABLE',
          message: 'Unable to connect to database',
        },
      });
    }
  });
}
