// Integration tests: Real Socket.io connection lifecycle
// Validates: guest auth over real socket, room join, DJ state broadcast, error paths
// Risk coverage: R-004 (guest JWT auth), R-001 (DJ state broadcast delivery)

import { createTestServer, resetAllServiceState, type TestServer } from '../helpers/test-server.js';
import { createAndConnectBot, createGuestAuth, connectBot, type ConnectedBot } from '../helpers/bot-client.js';
import { seedSession, setSessionHost, cleanupTestData } from '../helpers/test-db.js';
import { io as socketIOClient } from 'socket.io-client';
import { EVENTS } from '../../src/shared/events.js';

describe('Socket Lifecycle Integration', () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await createTestServer();
  });

  afterAll(async () => {
    await server.close();
    await cleanupTestData();
  });

  afterEach(() => {
    resetAllServiceState();
  });

  describe('[P0] Guest Authentication via Real Socket', () => {
    let session: Awaited<ReturnType<typeof seedSession>>;
    let bot: ConnectedBot | undefined;

    beforeEach(async () => {
      session = await seedSession();
    });

    afterEach(() => {
      bot?.cleanup();
      bot = undefined;
    });

    it('[P0] should connect with valid guest JWT and receive party:participants', async () => {
      // GIVEN: A session exists in DB and guest obtains a token via REST
      // WHEN: Bot connects via real Socket.io with the guest token
      bot = await createAndConnectBot(server.url, session.partyCode, 'TestGuest');

      // THEN: Socket is connected and bot received the party participants event
      expect(bot.socket.connected).toBe(true);
      expect(bot.sessionId).toBe(session.sessionId);
    });

    it('[P0] should reject connection with no token', async () => {
      // GIVEN: A socket client with no auth token
      const socket = socketIOClient(server.url, {
        auth: {},
        transports: ['websocket'],
        forceNew: true,
      });

      // WHEN/THEN: Connection fails with AUTH_MISSING
      const error = await new Promise<Error>((resolve) => {
        socket.on('connect_error', (err: Error) => {
          resolve(err);
        });
      });

      expect(error.message).toBe('AUTH_MISSING');
      socket.disconnect();
    });

    it('[P0] should reject connection with invalid token', async () => {
      // GIVEN: A socket client with a garbage token
      const socket = socketIOClient(server.url, {
        auth: { token: 'not.a.valid.jwt', sessionId: session.sessionId },
        transports: ['websocket'],
        forceNew: true,
      });

      // WHEN/THEN: Connection fails with AUTH_INVALID
      const error = await new Promise<Error>((resolve) => {
        socket.on('connect_error', (err: Error) => {
          resolve(err);
        });
      });

      expect(error.message).toBe('AUTH_INVALID');
      socket.disconnect();
    });
  });

  describe('[P0] DJ State Broadcast Delivery', () => {
    let session: Awaited<ReturnType<typeof seedSession>>;
    let host: ConnectedBot | undefined;
    let guest1: ConnectedBot | undefined;
    let guest2: ConnectedBot | undefined;
    let extraBot: ConnectedBot | undefined;

    beforeEach(async () => {
      session = await seedSession();
    });

    afterEach(() => {
      host?.cleanup();
      guest1?.cleanup();
      guest2?.cleanup();
      extraBot?.cleanup();
      host = undefined;
      guest1 = undefined;
      guest2 = undefined;
      extraBot = undefined;
    });

    it('[P0] should broadcast dj:stateChanged to all participants when party starts', async () => {
      // GIVEN: Host obtains auth, is set as DB host, THEN connects
      const hostAuth = await createGuestAuth(server.url, session.partyCode, 'Host');
      await setSessionHost(session.sessionId, hostAuth.guestId);
      host = await connectBot({ serverUrl: server.url, token: hostAuth.token, sessionId: hostAuth.sessionId, displayName: 'Host' });
      guest1 = await createAndConnectBot(server.url, session.partyCode, 'Guest1');
      guest2 = await createAndConnectBot(server.url, session.partyCode, 'Guest2');

      // WHEN: Host starts the party
      const hostDjPromise = host.waitForEvent(EVENTS.DJ_STATE_CHANGED, 5000);
      const guest1DjPromise = guest1.waitForEvent(EVENTS.DJ_STATE_CHANGED, 5000);
      const guest2DjPromise = guest2.waitForEvent(EVENTS.DJ_STATE_CHANGED, 5000);

      host.socket.emit(EVENTS.PARTY_START, {});

      // THEN: All participants receive the DJ state change
      const [hostDj, guest1Dj, guest2Dj] = await Promise.all([
        hostDjPromise,
        guest1DjPromise,
        guest2DjPromise,
      ]);

      expect(hostDj).toHaveProperty('state', 'icebreaker');
      expect(guest1Dj).toHaveProperty('state', 'icebreaker');
      expect(guest2Dj).toHaveProperty('state', 'icebreaker');
    });

    it('[P1] should send current DJ state to a late-joining participant', async () => {
      // GIVEN: Host starts a party (DJ enters icebreaker)
      const hostAuth = await createGuestAuth(server.url, session.partyCode, 'Host');
      await setSessionHost(session.sessionId, hostAuth.guestId);
      host = await connectBot({ serverUrl: server.url, token: hostAuth.token, sessionId: hostAuth.sessionId, displayName: 'Host' });
      guest1 = await createAndConnectBot(server.url, session.partyCode, 'Guest1');
      extraBot = await createAndConnectBot(server.url, session.partyCode, 'ExtraBot');

      host.socket.emit(EVENTS.PARTY_START, {});
      await host.waitForEvent(EVENTS.DJ_STATE_CHANGED, 5000);

      // WHEN: A new guest joins after party already started
      guest2 = await createAndConnectBot(server.url, session.partyCode, 'LateGuest');

      // THEN: Late joiner receives the current DJ state on connect
      const djState = await guest2.waitForEvent(EVENTS.DJ_STATE_CHANGED, 5000);
      expect(djState).toHaveProperty('state', 'icebreaker');
    });
  });

  describe('[P2] Error Paths', () => {
    it('[P2] should fail guest auth when party code does not exist', async () => {
      // GIVEN: No session with code 'ZZZZ'
      // WHEN: Attempting guest auth
      const response = await fetch(`${server.url}/api/auth/guest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partyCode: 'ZZZZ', displayName: 'Lost' }),
      });

      // THEN: Returns 404
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });
});
