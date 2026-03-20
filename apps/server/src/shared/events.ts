// Socket.io event name constants — namespace:action naming convention
// Populated as handlers are implemented in Story 1.3+

export const EVENTS = {
  // Party events
  PARTY_CREATED: 'party:created',
  PARTY_JOINED: 'party:joined',
  PARTY_PARTICIPANTS: 'party:participants',
  PARTY_ENDED: 'party:ended',
  PARTY_START: 'party:start',
  PARTY_STARTED: 'party:started',
  PARTY_VIBE_CHANGED: 'party:vibeChanged',

  // Connection lifecycle events
  PARTY_PARTICIPANT_DISCONNECTED: 'party:participantDisconnected',
  PARTY_PARTICIPANT_RECONNECTED: 'party:participantReconnected',
  PARTY_HOST_TRANSFERRED: 'party:hostTransferred',

  // DJ events
  DJ_STATE_CHANGED: 'dj:stateChanged',
  DJ_PAUSE: 'dj:pause',
  DJ_RESUME: 'dj:resume',

  // Ceremony events
  CEREMONY_ANTICIPATION: 'ceremony:anticipation',
  CEREMONY_REVEAL: 'ceremony:reveal',
  CEREMONY_QUICK: 'ceremony:quick',

  // Reaction events
  REACTION_SENT: 'reaction:sent',
  REACTION_BROADCAST: 'reaction:broadcast',
  REACTION_STREAK: 'reaction:streak',

  // Sound events
  SOUND_PLAY: 'sound:play',

  // Card events
  CARD_DEALT: 'card:dealt',
  CARD_ACCEPTED: 'card:accepted',
  CARD_DISMISSED: 'card:dismissed',
  CARD_REDRAW: 'card:redraw',
  CARD_GROUP_ACTIVATED: 'card:groupActivated',
  CARD_SHARED: 'card:shared',

  // Lightstick & Hype events
  LIGHTSTICK_TOGGLED: 'lightstick:toggled',
  HYPE_FIRED: 'hype:fired',
  HYPE_COOLDOWN: 'hype:cooldown',

  // Song events
  SONG_DETECTED: 'song:detected',
  SONG_QUEUED: 'song:queued',
  SONG_QUICKPICK: 'song:quickpick',
  SONG_SPINWHEEL: 'song:spinwheel',
  QUICKPICK_STARTED: 'quickpick:started',
  SPINWHEEL_STARTED: 'spinwheel:started',
  SPINWHEEL_RESULT: 'spinwheel:result',
  SONG_MANUAL_PLAY: 'song:manualPlay',
  SONG_MODE_CHANGED: 'song:modeChanged',

  // Capture events
  CAPTURE_BUBBLE: 'capture:bubble',
  CAPTURE_STARTED: 'capture:started',
  CAPTURE_COMPLETE: 'capture:complete',
  CAPTURE_PERSISTED: 'capture:persisted',
  CAPTURE_SHARED: 'capture:shared',

  // Host events
  HOST_SKIP: 'host:skip',
  HOST_OVERRIDE: 'host:override',
  HOST_SONG_OVER: 'host:songOver',
  HOST_END_PARTY: 'host:endParty',
  HOST_PAUSE: 'host:pause',
  HOST_RESUME: 'host:resume',
  HOST_KICK_PLAYER: 'host:kickPlayer',

  // Party participant removal
  PARTY_PARTICIPANT_REMOVED: 'party:participantRemoved',

  // Session events (auth-related errors)
  SESSION_NOT_FOUND: 'session:notFound',
  SESSION_FULL: 'session:full',

  // TV events
  TV_PAIR: 'tv:pair',
  TV_STATUS: 'tv:status',
  TV_UNPAIR: 'tv:unpair',
  TV_NOW_PLAYING: 'tv:nowPlaying',

  // Interlude events
  INTERLUDE_VOTE_STARTED: 'interlude:voteStarted',
  INTERLUDE_VOTE: 'interlude:vote',
  INTERLUDE_VOTE_RESULT: 'interlude:voteResult',
  INTERLUDE_GAME_STARTED: 'interlude:gameStarted',
  INTERLUDE_GAME_ENDED: 'interlude:gameEnded',
  QUICK_VOTE_CAST: 'interlude:quickVoteCast',
  QUICK_VOTE_RESULT: 'interlude:quickVoteResult',

  // Icebreaker events
  ICEBREAKER_STARTED: 'icebreaker:started',
  ICEBREAKER_VOTE: 'icebreaker:vote',
  ICEBREAKER_RESULT: 'icebreaker:result',

  // Finale events
  FINALE_AWARDS: 'finale:awards',
  FINALE_STATS: 'finale:stats',
  FINALE_SETLIST: 'finale:setlist',
  FINALE_FEEDBACK: 'finale:feedback',
  HOST_DISMISS_FINALE: 'host:dismissFinale',

  // Auth events
  AUTH_REFRESH_REQUIRED: 'auth:refreshRequired',
  AUTH_INVALID: 'auth:invalid',
} as const;
