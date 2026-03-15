// Group card participant selection — pure logic, ZERO Socket.io dependency.
// BOUNDARY: Takes connections array as input, returns selection. No side effects.

import type { TrackedConnection } from './connection-tracker.js';

export interface GroupCardSelection {
  selectedUserIds: string[];
  selectedDisplayNames: string[];
  cardId: string;
  announcement: string;
}

interface CardSelectionRule {
  selectCount: number;
  announcementTemplate: (selectedNames: string[], singerName: string) => string;
}

const CARD_RULES: Record<string, CardSelectionRule> = {
  'tag-team': {
    selectCount: 1,
    announcementTemplate: (names) =>
      names.length === 0
        ? 'TAG TEAM: No partner available!'
        : `TAG TEAM: ${names[0]} takes over at the chorus!`,
  },
  'backup-dancers': {
    selectCount: 2,
    announcementTemplate: (names) =>
      names.length === 0
        ? 'BACKUP DANCERS: No dancers available!'
        : names.length === 1
          ? `BACKUP DANCERS: ${names[0]} — get behind the singer!`
          : `BACKUP DANCERS: ${names[0]} and ${names[1]} — get behind the singer!`,
  },
  'hype-squad': {
    selectCount: 2,
    announcementTemplate: (names, singerName) =>
      names.length === 0
        ? `HYPE SQUAD: Everyone hype up ${singerName}!`
        : names.length === 1
          ? `HYPE SQUAD: ${names[0]} — hype up ${singerName} the entire song!`
          : `HYPE SQUAD: ${names[0]} and ${names[1]} — hype up ${singerName} the entire song!`,
  },
  'crowd-conductor': {
    selectCount: 0,
    announcementTemplate: (_names, singerName) => `CROWD CONDUCTOR: ${singerName} controls when you clap, wave, or cheer!`,
  },
  'name-that-tune': {
    selectCount: 0,
    announcementTemplate: (_names, singerName) => `NAME THAT TUNE: ${singerName} hums the intro — everyone guess the song!`,
  },
};

function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

export function selectGroupParticipants(
  cardId: string,
  singerId: string,
  connections: TrackedConnection[],
): GroupCardSelection {
  const rule = CARD_RULES[cardId];
  if (!rule) {
    return { selectedUserIds: [], selectedDisplayNames: [], cardId, announcement: '' };
  }

  const singerConnection = connections.find(c => c.userId === singerId);
  const singerName = singerConnection?.displayName ?? 'Singer';

  if (rule.selectCount === 0) {
    return {
      selectedUserIds: [],
      selectedDisplayNames: [],
      cardId,
      announcement: rule.announcementTemplate([], singerName),
    };
  }

  // Filter out the singer, shuffle, take required count
  const eligible = connections.filter(c => c.userId !== singerId);
  const shuffled = shuffle(eligible);
  const selected = shuffled.slice(0, rule.selectCount);

  const selectedUserIds = selected.map(c => c.userId);
  const selectedDisplayNames = selected.map(c => c.displayName);

  return {
    selectedUserIds,
    selectedDisplayNames,
    cardId,
    announcement: rule.announcementTemplate(selectedDisplayNames, singerName),
  };
}
