import { generateUniquePartyCode } from '../services/party-code.js';
import * as sessionRepo from '../persistence/session-repository.js';
import { DEFAULT_VIBE } from '../shared/constants.js';
import { createAppError } from '../shared/errors.js';
import { createDJContext, processTransition } from '../dj-engine/machine.js';
import { deserializeDJContext, serializeDJContext } from '../dj-engine/serializer.js';
import { calculateRemainingMs } from '../dj-engine/timers.js';
import type { DJContext, DJTransition, DJSideEffect } from '../dj-engine/types.js';
import { getSessionDjState, setSessionDjState, removeSessionDjState } from '../services/dj-state-store.js';
import { scheduleSessionTimer, cancelSessionTimer, pauseSessionTimer, resumeSessionTimer } from '../services/timer-scheduler.js';
import { broadcastDjState, broadcastDjPause, broadcastDjResume, broadcastCeremonyAnticipation, broadcastCeremonyReveal, broadcastCeremonyQuick, broadcastCardDealt, getIO } from '../services/dj-broadcaster.js';
import { EVENTS } from '../shared/events.js';
import { dealCard, clearDealtCards } from '../services/card-dealer.js';
import { getActiveConnections, removeSession } from '../services/connection-tracker.js';
import { clearSessionTimers } from '../socket-handlers/connection-handler.js';
import { clearFeedbackTracking } from '../socket-handlers/finale-handlers.js';
import type { TrackedConnection } from '../services/connection-tracker.js';
import { removeSession as removeActivitySession } from '../services/activity-tracker.js';
import { DJState } from '../dj-engine/types.js';
import { appendEvent, flushEventStream, getEventStream, type SessionEvent } from '../services/event-stream.js';
import { calculateScoreIncrement, ACTION_TIER_MAP } from '../services/participation-scoring.js';
import { generateAward, AWARD_TEMPLATES, AwardTone, type AwardContext } from '../services/award-generator.js';
import { clearSessionStreaks } from '../services/streak-tracker.js';
import { clearSession as clearPeakDetectorState } from '../services/peak-detector.js';
import {
  selectActivityOptions,
  startVoteRound as startActivityVoteRound,
  resolveByTimeout as resolveActivityByTimeout,
  getVoteCounts as getActivityVoteCounts,
  clearSession as clearActivityVoterState,
} from '../services/activity-voter.js';
import type { ActivityOption } from '../services/activity-voter.js';
import { clearPool, markSongSung } from '../services/song-pool.js';
import { detectSong } from '../services/song-detection.js';
import { startRound, getRound, resolveByTimeout, clearRound } from '../services/quick-pick.js';
import { computeSuggestions } from '../services/suggestion-engine.js';
import { shouldEmitCaptureBubble, markBubbleEmitted, clearCaptureTriggerState, type CaptureTriggerType } from '../services/capture-trigger.js';
import { broadcastQuickPickStarted, broadcastSpinWheelStarted, broadcastSpinWheelResult, broadcastModeChanged, broadcastInterludeVoteStarted, broadcastInterludeVoteResult, broadcastInterludeGameStarted, broadcastInterludeGameEnded, broadcastQuickVoteResult, broadcastIcebreakerStarted, broadcastIcebreakerResult, broadcastFinaleAwards, broadcastFinaleStats, broadcastFinaleSetlist } from '../services/dj-broadcaster.js';
import { sessionSummarySchema, type SessionStats, type SetlistEntry } from '../shared/schemas/finale-schemas.js';
import { dealCard as dealKingsCupCard, clearSession as clearKingsCupSession } from '../services/kings-cup-dealer.js';
import { dealDare, selectTarget, clearSession as clearDarePullSession } from '../services/dare-pull-dealer.js';
import { dealQuestion, startQuickVoteRound, resolveQuickVote, clearSession as clearQuickVoteSession } from '../services/quick-vote-dealer.js';
import { dealPrompt as dealSingAlongPrompt, clearSession as clearSingAlongSession } from '../services/singalong-dealer.js';
import { dealQuestion as dealIcebreakerQuestion, startIcebreakerRound, resolveIcebreaker, clearSession as clearIcebreakerSession } from '../services/icebreaker-dealer.js';
import { analyzeSessionForAwards, generateFinaleAwards, type FinaleAward } from '../services/finale-award-generator.js';
import { buildSessionSummary } from '../services/session-summary-builder.js';
import { withRetry } from '../services/retry.js';
import { writeSessionSummaryToDisk } from '../services/session-summary-fallback.js';
import type { QuickPickSong } from '../services/quick-pick.js';
import {
  startRound as startSpinWheelRound,
  initiateSpin as initiateSpinWheelSpin,
  onSpinComplete,
  startVetoWindow,
  handleVeto as handleSpinWheelVeto,
  resolveRound,
  autoSpin,
  getRound as getSpinWheelRound,
  clearRound as clearSpinWheelRound,
} from '../services/spin-wheel.js';
import type { SpinWheelSegment } from '../services/spin-wheel.js';
import type { TvIntegration, NowPlayingEvent, TvConnectionStatus, CreateTvIntegration } from '../integrations/tv-integration.js';
import { createLoungeApiClient } from '../integrations/lounge-api.js';

// TV connection tracking
let tvFactory: CreateTvIntegration = createLoungeApiClient;
const tvConnections = new Map<string, TvIntegration>();

export function setTvFactory(f: CreateTvIntegration): void {
  tvFactory = f;
}

export function getTvConnection(sessionId: string): TvIntegration | undefined {
  return tvConnections.get(sessionId);
}

export function isTvPaired(sessionId: string): boolean {
  return tvConnections.get(sessionId)?.isConnected() ?? false;
}

export async function pairTv(sessionId: string, pairingCode: string): Promise<void> {
  const existing = tvConnections.get(sessionId);
  if (existing) {
    await existing.disconnect();
    tvConnections.delete(sessionId);
  }

  const tv = tvFactory();

  tv.onNowPlaying((event: NowPlayingEvent) => {
    const io = getIO();
    if (!io) return;

    // Always emit raw nowPlaying immediately (for TV status display)
    io.to(sessionId).emit(EVENTS.TV_NOW_PLAYING, {
      videoId: event.videoId,
      title: event.title,
      state: event.state,
    });

    // Skip metadata resolution for non-playing states
    if (event.state !== 'playing') return;

    // Resolve metadata asynchronously (fire-and-forget with emit on success)
    detectSong(event.videoId)
      .then((detected) => {
        if (detected) {
          io.to(sessionId).emit(EVENTS.SONG_DETECTED, {
            videoId: detected.videoId,
            songTitle: detected.songTitle,
            artist: detected.artist,
            channel: detected.channel,
            thumbnail: detected.thumbnail,
            source: detected.source,
          });
          appendEvent(sessionId, {
            type: 'song:detected',
            ts: Date.now(),
            data: {
              videoId: detected.videoId,
              title: detected.songTitle,
              artist: detected.artist,
            },
          });

          // Mark song as sung in pool for suggestion engine deduplication
          markSongSung(sessionId, detected.songTitle, detected.artist);
        }
      })
      .catch((err) => {
        console.error('[session-manager] Song detection failed:', err);
        // Emit minimal detection so UI still updates
        io.to(sessionId).emit(EVENTS.SONG_DETECTED, {
          videoId: event.videoId,
          songTitle: event.title ?? 'Unknown',
          artist: null,
          channel: null,
          thumbnail: null,
          source: 'api-raw',
        });
      });
  });

  tv.onStatusChange((status: TvConnectionStatus) => {
    const io = getIO();
    if (!io) return;

    if (status === 'disconnected') {
      tvConnections.delete(sessionId);
      // Graceful degradation notification with degraded flag
      io.to(sessionId).emit(EVENTS.TV_STATUS, {
        status,
        degraded: true,
        message: 'TV disconnected. Continuing in suggestion-only mode.',
      });
    } else {
      io.to(sessionId).emit(EVENTS.TV_STATUS, { status });
    }
  });

  await tv.connect(pairingCode);
  tvConnections.set(sessionId, tv);
}

export async function unpairTv(sessionId: string): Promise<void> {
  const tv = tvConnections.get(sessionId);
  if (tv) {
    await tv.disconnect();
    tvConnections.delete(sessionId);
  }
}

export function resetAllTvConnections(): void {
  tvConnections.clear();
}

// Song selection mode tracking — default: quickPick
type SongSelectionMode = 'quickPick' | 'spinWheel';
const sessionModes = new Map<string, SongSelectionMode>();

export function getSongSelectionMode(sessionId: string): SongSelectionMode {
  return sessionModes.get(sessionId) ?? 'quickPick';
}

export function setSongSelectionMode(sessionId: string, mode: SongSelectionMode): void {
  sessionModes.set(sessionId, mode);
}

export function resetAllModes(): void {
  sessionModes.clear();
}

// In-memory card stats per session — tracks dealt/accepted counts (AC #6)
const cardStatsCache = new Map<string, { dealt: number; accepted: number }>();

export function getCardStats(sessionId: string): { dealt: number; accepted: number } {
  return cardStatsCache.get(sessionId) ?? { dealt: 0, accepted: 0 };
}

export function incrementCardDealt(sessionId: string): void {
  const stats = cardStatsCache.get(sessionId) ?? { dealt: 0, accepted: 0 };
  stats.dealt++;
  cardStatsCache.set(sessionId, stats);
}

export function incrementCardAccepted(sessionId: string): void {
  const stats = cardStatsCache.get(sessionId) ?? { dealt: 0, accepted: 0 };
  stats.accepted++;
  cardStatsCache.set(sessionId, stats);
}

export function clearCardStats(sessionId: string): void {
  cardStatsCache.delete(sessionId);
}

