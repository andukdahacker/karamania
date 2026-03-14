import type { Server as SocketIOServer } from 'socket.io';
import type { AuthenticatedSocket } from '../shared/socket-types.js';
import { EVENTS } from '../shared/events.js';
import { getSessionDjState, setSessionDjState } from '../services/dj-state-store.js';
import { DJState } from '../dj-engine/types.js';
import { redealCard } from '../services/card-dealer.js';
import { broadcastCardDealt } from '../services/dj-broadcaster.js';
import { recordActivity } from '../services/activity-tracker.js';
import { appendEvent } from '../services/event-stream.js';
import { serializeDJContext } from '../dj-engine/serializer.js';
import { persistDjState } from '../services/session-manager.js';
import { validateHost } from './host-handlers.js';

export function registerCardHandlers(
  socket: AuthenticatedSocket,
  io: SocketIOServer
): void {
  // Host re-deal: replace current card with a different random one
  socket.on(EVENTS.CARD_REDRAW, async () => {
    try {
      await validateHost(socket);
    } catch {
      return; // Not host — silently ignore
    }

    const { sessionId, userId } = socket.data;
    if (!sessionId || !userId) return;

    const context = getSessionDjState(sessionId);
    if (!context || context.state !== DJState.partyCardDeal) return;

    const currentCard = context.metadata.currentCard as { id: string } | undefined;
    if (!currentCard) return;

    recordActivity(sessionId);

    const newCard = redealCard(sessionId, context.participantCount, currentCard.id);

    // Update metadata with new card
    const updatedContext = {
      ...context,
      metadata: {
        ...context.metadata,
        currentCard: {
          id: newCard.id,
          title: newCard.title,
          description: newCard.description,
          type: newCard.type,
          emoji: newCard.emoji,
        },
      },
    };
    setSessionDjState(sessionId, updatedContext);
    void persistDjState(sessionId, serializeDJContext(updatedContext));

    // Broadcast new card to all participants
    broadcastCardDealt(sessionId, {
      cardId: newCard.id,
      title: newCard.title,
      description: newCard.description,
      cardType: newCard.type,
      emoji: newCard.emoji,
    });

    // Log re-deal
    appendEvent(sessionId, {
      type: 'card:redealt',
      ts: Date.now(),
      userId,
      data: { previousCardId: currentCard.id, newCardId: newCard.id },
    });
  });
}
