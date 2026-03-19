import { AwardTone } from './award-generator.js';
import type { SessionEvent } from './event-stream.js';

// --- Finale Award Category ---

export const FinaleAwardCategory = {
  performer: 'performer',
  hypeLeader: 'hypeLeader',
  socialButterfly: 'socialButterfly',
  crowdFavorite: 'crowdFavorite',
  partyStarter: 'partyStarter',
  vibeKeeper: 'vibeKeeper',
  everyone: 'everyone',
} as const;
export type FinaleAwardCategory = (typeof FinaleAwardCategory)[keyof typeof FinaleAwardCategory];

// --- Category priority for ordering (lower = higher priority) ---

const CATEGORY_PRIORITY: Record<FinaleAwardCategory, number> = {
  performer: 0,
  hypeLeader: 1,
  socialButterfly: 2,
  crowdFavorite: 3,
  partyStarter: 4,
  vibeKeeper: 5,
  everyone: 6,
};

// --- Interfaces ---

export interface SessionAnalysis {
  userId: string;
  displayName: string;
  participationScore: number;
  reactionsSent: number;
  reactionsReceived: number;
  songsPerformed: number;
  cardsAccepted: number;
  cardsCompleted: number;
  streakMax: number;
  soundboardUses: number;
  votesParticipated: number;
  distinctActionCategories: number;
  perSongAwards: string[];
}

export interface FinaleAward {
  userId: string;
  displayName: string;
  category: FinaleAwardCategory;
  title: string;
  tone: AwardTone;
  reason: string;
}

// --- Finale Award Template Pool (minimum 35) ---

export interface FinaleAwardTemplate {
  title: string;
  tone: AwardTone;
  category: FinaleAwardCategory;
  /** Score-based routing for everyone category: high = impressive, low = character celebration */
  prestige?: 'high' | 'low';
}