// In-memory score cache — avoids DB read race condition with fire-and-forget writes
const scoreCache = new Map<string, number>();

function getScoreCacheKey(sessionId: string, userId: string): string {
  return `${sessionId}:${userId}`;
}

export function clearScoreCache(sessionId?: string): void {
  if (sessionId) {
    for (const key of scoreCache.keys()) {
      if (key.startsWith(`${sessionId}:`)) {
        scoreCache.delete(key);
      }
    }
  } else {
    scoreCache.clear();
  }
}

// In-memory tracking of awards given per session (for dedup)
const sessionAwards = new Map<string, string[]>();

export function clearSessionAwards(sessionId: string): void {
  sessionAwards.delete(sessionId);
}

// In-memory cache for finale awards — persists until session cleanup for Story 8.2
const finaleAwardsCache = new Map<string, FinaleAward[]>();

export function getFinaleAwards(sessionId: string): FinaleAward[] | undefined {
  return finaleAwardsCache.get(sessionId);
}

export function clearFinaleAwards(sessionId: string): void {
  finaleAwardsCache.delete(sessionId);
}

// Finalization timer tracking — delays party:ended emission to allow finale experience
const finalizationTimers = new Map<string, NodeJS.Timeout>();
const FINALE_DURATION_MS = 5 * 60 * 1000; // 5 minutes — generous buffer for 60-90s sequence + browsing + feedback

function clearFinalizationTimer(sessionId: string): void {
  const timer = finalizationTimers.get(sessionId);
  if (timer) {
    clearTimeout(timer);
    finalizationTimers.delete(sessionId);
  }
}

const ANTICIPATION_DURATION_MS = 2000;
const QUICK_CEREMONY_DURATION_MS = 10_000; // 10s display then auto-advance
const DEFAULT_AWARD = 'Star of the Show';
const DEFAULT_AWARD_TONE = 'hype';

// Track scheduled ceremony reveals for cleanup
const ceremonyRevealTimers = new Map<string, NodeJS.Timeout>();

export function clearCeremonyTimers(sessionId: string): void {
  const timer = ceremonyRevealTimers.get(sessionId);
  if (timer) {
    clearTimeout(timer);
    ceremonyRevealTimers.delete(sessionId);
  }
}

async function orchestrateFullCeremony(
  sessionId: string,
  context: DJContext,
): Promise<void> {
  const performerName = context.currentPerformer;
  const songTitle = context.currentSongTitle;

  // Compute synchronized reveal timestamp BEFORE any async work
  // so that async latency doesn't shorten the anticipation phase
  const revealAt = Date.now() + ANTICIPATION_DURATION_MS;

  // Performer tracking not implemented until Epic 5 — always empty for now
  const performerUserId = '';
  const awardResult = performerUserId
    ? await generateCeremonyAward(sessionId, performerUserId, 'full')
    : null;

  // Phase 1: Broadcast anticipation to all clients
  broadcastCeremonyAnticipation(sessionId, {
    performerName,
    revealAt,
  });

  // Phase 2: Schedule reveal broadcast at revealAt
  const revealTimer = setTimeout(() => {
    ceremonyRevealTimers.delete(sessionId);
    const award = awardResult?.award ?? DEFAULT_AWARD;
    const tone = awardResult?.tone ?? DEFAULT_AWARD_TONE;

    broadcastCeremonyReveal(sessionId, {
      award,
      performerName,
      tone,
      songTitle,
    });

    // Log ceremony reveal to event stream
    appendEvent(sessionId, {
      type: 'ceremony:revealed',
      ts: Date.now(),
      data: {
        award,
        performerName,
        ceremonyType: 'full' as const,
        songTitle,
      },
    });

    // Capture bubble after reveal (short delay for dramatic effect)
    setTimeout(() => {
      const ctx = getSessionDjState(sessionId);
      emitCaptureBubble(sessionId, 'post_ceremony', ctx?.state);
    }, 3000);
  }, ANTICIPATION_DURATION_MS);

  ceremonyRevealTimers.set(sessionId, revealTimer);
}

async function orchestrateQuickCeremony(
  sessionId: string,
  context: DJContext,
): Promise<void> {
  const performerName = context.currentPerformer;

  // Performer tracking not implemented until Epic 5 — always empty for now
  const performerUserId = '';
  const awardResult = performerUserId
    ? await generateCeremonyAward(sessionId, performerUserId, 'quick')
    : null;

  const award = awardResult?.award ?? DEFAULT_AWARD;
  const tone = awardResult?.tone ?? DEFAULT_AWARD_TONE;

  // Broadcast quick ceremony immediately — no anticipation phase
  broadcastCeremonyQuick(sessionId, {
    award,
    performerName,
    tone,
  });

  // Log ceremony reveal to event stream
  appendEvent(sessionId, {
    type: 'ceremony:revealed',
    ts: Date.now(),
    data: {
      award,
      performerName,
      ceremonyType: 'quick' as const,
      songTitle: context.currentSongTitle,
    },
  });

  // Capture bubble after quick ceremony (short delay for dramatic effect)
  setTimeout(() => {
    const ctx = getSessionDjState(sessionId);
    emitCaptureBubble(sessionId, 'post_ceremony', ctx?.state);
  }, 3000);

  // Schedule auto-advance after display duration
  // Follows handleRecoveryTimeout pattern: retrieve current context, guard state, try-catch
  const advanceTimer = setTimeout(async () => {
    ceremonyRevealTimers.delete(sessionId);
    const currentContext = getSessionDjState(sessionId);
    if (!currentContext || currentContext.state !== DJState.ceremony) return;
    try {
      await processDjTransition(sessionId, currentContext, { type: 'CEREMONY_DONE' });
    } catch {
      // Already transitioned (e.g., HOST_SKIP raced) — safe to ignore
    }
  }, QUICK_CEREMONY_DURATION_MS);

  ceremonyRevealTimers.set(sessionId, advanceTimer);
}

// Track scheduled interlude reveal timers for cleanup
const interludeRevealTimers = new Map<string, NodeJS.Timeout>();

// Track scheduled interlude game timers for cleanup
const interludeGameTimers = new Map<string, NodeJS.Timeout>();

const INTERLUDE_GAME_DURATION_MS = 10_000; // 10s card display
const DARE_PULL_GAME_DURATION_MS = 15_000; // 15s dare timer
const QUICK_VOTE_VOTING_DURATION_MS = 6_000; // 6s hard voting window
const QUICK_VOTE_REVEAL_DURATION_MS = 5_000; // 5s results display
const SINGALONG_GAME_DURATION_MS = 30_000; // 30s — needs to be long enough for group to actually sing together; tunable

function clearInterludeTimers(sessionId: string): void {
  const revealTimer = interludeRevealTimers.get(sessionId);
  if (revealTimer) {
    clearTimeout(revealTimer);
    interludeRevealTimers.delete(sessionId);
  }
  const gameTimer = interludeGameTimers.get(sessionId);
  if (gameTimer) {
    clearTimeout(gameTimer);
    interludeGameTimers.delete(sessionId);
  }
}

const INTERLUDE_REVEAL_DELAY_MS = 5_000; // 5s result reveal before advancing

// Icebreaker reveal timers
const icebreakerRevealTimers = new Map<string, NodeJS.Timeout>();
const ICEBREAKER_REVEAL_DELAY_MS = 5_000; // 5s result reveal before advancing to songSelection

function clearIcebreakerTimers(sessionId: string): void {
  const revealTimer = icebreakerRevealTimers.get(sessionId);
  if (revealTimer) {
    clearTimeout(revealTimer);
    icebreakerRevealTimers.delete(sessionId);
  }
}

/**
 * Called when DJ engine enters icebreaker state.
 * Orchestrates: deal question → start round → broadcast.
 */
function onIcebreakerStateEntered(sessionId: string, context: DJContext): void {
  const question = dealIcebreakerQuestion();
  startIcebreakerRound(sessionId, question.id, question.options.map(o => o.id));

  broadcastIcebreakerStarted(sessionId, {
    question: question.question,
    options: question.options.map(o => ({ id: o.id, label: o.label, emoji: o.emoji })),
    voteDurationMs: context.timerDurationMs ?? 6_000,
  });

  appendEvent(sessionId, {
    type: 'icebreaker:started',
    ts: Date.now(),
    data: { questionId: question.id },
  });
}

/**
 * Resolve icebreaker by timeout — called from handleRecoveryTimeout when DJ engine timer fires.
 */
function resolveIcebreakerTimeout(sessionId: string, context: DJContext): void {
  // Get active participant IDs so non-voters are assigned a random option (AC #3)
  const connections = getActiveConnections(sessionId);
  const participantIds = connections.map(c => c.userId);
  const result = resolveIcebreaker(sessionId, participantIds);
  if (!result) {
    void processDjTransition(sessionId, context, { type: 'ICEBREAKER_DONE' });
    return;
  }

  broadcastIcebreakerResult(sessionId, result);

  appendEvent(sessionId, {
    type: 'icebreaker:result',
    ts: Date.now(),
    data: result,
  });

  // Schedule reveal delay then advance to songSelection
  const revealTimer = setTimeout(() => {
    icebreakerRevealTimers.delete(sessionId);
    const currentContext = getSessionDjState(sessionId);
    if (!currentContext || currentContext.state !== DJState.icebreaker) return;
    void processDjTransition(sessionId, currentContext, { type: 'ICEBREAKER_DONE' });
  }, ICEBREAKER_REVEAL_DELAY_MS);

  icebreakerRevealTimers.set(sessionId, revealTimer);
}

/**
 * Called when DJ engine enters interlude state.
 * Orchestrates: select options → start vote round → broadcast → (timer handled by DJ engine).
 */
