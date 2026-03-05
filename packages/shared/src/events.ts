export interface ServerToClientEvents {
  'dj:stateChanged': (payload: { state: import('./types.js').DJState }) => void;
  'party:playerJoined': (payload: { participant: import('./types.js').Participant }) => void;
  'party:playerLeft': (payload: { uid: string }) => void;
}

export interface ClientToServerEvents {
  'host:startParty': () => void;
  'host:skipSong': () => void;
  'player:join': (payload: { partyCode: string; displayName: string }) => void;
}
