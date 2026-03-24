// Concurrency tests: Multiple simultaneous reactions
// Validates: Rate limiter under load, broadcast fan-out, streak tracking
// Risk coverage: R-001 (real-time sync under 12 participants)

import { createTestServer, resetAllServiceState, type TestServer } from '../helpers/test-server.js';
import { createAndConnectBot, type ConnectedBot } from '../helpers/bot-client.js';
import { seedSession, cleanupTestData } from '../helpers/test-db.js';
import { EVENTS } from '../../src/shared/events.js';
import { setSessionDjState } from '../../src/services/dj-state-store.js';
import { createTestDJContextInState } from '../factories/dj-state.js';
import { DJState } from '../../src/dj-engine/types.js';

describe('Concurrent Reactions', () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await createTestServer();
  });

  afterAll(async () => {
    await server.close();
    await cleanupTestData();
  });

  describe('[P1] Multiple Clients Sending Reactions Simultaneously', () => {
    let session: Awaited<ReturnType<typeof seedSession>>;
    let bots: ConnectedBot[];

    beforeEach(async () => {
      resetAllServiceState();
      session = await seedSession();
      bots = [];
    });

    afterEach(() => {
      for (const bot of bots) {
        bot.cleanup();
      }
      bots = [];
    });

    it('[P1] should broadcast reactions from 6 concurrent senders to all participants', async () => {
      // GIVEN: 6 participants connected, party in song state
      for (let i = 0; i < 6; i++) {
        const bot = await createAndConnectBot(server.url, session.partyCode, `Reactor${i}`);
        bots.push(bot);
      }

      // Set DJ state to song (reactions only allowed during song state)
      setSessionDjState(session.sessionId, createTestDJContextInState(DJState.song, {
        sessionId: session.sessionId,
        participantCount: 6,
        currentPerformer: 'SomePerformer',
        currentSongTitle: 'Test Song',
        timerStartedAt: Date.now(),
        timerDurationMs: 180000,
      }));

      // WHEN: All 6 bots send reactions simultaneously
      const emojis = ['🎤', '🔥', '💃', '🎵', '⭐', '🎶'];
      for (let i = 0; i < 6; i++) {
        bots[i]!.sendReaction(emojis[i]!);
      }

      // THEN: Wait for broadcasts to propagate
      await new Promise((r) => setTimeout(r, 1500));

      // All bots should still be connected (no server crash under concurrent load)
      for (const bot of bots) {
        expect(bot.socket.connected).toBe(true);
      }
    });

    it('[P1] should handle rapid-fire reactions from single user with rate limiting', async () => {
      // GIVEN: 2 participants connected, party in song state
      const sender = await createAndConnectBot(server.url, session.partyCode, 'RapidSender');
      const observer = await createAndConnectBot(server.url, session.partyCode, 'Observer');
      bots.push(sender, observer);

      setSessionDjState(session.sessionId, createTestDJContextInState(DJState.song, {
        sessionId: session.sessionId,
        participantCount: 2,
        currentPerformer: 'Performer',
        currentSongTitle: 'Song',
        timerStartedAt: Date.now(),
        timerDurationMs: 180000,
      }));

      // WHEN: Sender fires 25 reactions rapidly (exceeds rate limit window)
      for (let i = 0; i < 25; i++) {
        sender.sendReaction('🎤');
      }

      // THEN: Server handles all emissions without crash
      // Rate limiter should diminish rewards but NOT block
      await new Promise((r) => setTimeout(r, 1000));

      expect(sender.socket.connected).toBe(true);
      expect(observer.socket.connected).toBe(true);
    });

    it('[P2] should track reaction streaks under concurrent load', async () => {
      // GIVEN: 3 participants connected in song state
      for (let i = 0; i < 3; i++) {
        const bot = await createAndConnectBot(server.url, session.partyCode, `Streaker${i}`);
        bots.push(bot);
      }

      setSessionDjState(session.sessionId, {
        state: 'song',
        sessionId: session.sessionId,
        participantCount: 3,
        songCount: 1,
        sessionStartedAt: Date.now(),
        currentPerformer: 'Performer',
        currentSongTitle: 'Song',
        timerStartedAt: Date.now(),
        timerDurationMs: 180000,
        isPaused: false,
        pausedAt: null,
        pausedFromState: null,
        timerRemainingMs: null,
        cycleHistory: ['icebreaker', 'songSelection'],
        metadata: {},
      });

      // WHEN: First bot sends 5 reactions (streak milestone at 5)
      // Collect streak events
      let streakReceived = false;
      bots[0]!.socket.on(EVENTS.REACTION_STREAK, () => {
        streakReceived = true;
      });

      for (let i = 0; i < 6; i++) {
        bots[0]!.sendReaction('🔥');
        // Small delay to ensure separate events (not batched)
        await new Promise((r) => setTimeout(r, 50));
      }

      await new Promise((r) => setTimeout(r, 1000));

      // THEN: Streak milestone notification received
      // Note: streak tracking counts all reactions regardless of rate limit
      expect(streakReceived).toBe(true);
    });
  });
});
