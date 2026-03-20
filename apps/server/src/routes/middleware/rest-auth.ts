import type { FastifyRequest, FastifyReply } from 'fastify';
import type { UsersTable } from '../../db/types.js';
import { verifyFirebaseToken } from '../../integrations/firebase-admin.js';
import { findByFirebaseUid } from '../../persistence/user-repository.js';

// TypeScript module augmentation — in the SAME file as the middleware
declare module 'fastify' {
  interface FastifyRequest {
    requestContext?: {
      userId: string;
      firebaseUid: string;
      user: UsersTable;
    };
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({
      error: { code: 'AUTH_REQUIRED', message: 'Authentication required' },
    });
  }

  const token = authHeader.slice(7);
  try {
    const decoded = await verifyFirebaseToken(token);
    const user = await findByFirebaseUid(decoded.uid);
    if (!user) {
      return reply.status(401).send({
        error: { code: 'USER_NOT_FOUND', message: 'User account not found' },
      });
    }
    // Attach user to request for downstream handlers
    request.requestContext = { userId: user.id, firebaseUid: decoded.uid, user };
  } catch {
    return reply.status(401).send({
      error: { code: 'AUTH_INVALID', message: 'Invalid or expired token' },
    });
  }
}
