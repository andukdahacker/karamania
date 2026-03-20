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
import { persistDjState, processDjTransition, recordParticipationAction, incrementCardAccepted } from '../services/session-manager.js';
import { validateHost } from './host-handlers.js';
import { getActiveConnections } from '../services/connection-tracker.js';
import { selectGroupParticipants } from '../services/group-card-selector.js';

export function registerCardHandlers(
  socket: AuthenticatedSocket,
  io: SocketIOServer
): void {
  // card:accepted — singer accepts the dealt party card
  socket.on(EVENTS.CARD_ACCEPTED, async (payload: { cardId: string }) => {
    const { sessionId, userId, displayName } = socket.data;
    if (!sessionId || !userId) return;

    const context = getSessionDjState(sessionId);
    if (!context || context.state !== DJState.partyCardDeal) return;

    // Singer guard — only the current performer can accept
    if (context.currentPerformer !== userId) return;

    const currentCard = context.metadata.currentCard as { id: string; title?: string; type?: string } | undefined;
    if (!currentCard || currentCard.id !== payload.cardId) return;

    recordActivity(sessionId);

    // Record participation scoring at engaged tier (5pts)
    recordParticipationAction(sessionId, userId, 'card:accepted').catch((err) => {
      console.error(`[card-handlers] Failed to record participation for ${userId}:`, err);
    });
    incrementCardAccepted(sessionId);

    // Update DJ context metadata with acceptance state
    const updatedContext = {
      ...context,
      metadata: {
        ...context.metadata,
        cardAccepted: true,
        acceptedCardId: payload.cardId,
      },
    };
    setSessionDjState(sessionId, updatedContext);
    void persistDjState(sessionId, serializeDJContext(updatedContext));

    // Group card activation — select participants and broadcast
    if (currentCard.type === 'group') {
      const connections = getActiveConnections(sessionId);
      const selection = selectGroupParticipants(currentCard.id, userId, connections);

      updatedContext.metadata.groupCardSelection = selection;
      setSessionDjState(sessionId, updatedContext);
      void persistDjState(sessionId, serializeDJContext(updatedContext));

      io.to(sessionId).emit(EVENTS.CARD_GROUP_ACTIVATED, {
        cardId: payload.cardId,
        cardType: 'group',
        announcement: selection.announcement,
        selectedUserIds: selection.selectedUserIds,
        selectedDisplayNames: selection.selectedDisplayNames,
        singerName: displayName,
      });

      appendEvent(sessionId, {
        type: 'card:groupActivated',
        ts: Date.now(),
        userId,
        data: { cardId: currentCard.id, selectedUserIds: selection.selectedUserIds, announcement: selection.announcement },
      });
    }

    // Broadcast acceptance to all participants so audience sees active challenge
    io.to(sessionId).emit(EVENTS.CARD_ACCEPTED, {
      cardId: payload.cardId,
      cardTitle: currentCard.title ?? '',
      cardType: currentCard.type ?? '',
      singerName: displayName,
    });

    // Log to event stream
    appendEvent(sessionId, {
      type: 'card:accepted',
      ts: Date.now(),
      userId,
      data: { cardId: payload.cardId, cardType: (currentCard.type as string) ?? '' },
    });

    // Trigger CARD_DONE transition to advance to song state
    await processDjTransition(sessionId, updatedContext, { type: 'CARD_DONE' });
  });

  // card:dismissed — singer dismisses the dealt party card (or auto-dismiss on timer)
  socket.on(EVENTS.CARD_DISMISSED, async (payload: { cardId: string }) => {
    const { sessionId, userId } = socket.data;
    if (!sessionId || !userId) return;

    const context = getSessionDjState(sessionId);
    if (!context || context.state !== DJState.partyCardDeal) return;

    // Singer guard — only the current performer can dismiss
    if (context.currentPerformer !== userId) return;

    const currentCard = context.metadata.currentCard as { id: string; type?: string } | undefined;
    if (!currentCard || currentCard.id !== payload.cardId) return;

    recordActivity(sessionId);

    // No participation points for dismissal

    // Update DJ context metadata
    const updatedContext = {
      ...context,
      metadata: {
        ...context.metadata,
        cardAccepted: false,
        acceptedCardId: null,
      },
    };
    setSessionDjState(sessionId, updatedContext);
    void persistDjState(sessionId, serializeDJContext(updatedContext));

    // Log to event stream
    appendEvent(sessionId, {
      type: 'card:dismissed',
      ts: Date.now(),
      userId,
      data: { cardId: payload.cardId, cardType: (currentCard.type as string) ?? '' },
    });

    // Trigger CARD_DONE transition to advance to song state
    await processDjTransition(sessionId, updatedContext, { type: 'CARD_DONE' });
  });

  // card:redraw — host OR singer can redraw the current card
  socket.on(EVENTS.CARD_REDRAW, async () => {
    const { sessionId, userId } = socket.data;
    if (!sessionId || !userId) return;

    const context = getSessionDjState(sessionId);
    if (!context || context.state !== DJState.partyCardDeal) return;

    // Allow if host OR if current singer
    const isSinger = context.currentPerformer === userId;
    let isHost = false;
    try {
      await validateHost(socket);
      isHost = true;
    } catch {
      // Not host
    }

    if (!isHost && !isSinger) return;

    // Singer redraw: check redrawUsed flag (one free redraw per turn)
    if (isSinger && !isHost) {
      if (context.metadata.redrawUsed === true) return;
    }

    const currentCard = context.metadata.currentCard as { id: string } | undefined;
    if (!currentCard) return;

    recordActivity(sessionId);

    const newCard = redealCard(sessionId, context.participantCount, currentCard.id);

    // Update metadata with new card + mark redraw used for singer
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
        redrawUsed: isSinger ? true : context.metadata.redrawUsed,
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

  // card:shared — track share intent as viral signal
  socket.on(EVENTS.CARD_SHARED, (payload: { type: string; timestamp: number }) => {
    const { sessionId, userId } = socket.data;
    if (!sessionId || !userId) return;

    if (!payload || typeof payload.type !== 'string' || !payload.type) return;
    if (typeof payload.timestamp !== 'number') return;

    appendEvent(sessionId, {
      type: 'card:shared',
      ts: Date.now(),
      userId,
      data: { type: payload.type },
    });
  });
}
