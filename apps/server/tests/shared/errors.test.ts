import { describe, it, expect, vi } from 'vitest';
import {
  createAppError,
  notFoundError,
  badRequestError,
  unauthorizedError,
  internalError,
  errorHandler,
} from '../../src/shared/errors.js';
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

describe('error factories', () => {
  it('createAppError creates error with all fields', () => {
    const error = createAppError('TEST_ERROR', 'Test message', 422);
    expect(error.code).toBe('TEST_ERROR');
    expect(error.message).toBe('Test message');
    expect(error.statusCode).toBe(422);
  });

  it('createAppError defaults statusCode to 500', () => {
    const error = createAppError('INTERNAL', 'Something broke');
    expect(error.statusCode).toBe(500);
  });

  it('notFoundError returns 404', () => {
    const error = notFoundError();
    expect(error.code).toBe('NOT_FOUND');
    expect(error.statusCode).toBe(404);
    expect(error.message).toBe('Resource not found');
  });

  it('notFoundError accepts custom message', () => {
    const error = notFoundError('Session not found');
    expect(error.message).toBe('Session not found');
  });

  it('badRequestError returns 400', () => {
    const error = badRequestError();
    expect(error.code).toBe('BAD_REQUEST');
    expect(error.statusCode).toBe(400);
  });

  it('unauthorizedError returns 401', () => {
    const error = unauthorizedError();
    expect(error.code).toBe('UNAUTHORIZED');
    expect(error.statusCode).toBe(401);
  });

  it('internalError returns 500', () => {
    const error = internalError();
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.statusCode).toBe(500);
  });
});

describe('errorHandler', () => {
  function createMockReply() {
    const reply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    } as unknown as FastifyReply;
    return reply;
  }

  function createMockRequest() {
    return {
      log: {
        error: vi.fn(),
      },
    } as unknown as FastifyRequest;
  }

  it('wraps error in { error: { code, message } } format', () => {
    const reply = createMockReply();
    const error = {
      statusCode: 400,
      code: 'BAD_REQUEST',
      message: 'Invalid input',
    } as FastifyError;

    errorHandler(error, createMockRequest(), reply);

    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith({
      error: { code: 'BAD_REQUEST', message: 'Invalid input' },
    });
  });

  it('defaults to 500 when no statusCode', () => {
    const reply = createMockReply();
    const error = {
      message: 'Unexpected error',
    } as FastifyError;

    errorHandler(error, createMockRequest(), reply);

    expect(reply.status).toHaveBeenCalledWith(500);
    expect(reply.send).toHaveBeenCalledWith({
      error: { code: 'INTERNAL_ERROR', message: 'Unexpected error' },
    });
  });

  it('logs the error via request.log.error', () => {
    const reply = createMockReply();
    const request = createMockRequest();
    const error = {
      statusCode: 500,
      code: 'TEST_ERROR',
      message: 'Something failed',
    } as FastifyError;

    errorHandler(error, request, reply);

    expect(request.log.error).toHaveBeenCalledWith(
      { err: error, statusCode: 500, code: 'TEST_ERROR' },
      'Request error'
    );
  });

  it('defaults code to INTERNAL_ERROR when not present', () => {
    const reply = createMockReply();
    const error = {
      statusCode: 503,
      message: 'Service unavailable',
    } as FastifyError;

    errorHandler(error, createMockRequest(), reply);

    expect(reply.send).toHaveBeenCalledWith({
      error: { code: 'INTERNAL_ERROR', message: 'Service unavailable' },
    });
  });
});
