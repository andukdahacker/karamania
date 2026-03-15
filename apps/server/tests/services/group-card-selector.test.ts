import { describe, it, expect } from 'vitest';
import { selectGroupParticipants } from '../../src/services/group-card-selector.js';
import type { TrackedConnection } from '../../src/services/connection-tracker.js';

function makeConnection(userId: string, displayName: string, isHost = false): TrackedConnection {
  return { socketId: `socket-${userId}`, userId, displayName, connectedAt: Date.now(), isHost };
}

describe('selectGroupParticipants', () => {
  const singer = makeConnection('singer-1', 'Alice');
  const p1 = makeConnection('p1', 'Bob');
  const p2 = makeConnection('p2', 'Carol');
  const p3 = makeConnection('p3', 'Dave');
  const hostP = makeConnection('host-1', 'Host Eve', true);

  const allConnections = [singer, p1, p2, p3, hostP];

  describe('tag-team', () => {
    it('selects exactly 1 participant, excluding the singer', () => {
      const result = selectGroupParticipants('tag-team', 'singer-1', allConnections);
      expect(result.selectedUserIds).toHaveLength(1);
      expect(result.selectedUserIds).not.toContain('singer-1');
      expect(result.selectedDisplayNames).toHaveLength(1);
    });

    it('generates correct announcement format', () => {
      const result = selectGroupParticipants('tag-team', 'singer-1', allConnections);
      const selectedName = result.selectedDisplayNames[0];
      expect(result.announcement).toBe(`TAG TEAM: ${selectedName} takes over at the chorus!`);
    });
  });

  describe('backup-dancers', () => {
    it('selects exactly 2 participants, excluding the singer', () => {
      const result = selectGroupParticipants('backup-dancers', 'singer-1', allConnections);
      expect(result.selectedUserIds).toHaveLength(2);
      expect(result.selectedUserIds).not.toContain('singer-1');
      expect(result.selectedDisplayNames).toHaveLength(2);
    });

    it('generates correct announcement format', () => {
      const result = selectGroupParticipants('backup-dancers', 'singer-1', allConnections);
      const [name1, name2] = result.selectedDisplayNames;
      expect(result.announcement).toBe(`BACKUP DANCERS: ${name1} and ${name2} — get behind the singer!`);
    });
  });

  describe('hype-squad', () => {
    it('selects exactly 2 participants, excluding the singer', () => {
      const result = selectGroupParticipants('hype-squad', 'singer-1', allConnections);
      expect(result.selectedUserIds).toHaveLength(2);
      expect(result.selectedUserIds).not.toContain('singer-1');
      expect(result.selectedDisplayNames).toHaveLength(2);
    });

    it('generates correct announcement format', () => {
      const connections = [singer, p1, p2];
      const result = selectGroupParticipants('hype-squad', 'singer-1', connections);
      const [name1, name2] = result.selectedDisplayNames;
      expect(result.announcement).toBe(`HYPE SQUAD: ${name1} and ${name2} — hype up Alice the entire song!`);
    });
  });

  describe('crowd-conductor', () => {
    it('selects 0 participants — singer is the conductor', () => {
      const result = selectGroupParticipants('crowd-conductor', 'singer-1', allConnections);
      expect(result.selectedUserIds).toHaveLength(0);
      expect(result.selectedDisplayNames).toHaveLength(0);
    });

    it('generates correct announcement with singer name', () => {
      const result = selectGroupParticipants('crowd-conductor', 'singer-1', allConnections);
      expect(result.announcement).toBe('CROWD CONDUCTOR: Alice controls when you clap, wave, or cheer!');
    });
  });

  describe('name-that-tune', () => {
    it('selects 0 participants — entire audience participates', () => {
      const result = selectGroupParticipants('name-that-tune', 'singer-1', allConnections);
      expect(result.selectedUserIds).toHaveLength(0);
      expect(result.selectedDisplayNames).toHaveLength(0);
    });

    it('generates correct announcement with singer name', () => {
      const result = selectGroupParticipants('name-that-tune', 'singer-1', allConnections);
      expect(result.announcement).toBe('NAME THAT TUNE: Alice hums the intro — everyone guess the song!');
    });
  });

  describe('singer exclusion', () => {
    it('never includes the singer in selectedUserIds for any card type', () => {
      const cardsWithSelection = ['tag-team', 'backup-dancers', 'hype-squad'];
      for (const cardId of cardsWithSelection) {
        for (let i = 0; i < 20; i++) {
          const result = selectGroupParticipants(cardId, 'singer-1', allConnections);
          expect(result.selectedUserIds).not.toContain('singer-1');
        }
      }
    });

    it('includes host as eligible for selection', () => {
      // With only host and singer, tag-team MUST select host
      const connections = [singer, hostP];
      const result = selectGroupParticipants('tag-team', 'singer-1', connections);
      expect(result.selectedUserIds).toContain('host-1');
    });
  });

  describe('edge case — not enough participants', () => {
    it('selects as many as available when fewer than required', () => {
      // 2 connected: singer + 1 other. backup-dancers needs 2 non-singers but only 1 available
      const connections = [singer, p1];
      const result = selectGroupParticipants('backup-dancers', 'singer-1', connections);
      expect(result.selectedUserIds).toHaveLength(1);
      expect(result.selectedUserIds[0]).toBe('p1');
    });

    it('adjusts announcement when fewer participants than required (backup-dancers)', () => {
      const connections = [singer, p1];
      const result = selectGroupParticipants('backup-dancers', 'singer-1', connections);
      expect(result.announcement).not.toContain('undefined');
      expect(result.announcement).toContain('Bob');
    });

    it('adjusts announcement when fewer participants than required (hype-squad)', () => {
      const connections = [singer, p1];
      const result = selectGroupParticipants('hype-squad', 'singer-1', connections);
      expect(result.announcement).not.toContain('undefined');
      expect(result.announcement).toContain('Bob');
    });

    it('returns empty selection when only the singer is connected', () => {
      const result = selectGroupParticipants('tag-team', 'singer-1', [singer]);
      expect(result.selectedUserIds).toHaveLength(0);
      expect(result.announcement).not.toContain('undefined');
    });
  });

  describe('randomness', () => {
    it('produces varied selections across multiple calls', () => {
      const selections = new Set<string>();
      for (let i = 0; i < 50; i++) {
        const result = selectGroupParticipants('tag-team', 'singer-1', allConnections);
        selections.add(result.selectedUserIds[0]!);
      }
      // With 4 eligible participants, we should see at least 2 different selections in 50 tries
      expect(selections.size).toBeGreaterThanOrEqual(2);
    });
  });
});