export const FINALE_AWARD_TEMPLATES: FinaleAwardTemplate[] = [
  // Performer (6)
  { title: "Tonight's Headliner", tone: AwardTone.hype, category: FinaleAwardCategory.performer },
  { title: 'One-Hit Wonder', tone: AwardTone.comedic, category: FinaleAwardCategory.performer },
  { title: 'Encore Demanded', tone: AwardTone.hype, category: FinaleAwardCategory.performer },
  { title: 'Mic Drop Specialist', tone: AwardTone.absurd, category: FinaleAwardCategory.performer },
  { title: 'Voice of the Night', tone: AwardTone.wholesome, category: FinaleAwardCategory.performer },
  { title: 'Setlist Dominator', tone: AwardTone.hype, category: FinaleAwardCategory.performer },

  // Hype Leader (5)
  { title: 'Reaction Machine', tone: AwardTone.hype, category: FinaleAwardCategory.hypeLeader },
  { title: 'Emoji Overload', tone: AwardTone.comedic, category: FinaleAwardCategory.hypeLeader },
  { title: 'Chief Hype Officer', tone: AwardTone.hype, category: FinaleAwardCategory.hypeLeader },
  { title: 'The Energy Source', tone: AwardTone.wholesome, category: FinaleAwardCategory.hypeLeader },
  { title: 'Reaction Tornado', tone: AwardTone.absurd, category: FinaleAwardCategory.hypeLeader },

  // Social Butterfly (4)
  { title: 'Dare Accepted', tone: AwardTone.hype, category: FinaleAwardCategory.socialButterfly },
  { title: 'Challenge Champion', tone: AwardTone.hype, category: FinaleAwardCategory.socialButterfly },
  { title: 'Card Shark', tone: AwardTone.comedic, category: FinaleAwardCategory.socialButterfly },
  { title: 'Never Backs Down', tone: AwardTone.absurd, category: FinaleAwardCategory.socialButterfly },

  // Crowd Favorite (4)
  { title: 'Crowd Whisperer', tone: AwardTone.hype, category: FinaleAwardCategory.crowdFavorite },
  { title: 'Fan Favorite', tone: AwardTone.wholesome, category: FinaleAwardCategory.crowdFavorite },
  { title: 'The People Chose You', tone: AwardTone.absurd, category: FinaleAwardCategory.crowdFavorite },
  { title: 'Most Cheered', tone: AwardTone.wholesome, category: FinaleAwardCategory.crowdFavorite },

  // Party Starter (4)
  { title: 'Party Engine', tone: AwardTone.hype, category: FinaleAwardCategory.partyStarter },
  { title: 'The First Spark', tone: AwardTone.wholesome, category: FinaleAwardCategory.partyStarter },
  { title: 'Participation Legend', tone: AwardTone.comedic, category: FinaleAwardCategory.partyStarter },
  { title: 'All-In Every Time', tone: AwardTone.hype, category: FinaleAwardCategory.partyStarter },

  // Vibe Keeper (4)
  { title: 'Vibe Architect', tone: AwardTone.hype, category: FinaleAwardCategory.vibeKeeper },
  { title: 'Jack of All Vibes', tone: AwardTone.comedic, category: FinaleAwardCategory.vibeKeeper },
  { title: 'The Versatile One', tone: AwardTone.wholesome, category: FinaleAwardCategory.vibeKeeper },
  { title: 'Swiss Army Party Guest', tone: AwardTone.absurd, category: FinaleAwardCategory.vibeKeeper },

  // Everyone — character-trait (8) with prestige routing:
  //   high = impressive titles for >= 75th percentile participation score
  //   low  = character celebrations for < 25th percentile
  //   (untagged = usable for any percentile)
  { title: 'Enigmatic Presence', tone: AwardTone.wholesome, category: FinaleAwardCategory.everyone, prestige: 'low' },
  { title: 'The Cool Observer', tone: AwardTone.hype, category: FinaleAwardCategory.everyone, prestige: 'high' },
  { title: 'Most Mysterious Energy', tone: AwardTone.absurd, category: FinaleAwardCategory.everyone, prestige: 'low' },
  { title: 'Silent Force', tone: AwardTone.hype, category: FinaleAwardCategory.everyone, prestige: 'high' },
  { title: 'The Anchor', tone: AwardTone.wholesome, category: FinaleAwardCategory.everyone },
  { title: 'Hype Lord', tone: AwardTone.hype, category: FinaleAwardCategory.everyone, prestige: 'high' },
  { title: 'The Zen Master', tone: AwardTone.wholesome, category: FinaleAwardCategory.everyone, prestige: 'low' },
  { title: 'Cosmic Presence', tone: AwardTone.absurd, category: FinaleAwardCategory.everyone, prestige: 'low' },
];

// --- Session Analysis ---

/** Distinct action category buckets for vibeKeeper */
function countDistinctActionCategories(events: SessionEvent[], userId: string): number {
  const categories = new Set<string>();
  for (const e of events) {
    if (!('userId' in e) || e.userId !== userId) continue;
    switch (e.type) {
      case 'reaction:sent':
        categories.add('reactions');
        break;
      case 'sound:play':
        categories.add('soundboard');
        break;
      case 'interlude:vote':
      case 'interlude:quickVoteCast':
      case 'icebreaker:vote':
      case 'quickpick:vote':
        categories.add('voting');
        break;
      case 'card:accepted':
        categories.add('cards');
        break;
      case 'capture:started':
      case 'capture:complete':
        categories.add('captures');
        break;
    }
  }
  return categories.size;
}