function onInterludeStateEntered(sessionId: string, context: DJContext): void {
  const sessionStartedAt = typeof context.metadata.sessionStartedAt === 'number'
    ? context.metadata.sessionStartedAt
    : Date.now();
  const interludeCount = typeof context.metadata.interludeCount === 'number'
    ? context.metadata.interludeCount
    : 0;

  const options = selectActivityOptions(
    sessionId,
    context.participantCount,
    sessionStartedAt,
    interludeCount,
  );

  if (options.length === 0) {
    // No eligible activities — skip interlude
    void processDjTransition(sessionId, context, { type: 'INTERLUDE_DONE' });
    return;
  }

  startActivityVoteRound(sessionId, options, context.participantCount, interludeCount);

  broadcastInterludeVoteStarted(sessionId, {
    options: options.map(o => ({ id: o.id, name: o.name, description: o.description, icon: o.icon })),
    voteDurationMs: context.timerDurationMs ?? 15_000,
    roundId: `${sessionId}-interlude-${Date.now()}`,
  });

  appendEvent(sessionId, {
    type: 'interlude:voteStarted',
    ts: Date.now(),
    data: { optionCount: options.length, participantCount: context.participantCount },
  });
}

/**
 * Shared finalization for interlude vote resolution (majority or timeout).
 * Broadcasts result, updates metadata, schedules reveal delay, then advances DJ state.
 */
function finalizeInterludeVote(
  sessionId: string,
  context: DJContext,
  winner: ActivityOption,
): void {
  const voteCounts = getActivityVoteCounts(sessionId);
  const totalVotes = Object.values(voteCounts).reduce((sum, c) => sum + c, 0);

  broadcastInterludeVoteResult(sessionId, {
    winningOptionId: winner.id,
    voteCounts,
    totalVotes,
  });

  appendEvent(sessionId, {
    type: 'interlude:voteResult',
    ts: Date.now(),
    data: { winningOptionId: winner.id, totalVotes },
  });

  // Write selectedActivity to context.metadata for Stories 7.2-7.6
  const updatedContext: DJContext = {
    ...context,
    metadata: {
      ...context.metadata,
      selectedActivity: winner.id,
    },
  };
  setSessionDjState(sessionId, updatedContext);

  // Schedule reveal delay then dispatch interlude game
  const revealTimer = setTimeout(() => {
    interludeRevealTimers.delete(sessionId);
    const currentContext = getSessionDjState(sessionId);
    if (!currentContext || currentContext.state !== DJState.interlude) return;
    const selectedActivity = typeof currentContext.metadata.selectedActivity === 'string'
      ? currentContext.metadata.selectedActivity
      : null;
    if (selectedActivity) {
      startInterludeGame(sessionId, selectedActivity, currentContext);
    } else {
      void processDjTransition(sessionId, currentContext, { type: 'INTERLUDE_DONE' });
    }
  }, INTERLUDE_REVEAL_DELAY_MS);

  interludeRevealTimers.set(sessionId, revealTimer);
}

/**
 * Called from interlude-handlers when majority winner is reached.
 * Resolves the vote early, broadcasts result, schedules reveal delay then INTERLUDE_DONE.
 */
export function handleInterludeVoteWinner(sessionId: string, winner: ActivityOption): void {
  const context = getSessionDjState(sessionId);
  if (!context || context.state !== DJState.interlude) return;

  // Cancel the DJ engine timer — we're resolving early
  cancelSessionTimer(sessionId);

  finalizeInterludeVote(sessionId, context, winner);
}

/**
 * Resolve interlude vote by timeout — called from handleRecoveryTimeout when DJ engine timer fires.
 */
function resolveInterludeTimeout(sessionId: string, context: DJContext): void {
  const winner = resolveActivityByTimeout(sessionId);
  if (!winner) {
    // No round or already resolved — just advance
    void processDjTransition(sessionId, context, { type: 'TIMEOUT' });
    return;
  }

  finalizeInterludeVote(sessionId, context, winner);
}

/**
 * Dispatch interlude game after vote reveal. Routes to specific game handler
 * or triggers INTERLUDE_DONE for unhandled activities.
 */
function startInterludeGame(sessionId: string, selectedActivity: string, context: DJContext): void {
  if (selectedActivity === 'kings_cup') {
    executeKingsCup(sessionId);
  } else if (selectedActivity === 'dare_pull') {
    const connections = getActiveConnections(sessionId);
    const target = selectTarget(sessionId, connections);
    if (target) {
      executeDarePull(sessionId, target);
    } else {
      void processDjTransition(sessionId, context, { type: 'INTERLUDE_DONE' });
    }
  } else if (selectedActivity === 'quick_vote') {
    executeQuickVote(sessionId);
  } else if (selectedActivity === 'group_singalong') {
    executeGroupSingAlong(sessionId);
  } else {
    void processDjTransition(sessionId, context, { type: 'INTERLUDE_DONE' });
  }
}

function executeKingsCup(sessionId: string): void {
  const card = dealKingsCupCard(sessionId);

  broadcastInterludeGameStarted(sessionId, {
    activityId: 'kings_cup',
    card,
    gameDurationMs: INTERLUDE_GAME_DURATION_MS,
  });

  appendEvent(sessionId, {
    type: 'interlude:gameStarted',
    ts: Date.now(),
    data: { activityId: 'kings_cup', cardId: card.id },
  });

  const gameTimer = setTimeout(() => {
    endInterludeGame(sessionId);
  }, INTERLUDE_GAME_DURATION_MS);

  interludeGameTimers.set(sessionId, gameTimer);
}

function executeDarePull(sessionId: string, target: TrackedConnection): void {
  const dare = dealDare(sessionId);

  broadcastInterludeGameStarted(sessionId, {
    activityId: 'dare_pull',
    card: { id: dare.id, title: dare.title, rule: dare.dare, emoji: dare.emoji },
    gameDurationMs: DARE_PULL_GAME_DURATION_MS,
    targetUserId: target.userId,
    targetDisplayName: target.displayName,
  });

  appendEvent(sessionId, {
    type: 'interlude:gameStarted',
    ts: Date.now(),
    data: { activityId: 'dare_pull', cardId: dare.id },
  });

  const gameTimer = setTimeout(() => {
    endInterludeGame(sessionId);
  }, DARE_PULL_GAME_DURATION_MS);

  interludeGameTimers.set(sessionId, gameTimer);
}

function executeQuickVote(sessionId: string): void {
  const question = dealQuestion(sessionId);
  startQuickVoteRound(sessionId, question.id);

  broadcastInterludeGameStarted(sessionId, {
    activityId: 'quick_vote',
    card: { id: question.id, title: question.question, rule: question.optionA + ' vs ' + question.optionB, emoji: question.emoji },
    gameDurationMs: QUICK_VOTE_VOTING_DURATION_MS,
    quickVoteOptions: [{ id: 'A', label: question.optionA }, { id: 'B', label: question.optionB }],
  });

  appendEvent(sessionId, {
    type: 'interlude:gameStarted',
    ts: Date.now(),
    data: { activityId: 'quick_vote', questionId: question.id },
  });

  const voteTimer = setTimeout(() => {
    resolveAndRevealQuickVote(sessionId);
  }, QUICK_VOTE_VOTING_DURATION_MS);

  interludeGameTimers.set(sessionId, voteTimer);
}

function executeGroupSingAlong(sessionId: string): void {
  const prompt = dealSingAlongPrompt(sessionId);

  broadcastInterludeGameStarted(sessionId, {
    activityId: 'group_singalong',
    // prompt.lyric maps to card.rule for InterludeGameCard reuse — Flutter overlay displays rule field as lyric text
    card: { id: prompt.id, title: prompt.title, rule: prompt.lyric, emoji: prompt.emoji },
    gameDurationMs: SINGALONG_GAME_DURATION_MS,
  });

  appendEvent(sessionId, {
    type: 'interlude:gameStarted',
    ts: Date.now(),
    data: { activityId: 'group_singalong', cardId: prompt.id },
  });

  const gameTimer = setTimeout(() => {
    endInterludeGame(sessionId);
  }, SINGALONG_GAME_DURATION_MS);

  interludeGameTimers.set(sessionId, gameTimer);
}

function resolveAndRevealQuickVote(sessionId: string): void {
  interludeGameTimers.delete(sessionId);

  const result = resolveQuickVote(sessionId);
  if (!result) {
    endInterludeGame(sessionId);
    return;
  }

  broadcastQuickVoteResult(sessionId, result);

  appendEvent(sessionId, {
    type: 'interlude:quickVoteResult',
    ts: Date.now(),
    data: result,
  });

  const revealTimer = setTimeout(() => {
    endInterludeGame(sessionId);
  }, QUICK_VOTE_REVEAL_DURATION_MS);

  interludeGameTimers.set(sessionId, revealTimer);
}

function endInterludeGame(sessionId: string): void {
  interludeGameTimers.delete(sessionId);

  const currentContext = getSessionDjState(sessionId);
  if (!currentContext || currentContext.state !== DJState.interlude) return;

  const selectedActivity = typeof currentContext.metadata.selectedActivity === 'string'
    ? currentContext.metadata.selectedActivity
    : 'unknown';

  broadcastInterludeGameEnded(sessionId, { activityId: selectedActivity });

  appendEvent(sessionId, {
    type: 'interlude:gameEnded',
    ts: Date.now(),
    data: { activityId: selectedActivity },
  });

  void processDjTransition(sessionId, currentContext, { type: 'INTERLUDE_DONE' });
}

