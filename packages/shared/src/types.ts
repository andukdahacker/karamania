import type { DJStateType } from './states.js';

export interface DJState {
  type: DJStateType;
  timestamp: number;
  sessionId: string;
}

export interface PartySession {
  id: string;
  partyCode: string;
  hostUid: string;
  participants: Participant[];
  createdAt: number;
}

export interface Participant {
  uid: string;
  displayName: string;
  joinedAt: number;
  isHost: boolean;
}