export function analyzeSessionForAwards(
  events: SessionEvent[],
  participantEntries: Array<{ userId: string; displayName: string; participationScore: number }>,
  perSongAwardsMap: Map<string, string[]>,
): SessionAnalysis[] {
  // Build per-user stats from event stream
  const statsMap = new Map<string, {
    reactionsSent: number;
    reactionsReceived: number;
    songsPerformed: number;
    cardsAccepted: number;
    cardsCompleted: number;
    streakMax: number;
    soundboardUses: number;
    votesParticipated: number;
  }>();

  const getStats = (userId: string) => {
    let s = statsMap.get(userId);
    if (!s) {
      s = {
        reactionsSent: 0,
        reactionsReceived: 0,
        songsPerformed: 0,
        cardsAccepted: 0,
        cardsCompleted: 0,
        streakMax: 0,
        soundboardUses: 0,
        votesParticipated: 0,
      };
      statsMap.set(userId, s);
    }
    return s;
  };

  // Track performers who received reactions (via ceremony:awardGenerated which ties performers to songs)
  const performerUserIds = new Set<string>();

  for (const e of events) {
    switch (e.type) {
      case 'reaction:sent': {
        const s = getStats(e.userId);
        s.reactionsSent++;
        s.streakMax = Math.max(s.streakMax, e.data.streak);
        break;
      }
      case 'ceremony:awardGenerated': {
        const s = getStats(e.userId);
        s.songsPerformed++;
        s.reactionsReceived += e.data.contextFactors.reactionCount;
        performerUserIds.add(e.userId);
        break;
      }
      case 'sound:play': {
        getStats(e.userId).soundboardUses++;
        break;
      }
      case 'card:accepted': {
        getStats(e.userId).cardsAccepted++;
        break;
      }
      case 'interlude:vote':
      case 'interlude:quickVoteCast':
      case 'icebreaker:vote':
      case 'quickpick:vote': {
        getStats(e.userId).votesParticipated++;
        break;
      }
    }
  }

  // If no ceremony:awardGenerated events, fall back to counting dj:stateChanged to song for performers
  // and reaction:sent for reactionsReceived (attribute to all performers)
  if (performerUserIds.size === 0) {
    // Count performers from per-song awards map
    for (const [userId] of perSongAwardsMap) {
      performerUserIds.add(userId);
      const s = getStats(userId);
      if (s.songsPerformed === 0) s.songsPerformed = 1;
    }
  }

  return participantEntries.map(p => {
    const s = statsMap.get(p.userId);
    return {
      userId: p.userId,
      displayName: p.displayName,
      participationScore: p.participationScore,
      reactionsSent: s?.reactionsSent ?? 0,
      reactionsReceived: s?.reactionsReceived ?? 0,
      songsPerformed: s?.songsPerformed ?? 0,
      cardsAccepted: s?.cardsAccepted ?? 0,
      cardsCompleted: s?.cardsAccepted ?? 0, // inferred from accepted
      streakMax: s?.streakMax ?? 0,
      soundboardUses: s?.soundboardUses ?? 0,
      votesParticipated: s?.votesParticipated ?? 0,
      distinctActionCategories: countDistinctActionCategories(events, p.userId),
      perSongAwards: perSongAwardsMap.get(p.userId) ?? [],
    };
  });
}

// --- Award Generation ---

const MAX_REASON_LENGTH = 60;

function truncateReason(reason: string): string {
  return reason.length > MAX_REASON_LENGTH ? reason.slice(0, MAX_REASON_LENGTH - 1) + '…' : reason;
}

function buildReason(category: FinaleAwardCategory, analysis: SessionAnalysis): string {
  switch (category) {
    case FinaleAwardCategory.performer:
      return truncateReason(
        analysis.songsPerformed === 1
          ? 'Performed 1 song tonight'
          : `Performed ${analysis.songsPerformed} songs tonight`,
      );
    case FinaleAwardCategory.hypeLeader:
      return truncateReason(`Sent ${analysis.reactionsSent} reactions tonight`);
    case FinaleAwardCategory.socialButterfly:
      return truncateReason(`Accepted ${analysis.cardsAccepted} challenges`);
    case FinaleAwardCategory.crowdFavorite:
      return truncateReason(`Received ${analysis.reactionsReceived} reactions`);
    case FinaleAwardCategory.partyStarter:
      return truncateReason(`${analysis.participationScore} participation points`);
    case FinaleAwardCategory.vibeKeeper:
      return truncateReason(
        `Active across ${analysis.distinctActionCategories} activity types`,
      );
    case FinaleAwardCategory.everyone: {
      // Data-driven reason based on participant's top activity
      if (analysis.reactionsSent > 0)
        return truncateReason(`Sent ${analysis.reactionsSent} reactions tonight`);
      if (analysis.votesParticipated > 0)
        return truncateReason(`Voted ${analysis.votesParticipated} times tonight`);
      if (analysis.soundboardUses > 0)
        return truncateReason(`Played ${analysis.soundboardUses} sound effects`);
      if (analysis.cardsAccepted > 0)
        return truncateReason(`Accepted ${analysis.cardsAccepted} challenges`);
      return truncateReason('Part of the crew from the start');
    }
  }
}

