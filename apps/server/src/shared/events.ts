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

  // Song events
  SONG_DETECTED: 'song:detected',
  SONG_QUEUED: 'song:queued',
  SONG_QUICKPICK: 'song:quickpick',
  SONG_SPINWHEEL: 'song:spinwheel',

  // Capture events
  CAPTURE_BUBBLE: 'capture:bubble',
  CAPTURE_STARTED: 'capture:started',
  CAPTURE_COMPLETE: 'capture:complete',

  // Host events
  HOST_SKIP: 'host:skip',
  HOST_OVERRIDE: 'host:override',
  HOST_SONG_OVER: 'host:songOver',
  HOST_END_PARTY: 'host:endParty',
  HOST_KICK_PLAYER: 'host:kickPlayer',

  // Party participant removal
  PARTY_PARTICIPANT_REMOVED: 'party:participantRemoved',

  // Session events (auth-related errors)
  SESSION_NOT_FOUND: 'session:notFound',
  SESSION_FULL: 'session:full',

  // Auth events
  AUTH_REFRESH_REQUIRED: 'auth:refreshRequired',
  AUTH_INVALID: 'auth:invalid',
} as const;