function orchestrateCardDeal(
  sessionId: string,
  context: DJContext,
): DJContext {
  // Select current performer (round-robin from active non-host participants)
  const connections = getActiveConnections(sessionId);
  const nonHostConnections = connections.filter(c => !c.isHost);
  let performer: string | null = null;
  if (nonHostConnections.length > 0) {
    // Round-robin using songCount as rotation index
    const index = (context.songCount) % nonHostConnections.length;
    performer = nonHostConnections[index]!.userId;
  } else if (connections.length > 0) {
    // Fallback: if everyone is host (shouldn't happen), pick first connection
    performer = connections[0]!.userId;
  }

  const card = dealCard(sessionId, context.participantCount);
  incrementCardDealt(sessionId);

  // Store dealt card + currentPerformer in DJ context metadata for persistence/recovery
  const updatedContext: DJContext = {
    ...context,
    currentPerformer: performer,
    metadata: {
      ...context.metadata,
      currentCard: {
        id: card.id,
        title: card.title,
        description: card.description,
        type: card.type,
        emoji: card.emoji,
      },
      redrawUsed: false,
    },
  };
  setSessionDjState(sessionId, updatedContext);
  void persistDjState(sessionId, serializeDJContext(updatedContext));

  // Broadcast card to all participants
  broadcastCardDealt(sessionId, {
    cardId: card.id,
    title: card.title,
    description: card.description,
    cardType: card.type,
    emoji: card.emoji,
  });

  // Log to event stream
  appendEvent(sessionId, {
    type: 'card:dealt',
    ts: Date.now(),
    data: { cardId: card.id, cardType: card.type },
  });

  return updatedContext;
}

function countRecentReactions(events: SessionEvent[]): number {
  // Scan backward from end — count reaction:sent events until we hit the song start
  let count = 0;
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i]!;
    if (event.type === 'dj:stateChanged' && event.data.to === DJState.song) {
      break; // Found start of most recent song, stop counting
    }
    if (event.type === 'participation:scored' && event.data.action === 'reaction:sent') {
      count++;
    }
  }
  return count;
}

function checkCardCompletion(_events: SessionEvent[], _performerUserId: string): boolean {
  // Epic 4 will add card:completed events — for now always returns false
  return false;
}

function buildAwardContext(
  sessionId: string,
  performerUserId: string,
): AwardContext {
  const djContext = getSessionDjState(sessionId);
  const songPosition = djContext?.songCount ?? 1;
  const participantCount = djContext?.participantCount ?? 2;

  const scoreCacheKey = getScoreCacheKey(sessionId, performerUserId);
  const participationScore = scoreCache.get(scoreCacheKey) ?? 0;

  const eventStream = getEventStream(sessionId);
  const reactionCount = countRecentReactions(eventStream);
  const cardCompleted = checkCardCompletion(eventStream, performerUserId);

  const previousAwards = sessionAwards.get(sessionId) ?? [];

  return {
    songPosition,
    cardCompleted,
    reactionCount,
    participationScore,
    participantCount,
    previousAwards,
  };
}

export async function generateCeremonyAward(
  sessionId: string,
  performerUserId: string,
  ceremonyType: 'full' | 'quick',
): Promise<{ award: string; tone: AwardTone } | null> {
  if (!performerUserId) return null;

  const context = buildAwardContext(sessionId, performerUserId);
  const award = generateAward(context);

  // Track for dedup
  const awards = sessionAwards.get(sessionId) ?? [];
  awards.push(award);
  sessionAwards.set(sessionId, awards);

  // Persist top_award (fire-and-forget)
  sessionRepo.updateTopAward(sessionId, performerUserId, award).catch((err) => {
    console.error(`[session-manager] Failed to persist top_award for ${performerUserId}:`, err);
  });

  // Find the tone for the event stream
  const template = AWARD_TEMPLATES.find(t => t.title === award);
  const tone = template?.tone ?? AwardTone.comedic;

  // Log to event stream
  appendEvent(sessionId, {
    type: 'ceremony:awardGenerated',
    ts: Date.now(),
    userId: performerUserId,
    data: {
      award,
      songPosition: context.songPosition,
      ceremonyType,
      tone,
      contextFactors: {
        cardCompleted: context.cardCompleted,
        reactionCount: context.reactionCount,
        participationScore: context.participationScore,
      },
    },
  });

  return { award, tone };
}

export async function recordParticipationAction(
  sessionId: string,
  userId: string,
  action: string,
  rewardMultiplier: number = 1.0
): Promise<{ points: number; totalScore: number } | null> {
  const increment = calculateScoreIncrement(action, rewardMultiplier);
  if (increment === 0) return null;

  // Fire-and-forget DB update (same pattern as DJ state persistence)
  sessionRepo.incrementParticipationScore(sessionId, userId, increment).catch((err) => {
    console.error(`[session-manager] Failed to persist score for ${userId}:`, err);
  });

  // Track score in memory to avoid read-after-write race condition
  const cacheKey = getScoreCacheKey(sessionId, userId);
  const cachedScore = scoreCache.get(cacheKey) ?? 0;
  const totalScore = cachedScore + increment;
  scoreCache.set(cacheKey, totalScore);

  // Log to event stream
  const tier = ACTION_TIER_MAP[action];
  if (tier) {
    appendEvent(sessionId, {
      type: 'participation:scored',
      ts: Date.now(),
      userId,
      data: {
        action,
        tier,
        points: increment,
        rewardMultiplier,
        totalScore,
      },
    });
  }

  return { points: increment, totalScore };
}

// Set of session IDs that failed recovery — checked during client reconnection
const failedRecoverySessionIds = new Set<string>();

export function isRecoveryFailed(sessionId: string): boolean {
  return failedRecoverySessionIds.has(sessionId);
}

export function clearRecoveryFailed(sessionId: string): void {
  failedRecoverySessionIds.delete(sessionId);
}

export async function recoverActiveSessions(
  now: number = Date.now(),
): Promise<{ recovered: string[]; failed: string[] }> {
  const recovered: string[] = [];
  const failed: string[] = [];

  const activeSessions = await sessionRepo.findActiveSessions();

  for (const session of activeSessions) {
    // Skip sessions with no DJ state (lobby state — no recovery needed)
    if (session.dj_state === null || session.dj_state === undefined) {
      continue;
    }

    try {
      // Deserialize and validate DJ state
      const context = deserializeDJContext(session.dj_state);

      // If paused, skip all timer reconciliation — store as-is
      if (context.isPaused) {
        setSessionDjState(session.id, context);
        console.log(`[session-manager] Session ${session.id} recovered in paused state`);
        appendEvent(session.id, {
          type: 'system:recovery',
          ts: Date.now(),
          data: { recoveredState: context.state, songCount: context.songCount },
        });
        recovered.push(session.id);
        continue;
      }

      // Reconcile timers
      const remaining = calculateRemainingMs(context, now);
      let recoveredContext = context;

      if (remaining > 0) {
        // Timer still active — store state and reschedule with remaining duration
        setSessionDjState(session.id, context);
        scheduleSessionTimer(session.id, remaining, () => {
          void handleRecoveryTimeout(session.id);
        });
      } else if (context.timerStartedAt !== null && context.timerDurationMs !== null) {
        // Timer expired during downtime — trigger TIMEOUT to advance state
        const { newContext, sideEffects } = processTransition(context, { type: 'TIMEOUT' }, now);
        setSessionDjState(session.id, newContext);
        recoveredContext = newContext;

        // Persist the new state
        const persistEffect = sideEffects.find(
          (e): e is Extract<DJSideEffect, { type: 'persist' }> => e.type === 'persist',
        );
        if (persistEffect) {
          void persistDjState(session.id, persistEffect.data.context);
        }

        // Check if new state also has a timer — schedule it fresh from now
        const scheduleEffect = sideEffects.find(
          (e): e is Extract<DJSideEffect, { type: 'scheduleTimer' }> => e.type === 'scheduleTimer',
        );
        if (scheduleEffect) {
          scheduleSessionTimer(session.id, scheduleEffect.data.durationMs, () => {
            void handleRecoveryTimeout(session.id);
          });
        }
      } else {
        // No timer to reconcile (paused or no-timeout state) — just store
        setSessionDjState(session.id, context);
      }

      appendEvent(session.id, {
        type: 'system:recovery',
        ts: Date.now(),
        data: { recoveredState: recoveredContext.state, songCount: recoveredContext.songCount },
      });

      recovered.push(session.id);
    } catch (error) {
      // Deserialization failed — gracefully end session
      console.error(`[session-manager] Recovery failed for session ${session.id}:`, error);
      failed.push(session.id);
      failedRecoverySessionIds.add(session.id);
      await sessionRepo.updateStatus(session.id, 'ended');
    }
  }

  return { recovered, failed };
}

/**
 * Initialize Quick Pick round when entering songSelection state.
 * Fetches suggestions, creates round, stores metadata, broadcasts.
 */
async function initializeQuickPick(sessionId: string, context: DJContext): Promise<void> {
  try {
    const suggestions = await computeSuggestions(sessionId, 5);
    if (suggestions.length === 0) return;

    const songs: QuickPickSong[] = suggestions.map((s) => ({
      catalogTrackId: s.catalogTrackId,
      songTitle: s.songTitle,
      artist: s.artist,
      youtubeVideoId: s.youtubeVideoId,
      overlapCount: s.overlapCount,
    }));

    startRound(sessionId, songs, context.participantCount);

    // Store in metadata for persistence
    const updatedContext = {
      ...context,
      metadata: {
        ...context.metadata,
        quickPickSongs: songs,
      },
    };
    setSessionDjState(sessionId, updatedContext);

    // Broadcast via dedicated event (NOT dj:stateChanged metadata)
    broadcastQuickPickStarted(sessionId, {
      songs,
      participantCount: context.participantCount,
      timerDurationMs: 15_000,
    });
  } catch (error) {
    console.error(`[session-manager] Failed to initialize Quick Pick for ${sessionId}:`, error);
  }
}

/**
 * Initialize Spin the Wheel round when entering songSelection state.
 * Fetches 8 suggestions, creates round, stores metadata, broadcasts.
 */
