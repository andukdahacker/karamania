// Bot behavior profiles for local development testing
// Each behavior defines how a bot reacts to events from the server

import type { Socket } from 'socket.io-client';

// Mirror of EVENTS from src/shared/events.ts (standalone, no cross-imports)
const EVENTS = {
  PARTY_PARTICIPANTS: 'party:participants',
  PARTY_ENDED: 'party:ended',
  PARTY_STARTED: 'party:started',
  PARTY_VIBE_CHANGED: 'party:vibeChanged',
  PARTY_PARTICIPANT_DISCONNECTED: 'party:participantDisconnected',
  PARTY_PARTICIPANT_RECONNECTED: 'party:participantReconnected',
  DJ_STATE_CHANGED: 'dj:stateChanged',
  CEREMONY_ANTICIPATION: 'ceremony:anticipation',
  CEREMONY_REVEAL: 'ceremony:reveal',
  CEREMONY_QUICK: 'ceremony:quick',
  REACTION_SENT: 'reaction:sent',
  REACTION_BROADCAST: 'reaction:broadcast',
  REACTION_STREAK: 'reaction:streak',
  CARD_DEALT: 'card:dealt',
  CARD_ACCEPTED: 'card:accepted',
  CARD_DISMISSED: 'card:dismissed',
  LIGHTSTICK_TOGGLED: 'lightstick:toggled',
  HYPE_FIRED: 'hype:fired',
  SONG_QUICKPICK: 'song:quickpick',
  QUICKPICK_STARTED: 'quickpick:started',
  INTERLUDE_VOTE_STARTED: 'interlude:voteStarted',
  INTERLUDE_VOTE: 'interlude:vote',
  QUICK_VOTE_CAST: 'interlude:quickVoteCast',
  QUICK_VOTE_RESULT: 'interlude:quickVoteResult',
  ICEBREAKER_STARTED: 'icebreaker:started',
  ICEBREAKER_VOTE: 'icebreaker:vote',
  FINALE_AWARDS: 'finale:awards',
  FINALE_STATS: 'finale:stats',
  FINALE_FEEDBACK: 'finale:feedback',
  SESSION_NOT_FOUND: 'session:notFound',
  SESSION_FULL: 'session:full',
  AUTH_REFRESH_REQUIRED: 'auth:refreshRequired',
  AUTH_INVALID: 'auth:invalid',
} as const;

export type BehaviorType = 'passive' | 'active' | 'chaos' | 'spectator';

const REACTION_EMOJIS = ['🔥', '❤️', '😂', '👏', '🎤', '🎶', '💃', '🕺', '✨', '🙌', '😍', '🤩'];

