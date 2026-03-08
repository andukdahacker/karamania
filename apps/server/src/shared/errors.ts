import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

export interface AppError {
  code: string;
  message: string;
  statusCode?: number;
}

export function createAppError(
  code: string,
  message: string,
  statusCode = 500
): AppError {
  return { code, message, statusCode };
}

export function notFoundError(message = 'Resource not found'): AppError {
  return createAppError('NOT_FOUND', message, 404);
}

export function badRequestError(message = 'Bad request'): AppError {
  return createAppError('BAD_REQUEST', message, 400);
}

export function unauthorizedError(message = 'Unauthorized'): AppError {
  return createAppError('UNAUTHORIZED', message, 401);
}

export function internalError(message = 'Internal server error'): AppError {
  return createAppError('INTERNAL_ERROR', message, 500);
}

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  const statusCode = error.statusCode ?? 500;
  const code = (error as unknown as AppError).code ?? 'INTERNAL_ERROR';
  const message = error.message || 'Internal server error';

  request.log.error({ err: error, statusCode, code }, 'Request error');

  reply.status(statusCode).send({
    error: { code, message },
  });
}