async function initializeSpinWheel(sessionId: string, context: DJContext): Promise<void> {
  try {
    const suggestions = await computeSuggestions(sessionId, 8);
    if (suggestions.length === 0) return;

    const segments: SpinWheelSegment[] = suggestions.map((s, i) => ({
      catalogTrackId: s.catalogTrackId,
      songTitle: s.songTitle,
      artist: s.artist,
      youtubeVideoId: s.youtubeVideoId,
      overlapCount: s.overlapCount,
      segmentIndex: i,
    }));

    startSpinWheelRound(sessionId, segments);

    // Store in metadata for persistence
    const updatedContext = {
      ...context,
      metadata: {
        ...context.metadata,
        spinWheelSegments: segments,
      },
    };
    setSessionDjState(sessionId, updatedContext);

    // Broadcast via dedicated event
    broadcastSpinWheelStarted(sessionId, segments, context.participantCount, 15_000);
  } catch (error) {
    console.error(`[session-manager] Failed to initialize Spin the Wheel for ${sessionId}:`, error);
  }
}

/**
 * Handle spin animation completion — transitions to landed, starts veto window or resolves.
 */
export async function handleSpinAnimationComplete(sessionId: string): Promise<void> {
  const landedSegment = onSpinComplete(sessionId);
  if (!landedSegment) return;

  const round = getSpinWheelRound(sessionId);
  if (!round) return;

  if (round.vetoUsed) {
    // Post-veto re-spin: no second veto window (AC #4)
    const selectedSegment = resolveRound(sessionId);
    if (!selectedSegment) return;
    broadcastSpinWheelResult(sessionId, { phase: 'selected', song: selectedSegment });
    await handleSpinWheelSongSelected(sessionId, selectedSegment);
  } else {
    // First spin: show landed, start veto window
    broadcastSpinWheelResult(sessionId, { phase: 'landed', song: landedSegment });
    startVetoWindow(sessionId);

    const vetoTimer = setTimeout(() => {
      void handleVetoWindowExpired(sessionId);
    }, 5000);
    round.vetoTimerHandle = vetoTimer;
  }
}

/**
 * Handle veto window expiry — resolves round and selects song.
 */
async function handleVetoWindowExpired(sessionId: string): Promise<void> {
  const round = getSpinWheelRound(sessionId);
  if (!round || round.state !== 'vetoing') return;

  const selectedSegment = resolveRound(sessionId);
  if (!selectedSegment) return;

  broadcastSpinWheelResult(sessionId, { phase: 'selected', song: selectedSegment });
  await handleSpinWheelSongSelected(sessionId, selectedSegment);
}

/**
 * Handle Spin the Wheel song selection — mirrors handleQuickPickSongSelected.
 * CRITICAL: Emit SONG_QUEUED BEFORE processDjTransition(SONG_SELECTED)
 */
export async function handleSpinWheelSongSelected(
  sessionId: string,
  segment: SpinWheelSegment,
): Promise<void> {
  markSongSung(sessionId, segment.songTitle, segment.artist);

  clearSpinWheelRound(sessionId);
  cancelSessionTimer(sessionId);

  const context = getSessionDjState(sessionId);
  if (!context) return;

  // Broadcast song selected BEFORE DJ transition (same fix as Story 5.5 H1)
  const io = getIO();
  if (io) {
    io.to(sessionId).emit(EVENTS.SONG_QUEUED, {
      catalogTrackId: segment.catalogTrackId,
      songTitle: segment.songTitle,
      artist: segment.artist,
      youtubeVideoId: segment.youtubeVideoId,
    });
  }

  if (isTvPaired(sessionId)) {
    getTvConnection(sessionId)!.addToQueue(segment.youtubeVideoId).catch((err) => {
      console.error('[session-manager] TV queue push failed:', err);
    });
  }

  appendEvent(sessionId, {
    type: 'spinwheel:selected',
    ts: Date.now(),
    data: { song: segment },
  });

  const updatedContext = {
    ...context,
    metadata: {
      ...context.metadata,
      selectedSong: {
        catalogTrackId: segment.catalogTrackId,
        songTitle: segment.songTitle,
        artist: segment.artist,
        youtubeVideoId: segment.youtubeVideoId,
      },
    },
  };

  await processDjTransition(sessionId, updatedContext, { type: 'SONG_SELECTED' });
}

/**
 * Handle mode change — updates mode, restarts round if in songSelection.
 */
export async function handleModeChange(
  sessionId: string,
  mode: 'quickPick' | 'spinWheel',
  userId: string,
  displayName: string,
): Promise<void> {
  setSongSelectionMode(sessionId, mode);
  broadcastModeChanged(sessionId, mode, userId, displayName);

  // If currently in songSelection, cancel active round and restart with new mode
  const context = getSessionDjState(sessionId);
  if (context && context.state === DJState.songSelection) {
    // Clear any active rounds
    clearRound(sessionId); // quick-pick
    clearSpinWheelRound(sessionId); // spin-wheel
    cancelSessionTimer(sessionId);

    // Re-initialize with new mode
    if (mode === 'spinWheel') {
      void initializeSpinWheel(sessionId, context);
    } else {
      void initializeQuickPick(sessionId, context);
    }

    // Re-schedule DJ timer
    scheduleSessionTimer(sessionId, 15_000, () => {
      void handleRecoveryTimeout(sessionId);
    });
  }

  appendEvent(sessionId, {
    type: 'song:modeChanged',
    ts: Date.now(),
    userId,
    data: { mode },
  });
}

/**
 * Handle Quick Pick song selection — called from both majority vote path and timeout path.
 * Orchestration function: marks song sung, clears round, cancels timer, triggers DJ transition, broadcasts.
 */
export async function handleQuickPickSongSelected(
  sessionId: string,
  song: QuickPickSong,
): Promise<void> {
  markSongSung(sessionId, song.songTitle, song.artist);

  clearRound(sessionId);
  cancelSessionTimer(sessionId);

  const context = getSessionDjState(sessionId);
  if (!context) return;

  // Broadcast song selected BEFORE DJ transition so clients see the winner
  // while QuickPickOverlay is still mounted (songSelection state)
  const io = getIO();
  if (io) {
    io.to(sessionId).emit(EVENTS.SONG_QUEUED, {
      catalogTrackId: song.catalogTrackId,
      songTitle: song.songTitle,
      artist: song.artist,
      youtubeVideoId: song.youtubeVideoId,
    });
  }

  if (isTvPaired(sessionId)) {
    getTvConnection(sessionId)!.addToQueue(song.youtubeVideoId).catch((err) => {
      console.error('[session-manager] TV queue push failed:', err);
    });
  }

  appendEvent(sessionId, {
    type: 'quickpick:selected',
    ts: Date.now(),
    data: { song },
  });

  const updatedContext = {
    ...context,
    metadata: {
      ...context.metadata,
      selectedSong: {
        catalogTrackId: song.catalogTrackId,
        songTitle: song.songTitle,
        artist: song.artist,
        youtubeVideoId: song.youtubeVideoId,
      },
    },
  };

  await processDjTransition(sessionId, updatedContext, { type: 'SONG_SELECTED' });
}

async function handleRecoveryTimeout(sessionId: string): Promise<void> {
  const context = getSessionDjState(sessionId);
  if (!context) return;

  // Song selection resolution: when songSelection timer fires
  if (context.state === DJState.songSelection) {
    // Quick Pick path (existing)
    const qpRound = getRound(sessionId);
    if (qpRound && !qpRound.resolved) {
      const winner = resolveByTimeout(sessionId);
      if (winner) {
        await handleQuickPickSongSelected(sessionId, winner);
        return;
      }
    }
    // Spin the Wheel path
    const swRound = getSpinWheelRound(sessionId);
    if (swRound && swRound.state === 'waiting') {
      // Nobody spun within 15s — auto-spin
      const spinParams = autoSpin(sessionId);
      if (spinParams) {
        broadcastSpinWheelResult(sessionId, {
          phase: 'spinning',
          spinnerUserId: null,
          spinnerDisplayName: 'Auto',
          ...spinParams,
        });
        // Schedule spin animation completion
        const spinTimer = setTimeout(() => {
          void handleSpinAnimationComplete(sessionId);
        }, spinParams.spinDurationMs);
        swRound.spinTimerHandle = spinTimer;
        return;
      }
    }
    // Fallback: generic TIMEOUT
  }

  // Icebreaker resolution: when icebreaker timer fires (6s hard deadline)
  if (context.state === DJState.icebreaker) {
    resolveIcebreakerTimeout(sessionId, context);
    return;
  }

  // Interlude resolution: when interlude timer fires
  if (context.state === DJState.interlude) {
    resolveInterludeTimeout(sessionId, context);
    return;
  }

  await processDjTransition(sessionId, context, { type: 'TIMEOUT' });
}

export async function createSession(params: {
  hostUserId: string;
  displayName: string;
  vibe?: string;
  venueName?: string;
}): Promise<{ sessionId: string; partyCode: string }> {
  const partyCode = await generateUniquePartyCode();
  const resolvedVibe = params.vibe ?? DEFAULT_VIBE;

  const session = await sessionRepo.create({
    hostUserId: params.hostUserId,
    partyCode,
    vibe: resolvedVibe,
    venueName: params.venueName,
  });

  await sessionRepo.addParticipant({
    sessionId: session.id,
    userId: params.hostUserId,
  });

  return { sessionId: session.id, partyCode: session.party_code };
}