function randomEmoji(): string {
  return REACTION_EMOJIS[Math.floor(Math.random() * REACTION_EMOJIS.length)]!;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function ts(): string {
  return new Date().toISOString().slice(11, 23);
}

export interface BotHandle {
  /** Stop all behavior timers and clean up */
  stop: () => void;
}

/**
 * Attach behavior to a connected socket. Returns a handle to stop the behavior.
 */
export function attachBehavior(
  socket: Socket,
  botName: string,
  behavior: BehaviorType,
): BotHandle {
  const timers: ReturnType<typeof setInterval>[] = [];
  let stopped = false;

  const log = (msg: string) => {
    if (!stopped) {
      console.log(`[${ts()}] [${botName}] ${msg}`);
    }
  };

  // ── Universal event logging ──
  socket.onAny((event: string, data: unknown) => {
    const preview = data !== undefined ? ` ${JSON.stringify(data).slice(0, 120)}` : '';
    log(`<< ${event}${preview}`);
  });

  // ── Spectator: do nothing beyond logging ──
  if (behavior === 'spectator') {
    return {
      stop: () => {
        stopped = true;
      },
    };
  }

  // ── Passive behavior ──
  if (behavior === 'passive') {
    // Occasional reaction every ~30s
    const t = setInterval(() => {
      if (!socket.connected) return;
      const emoji = randomEmoji();
      log(`>> reaction:sent ${emoji}`);
      socket.emit(EVENTS.REACTION_SENT, { emoji });
    }, 30_000);
    timers.push(t);
  }

  // ── Active behavior ──
  if (behavior === 'active') {
    // Frequent reactions every ~5s
    const t = setInterval(() => {
      if (!socket.connected) return;
      const emoji = randomEmoji();
      log(`>> reaction:sent ${emoji}`);
      socket.emit(EVENTS.REACTION_SENT, { emoji });
    }, 5_000);
    timers.push(t);

    // Accept cards immediately
    socket.on(EVENTS.CARD_DEALT, () => {
      log(`>> card:accepted`);
      socket.emit(EVENTS.CARD_ACCEPTED, {});
    });

    // Vote on quick pick
    socket.on(EVENTS.QUICKPICK_STARTED, (data: unknown) => {
      const payload = data as { tracks?: Array<{ catalogTrackId: string }> };
      if (payload.tracks && payload.tracks.length > 0) {
        const track = payload.tracks[randomInt(0, payload.tracks.length - 1)]!;
        log(`>> song:quickpick vote up for ${track.catalogTrackId}`);
        socket.emit(EVENTS.SONG_QUICKPICK, { catalogTrackId: track.catalogTrackId, vote: 'up' });
      }
    });

    // Vote on quick vote (interlude)
    socket.on(EVENTS.INTERLUDE_VOTE_STARTED, () => {
      const option = Math.random() > 0.5 ? 'A' : 'B';
      log(`>> interlude:quickVoteCast ${option}`);
      socket.emit(EVENTS.QUICK_VOTE_CAST, { option });
    });

    // Vote on icebreaker
    socket.on(EVENTS.ICEBREAKER_STARTED, (data: unknown) => {
      const payload = data as { options?: string[] };
      if (payload.options && payload.options.length > 0) {
        const pick = payload.options[randomInt(0, payload.options.length - 1)]!;
        log(`>> icebreaker:vote ${pick}`);
        socket.emit(EVENTS.ICEBREAKER_VOTE, { option: pick });
      }
    });

    // Toggle lightstick occasionally
    const lt = setInterval(() => {
      if (!socket.connected) return;
      log(`>> lightstick:toggled`);
      socket.emit(EVENTS.LIGHTSTICK_TOGGLED, {});
    }, 15_000);
    timers.push(lt);
  }

  // ── Chaos behavior ──
  if (behavior === 'chaos') {
    // Rapid reactions every 500ms
    const t = setInterval(() => {
      if (!socket.connected) return;
      const emoji = randomEmoji();
      socket.emit(EVENTS.REACTION_SENT, { emoji });
    }, 500);
    timers.push(t);

    // Accept or dismiss cards randomly
    socket.on(EVENTS.CARD_DEALT, () => {
      if (Math.random() > 0.3) {
        log(`>> card:accepted (chaos)`);
        socket.emit(EVENTS.CARD_ACCEPTED, {});
      } else {
        log(`>> card:dismissed (chaos)`);
        socket.emit(EVENTS.CARD_DISMISSED, {});
      }
    });

    // Random quick votes
    socket.on(EVENTS.INTERLUDE_VOTE_STARTED, () => {
      const option = Math.random() > 0.5 ? 'A' : 'B';
      socket.emit(EVENTS.QUICK_VOTE_CAST, { option });
    });

    // Fire hype randomly
    const ht = setInterval(() => {
      if (!socket.connected) return;
      log(`>> hype:fired (chaos)`);
      socket.emit(EVENTS.HYPE_FIRED, {});
    }, 3_000);
    timers.push(ht);

    // Lightstick spam
    const lst = setInterval(() => {
      if (!socket.connected) return;
      socket.emit(EVENTS.LIGHTSTICK_TOGGLED, {});
    }, 2_000);
    timers.push(lst);
  }

  return {
    stop: () => {
      stopped = true;
      for (const t of timers) {
        clearInterval(t);
      }
      timers.length = 0;
    },
  };
}

/**
 * Schedule chaos disconnects/reconnects. Returns a handle to cancel.
 * This is separate because it needs the reconnect auth info.
 */
export function scheduleChaosDisconnects(
  socket: Socket,
  botName: string,
): BotHandle {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  const log = (msg: string) => {
    if (!stopped) {
      console.log(`[${ts()}] [${botName}] ${msg}`);
    }
  };

  function scheduleNext() {
    if (stopped) return;
    const delay = randomInt(30_000, 60_000);
    timer = setTimeout(() => {
      if (stopped || !socket.connected) return;
      log(`!! chaos disconnect (will reconnect in 2-5s)`);
      socket.disconnect();
      const reconnDelay = randomInt(2_000, 5_000);
      timer = setTimeout(() => {
        if (stopped) return;
        log(`!! chaos reconnect`);
        socket.connect();
        scheduleNext();
      }, reconnDelay);
    }, delay);
  }

  scheduleNext();

  return {
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
}
