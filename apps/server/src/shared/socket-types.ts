import type { Socket } from 'socket.io';

export interface SocketData {
  userId: string;      // Firebase UID or generated guest UUID
  sessionId: string;   // Party session UUID
  role: 'guest' | 'authenticated';
  displayName: string; // From Firebase profile or guest input
}

export type AuthenticatedSocket = Socket & { data: SocketData };
