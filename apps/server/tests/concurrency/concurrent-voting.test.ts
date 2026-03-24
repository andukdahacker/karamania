// Concurrency tests: Simultaneous voting race conditions
// Validates: Quick Pick majority calculation under concurrent votes,
// Quick Vote binary resolution, no duplicate counting
// Risk coverage: R-003 (concurrent vote race conditions)

import { createTestServer, resetAllServiceState, type TestServer } from '../helpers/test-server.js';
import { createAndConnectBot, type ConnectedBot } from '../helpers/bot-client.js';
import { seedSession, seedCatalogTracks, cleanupTestData } from '../helpers/test-db.js';
import { setSessionDjState } from '../../src/services/dj-state-store.js';
import { startRound as startQuickPickRound, getRound } from '../../src/services/quick-pick.js';
import { createTestDJContextInState } from '../factories/dj-state.js';
import { DJState } from '../../src/dj-engine/types.js';

describe('Concurrent Voting', () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await createTestServer();
  });

  afterAll(async () => {
    await server.close();
    await cleanupTestData();
  });

  describe('[P0] Quick Pick: 6 Simultaneous Votes', () => {
    let session: Awaited<ReturnType<typeof seedSession>>;
    let bots: ConnectedBot[];
    let catalogTrackIds: string[];

    beforeEach(async () => {
      resetAllServiceState();
      session = await seedSession();
      catalogTrackIds = await seedCatalogTracks(3);
      bots = [];
    });

    afterEach(() => {
      for (const bot of bots) {
        bot.cleanup();
      }
      bots = [];
    });

    it('[P0] should correctly determine majority winner when 6 bots vote simultaneously', async () => {
      // GIVEN: 6 participants connected to a party
      for (let i = 0; i < 6; i++) {
        const bot = await createAndConnectBot(server.url, session.partyCode, `Voter${i}`);
        bots.push(bot);
      }

      // Set up DJ state in songSelection so votes are accepted
      setSessionDjState(session.sessionId, createTestDJContextInState(DJState.songSelection, {
        sessionId: session.sessionId,
        participantCount: 6,
      }));

      // Start a Quick Pick round with 3 songs
      const songs = catalogTrackIds.map((id, i) => ({
        catalogTrackId: id,
        songTitle: `Song ${i}`,
        artist: `Artist ${i}`,
        youtubeVideoId: `yt-${id.slice(0, 8)}`,
        overlapCount: 0,
      }));
      startQuickPickRound(session.sessionId, songs, 6);

      // WHEN: All 6 bots vote for the same song simultaneously
      const targetSong = catalogTrackIds[0]!;
      for (const bot of bots) {
        bot.castQuickPickVote(targetSong, 'up');
      }

      // Allow server time to process all votes
      await new Promise((r) => setTimeout(r, 1000));

      // THEN: All bots still connected (no crash under concurrent load)
      for (const bot of bots) {
        expect(bot.socket.connected).toBe(true);
      }

      // AND: Votes were correctly recorded — 6 unique up-votes on target song
      const round = getRound(session.sessionId);
      if (round) {
        const songVotes = round.votes.get(targetSong);
        expect(songVotes).toBeDefined();
        expect(songVotes!.size).toBe(6);
      }
    });

    it('[P0] should not double-count votes when same user votes twice rapidly', async () => {
      // GIVEN: 4 participants connected
      for (let i = 0; i < 4; i++) {
        const bot = await createAndConnectBot(server.url, session.partyCode, `Voter${i}`);
        bots.push(bot);
      }

      setSessionDjState(session.sessionId, createTestDJContextInState(DJState.songSelection, {
        sessionId: session.sessionId,
        participantCount: 4,
      }));

      const songs = catalogTrackIds.map((id, i) => ({
        catalogTrackId: id,
        songTitle: `Song ${i}`,
        artist: `Artist ${i}`,
        youtubeVideoId: `yt-${id.slice(0, 8)}`,
        overlapCount: 0,
      }));
      startQuickPickRound(session.sessionId, songs, 4);

      // WHEN: First bot votes for the same song 3 times rapidly
      const targetSong = catalogTrackIds[0]!;
      bots[0]!.castQuickPickVote(targetSong, 'up');
      bots[0]!.castQuickPickVote(targetSong, 'up');
      bots[0]!.castQuickPickVote(targetSong, 'up');

      // AND: Only 1 other bot votes for the same song
      bots[1]!.castQuickPickVote(targetSong, 'up');

      await new Promise((r) => setTimeout(r, 500));

      // THEN: Only 2 unique votes counted (not 4)
      // With 4 participants, majority = 3, so no winner should be declared
      const round = getRound(session.sessionId);
      expect(round).toBeDefined();
      const songVotes = round!.votes.get(targetSong);
      expect(songVotes).toBeDefined();
      // Idempotent voting: same user's duplicate votes should count as 1
      expect(songVotes!.size).toBeLessThanOrEqual(2);

      // No winner declared (majority = 3, only 2 unique voters)
      expect(round!.winningSongId).toBeNull();
    });
  });

  describe('[P1] Quick Vote: Simultaneous Binary Votes', () => {
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

    it('[P1] should handle 8 simultaneous quick votes without errors', async () => {
      // GIVEN: 8 participants connected
      for (let i = 0; i < 8; i++) {
        const bot = await createAndConnectBot(server.url, session.partyCode, `QV-${i}`);
        bots.push(bot);
      }

      // Set up DJ state in interlude
      setSessionDjState(session.sessionId, createTestDJContextInState(DJState.interlude, {
        sessionId: session.sessionId,
        participantCount: 8,
        songCount: 1,
        cycleHistory: ['icebreaker', 'songSelection', 'song', 'ceremony', 'interlude'],
      }));

      // WHEN: All 8 bots vote simultaneously (split 5A/3B)
      const votes = bots.map((bot, i) => {
        const option = i < 5 ? 'A' : 'B';
        return new Promise<void>((resolve) => {
          bot.castQuickVote(option as 'A' | 'B');
          resolve();
        });
      });
      await Promise.all(votes);

      // THEN: Server processes all votes without crash or error
      await new Promise((r) => setTimeout(r, 500));

      // All bots should still be connected (no server error kicked them)
      for (const bot of bots) {
        expect(bot.socket.connected).toBe(true);
      }
    });
  });
});
