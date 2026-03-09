import { generateUniquePartyCode } from '../services/party-code.js';
import * as sessionRepo from '../persistence/session-repository.js';
import { DEFAULT_VIBE } from '../shared/constants.js';
import { createAppError } from '../shared/errors.js';

// TODO: Add restoreSession(), endSession() in future stories
// TODO: endSession() must set status='ended' to expire party codes (NFR21)

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

export async function startSession(params: {
  sessionId: string;
  hostUserId: string;
}): Promise<{ status: string }> {
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

  return { status: 'active' };
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
}> {
  // 1. Add participant (idempotent — handles reconnection + host duplicate)
  await sessionRepo.addParticipantIfNotExists({
    sessionId: params.sessionId,
    userId: params.role === 'guest' ? undefined : params.userId,
    guestName: params.role === 'guest' ? params.displayName : undefined,
  });

  // 2. Get current participants + session metadata
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
  };
}