export async function handleManualSongPlay(
  sessionId: string,
  song: { catalogTrackId: string; songTitle: string; artist: string; youtubeVideoId: string },
): Promise<void> {
  const context = getSessionDjState(sessionId);
  if (!context) return;

  // Update DJ context with song metadata — enables ceremony/challenge references
  const updatedContext = {
    ...context,
    currentSongTitle: song.songTitle,
    metadata: {
      ...context.metadata,
      manuallyMarkedSong: {
        catalogTrackId: song.catalogTrackId,
        songTitle: song.songTitle,
        artist: song.artist,
        youtubeVideoId: song.youtubeVideoId,
      },
    },
  };
  setSessionDjState(sessionId, updatedContext);
  void persistDjState(sessionId, serializeDJContext(updatedContext));

  // Emit song:detected equivalent so Flutter shows now-playing metadata
  const io = getIO();
  if (io) {
    io.to(sessionId).emit(EVENTS.SONG_DETECTED, {
      videoId: song.youtubeVideoId,
      songTitle: song.songTitle,
      artist: song.artist,
      channel: null,
      thumbnail: null,
      source: 'manual',
    });
  }

  // Mark as sung in pool for suggestion dedup
  markSongSung(sessionId, song.songTitle, song.artist);

  appendEvent(sessionId, {
    type: 'song:manualPlay',
    ts: Date.now(),
    data: {
      videoId: song.youtubeVideoId,
      title: song.songTitle,
      artist: song.artist,
    },
  });
}

export async function persistDjState(sessionId: string, serializedState: unknown): Promise<void> {
  try {
    await sessionRepo.updateDjState(sessionId, serializedState);
  } catch (error) {
    console.warn(`[session-manager] Failed to persist DJ state for session ${sessionId}:`, error);
  }
}

export async function initializeDjState(
  sessionId: string,
  participantCount: number,
): Promise<{ djContext: DJContext; sideEffects: DJSideEffect[] }> {
  const context = createDJContext(sessionId, participantCount);
  const { newContext, sideEffects } = processTransition(context, { type: 'SESSION_STARTED' }, Date.now());

  setSessionDjState(sessionId, newContext);

  const persistEffect = sideEffects.find((e): e is Extract<DJSideEffect, { type: 'persist' }> => e.type === 'persist');
  if (persistEffect) {
    void persistDjState(sessionId, persistEffect.data.context);
  }

  return { djContext: newContext, sideEffects };
}

export async function loadDjState(sessionId: string): Promise<DJContext | null> {
  const session = await sessionRepo.findById(sessionId);
  if (!session || session.dj_state === null || session.dj_state === undefined) {
    return null;
  }

  try {
    return deserializeDJContext(session.dj_state);
  } catch (error) {
    console.error(`[session-manager] Failed to deserialize DJ state for session ${sessionId}:`, error);
    return null;
  }
}

/** Emit capture:bubble if allowed by cooldown/state, log to event stream. Returns true if emitted. */
export function emitCaptureBubble(sessionId: string, triggerType: CaptureTriggerType, currentState?: DJState): boolean {
  if (!shouldEmitCaptureBubble(sessionId, currentState)) return false;
  markBubbleEmitted(sessionId);
  const io = getIO();
  if (io) {
    io.to(sessionId).emit(EVENTS.CAPTURE_BUBBLE, {
      triggerType,
      ts: Date.now(),
    });
  }
  appendEvent(sessionId, {
    type: 'capture:bubble',
    ts: Date.now(),
    data: { triggerType },
  });
  return true;
}

export async function processDjTransition(
  sessionId: string,
  context: DJContext,
  event: DJTransition,
  userId?: string,
): Promise<{ newContext: DJContext; sideEffects: DJSideEffect[] }> {
  let { newContext, sideEffects } = processTransition(context, event, Date.now());

  setSessionDjState(sessionId, newContext);

  appendEvent(sessionId, {
    type: 'dj:stateChanged',
    ts: Date.now(),
    userId,
    data: { from: context.state, to: newContext.state, trigger: event.type },
  });

  // Cancel any pending ceremony reveal if skipping out of ceremony
  if (context.state === DJState.ceremony) {
    clearCeremonyTimers(sessionId);
  }

  // Clear reaction streaks when leaving song state (AC #4)
  if (context.state === DJState.song && newContext.state !== DJState.song) {
    clearSessionStreaks(sessionId);
  }

  if (newContext.state === DJState.ceremony) {
    const resolvedCeremonyType = (newContext.metadata.ceremonyType === 'full' || newContext.metadata.ceremonyType === 'quick')
      ? newContext.metadata.ceremonyType
      : 'quick';

    appendEvent(sessionId, {
      type: 'ceremony:typeSelected',
      ts: Date.now(),
      data: {
        ceremonyType: resolvedCeremonyType,
        songCount: newContext.songCount,
        participantCount: newContext.participantCount,
      },
    });

    if (resolvedCeremonyType === 'full') {
      // Fire-and-forget — don't block DJ transition pipeline
      void orchestrateFullCeremony(sessionId, newContext);
    } else {
      // Quick ceremony — immediate award flash, auto-advances after 10s
      void orchestrateQuickCeremony(sessionId, newContext);
    }
  }

  // Cancel any pending icebreaker reveal if leaving icebreaker
  if (context.state === DJState.icebreaker) {
    clearIcebreakerTimers(sessionId);
  }

  // Orchestrate icebreaker when entering icebreaker state
  if (newContext.state === DJState.icebreaker) {
    onIcebreakerStateEntered(sessionId, newContext);
  }

  // Cancel any pending interlude reveal if skipping out of interlude
  if (context.state === DJState.interlude) {
    clearInterludeTimers(sessionId);
  }

  // Orchestrate interlude voting when entering interlude state
  if (newContext.state === DJState.interlude) {
    onInterludeStateEntered(sessionId, newContext);
  }

  // Session start capture bubble — 10s after icebreaker→songSelection
  if (context.state === DJState.icebreaker && newContext.state === DJState.songSelection) {
    setTimeout(() => {
      emitCaptureBubble(sessionId, 'session_start', newContext.state);
    }, 10_000);
  }

  // Song selection mode initialization when entering songSelection
  if (newContext.state === DJState.songSelection) {
    const mode = getSongSelectionMode(sessionId);
    if (mode === 'spinWheel') {
      void initializeSpinWheel(sessionId, newContext);
    } else {
      void initializeQuickPick(sessionId, newContext);
    }
  }

  // Final capture opportunity when entering finale
  if (newContext.state === DJState.finale) {
    emitCaptureBubble(sessionId, 'session_end', newContext.state);
  }

  // Orchestrate card dealing when entering partyCardDeal state
  // orchestrateCardDeal persists enriched context (with currentCard + currentPerformer),
  // so we skip the side effect persist to avoid overwriting card data.
  let orchestrationPersisted = false;
  if (newContext.state === DJState.partyCardDeal) {
    newContext = orchestrateCardDeal(sessionId, newContext);
    orchestrationPersisted = true;
  }

  for (const effect of sideEffects) {
    switch (effect.type) {
      case 'persist':
        if (!orchestrationPersisted) {
          void persistDjState(sessionId, effect.data.context);
        }
        break;
      case 'scheduleTimer':
        scheduleSessionTimer(sessionId, effect.data.durationMs, () => {
          void handleRecoveryTimeout(sessionId);
        });
        break;
      case 'cancelTimer':
        cancelSessionTimer(sessionId);
        break;
      case 'broadcast':
        broadcastDjState(sessionId, newContext);
        break;
    }
  }

  return { newContext, sideEffects };
}

export async function startSession(params: {
  sessionId: string;
  hostUserId: string;
}): Promise<{ status: string; djContext: DJContext; sideEffects: DJSideEffect[] }> {
  const session = await sessionRepo.findById(params.sessionId);
  if (!session) throw createAppError('SESSION_NOT_FOUND', 'Session not found', 404);
  if (session.status !== 'lobby') throw createAppError('INVALID_STATUS', 'Party already started', 400);

  if (session.host_user_id !== params.hostUserId) {
    throw createAppError('NOT_HOST', 'Only the host can start the party', 403);
  }

  const participants = await sessionRepo.getParticipants(params.sessionId);
  if (participants.length < 3) {
    throw createAppError('INSUFFICIENT_PLAYERS', 'Need at least 3 participants to start', 400);
  }

  await sessionRepo.updateStatus(params.sessionId, 'active');

  const { djContext, sideEffects } = await initializeDjState(params.sessionId, participants.length);

  appendEvent(params.sessionId, {
    type: 'party:started',
    ts: Date.now(),
    userId: params.hostUserId,
    data: { participantCount: participants.length },
  });

  return { status: 'active', djContext, sideEffects };
}

export async function transferHost(
  sessionId: string,
  newHostUserId: string,
): Promise<{ newHostId: string; newHostName: string } | null> {
  // 1. Verify session exists and is active
  const session = await sessionRepo.findById(sessionId);
  if (!session || session.status === 'ended') return null;

  // 2. Get new host's display name from participants
  const participants = await sessionRepo.getParticipants(sessionId);
  const newHost = participants.find(
    p => (p.user_id ?? p.id) === newHostUserId,
  );
  if (!newHost) return null;

  // 3. Update host in DB
  await sessionRepo.updateHost(sessionId, newHostUserId);

  appendEvent(sessionId, {
    type: 'party:hostTransferred',
    ts: Date.now(),
    data: { fromUserId: session.host_user_id, toUserId: newHostUserId },
  });

  return {
    newHostId: newHostUserId,
    newHostName: newHost.guest_name ?? newHost.display_name ?? 'Unknown',
  };
}

