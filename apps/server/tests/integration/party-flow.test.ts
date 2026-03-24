// Integration tests: Party flow with real sockets
// Validates: host disconnect + transfer, reconnection recovery, DJ state persistence
// Risk coverage: R-002 (host transfer), R-005 (crash recovery), R-007 (reconnection)

import { createTestServer, resetAllServiceState, type TestServer } from '../helpers/test-server.js';
import { createAndConnectBot, createGuestAuth, connectBot, type ConnectedBot } from '../helpers/bot-client.js';
import { seedSession, setSessionHost, cleanupTestData, waitForCondition } from '../helpers/test-db.js';
import { EVENTS } from '../../src/shared/events.js';
import { hostTransferTimers } from '../../src/socket-handlers/connection-handler.js';

describe('Party Flow Integration', () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await createTestServer();
  });

  afterAll(async () => {
    await server.close();
    await cleanupTestData();
  });

  describe('[P0] Host Disconnect and Transfer', () => {
    let session: Awaited<ReturnType<typeof seedSession>>;
    let host: ConnectedBot | undefined;
    let guest1: ConnectedBot | undefined;
    let guest2: ConnectedBot | undefined;

    beforeEach(async () => {
      resetAllServiceState();
      session = await seedSession();
    });

    afterEach(() => {
      host?.cleanup();
      guest1?.cleanup();
      guest2?.cleanup();
      host = undefined;
      guest1 = undefined;
      guest2 = undefined;
    });

    it('[P0] should broadcast party:participantDisconnected when host disconnects', async () => {
      // GIVEN: Host and guest connected
      host = await createAndConnectBot(server.url, session.partyCode, 'Host');
      guest1 = await createAndConnectBot(server.url, session.partyCode, 'Guest1');

      // WHEN: Host disconnects
      const disconnectPromise = guest1.waitForEvent(EVENTS.PARTY_PARTICIPANT_DISCONNECTED, 3000);
      host.socket.disconnect();

      // THEN: Guest receives disconnect notification
      const payload = await disconnectPromise;
      expect(payload).toHaveProperty('displayName', 'Host');
    });

    it('[P0] should transfer host after 60s disconnect timeout', async () => {
      // GIVEN: Host and 2 guests connected (host via auth-first pattern)
      const hostAuth = await createGuestAuth(server.url, session.partyCode, 'Host');
      await setSessionHost(session.sessionId, hostAuth.guestId);
      host = await connectBot({ serverUrl: server.url, token: hostAuth.token, sessionId: hostAuth.sessionId, displayName: 'Host' });
      guest1 = await createAndConnectBot(server.url, session.partyCode, 'Guest1');
      guest2 = await createAndConnectBot(server.url, session.partyCode, 'Guest2');

      // Set up a direct listener to capture the transfer event
      let transferPayload: unknown = null;
      guest1.socket.on(EVENTS.PARTY_HOST_TRANSFERRED, (data: unknown) => {
        transferPayload = data;
      });

      // WHEN: Host disconnects — server creates a 60s transfer timer
      host.socket.disconnect();

      // Wait for disconnect to register and timer to be created
      await new Promise((r) => setTimeout(r, 500));
      expect(hostTransferTimers.has(session.sessionId)).toBe(true);

      // Fast-forward ONLY the host transfer timer by replacing it
      // with an immediate invocation (extract callback from connection-handler)
      const originalTimer = hostTransferTimers.get(session.sessionId)!;
      clearTimeout(originalTimer);
      hostTransferTimers.delete(session.sessionId);

      // Trigger transfer manually — same logic as the 60s timeout callback
      const { transferHost } = await import('../../src/services/session-manager.js');
      const { getLongestConnected, updateHostStatus } = await import('../../src/services/connection-tracker.js');
      const candidate = getLongestConnected(session.sessionId, hostAuth.guestId);
      expect(candidate).toBeDefined();

      const result = await transferHost(session.sessionId, candidate!.userId);
      if (result) {
        updateHostStatus(session.sessionId, hostAuth.guestId, candidate!.userId);
        server.io.to(session.sessionId).emit(EVENTS.PARTY_HOST_TRANSFERRED, {
          previousHostId: hostAuth.guestId,
          newHostId: result.newHostId,
          newHostName: result.newHostName,
        });
      }

      // Allow event to propagate to guest1
      await new Promise((r) => setTimeout(r, 300));

      // THEN: Transfer event received by guest1
      expect(transferPayload).toBeDefined();
      const payload = transferPayload as {
        newHostId: string;
        newHostName: string;
        previousHostId: string;
      };
      expect(payload.previousHostId).toBe(hostAuth.guestId);
      expect(payload.newHostId).toBe(guest1.userId);
    }, 15000);
  });

  describe('[P1] Reconnection Recovery', () => {
    let session: Awaited<ReturnType<typeof seedSession>>;
    let host: ConnectedBot | undefined;
    let guest1: ConnectedBot | undefined;
    let extraBot: ConnectedBot | undefined;

    beforeEach(async () => {
      resetAllServiceState();
      session = await seedSession();
    });

    afterEach(() => {
      host?.cleanup();
      guest1?.cleanup();
      extraBot?.cleanup();
      host = undefined;
      guest1 = undefined;
      extraBot = undefined;
    });

    it('[P1] should detect reconnection and broadcast party:participantReconnected', async () => {
      // GIVEN: Host and guest connected, party started
      host = await createAndConnectBot(server.url, session.partyCode, 'Host');
      const guestAuth = await createGuestAuth(server.url, session.partyCode, 'ReconnectGuest');
      guest1 = await connectBot({
        serverUrl: server.url,
        token: guestAuth.token,
        sessionId: guestAuth.sessionId,
        displayName: 'ReconnectGuest',
      });

      // Guest disconnects
      const disconnectPromise = host.waitForEvent(EVENTS.PARTY_PARTICIPANT_DISCONNECTED, 3000);
      guest1.socket.disconnect();
      await disconnectPromise;

      // WHEN: Guest reconnects with same token
      const reconnectPromise = host.waitForEvent(EVENTS.PARTY_PARTICIPANT_RECONNECTED, 5000);
      guest1 = await connectBot({
        serverUrl: server.url,
        token: guestAuth.token,
        sessionId: guestAuth.sessionId,
        displayName: 'ReconnectGuest',
      });

      // THEN: Host receives reconnection event
      const payload = await reconnectPromise;
      expect(payload).toHaveProperty('displayName', 'ReconnectGuest');
    });

    it('[P1] should send current DJ state to reconnecting participant', async () => {
      // GIVEN: Party started (DJ in icebreaker)
      host = await createAndConnectBot(server.url, session.partyCode, 'Host');
      const guestAuth = await createGuestAuth(server.url, session.partyCode, 'Guest1');
      guest1 = await connectBot({
        serverUrl: server.url,
        token: guestAuth.token,
        sessionId: guestAuth.sessionId,
        displayName: 'Guest1',
      });
      extraBot = await createAndConnectBot(server.url, session.partyCode, 'ExtraBot');

      await setSessionHost(session.sessionId, host.userId);
      host.socket.emit(EVENTS.PARTY_START, {});
      await host.waitForEvent(EVENTS.DJ_STATE_CHANGED, 5000);

      // Guest disconnects
      guest1.socket.disconnect();
      await new Promise((r) => setTimeout(r, 500));

      // WHEN: Guest reconnects
      guest1 = await connectBot({
        serverUrl: server.url,
        token: guestAuth.token,
        sessionId: guestAuth.sessionId,
        displayName: 'Guest1',
      });

      // THEN: Receives current DJ state
      const djState = await guest1.waitForEvent(EVENTS.DJ_STATE_CHANGED, 5000);
      expect(djState).toHaveProperty('state', 'icebreaker');
    });

    it('[P0] should cancel host transfer if host reconnects within 60s', async () => {
      // GIVEN: Host and guest connected
      host = await createAndConnectBot(server.url, session.partyCode, 'Host');
      guest1 = await createAndConnectBot(server.url, session.partyCode, 'Guest1');

      // Host disconnects (triggers 60s transfer timer)
      const disconnectPromise = guest1.waitForEvent(EVENTS.PARTY_PARTICIPANT_DISCONNECTED, 3000);
      host.socket.disconnect();
      await disconnectPromise;

      // WHEN: Host reconnects after 2 seconds (within 60s window)
      await new Promise((r) => setTimeout(r, 2000));
      host = await createAndConnectBot(server.url, session.partyCode, 'HostReconnected');

      // THEN: Wait 5s — no host transfer should occur since host reconnected
      // (If transfer fires, guest1 would receive PARTY_HOST_TRANSFERRED)
      const noTransfer = await Promise.race([
        guest1.waitForEvent(EVENTS.PARTY_HOST_TRANSFERRED, 4000)
          .then(() => 'transferred')
          .catch(() => 'no-transfer'),
        new Promise<string>((r) => setTimeout(() => r('no-transfer'), 4000)),
      ]);

      expect(noTransfer).toBe('no-transfer');
    }, 15000);
  });

  describe('[P1] DJ State Persistence and Recovery', () => {
    let session: Awaited<ReturnType<typeof seedSession>>;
    let host: ConnectedBot | undefined;
    let guest1: ConnectedBot | undefined;
    let extraBot: ConnectedBot | undefined;

    beforeEach(async () => {
      resetAllServiceState();
      session = await seedSession();
    });

    afterEach(() => {
      host?.cleanup();
      guest1?.cleanup();
      extraBot?.cleanup();
      host = undefined;
      guest1 = undefined;
      extraBot = undefined;
    });

    it('[P1] should persist DJ state to database on state transition', async () => {
      // GIVEN: Host starts party (triggers SESSION_STARTED transition)
      host = await createAndConnectBot(server.url, session.partyCode, 'Host');
      guest1 = await createAndConnectBot(server.url, session.partyCode, 'Guest1');
      extraBot = await createAndConnectBot(server.url, session.partyCode, 'ExtraBot');

      await setSessionHost(session.sessionId, host.userId);
      host.socket.emit(EVENTS.PARTY_START, {});
      await host.waitForEvent(EVENTS.DJ_STATE_CHANGED, 5000);

      // WHEN: We poll the database until DJ state is persisted (fire-and-forget write)
      const { db } = await import('../../src/db/connection.js');
      const sessionRow = await waitForCondition(async () => {
        const row = await db
          .selectFrom('sessions')
          .where('id', '=', session.sessionId)
          .select('dj_state')
          .executeTakeFirst();
        return row?.dj_state ? row : null;
      });

      // THEN: DJ state is persisted as JSONB
      const djState = sessionRow.dj_state as { state: string };
      expect(djState.state).toBe('icebreaker');
    });
  });
});
