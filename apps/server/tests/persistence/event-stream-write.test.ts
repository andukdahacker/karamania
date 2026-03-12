import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestSession } from '../factories/session.js';

vi.mock('../../src/config.js', () => ({
  config: {
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    JWT_SECRET: 'test-secret-key-at-least-32-characters-long',
    YOUTUBE_API_KEY: 'test-key',
    SPOTIFY_CLIENT_ID: 'test-id',
    SPOTIFY_CLIENT_SECRET: 'test-secret',
    FIREBASE_PROJECT_ID: 'test-project',
    FIREBASE_CLIENT_EMAIL: 'test@test.iam.gserviceaccount.com',
    FIREBASE_PRIVATE_KEY: 'test-key',
    NODE_ENV: 'test',
    PORT: 3000,
  },
}));

const mockExecute = vi.fn();
const mockWhere = vi.fn();
const mockSet = vi.fn();

vi.mock('../../src/db/connection.js', () => {
  const createUpdateChain = () => ({
    set: (...args: unknown[]) => {
      mockSet(...args);
      return {
        where: (...whereArgs: unknown[]) => {
          mockWhere(...whereArgs);
          return { execute: mockExecute };
        },
      };
    },
  });

  return {
    db: {
      updateTable: vi.fn().mockReturnValue(createUpdateChain()),
    },
  };
});

describe('writeEventStream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes JSONB to sessions table', async () => {
    const session = createTestSession();
    mockExecute.mockResolvedValue(undefined);

    const { writeEventStream } = await import('../../src/persistence/session-repository.js');
    const events = [
      { type: 'party:started', ts: 1000, userId: 'user-1', data: { participantCount: 5 } },
      { type: 'party:joined', ts: 1001, userId: 'user-2', data: { displayName: 'Alice', role: 'guest' } },
    ];
    await writeEventStream(session.id, events);

    expect(mockSet).toHaveBeenCalledWith({ event_stream: JSON.stringify(events) });
    expect(mockWhere).toHaveBeenCalledWith('id', '=', session.id);
    expect(mockExecute).toHaveBeenCalled();
  });

  it('writes empty JSON array for empty events', async () => {
    const session = createTestSession();
    mockExecute.mockResolvedValue(undefined);

    const { writeEventStream } = await import('../../src/persistence/session-repository.js');
    await writeEventStream(session.id, []);

    expect(mockSet).toHaveBeenCalledWith({ event_stream: '[]' });
  });

  it('does not crash for non-existent session', async () => {
    mockExecute.mockResolvedValue(undefined);

    const { writeEventStream } = await import('../../src/persistence/session-repository.js');
    await expect(writeEventStream('nonexistent-id', [{ type: 'test' }])).resolves.toBeUndefined();
  });
});