export function generateFinaleAwards(
  analyses: SessionAnalysis[],
  _participantCount: number,
  randomFn: () => number = Math.random,
): FinaleAward[] {
  const awards: FinaleAward[] = [];
  const usedTitles = new Set<string>();
  const userAwards = new Map<string, FinaleAward[]>(); // userId -> awards

  // usedTitles tracks session-wide finale dedup only (no two participants get same finale title)
  // Per-song dedup is per-user scope — handled in assignAward via analysis.perSongAwards

  const getTemplatesForCategory = (cat: FinaleAwardCategory) =>
    FINALE_AWARD_TEMPLATES.filter(t => t.category === cat);

  const assignAward = (userId: string, displayName: string, category: FinaleAwardCategory, analysis: SessionAnalysis, preferredPrestige?: 'high' | 'low') => {
    const templates = getTemplatesForCategory(category);
    // Session-wide finale dedup + per-user per-song dedup
    const userExistingTitles = new Set([
      ...usedTitles,
      ...(userAwards.get(userId) ?? []).map(a => a.title),
      ...analysis.perSongAwards,
    ]);

    let available = templates.filter(t => !userExistingTitles.has(t.title));

    // Score-based prestige routing for everyone category (M1)
    if (preferredPrestige && available.length > 0) {
      const prestigeFiltered = available.filter(t => t.prestige === preferredPrestige || !t.prestige);
      if (prestigeFiltered.length > 0) available = prestigeFiltered;
    }

    if (available.length === 0) {
      // Fall back to everyone templates
      const everyoneTemplates = getTemplatesForCategory(FinaleAwardCategory.everyone)
        .filter(t => !userExistingTitles.has(t.title));
      if (everyoneTemplates.length === 0) return; // truly exhausted
      const t = selectFromPool(everyoneTemplates, randomFn);
      if (!t) return;
      addAward(userId, displayName, FinaleAwardCategory.everyone, t, analysis);
      return;
    }

    const t = selectFromPool(available, randomFn);
    if (!t) return;
    addAward(userId, displayName, category, t, analysis);
  };

  const selectFromPool = (pool: FinaleAwardTemplate[], rng: () => number): FinaleAwardTemplate | null => {
    if (pool.length === 0) return null;
    const index = Math.min(Math.floor(rng() * pool.length), pool.length - 1);
    return pool[index]!;
  };

  const addAward = (userId: string, displayName: string, category: FinaleAwardCategory, template: FinaleAwardTemplate, analysis: SessionAnalysis) => {
    const award: FinaleAward = {
      userId,
      displayName,
      category,
      title: template.title,
      tone: template.tone,
      reason: buildReason(category, analysis),
    };
    awards.push(award);
    usedTitles.add(template.title);
    const existing = userAwards.get(userId) ?? [];
    existing.push(award);
    userAwards.set(userId, existing);
  };

  // --- Step 1: Category-specific awards to top performers ---

  // Helper to find top user for a metric
  const findTop = (metric: (a: SessionAnalysis) => number, minValue: number = 1): SessionAnalysis | null => {
    let best: SessionAnalysis | null = null;
    let bestVal = minValue - 1;
    for (const a of analyses) {
      const val = metric(a);
      if (val > bestVal) {
        bestVal = val;
        best = a;
      } else if (val === bestVal && best && a.participationScore > best.participationScore) {
        best = a;
      }
    }
    return best;
  };

  // hypeLeader — highest reactionsSent
  const topHype = findTop(a => a.reactionsSent);
  if (topHype) {
    assignAward(topHype.userId, topHype.displayName, FinaleAwardCategory.hypeLeader, topHype);
  }

  // socialButterfly — most cardsAccepted (skip if zero cards dealt in session)
  const totalCardsAccepted = analyses.reduce((sum, a) => sum + a.cardsAccepted, 0);
  if (totalCardsAccepted > 0) {
    const topSocial = findTop(a => a.cardsAccepted);
    if (topSocial) {
      assignAward(topSocial.userId, topSocial.displayName, FinaleAwardCategory.socialButterfly, topSocial);
    }
  }

  // crowdFavorite — most reactionsReceived
  // AC #7: when only 1 person sang, crowdFavorite goes to the sole performer
  const singers = analyses.filter(a => a.songsPerformed > 0);
  const topCrowd = singers.length === 1
    ? singers[0]!
    : findTop(a => a.reactionsReceived);
  if (topCrowd) {
    assignAward(topCrowd.userId, topCrowd.displayName, FinaleAwardCategory.crowdFavorite, topCrowd);
  }

  // partyStarter — highest participationScore
  const topParty = findTop(a => a.participationScore);
  if (topParty) {
    assignAward(topParty.userId, topParty.displayName, FinaleAwardCategory.partyStarter, topParty);
  }

  // vibeKeeper — highest distinctActionCategories
  const topVibe = findTop(a => a.distinctActionCategories, 2); // need at least 2 distinct categories
  if (topVibe) {
    assignAward(topVibe.userId, topVibe.displayName, FinaleAwardCategory.vibeKeeper, topVibe);
  }

  // --- Step 2: Performer awards for anyone who sang ---
  for (const a of analyses) {
    if (a.songsPerformed > 0) {
      assignAward(a.userId, a.displayName, FinaleAwardCategory.performer, a);
    }
  }

  // --- Step 3: Character-trait awards for anyone not yet awarded ---
  // Calculate percentiles for score-based prestige routing
  const sortedScores = analyses.map(a => a.participationScore).sort((a, b) => a - b);
  const p25 = sortedScores[Math.floor(sortedScores.length * 0.25)] ?? 0;
  const p75 = sortedScores[Math.floor(sortedScores.length * 0.75)] ?? 0;

  for (const a of analyses) {
    if (userAwards.has(a.userId)) continue; // already has award

    // Score-based prestige: high scorers get impressive titles, low get character celebrations
    const prestige: 'high' | 'low' | undefined =
      a.participationScore >= p75 && p75 > p25 ? 'high' :
      a.participationScore < p25 && p25 > 0 ? 'low' :
      undefined;

    assignAward(a.userId, a.displayName, FinaleAwardCategory.everyone, a, prestige);
  }

  // --- Step 4: Guarantee every participant has at least 1 award ---
  for (const a of analyses) {
    if (!userAwards.has(a.userId) || (userAwards.get(a.userId)?.length ?? 0) === 0) {
      assignAward(a.userId, a.displayName, FinaleAwardCategory.everyone, a);
    }
  }

  // --- Sort by category priority, then participation score descending ---
  awards.sort((a, b) => {
    const catDiff = CATEGORY_PRIORITY[a.category] - CATEGORY_PRIORITY[b.category];
    if (catDiff !== 0) return catDiff;
    // Within same category, sort by participation score descending
    const aAnalysis = analyses.find(x => x.userId === a.userId);
    const bAnalysis = analyses.find(x => x.userId === b.userId);
    return (bAnalysis?.participationScore ?? 0) - (aAnalysis?.participationScore ?? 0);
  });

  return awards;
}
