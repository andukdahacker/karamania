import type { FastifyInstance } from 'fastify';
import { sql } from 'kysely';
import { z } from 'zod/v4';
import { db } from '../db/connection.js';
import { dataResponseSchema, errorResponseSchema } from '../shared/schemas/common-schemas.js';

const healthDataSchema = z.object({
  status: z.string(),
  database: z.string(),
  timestamp: z.string(),
});
z.globalRegistry.add(healthDataSchema, { id: 'HealthData' });

const healthResponseSchema = dataResponseSchema(healthDataSchema);
z.globalRegistry.add(healthResponseSchema, { id: 'HealthResponse' });

export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/health', {
    schema: {
      response: {
        200: healthResponseSchema,
        503: errorResponseSchema,
      },
    },
  }, async (_request, reply) => {
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