export async function handleParticipantJoin(params: {
  sessionId: string;
  userId: string;
  role: 'guest' | 'authenticated';
  displayName: string;
}): Promise<{
  participants: Array<{ userId: string; displayName: string }>;
  participantCount: number;
  vibe: string;
  status: string;
  hostUserId: string;
}> {
  // 1. Add participant (idempotent — handles reconnection + host duplicate)
  // Always pass userId so the unique constraint catches duplicates
  // (guest hosts are already inserted by createSession with their user_id)
  await sessionRepo.addParticipantIfNotExists({
    sessionId: params.sessionId,
    userId: params.userId,
    guestName: params.role === 'guest' ? params.displayName : undefined,
  });

  // 2. Log join event
  appendEvent(params.sessionId, {
    type: 'party:joined',
    ts: Date.now(),
    userId: params.userId,
    data: { displayName: params.displayName, role: params.role },
  });

  // 3. Score the join action (passive tier, 1pt) — only for authenticated users
  if (params.role !== 'guest') {
    recordParticipationAction(params.sessionId, params.userId, 'party:joined', 1.0).catch(() => {});
  }

  // 4. Get current participants + session metadata
  const [participants, session] = await Promise.all([
    sessionRepo.getParticipants(params.sessionId),
    sessionRepo.findById(params.sessionId),
  ]);

  return {
    participants: participants.map(p => ({
      userId: p.user_id ?? p.id,
      displayName: p.guest_name ?? p.display_name ?? 'Unknown',
    })),
    participantCount: participants.length,
    vibe: session?.vibe ?? 'general',
    status: session?.status ?? 'lobby',
    hostUserId: session?.host_user_id ?? '',
  };
}

async function generateEndOfNightAwards(sessionId: string): Promise<FinaleAward[]> {
  // 1. Read event stream (still in memory, not yet flushed)
  const events = getEventStream(sessionId);

  // 2. Get participants with scores
  const participants = await sessionRepo.getParticipants(sessionId);
  const participantEntries = participants.map(p => {
    const userId = p.user_id ?? p.id;
    const scoreCacheKey = `${sessionId}:${userId}`;
    return {
      userId,
      displayName: p.guest_name ?? p.display_name ?? 'Unknown',
      participationScore: scoreCache.get(scoreCacheKey) ?? 0,
    };
  });

  // 3. Build per-song awards map from sessionAwards
  const perSongAwardsMap = new Map<string, string[]>();
  // sessionAwards is sessionId -> all titles; we need userId -> titles
  // But sessionAwards doesn't track per-user — derive from ceremony:awardGenerated events
  for (const e of events) {
    if (e.type === 'ceremony:awardGenerated') {
      const existing = perSongAwardsMap.get(e.userId) ?? [];
      existing.push(e.data.award);
      perSongAwardsMap.set(e.userId, existing);
    }
  }

  // 4. Analyze and generate
  const analyses = analyzeSessionForAwards(events, participantEntries, perSongAwardsMap);
  const awards = generateFinaleAwards(analyses, participantEntries.length);

  // 5. Store in cache for Story 8.2
  finaleAwardsCache.set(sessionId, awards);

  // 6. Broadcast to clients
  broadcastFinaleAwards(sessionId, awards);

  // 7. Update top_award in DB for each participant (fire-and-forget)
  for (const award of awards) {
    // Only update the first award per user (primary award)
    const userAwards = awards.filter(a => a.userId === award.userId);
    if (userAwards[0] === award) {
      sessionRepo.updateTopAward(sessionId, award.userId, award.title).catch(() => {});
    }
  }

  return awards;
}

async function writeSessionSummary(
  sessionId: string,
  stats: SessionStats | undefined,
  setlist: SetlistEntry[] | undefined,
  awards: FinaleAward[],
  participants: Array<{ userId: string | null; displayName: string; participationScore: number; topAward: string | null }>,
): Promise<void> {
  const summary = buildSessionSummary({
    sessionId,
    stats: stats ?? {
      songCount: 0, participantCount: participants.length, sessionDurationMs: 0,
      totalReactions: 0, totalSoundboardPlays: 0, totalCardsDealt: 0, topReactor: null, longestStreak: 0,
    },
    setlist: setlist ?? [],
    awards,
    participants,
  });

  const parsed = sessionSummarySchema.safeParse(summary);
  if (!parsed.success) {
    console.error('[SessionSummary] Validation failed, writing to disk as fallback', parsed.error.message);
    await writeSessionSummaryToDisk(sessionId, summary);
    return;
  }

  try {
    await withRetry(
      () => sessionRepo.persistSessionSummary(sessionId, summary),
      {
        maxAttempts: 4,
        baseDelayMs: 500,
        maxDelayMs: 5000,
        onRetry: (attempt, err) => console.warn(`[SessionSummary] Retry ${attempt}`, err),
      },
    );
  } catch (error) {
    console.error('[SessionSummary] All retries failed, writing to disk', error);
    await writeSessionSummaryToDisk(sessionId, summary);
  }
}

function calculateSessionStats(sessionId: string): SessionStats {
  const events = getEventStream(sessionId);
  const context = getSessionDjState(sessionId);

  let totalReactions = 0;
  let totalSoundboardPlays = 0;
  let totalCardsDealt = 0;
  let longestStreak = 0;
  const reactorCounts = new Map<string, { count: number; displayName: string }>();

  for (const e of events) {
    if (e.type === 'reaction:sent') {
      totalReactions++;
      const streak = e.data.streak ?? 0;
      if (streak > longestStreak) longestStreak = streak;
      const existing = reactorCounts.get(e.userId);
      if (existing) {
        existing.count++;
      } else {
        // We need displayName — get from participants or use userId
        reactorCounts.set(e.userId, { count: 1, displayName: e.userId });
      }
    } else if (e.type === 'sound:play') {
      totalSoundboardPlays++;
    } else if (e.type === 'card:dealt') {
      totalCardsDealt++;
    }
  }

  // Resolve display names for top reactor
  let topReactor: SessionStats['topReactor'] = null;
  if (reactorCounts.size > 0) {
    let maxCount = 0;
    let maxUserId = '';
    for (const [userId, data] of reactorCounts) {
      if (data.count > maxCount) {
        maxCount = data.count;
        maxUserId = userId;
      }
    }
    // Get display name from connection tracker
    const connections = getActiveConnections(sessionId);
    const conn = connections.find(c => c.userId === maxUserId);
    topReactor = {
      displayName: conn?.displayName ?? maxUserId,
      count: maxCount,
    };
  }

  return {
    songCount: context?.songCount ?? 0,
    participantCount: context?.participantCount ?? 0,
    sessionDurationMs: context?.sessionStartedAt ? Date.now() - context.sessionStartedAt : 0,
    totalReactions,
    totalSoundboardPlays,
    totalCardsDealt,
    topReactor,
    longestStreak,
  };
}

function buildFinaleSetlist(sessionId: string): SetlistEntry[] {
  const events = getEventStream(sessionId);

  // Build position→performer map from ceremony:awardGenerated events (most reliable)
  const positionPerformers = new Map<number, string>();
  const positionAwards = new Map<number, { title: string; tone: string }>();

  for (const e of events) {
    if (e.type === 'ceremony:awardGenerated') {
      const pos = e.data.songPosition;
      // Use ceremony:awardGenerated as performer source — has userId
      if (!positionPerformers.has(pos)) {
        // Resolve display name from connections
        const connections = getActiveConnections(sessionId);
        const conn = connections.find(c => c.userId === e.userId);
        positionPerformers.set(pos, conn?.displayName ?? e.userId);
      }
      positionAwards.set(pos, { title: e.data.award, tone: e.data.tone });
    }
  }

  // Count song transitions to get total song count (authoritative)
  let songPosition = 0;
  const songTransitions: number[] = []; // timestamps of each song transition
  for (const e of events) {
    if (e.type === 'dj:stateChanged' && e.data.to === 'song') {
      songPosition++;
      songTransitions.push(e.ts);
    }
  }

  // Extract song:detected events in order
  const detectedSongs: Array<{ title: string; artist: string; ts: number }> = [];
  for (const e of events) {
    if (e.type === 'song:detected') {
      detectedSongs.push({ title: e.data.title, artist: e.data.artist, ts: e.ts });
    }
  }

  // Build setlist by matching song positions
  const setlist: SetlistEntry[] = [];
  for (let pos = 1; pos <= songPosition; pos++) {
    // Find the detected song closest to (and after) this song transition
    const transitionTs = songTransitions[pos - 1];
    let matchedSong: { title: string; artist: string } | undefined;
    if (transitionTs !== undefined) {
      // Find detected song with ts >= transitionTs and < next transition
      const nextTransitionTs = songTransitions[pos] ?? Infinity;
      matchedSong = detectedSongs.find(
        s => s.ts >= transitionTs && s.ts < nextTransitionTs
      );
    }

    const award = positionAwards.get(pos);

    setlist.push({
      position: pos,
      title: matchedSong?.title ?? `Song ${pos}`,
      artist: matchedSong?.artist ?? 'Unknown',
      performerName: positionPerformers.get(pos) ?? null,
      awardTitle: award?.title ?? null,
      awardTone: award?.tone ?? null,
    });
  }

  return setlist;
}

export async function saveFeedback(sessionId: string, userId: string, score: number): Promise<void> {
  // Persist to DB (fire-and-forget — feedback_score column is authoritative)
  sessionRepo.updateFeedbackScore(sessionId, userId, score).catch((err) => {
    console.error('[session-manager] Failed to persist feedback score:', err);
  });

  // Append to in-memory event stream (may not be persisted — see Dev Notes)
  appendEvent(sessionId, {
    type: 'finale:feedbackReceived',
    ts: Date.now(),
    userId,
    data: { score },
  });
}

