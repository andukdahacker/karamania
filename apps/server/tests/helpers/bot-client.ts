// Bot client — real Socket.io client wrapper for integration/E2E tests
// Connects to real server, authenticates with guest JWT, and provides
// typed event helpers for sending actions and waiting for responses

import { io as socketIOClient, type Socket } from 'socket.io-client';
import { EVENTS } from '../../src/shared/events.js';

export interface BotClientConfig {
  serverUrl: string;
  token: string;
  sessionId: string;
  displayName: string;
}

export interface ConnectedBot {
  socket: Socket;
  userId: string;
  sessionId: string;
  displayName: string;

  // Event helpers
  waitForEvent: <T = unknown>(event: string, timeoutMs?: number) => Promise<T>;
  waitForDjState: (targetState?: string, timeoutMs?: number) => Promise<unknown>;
  sendReaction: (emoji: string) => void;
  castQuickPickVote: (catalogTrackId: string, vote: 'up' | 'skip') => void;
  castQuickVote: (option: 'A' | 'B') => void;
  acceptCard: () => void;
  dismissCard: () => void;
  disconnect: () => void;
  cleanup: () => void;
}

/**
 * Creates a guest user via the auth endpoint and returns a token.
 * Also inserts a user row in the DB so the FK constraint on
 * session_participants.user_id is satisfied when the bot joins.
 */
export async function createGuestAuth(
  serverUrl: string,
  partyCode: string,
  displayName: string,
): Promise<{ token: string; guestId: string; sessionId: string }> {
  const response = await fetch(`${serverUrl}/api/auth/guest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ partyCode, displayName }),
  });

  if (!response.ok) {
    const body = await response.json();
    throw new Error(`Guest auth failed (${response.status}): ${JSON.stringify(body)}`);
  }

  const { data } = (await response.json()) as {
    data: { token: string; guestId: string; sessionId: string };
  };

  // Insert guest user row so session_participants FK constraint is satisfied
  const { db } = await import('../../src/db/connection.js');
  const { trackedUserIds } = await import('./test-db.js');
  await db
    .insertInto('users')
    .values({
      id: data.guestId,
      firebase_uid: null,
      display_name: displayName,
      avatar_url: null,
      created_at: new Date(),
    })
    .onConflict((oc) => oc.column('id').doNothing())
    .execute();

  trackedUserIds.push(data.guestId);
  return data;
}

/**
 * Connects a bot client to the test server via real Socket.io.
 * Authenticates with guest JWT, waits for party:participants (join confirmation).
 */
export async function connectBot(config: BotClientConfig): Promise<ConnectedBot> {
  const { serverUrl, token, sessionId, displayName } = config;

  const socket = socketIOClient(serverUrl, {
    auth: { token, sessionId, displayName },
    transports: ['websocket'],
    forceNew: true,
  });

  // Collect received events for assertions
  const receivedEvents: Array<{ event: string; data: unknown }> = [];
  const eventListeners = new Map<string, Array<(data: unknown) => void>>();

  // Catch-all listener for debugging and assertions
  socket.onAny((event: string, data: unknown) => {
    receivedEvents.push({ event, data });
    const listeners = eventListeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        listener(data);
      }
      eventListeners.delete(event);
    }
  });

  // Wait for successful connection and join confirmation
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Bot "${displayName}" connection timed out (5s)`));
    }, 5000);

    socket.on('connect_error', (err: Error) => {
      clearTimeout(timeout);
      reject(new Error(`Bot "${displayName}" connect error: ${err.message}`));
    });

    socket.on(EVENTS.PARTY_PARTICIPANTS, () => {
      clearTimeout(timeout);
      resolve();
    });
  });

  // Extract userId from the token payload (guest tokens have sub = guestId)
  const tokenPayload = JSON.parse(
    Buffer.from(token.split('.')[1]!, 'base64').toString(),
  );
  const userId = tokenPayload.sub as string;

  function waitForEvent<T = unknown>(event: string, timeoutMs = 5000): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        eventListeners.delete(event);
        reject(new Error(`Timed out waiting for "${event}" (${timeoutMs}ms)`));
      }, timeoutMs);

      // Check if event already received
      const existing = receivedEvents.find((e) => e.event === event);
      if (existing) {
        clearTimeout(timeout);
        resolve(existing.data as T);
        return;
      }

      const listeners = eventListeners.get(event) ?? [];
      listeners.push((data: unknown) => {
        clearTimeout(timeout);
        resolve(data as T);
      });
      eventListeners.set(event, listeners);
    });
  }

  function waitForDjState(targetState?: string, timeoutMs = 10000): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timed out waiting for dj:stateChanged${targetState ? ` (${targetState})` : ''} (${timeoutMs}ms)`));
      }, timeoutMs);

      // Check already-received events (scan all, not just first)
      for (const e of receivedEvents) {
        if (e.event === EVENTS.DJ_STATE_CHANGED) {
          const payload = e.data as { state?: string };
          if (!targetState || payload.state === targetState) {
            clearTimeout(timeout);
            resolve(e.data);
            return;
          }
        }
      }

      // Use a persistent socket.on listener instead of onAny-based eventListeners
      // because onAny deletes listeners after first call (even for wrong state)
      const handler = (data: unknown) => {
        const payload = data as { state?: string };
        if (!targetState || payload.state === targetState) {
          clearTimeout(timeout);
          socket.off(EVENTS.DJ_STATE_CHANGED, handler);
          resolve(data);
        }
      };
      socket.on(EVENTS.DJ_STATE_CHANGED, handler);
    });
  }

  return {
    socket,
    userId,
    sessionId,
    displayName,

    waitForEvent,
    waitForDjState,

    sendReaction: (emoji: string) => {
      socket.emit(EVENTS.REACTION_SENT, { emoji });
    },

    castQuickPickVote: (catalogTrackId: string, vote: 'up' | 'skip') => {
      socket.emit(EVENTS.SONG_QUICKPICK, { catalogTrackId, vote });
    },

    castQuickVote: (option: 'A' | 'B') => {
      socket.emit(EVENTS.QUICK_VOTE_CAST, { option });
    },

    acceptCard: () => {
      socket.emit(EVENTS.CARD_ACCEPTED, {});
    },

    dismissCard: () => {
      socket.emit(EVENTS.CARD_DISMISSED, {});
    },

    disconnect: () => {
      socket.disconnect();
    },

    cleanup: () => {
      socket.removeAllListeners();
      socket.disconnect();
    },
  };
}

/**
 * Helper: Create a guest and connect as a bot in one call.
 */
export async function createAndConnectBot(
  serverUrl: string,
  partyCode: string,
  displayName: string,
): Promise<ConnectedBot> {
  const auth = await createGuestAuth(serverUrl, partyCode, displayName);
  return connectBot({
    serverUrl,
    token: auth.token,
    sessionId: auth.sessionId,
    displayName,
  });
}
