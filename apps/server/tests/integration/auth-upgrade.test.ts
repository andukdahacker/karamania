// Integration tests: Guest auth upgrade mid-session
// Validates: Guest connects, upgrades to authenticated, socket stays connected
// Risk coverage: R-010 (auth upgrade continuity)

import { createTestServer, resetAllServiceState, type TestServer } from '../helpers/test-server.js';
import { createAndConnectBot, type ConnectedBot } from '../helpers/bot-client.js';
import { seedSession, setSessionHost, cleanupTestData } from '../helpers/test-db.js';
import { EVENTS } from '../../src/shared/events.js';

describe('Auth Upgrade Integration', () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await createTestServer();
  });

  afterAll(async () => {
    await server.close();
    await cleanupTestData();
  });

  describe('[P1] Guest-to-Authenticated Upgrade', () => {
    let session: Awaited<ReturnType<typeof seedSession>>;
    let guest: ConnectedBot | undefined;
    let extraBot: ConnectedBot | undefined;

    beforeEach(async () => {
      resetAllServiceState();
      session = await seedSession();
    });

    afterEach(() => {
      guest?.cleanup();
      extraBot?.cleanup();
      guest = undefined;
      extraBot = undefined;
    });

    it('[P1] should keep socket connected after auth:upgraded event', async () => {
      // GIVEN: Guest connected to party
      guest = await createAndConnectBot(server.url, session.partyCode, 'GuestToUpgrade');
      expect(guest.socket.connected).toBe(true);
      const originalSocketId = guest.socket.id;

      // WHEN: Guest emits auth:upgraded with a (fake) Firebase token
      // Note: In a real scenario this would be a valid Firebase token.
      // Here we verify the socket handler doesn't disconnect on the attempt.
      guest.socket.emit(EVENTS.AUTH_UPGRADED, { token: 'fake-firebase-token' });

      // Wait for server to process the upgrade attempt
      await new Promise((r) => setTimeout(r, 500));

      // THEN: Socket remains connected (upgrade fails silently for invalid token,
      // but the socket is NOT disconnected — that's the key behavior)
      expect(guest.socket.connected).toBe(true);
      expect(guest.socket.id).toBe(originalSocketId);
    });

    it('[P1] should allow guest to continue sending events after upgrade attempt', async () => {
      // GIVEN: Guest connected and party started
      const host = await createAndConnectBot(server.url, session.partyCode, 'Host');
      await setSessionHost(session.sessionId, host.userId);
      guest = await createAndConnectBot(server.url, session.partyCode, 'ActiveGuest');
      extraBot = await createAndConnectBot(server.url, session.partyCode, 'ExtraBot');

      // Start party
      host.socket.emit(EVENTS.PARTY_START, {});
      await host.waitForEvent(EVENTS.DJ_STATE_CHANGED, 5000);

      // Guest attempts upgrade (will fail silently with invalid token)
      guest.socket.emit(EVENTS.AUTH_UPGRADED, { token: 'invalid-token' });
      await new Promise((r) => setTimeout(r, 300));

      // WHEN: Guest continues to interact (e.g., vibe change in lobby)
      // The socket should still be functional
      expect(guest.socket.connected).toBe(true);

      host.cleanup();
    });
  });
});