export async function initiateFinale(
  sessionId: string,
  hostUserId: string,
): Promise<DJContext> {
  // Verify host authorization
  const session = await sessionRepo.findById(sessionId);
  if (!session || session.host_user_id !== hostUserId) {
    throw createAppError('NOT_HOST', 'Only the host can end the party', 403);
  }

  const context = getSessionDjState(sessionId);
  if (!context) {
    throw createAppError('SESSION_NOT_FOUND', 'No active DJ state for session', 404);
  }

  // Clear pause state if paused — ending party while paused is valid
  const contextForTransition: DJContext = context.isPaused
    ? { ...context, isPaused: false, pausedAt: null, pausedFromState: null, timerRemainingMs: null }
    : context;

  // Transition to finale — automatically broadcasts, persists, cancels timers
  const { newContext } = await processDjTransition(sessionId, contextForTransition, { type: 'END_PARTY' });

  // Step A: Append party:ended event (DJ context still available)
  const endTs = Date.now();
  appendEvent(sessionId, {
    type: 'party:ended',
    ts: endTs,
    userId: hostUserId,
    data: {
      songCount: context.songCount ?? 0,
      duration: context.sessionStartedAt ? endTs - context.sessionStartedAt : 0,
    },
  });

  // Include card stats in final event stream
  const cardStats = getCardStats(sessionId);
  if (cardStats.dealt > 0) {
    appendEvent(sessionId, {
      type: 'card:sessionStats',
      ts: Date.now(),
      data: { dealt: cardStats.dealt, accepted: cardStats.accepted },
    });
  }

  // Step B: Generate end-of-night awards (reads in-memory event stream)
  try {
    const finaleAwardsList = await generateEndOfNightAwards(sessionId);
    if (finaleAwardsList.length > 0) {
      appendEvent(sessionId, {
        type: 'finale:awardsGenerated',
        ts: Date.now(),
        data: {
          awards: finaleAwardsList.map(a => ({
            userId: a.userId,
            title: a.title,
            category: a.category,
          })),
        },
      });
    }
  } catch (err) {
    console.error('[session-manager] Failed to generate finale awards:', err);
  }

  // Step C: Calculate session stats and broadcast
  let capturedStats: SessionStats | undefined;
  try {
    capturedStats = calculateSessionStats(sessionId);
    broadcastFinaleStats(sessionId, capturedStats);
  } catch (err) {
    console.error('[session-manager] Failed to calculate session stats:', err);
  }

  // Step D: Build setlist and broadcast
  let capturedSetlist: SetlistEntry[] | undefined;
  try {
    capturedSetlist = buildFinaleSetlist(sessionId);
    broadcastFinaleSetlist(sessionId, capturedSetlist);
  } catch (err) {
    console.error('[session-manager] Failed to build finale setlist:', err);
  }

  // ★ NEW: Persist session summary (fire-and-forget — entire block is async to avoid blocking finale)
  const awards = finaleAwardsCache.get(sessionId) ?? [];
  (async () => {
    const summaryParticipants = (await sessionRepo.getParticipants(sessionId)).map(p => {
      const resolvedId = p.user_id ?? p.id;
      const scoreCacheKey = `${sessionId}:${resolvedId}`;
      return {
        userId: p.user_id,
        displayName: p.guest_name ?? p.display_name ?? 'Unknown',
        participationScore: scoreCache.get(scoreCacheKey) ?? 0,
        topAward: awards.find(a => a.userId === resolvedId)?.title ?? null,
      };
    });
    await writeSessionSummary(sessionId, capturedStats, capturedSetlist, awards, summaryParticipants);
  })().catch((err: unknown) => console.error('[SessionSummary] Write failed:', err));

  // Step E: Flush and write event stream to DB (BEFORE cleanup, includes all finale events)
  const events = flushEventStream(sessionId);
  if (events.length > 0) {
    sessionRepo.writeEventStream(sessionId, events).catch((err) => {
      console.error('[session-manager] Failed to write event stream:', err);
    });
  }

  // Step F: Update DB status + ended_at
  await sessionRepo.updateStatus(sessionId, 'ended');

  // Step G: Start finalization timer — DO NOT cleanup in-memory state yet
  const timer = setTimeout(() => {
    finalizationTimers.delete(sessionId);
    finalizeSession(sessionId).catch((err) => {
      console.error('[session-manager] Finalization timer error:', err);
    });
  }, FINALE_DURATION_MS);
  finalizationTimers.set(sessionId, timer);

  return newContext;
}

export async function finalizeSession(sessionId: string, _hostUserId?: string): Promise<void> {
  // Cancel finalization timer if called early (host dismiss)
  clearFinalizationTimer(sessionId);

  // Emit party:ended — clients navigate away
  const io = getIO();
  if (io) {
    io.to(sessionId).emit(EVENTS.PARTY_ENDED, { reason: 'host_ended' });
  }

  // Clean up TV connection
  tvConnections.get(sessionId)?.disconnect().catch(() => {});
  tvConnections.delete(sessionId);

  // Clean up connection-handler timers that may be pending
  clearSessionTimers(sessionId);

  // Clean up ALL in-memory state
  removeSessionDjState(sessionId);
  cancelSessionTimer(sessionId);
  clearCeremonyTimers(sessionId);
  removeSession(sessionId);
  removeActivitySession(sessionId);
  clearScoreCache(sessionId);
  clearSessionAwards(sessionId);
  clearFinaleAwards(sessionId);
  clearCardStats(sessionId);
  clearDealtCards(sessionId);
  clearPool(sessionId);
  clearCaptureTriggerState(sessionId);
  clearPeakDetectorState(sessionId);
  clearActivityVoterState(sessionId);
  clearIcebreakerSession(sessionId);
  clearKingsCupSession(sessionId);
  clearDarePullSession(sessionId);
  clearQuickVoteSession(sessionId);
  clearSingAlongSession(sessionId);
  clearInterludeTimers(sessionId);
  clearIcebreakerTimers(sessionId);
  clearRound(sessionId);
  clearSpinWheelRound(sessionId);
  sessionModes.delete(sessionId);
  clearFeedbackTracking(sessionId);
}

/** @deprecated Use {@link initiateFinale} instead. This alias exists for backward compatibility only.
 *  Note: behavior changed in Story 8.2 — now initiates the finale sequence instead of immediately ending the session. */
export async function endSession(
  sessionId: string,
  hostUserId: string,
): Promise<DJContext> {
  return initiateFinale(sessionId, hostUserId);
}

export async function pauseSession(sessionId: string, userId?: string): Promise<DJContext> {
  const context = getSessionDjState(sessionId);
  if (!context) {
    throw createAppError('SESSION_NOT_FOUND', 'No active DJ state for session', 404);
  }

  if (context.state === DJState.lobby || context.state === DJState.finale) {
    throw createAppError('INVALID_STATE', 'Cannot pause in lobby or finale', 400);
  }

  if (context.isPaused) {
    throw createAppError('ALREADY_PAUSED', 'Session is already paused', 400);
  }

  const remainingMs = pauseSessionTimer(sessionId);

  const updatedContext: DJContext = {
    ...context,
    isPaused: true,
    pausedAt: Date.now(),
    pausedFromState: context.state,
    timerRemainingMs: remainingMs,
  };

  setSessionDjState(sessionId, updatedContext);
  void persistDjState(sessionId, serializeDJContext(updatedContext));
  broadcastDjPause(sessionId, updatedContext);

  appendEvent(sessionId, {
    type: 'dj:pause',
    ts: Date.now(),
    userId,
    data: { fromState: context.state },
  });

  return updatedContext;
}

export async function resumeSession(sessionId: string, userId?: string): Promise<DJContext> {
  const context = getSessionDjState(sessionId);
  if (!context) {
    throw createAppError('SESSION_NOT_FOUND', 'No active DJ state for session', 404);
  }

  if (!context.isPaused) {
    throw createAppError('NOT_PAUSED', 'Session is not paused', 400);
  }

  if (context.timerRemainingMs !== null && context.timerRemainingMs > 0) {
    resumeSessionTimer(sessionId, context.timerRemainingMs, () => {
      void handleRecoveryTimeout(sessionId);
    });
  }

  const now = Date.now();
  const updatedContext: DJContext = {
    ...context,
    isPaused: false,
    pausedAt: null,
    pausedFromState: null,
    timerStartedAt: context.timerRemainingMs !== null ? now : context.timerStartedAt,
    timerDurationMs: context.timerRemainingMs !== null ? context.timerRemainingMs : context.timerDurationMs,
    timerRemainingMs: null,
  };

  setSessionDjState(sessionId, updatedContext);
  void persistDjState(sessionId, serializeDJContext(updatedContext));
  broadcastDjResume(sessionId, updatedContext);

  appendEvent(sessionId, {
    type: 'dj:resume',
    ts: Date.now(),
    userId,
    data: { toState: updatedContext.state },
  });

  return updatedContext;
}

export async function kickPlayer(
  sessionId: string,
  hostUserId: string,
  targetUserId: string,
): Promise<{ kickedUserId: string }> {
  // Verify host
  const session = await sessionRepo.findById(sessionId);
  if (!session || session.host_user_id !== hostUserId) {
    throw createAppError('NOT_HOST', 'Only the host can kick players', 403);
  }

  // Can't kick yourself
  if (targetUserId === hostUserId) {
    throw createAppError('INVALID_ACTION', 'Cannot kick yourself', 400);
  }

  // Remove from DB
  await sessionRepo.removeParticipant(sessionId, targetUserId);

  appendEvent(sessionId, {
    type: 'party:kicked',
    ts: Date.now(),
    userId: hostUserId,
    data: { kickedUserId: targetUserId },
  });

  // Update DJ context participant count
  const context = getSessionDjState(sessionId);
  if (context) {
    const updatedContext: DJContext = {
      ...context,
      participantCount: Math.max(0, context.participantCount - 1),
    };
    setSessionDjState(sessionId, updatedContext);
    void persistDjState(sessionId, serializeDJContext(updatedContext));
  }

  return { kickedUserId: targetUserId };
}
