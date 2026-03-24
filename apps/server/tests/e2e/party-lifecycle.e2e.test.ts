// E2E test: Full party lifecycle with real server and bot clients
// Validates: Complete DJ cycle — create → join → start → icebreaker → songSelection
// Risk coverage: Core multiplayer journey that cannot be validated at lower levels

import { createTestServer, resetAllServiceState, type TestServer } from '../helpers/test-server.js';
import { createAndConnectBot, createGuestAuth, connectBot, type ConnectedBot } from '../helpers/bot-client.js';
import { seedSession, setSessionHost, seedCatalogTracks, cleanupTestData } from '../helpers/test-db.js';
import { EVENTS } from '../../src/shared/events.js';

describe('E2E: Party Lifecycle', () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await createTestServer();
  });

  afterAll(async () => {
    await server.close();
    await cleanupTestData();
  });

  describe('[P1] Full Party Lifecycle with 4 Participants', () => {
    let session: Awaited<ReturnType<typeof seedSession>>;
    let host: ConnectedBot | undefined;
    let guests: ConnectedBot[];

    beforeEach(async () => {
      resetAllServiceState();
      session = await seedSession();
      await seedCatalogTracks(10);
      guests = [];
    });

    afterEach(() => {
      host?.cleanup();
      for (const g of guests) {
        g.cleanup();
      }
      host = undefined;
      guests = [];
    });

    it('[P1] should complete: create → join → start → icebreaker DJ state', async () => {
      // GIVEN: A session exists in the database
      // WHEN: Host and 3 guests join the party
      host = await createAndConnectBot(server.url, session.partyCode, 'E2E-Host');

      for (let i = 0; i < 3; i++) {
        const guest = await createAndConnectBot(server.url, session.partyCode, `E2E-Guest${i}`);
        guests.push(guest);
      }

      // THEN: All 4 participants are connected
      expect(host.socket.connected).toBe(true);
      for (const g of guests) {
        expect(g.socket.connected).toBe(true);
      }

      // WHEN: Host starts the party
      await setSessionHost(session.sessionId, host.userId);
      const hostDjPromise = host.waitForEvent(EVENTS.DJ_STATE_CHANGED, 5000);
      const guestDjPromises = guests.map((g) =>
        g.waitForEvent(EVENTS.DJ_STATE_CHANGED, 5000),
      );

      host.socket.emit(EVENTS.PARTY_START, {});

      // THEN: All participants receive icebreaker state
      const hostDj = (await hostDjPromise) as { state: string };
      expect(hostDj.state).toBe('icebreaker');

      const guestDjs = await Promise.all(guestDjPromises);
      for (const dj of guestDjs) {
        expect((dj as { state: string }).state).toBe('icebreaker');
      }
    });

    it('[P1] should transition through icebreaker → songSelection via host skip', async () => {
      // GIVEN: Party started, DJ in icebreaker
      const hostAuth = await createGuestAuth(server.url, session.partyCode, 'E2E-Host');
      await setSessionHost(session.sessionId, hostAuth.guestId);
      host = await connectBot({ serverUrl: server.url, token: hostAuth.token, sessionId: hostAuth.sessionId, displayName: 'E2E-Host' });
      const guest = await createAndConnectBot(server.url, session.partyCode, 'E2E-Guest');
      guests.push(guest);
      const extraBot = await createAndConnectBot(server.url, session.partyCode, 'ExtraBot');
      guests.push(extraBot);

      host.socket.emit(EVENTS.PARTY_START, {});
      await host.waitForEvent(EVENTS.DJ_STATE_CHANGED, 5000);

      // WHEN: Host skips icebreaker
      const nextStatePromise = host.waitForDjState('songSelection', 5000);
      host.socket.emit(EVENTS.HOST_SKIP, {});

      // THEN: DJ transitions to songSelection
      const payload = (await nextStatePromise) as { state: string };
      expect(payload.state).toBe('songSelection');
    });

    it('[P1] should handle host ending party and transitioning to finale', async () => {
      // GIVEN: Party started, DJ in icebreaker
      const hostAuth = await createGuestAuth(server.url, session.partyCode, 'E2E-Host');
      await setSessionHost(session.sessionId, hostAuth.guestId);
      host = await connectBot({ serverUrl: server.url, token: hostAuth.token, sessionId: hostAuth.sessionId, displayName: 'E2E-Host' });
      const guest = await createAndConnectBot(server.url, session.partyCode, 'E2E-Guest');
      guests.push(guest);
      const extraBot = await createAndConnectBot(server.url, session.partyCode, 'ExtraBot');
      guests.push(extraBot);

      host.socket.emit(EVENTS.PARTY_START, {});
      await host.waitForEvent(EVENTS.DJ_STATE_CHANGED, 5000);

      // WHEN: Host ends party
      const finalePromise = host.waitForDjState('finale', 5000);
      host.socket.emit(EVENTS.HOST_END_PARTY, {});

      // THEN: DJ transitions to finale
      const payload = (await finalePromise) as { state: string };
      expect(payload.state).toBe('finale');
    });

    it('[P1] should broadcast party:joined to existing participants when new guest joins', async () => {
      // GIVEN: Host connected
      host = await createAndConnectBot(server.url, session.partyCode, 'E2E-Host');

      // WHEN: A guest joins
      const joinPromise = host.waitForEvent(EVENTS.PARTY_JOINED, 5000);
      const guest = await createAndConnectBot(server.url, session.partyCode, 'NewGuest');
      guests.push(guest);

      // THEN: Host receives party:joined with the new participant info
      const payload = (await joinPromise) as { displayName: string; participantCount: number };
      expect(payload.displayName).toBe('NewGuest');
      expect(payload.participantCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('[P2] Edge Cases', () => {
    let session: Awaited<ReturnType<typeof seedSession>>;
    let host: ConnectedBot | undefined;

    beforeEach(async () => {
      resetAllServiceState();
      session = await seedSession();
    });

    afterEach(() => {
      host?.cleanup();
      host = undefined;
    });

    it('[P2] should reject solo host party (1 participant) with INSUFFICIENT_PLAYERS', async () => {
      // GIVEN: Only host connected (no guests)
      host = await createAndConnectBot(server.url, session.partyCode, 'SoloHost');
      await setSessionHost(session.sessionId, host.userId);

      // WHEN: Host starts party with fewer than 3 participants
      host.socket.emit(EVENTS.PARTY_START, {});

      // THEN: No dj:stateChanged should be emitted (party start is rejected)
      const result = await host.waitForEvent(EVENTS.DJ_STATE_CHANGED, 3000)
        .then(() => 'state-changed')
        .catch(() => 'no-event');
      expect(result).toBe('no-event');
    });
  });
});
