// In-memory DJ state store — hot cache for active sessions
// No persistence imports — pure in-memory Map

import type { DJContext } from '../dj-engine/types.js';

const store = new Map<string, DJContext>();

export function getSessionDjState(sessionId: string): DJContext | undefined {
  return store.get(sessionId);
}

export function setSessionDjState(sessionId: string, context: DJContext): void {
  store.set(sessionId, context);
}

export function removeSessionDjState(sessionId: string): void {
  store.delete(sessionId);
}

export function getAllActiveSessions(): Array<{ sessionId: string; context: DJContext }> {
  return Array.from(store.entries()).map(([sessionId, context]) => ({ sessionId, context }));
}

export function clearAllSessions(): void {
  store.clear();
}
