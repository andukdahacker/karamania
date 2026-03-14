# Story 4.4: Party Card Pool & Deal System

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a singer,
I want to receive a fun challenge card before my performance,
so that my song has an entertaining twist that engages the whole group.

## Acceptance Criteria

1. **Given** the DJ engine enters the partyCardDeal state **When** the party card deal phase begins **Then** a random party card is dealt from the curated pool of 19 cards (FR54) **And** the pool contains 7 vocal modifier cards: Chipmunk Mode, Barry White, The Whisperer, Robot Mode, Opera Singer, Accent Roulette, Beatboxer (FR56) **And** the pool contains 7 performance modifier cards: Blind Karaoke, Method Actor, The Statue, Slow Motion, The Drunk Uncle, News Anchor, Interpretive Dance (FR57) **And** the pool contains 5 group involvement cards: Name That Tune, Backup Dancers, Crowd Conductor, Tag Team, Hype Squad (FR58) **And** the card is presented with a slide-up flip animation (FR55) **And** cards have visual type differentiation: blue borders (vocal), purple borders (performance), gold borders (group involvement)
2. **Given** the app auto-deals by default **When** the host wants to intervene **Then** the host can skip card dealing for a turn via HOST_SKIP (already supported) **And** the host can trigger a re-deal to get a different random card via `card:redraw` (validated as host)
3. **Given** fewer than 3 participants are in the party **When** the DJ engine enters partyCardDeal **Then** group involvement cards that require 3+ participants are excluded from the eligible pool (NFR12)
4. **Given** the partyCardDeal state has a timer **When** no interaction occurs (Story 4.5 adds accept/dismiss) **Then** the state auto-advances to song via TIMEOUT after 15 seconds

## Tasks / Subtasks

- [x] Task 1: Define party card pool on server (AC: #1, #3)
  - [x] 1.1 Create `apps/server/src/services/party-card-pool.ts`:
    ```typescript
    import { DJState } from '../dj-engine/types.js';

    export const CardType = {
      vocal: 'vocal',
      performance: 'performance',
      group: 'group',
    } as const;
    export type CardType = (typeof CardType)[keyof typeof CardType];

    export interface PartyCard {
      id: string;
      title: string;
      description: string;
      type: CardType;
      emoji: string;
      minParticipants: number; // 1 for vocal/performance, 3 for group
    }

    export const PARTY_CARDS: readonly PartyCard[] = [
      // Vocal Modifier Cards (7) — FR56
      { id: 'chipmunk-mode', title: 'Chipmunk Mode', description: 'Sing in the highest pitch you can manage', type: CardType.vocal, emoji: '🐿️', minParticipants: 1 },
      { id: 'barry-white', title: 'Barry White', description: 'Channel your deepest, smoothest bass voice', type: CardType.vocal, emoji: '🎵', minParticipants: 1 },
      { id: 'the-whisperer', title: 'The Whisperer', description: 'Perform the entire song in a dramatic whisper', type: CardType.vocal, emoji: '🤫', minParticipants: 1 },
      { id: 'robot-mode', title: 'Robot Mode', description: 'Sing like a malfunctioning robot — monotone and glitchy', type: CardType.vocal, emoji: '🤖', minParticipants: 1 },
      { id: 'opera-singer', title: 'Opera Singer', description: 'Give it full operatic vibrato and drama', type: CardType.vocal, emoji: '🎭', minParticipants: 1 },
      { id: 'accent-roulette', title: 'Accent Roulette', description: 'Pick a random accent and commit to it for the whole song', type: CardType.vocal, emoji: '🌍', minParticipants: 1 },
      { id: 'beatboxer', title: 'Beatboxer', description: 'Add beatbox sounds between lyrics', type: CardType.vocal, emoji: '🥁', minParticipants: 1 },

      // Performance Modifier Cards (7) — FR57
      { id: 'blind-karaoke', title: 'Blind Karaoke', description: 'Close your eyes — no peeking at lyrics!', type: CardType.performance, emoji: '🙈', minParticipants: 1 },
      { id: 'method-actor', title: 'Method Actor', description: 'Act out every lyric with full dramatic commitment', type: CardType.performance, emoji: '🎬', minParticipants: 1 },
      { id: 'the-statue', title: 'The Statue', description: 'Sing without moving your body at all — freeze!', type: CardType.performance, emoji: '🗿', minParticipants: 1 },
      { id: 'slow-motion', title: 'Slow Motion', description: 'Move in slow motion while singing at normal speed', type: CardType.performance, emoji: '🐌', minParticipants: 1 },
      { id: 'the-drunk-uncle', title: 'The Drunk Uncle', description: 'Perform like the lovable relative at a wedding who insists on karaoke', type: CardType.performance, emoji: '🍺', minParticipants: 1 },
      { id: 'news-anchor', title: 'News Anchor', description: 'Deliver the song like you\'re reading breaking news', type: CardType.performance, emoji: '📺', minParticipants: 1 },
      { id: 'interpretive-dance', title: 'Interpretive Dance', description: 'Express every emotion through interpretive dance while singing', type: CardType.performance, emoji: '💃', minParticipants: 1 },

      // Group Involvement Cards (5) — FR58
      { id: 'name-that-tune', title: 'Name That Tune', description: 'Hum the first few bars — audience guesses the song before you sing', type: CardType.group, emoji: '🎶', minParticipants: 3 },
      { id: 'backup-dancers', title: 'Backup Dancers', description: 'Random audience members become your backup dancers', type: CardType.group, emoji: '🕺', minParticipants: 3 },
      { id: 'crowd-conductor', title: 'Crowd Conductor', description: 'You control when the audience claps, waves, or cheers', type: CardType.group, emoji: '🎼', minParticipants: 3 },
      { id: 'tag-team', title: 'Tag Team', description: 'A random participant joins you — alternate verses!', type: CardType.group, emoji: '🏷️', minParticipants: 3 },
      { id: 'hype-squad', title: 'Hype Squad', description: 'Random participants must hype you up throughout the song', type: CardType.group, emoji: '📣', minParticipants: 3 },
    ] as const;

    /**
     * Get eligible cards for the current participant count.
     * Filters out group cards when < 3 participants (NFR12).
     */
    export function getEligibleCards(participantCount: number): PartyCard[] {
      return PARTY_CARDS.filter(card => participantCount >= card.minParticipants);
    }
    ```
    **Design decisions:**
    - `id` is kebab-case string for stable identity across server/client and event logging
    - `minParticipants` handles NFR12 at the data level — no special-case logic needed
    - `emoji` included for Flutter display (same emoji on both sides)
    - `description` is the challenge instruction shown to the singer
    - `as const` on the array makes it readonly — cards never change at runtime

- [x] Task 2: Create card dealer service (AC: #1, #3)
  - [x] 2.1 Create `apps/server/src/services/card-dealer.ts`:
    ```typescript
    import { getEligibleCards } from './party-card-pool.js';
    import type { PartyCard } from './party-card-pool.js';

    // Track dealt cards per session to avoid repeats until pool exhausted
    const sessionDealtCards = new Map<string, Set<string>>();

    /**
     * Deal a random card from the eligible pool, avoiding recently dealt cards.
     * When all eligible cards have been dealt, resets the tracking and starts fresh.
     */
    export function dealCard(sessionId: string, participantCount: number): PartyCard {
      const eligible = getEligibleCards(participantCount);
      const dealt = sessionDealtCards.get(sessionId) ?? new Set<string>();

      // Filter out already-dealt cards
      let available = eligible.filter(card => !dealt.has(card.id));

      // If all eligible cards dealt, reset and use full eligible pool
      if (available.length === 0) {
        dealt.clear();
        available = eligible;
      }

      // Random selection
      const index = Math.floor(Math.random() * available.length);
      const card = available[index]!;

      // Track dealt card
      dealt.add(card.id);
      sessionDealtCards.set(sessionId, dealt);

      return card;
    }

    /**
     * Deal a specific card (for host override re-deal — excludes the current card).
     */
    export function redealCard(sessionId: string, participantCount: number, excludeCardId: string): PartyCard {
      const eligible = getEligibleCards(participantCount);
      const available = eligible.filter(card => card.id !== excludeCardId);

      if (available.length === 0) {
        // Only one eligible card — return it (same card)
        return eligible[0]!;
      }

      const index = Math.floor(Math.random() * available.length);
      const card = available[index]!;

      // Track dealt card
      const dealt = sessionDealtCards.get(sessionId) ?? new Set<string>();
      dealt.add(card.id);
      sessionDealtCards.set(sessionId, dealt);

      return card;
    }

    /**
     * Clear dealt card tracking for a session (on session end).
     */
    export function clearDealtCards(sessionId: string): void {
      sessionDealtCards.delete(sessionId);
    }
    ```
    **Design decisions:**
    - Session-scoped tracking avoids repeats within a session — resets when pool is exhausted
    - `redealCard` excludes the current card to guarantee a different one
    - `clearDealtCards` called on session end (cleanup)
    - No rate limiting on dealing — that's handled at the DJ engine timer level

- [x] Task 3: Add card:dealt broadcaster (AC: #1)
  - [x] 3.1 In `apps/server/src/services/dj-broadcaster.ts`, add `broadcastCardDealt` function after `broadcastCeremonyQuick`:
    ```typescript
    export function broadcastCardDealt(
      sessionId: string,
      data: {
        cardId: string;
        title: string;
        description: string;
        cardType: string;
        emoji: string;
      },
    ): void {
      if (!io) {
        console.warn('[dj-broadcaster] Cannot broadcast — io not initialized');
        return;
      }
      io.to(sessionId).emit(EVENTS.CARD_DEALT, data);
    }
    ```
    **Design:** Broadcasts to ALL participants — everyone sees what card was dealt. This matches ceremony broadcasts where all clients receive the reveal.

  - [x] 3.2 In `apps/server/src/services/session-manager.ts`, add import for `broadcastCardDealt`:
    Update the existing import line from `dj-broadcaster.js` to include `broadcastCardDealt`:
    ```typescript
    import { broadcastDjState, broadcastDjPause, broadcastDjResume, broadcastCeremonyAnticipation, broadcastCeremonyReveal, broadcastCeremonyQuick, broadcastCardDealt } from '../services/dj-broadcaster.js';
    ```

- [x] Task 4: Orchestrate card dealing in session-manager (AC: #1, #3)
  - [x] 4.1 In `apps/server/src/services/session-manager.ts`, add imports for card dealer:
    ```typescript
    import { dealCard } from '../services/card-dealer.js';
    ```

  - [x] 4.2 Add `orchestrateCardDeal()` function. Place after `orchestrateQuickCeremony()` (around line 162):
    ```typescript
    function orchestrateCardDeal(
      sessionId: string,
      context: DJContext,
    ): void {
      const card = dealCard(sessionId, context.participantCount);

      // Store dealt card in DJ context metadata for persistence/recovery
      const updatedContext: DJContext = {
        ...context,
        metadata: {
          ...context.metadata,
          currentCard: {
            id: card.id,
            title: card.title,
            description: card.description,
            type: card.type,
            emoji: card.emoji,
          },
        },
      };
      setSessionDjState(sessionId, updatedContext);
      void persistDjState(sessionId, serializeDJContext(updatedContext));

      // Broadcast card to all participants
      broadcastCardDealt(sessionId, {
        cardId: card.id,
        title: card.title,
        description: card.description,
        cardType: card.type,
        emoji: card.emoji,
      });

      // Log to event stream
      appendEvent(sessionId, {
        type: 'card:dealt',
        ts: Date.now(),
        data: { cardId: card.id, cardType: card.type },
      });
    }
    ```
    **Design decisions:**
    - Stores card in DJ context metadata (like ceremonyType) for crash recovery — if server restarts, card data is in PostgreSQL JSONB
    - Persists immediately (fire-and-forget) for durability
    - Broadcasts to all clients — everyone sees the challenge
    - No `async` needed — all operations are synchronous or fire-and-forget

  - [x] 4.3 Add card deal orchestration in `processDjTransition()`. Add AFTER the ceremony orchestration block (after line 514) and BEFORE the side effects loop:
    ```typescript
    // Orchestrate card dealing when entering partyCardDeal state
    if (newContext.state === DJState.partyCardDeal) {
      orchestrateCardDeal(sessionId, newContext);
    }
    ```
    **Pattern:** Identical to ceremony orchestration — orchestrate AFTER transition, BEFORE side effect processing.

  - [x] 4.4 Add import for `serializeDJContext` if not already imported. Check the existing imports — `serializeDJContext` is imported via `../dj-engine/serializer.js` at line 6 (already present). **No change needed.**

  - [x] 4.5 In `apps/server/src/services/session-manager.ts`, import `clearDealtCards` and call it in `endSession()` for cleanup. Find the `endSession` function and add:
    ```typescript
    import { dealCard, clearDealtCards } from '../services/card-dealer.js';
    ```
    In the `endSession()` function body, add after existing cleanup calls:
    ```typescript
    clearDealtCards(sessionId);
    ```

- [x] Task 5: Add card:dealt and card:redraw event types to event-stream (AC: #1, #2)
  - [x] 5.1 In `apps/server/src/services/event-stream.ts`, add `card:dealt` event type to the `SessionEvent` union. Add after the `sound:play` line:
    ```typescript
    | { type: 'card:dealt'; ts: number; data: { cardId: string; cardType: string } }
    | { type: 'card:redealt'; ts: number; userId: string; data: { previousCardId: string; newCardId: string } }
    ```

- [x] Task 6: Update DJ engine partyCardDeal configuration (AC: #4)
  - [x] 6.1 In `apps/server/src/dj-engine/states.ts`, remove placeholder flag and update the comment:
    ```typescript
    [DJState.partyCardDeal]: {
      // Story 4.4: Party card dealing — auto-advances via TIMEOUT if no interaction
      allowedTransitions: ['CARD_DEALT', 'CARD_DONE', 'TIMEOUT', 'HOST_SKIP', 'HOST_OVERRIDE', 'END_PARTY'],
      hasTimeout: true,
      isPlaceholder: false,
    },
    ```
    **Change:** `isPlaceholder: true` → `isPlaceholder: false`, comment updated.

  - [x] 6.2 In `apps/server/src/dj-engine/timers.ts`, update timer from 5s to 15s:
    ```typescript
    [DJState.partyCardDeal]: 15_000,    // 15s: card display + future accept/dismiss interaction (Story 4.5)
    ```

- [x] Task 7: Create card handler for host re-deal (AC: #2)
  - [x] 7.1 **PREREQUISITE:** Export `validateHost` from `apps/server/src/socket-handlers/host-handlers.ts`. It is currently a private function (line 17). Add the `export` keyword:
    ```typescript
    // Change from:
    async function validateHost(socket: AuthenticatedSocket): Promise<void> {
    // To:
    export async function validateHost(socket: AuthenticatedSocket): Promise<void> {
    ```
    **Why:** `card-handlers.ts` needs host validation for re-deal. Exporting avoids duplicating the DB lookup + error handling logic. All existing internal uses within `host-handlers.ts` are unaffected by adding `export`.

  - [x] 7.2 Create `apps/server/src/socket-handlers/card-handlers.ts`:
    ```typescript
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
    ```
    **Design decisions:**
    - `card:redraw` event reused for host re-deal (host-validated). Story 4.5 will add singer-initiated redraw (different validation)
    - `validateHost` imported from `host-handlers.ts` — same pattern used by HOST_SKIP/HOST_OVERRIDE
    - Replaces card in metadata and re-broadcasts — Flutter clients will see new `card:dealt` event replacing previous card
    - State guard: only during `partyCardDeal` state
    - Silently ignores non-host callers (security)

  - [x] 7.3 Register handler in `apps/server/src/socket-handlers/connection-handler.ts`:
    - Add import: `import { registerCardHandlers } from './card-handlers.js';`
    - Add registration call AFTER `registerSoundboardHandlers(s, io);` (line 49):
      ```typescript
      registerCardHandlers(s, io);
      ```

- [x] Task 8: Define party card constants in Flutter (AC: #1)
  - [x] 8.1 Create `apps/flutter_app/lib/constants/party_cards.dart`:
    ```dart
    /// Party card type for visual differentiation.
    enum PartyCardType {
      vocal,
      performance,
      group;

      /// Border color for card type visual differentiation (AC #1).
      int get borderColor => switch (this) {
        PartyCardType.vocal => 0xFF4A9EFF,       // Blue
        PartyCardType.performance => 0xFFAB47BC,  // Purple
        PartyCardType.group => 0xFFFFB300,        // Gold
      };

      String get label => switch (this) {
        PartyCardType.vocal => 'Vocal Modifier',
        PartyCardType.performance => 'Performance Modifier',
        PartyCardType.group => 'Group Involvement',
      };
    }

    /// Party card data — matches server PartyCard interface.
    class PartyCardData {
      const PartyCardData({
        required this.id,
        required this.title,
        required this.description,
        required this.type,
        required this.emoji,
      });

      final String id;
      final String title;
      final String description;
      final PartyCardType type;
      final String emoji;

      /// Parse from socket event payload.
      factory PartyCardData.fromPayload(Map<String, dynamic> payload) {
        return PartyCardData(
          id: payload['cardId'] as String,
          title: payload['title'] as String,
          description: payload['description'] as String,
          type: PartyCardType.values.byName(payload['cardType'] as String),
          emoji: payload['emoji'] as String,
        );
      }
    }
    ```
    **Design decisions:**
    - `borderColor` on the enum provides type-based visual differentiation (blue/purple/gold per AC)
    - `fromPayload` factory parses the `card:dealt` socket event payload
    - Matches server `PartyCard` interface structure exactly
    - No full card pool needed in Flutter — cards come from server via socket event

- [x] Task 9: Add card state to PartyProvider (AC: #1)
  - [x] 9.1 In `apps/flutter_app/lib/state/party_provider.dart`, add import:
    ```dart
    import 'package:karamania/constants/party_cards.dart';
    ```

  - [x] 9.2 Add card state fields after the ceremony state fields (after line 81, `Timer? _momentCardTimer;`):
    ```dart
    // Party card state — populated by card:dealt event
    PartyCardData? _currentCard;
    ```

  - [x] 9.3 Add getter after ceremony getters:
    ```dart
    PartyCardData? get currentCard => _currentCard;
    ```

  - [x] 9.4 Add `onCardDealt` handler after `dismissMomentCard()`:
    ```dart
    void onCardDealt(PartyCardData card) {
      _currentCard = card;
      notifyListeners();
    }
    ```

  - [x] 9.5 Add card state clearing in `onDjStateUpdate()`. When leaving `partyCardDeal`, clear card data. Add after the reaction feed clearing block (after line 257):
    ```dart
    // Clear card state when leaving partyCardDeal state
    if (_djState == DJState.partyCardDeal && state != DJState.partyCardDeal) {
      _currentCard = null;
    }
    ```

- [x] Task 10: Add card:dealt listener to SocketClient (AC: #1)
  - [x] 10.1 In `apps/flutter_app/lib/socket/client.dart`, add import:
    ```dart
    import 'package:karamania/constants/party_cards.dart';
    ```

  - [x] 10.2 Add `card:dealt` listener in `_setupPartyListeners()` after the `sound:play` listener:
    ```dart
    // Card dealt — server dealt a party card for the current round
    on('card:dealt', (data) {
      final payload = data as Map<String, dynamic>;
      try {
        final card = PartyCardData.fromPayload(payload);
        _partyProvider?.onCardDealt(card);
      } catch (_) {
        // Malformed payload — ignore silently
      }
    });
    ```
    **Design:** Follows the same pattern as `ceremony:anticipation` and `ceremony:reveal` listeners — parse payload, call provider method.

  - [x] 10.3 Add `emitCardRedraw()` method for host re-deal. Place after `emitSoundboard()`:
    ```dart
    void emitCardRedraw() {
      _socket?.emit('card:redraw');
    }
    ```

- [x] Task 11: Add card copy to constants (AC: #1)
  - [x] 11.1 In `apps/flutter_app/lib/constants/copy.dart`, add card-related copy. Place after the soundboard section:
    ```dart
    // Party card copy
    static const String partyCardTitle = 'Your Challenge';
    static const String partyCardTypeVocal = 'Vocal Modifier';
    static const String partyCardTypePerformance = 'Performance Modifier';
    static const String partyCardTypeGroup = 'Group Involvement';
    ```

- [x] Task 12: Create PartyCardDealOverlay widget (AC: #1)
  - [x] 12.1 Create `apps/flutter_app/lib/widgets/party_card_deal_overlay.dart`:
    ```dart
    import 'dart:math' as math;
    import 'package:flutter/material.dart';
    import 'package:karamania/constants/copy.dart';
    import 'package:karamania/constants/party_cards.dart';
    import 'package:karamania/theme/dj_tokens.dart';

    /// Full-screen overlay displaying the dealt party card with slide-up flip animation.
    /// Shown during DJState.partyCardDeal when a card has been dealt.
    class PartyCardDealOverlay extends StatefulWidget {
      const PartyCardDealOverlay({
        super.key,
        required this.card,
      });

      final PartyCardData card;

      @override
      State<PartyCardDealOverlay> createState() => _PartyCardDealOverlayState();
    }

    class _PartyCardDealOverlayState extends State<PartyCardDealOverlay>
        with TickerProviderStateMixin {
      late final AnimationController _slideController;
      late final AnimationController _flipController;
      late final Animation<Offset> _slideAnimation;
      late final Animation<double> _flipAnimation;
      late final Animation<double> _fadeAnimation;

      @override
      void initState() {
        super.initState();

        // Slide up from bottom (400ms, easeOut)
        _slideController = AnimationController(
          duration: const Duration(milliseconds: 400),
          vsync: this,
        );
        _slideAnimation = Tween<Offset>(
          begin: const Offset(0.0, 1.0),
          end: Offset.zero,
        ).animate(CurvedAnimation(
          parent: _slideController,
          curve: Curves.easeOut,
        ));
        _fadeAnimation = Tween<double>(
          begin: 0.0,
          end: 1.0,
        ).animate(CurvedAnimation(
          parent: _slideController,
          curve: Curves.easeOut,
        ));

        // Flip reveal (500ms, easeOutBack) — starts after slide completes
        _flipController = AnimationController(
          duration: const Duration(milliseconds: 500),
          vsync: this,
        );
        _flipAnimation = Tween<double>(
          begin: math.pi / 2, // 90 degrees — card edge-on (hidden)
          end: 0.0,           // 0 degrees — card face (revealed)
        ).animate(CurvedAnimation(
          parent: _flipController,
          curve: Curves.easeOutBack,
        ));

        // Start slide, then flip
        _slideController.forward().then((_) {
          if (mounted) _flipController.forward();
        });
      }

      @override
      void didUpdateWidget(PartyCardDealOverlay oldWidget) {
        super.didUpdateWidget(oldWidget);
        // If card changes (host re-deal), replay flip animation
        if (oldWidget.card.id != widget.card.id) {
          _flipController.reset();
          _flipController.forward();
        }
      }

      @override
      void dispose() {
        _slideController.dispose();
        _flipController.dispose();
        super.dispose();
      }

      @override
      Widget build(BuildContext context) {
        return FadeTransition(
          opacity: _fadeAnimation,
          child: SlideTransition(
            position: _slideAnimation,
            child: Center(
              child: AnimatedBuilder(
                animation: _flipAnimation,
                builder: (context, child) {
                  return Transform(
                    alignment: Alignment.center,
                    transform: Matrix4.identity()
                      ..setEntry(3, 2, 0.001) // Perspective
                      ..rotateY(_flipAnimation.value),
                    child: child,
                  );
                },
                child: _buildCard(),
              ),
            ),
          ),
        );
      }

      Widget _buildCard() {
        final borderColor = Color(widget.card.type.borderColor);

        return Container(
          key: const Key('party-card-deal'),
          margin: const EdgeInsets.symmetric(horizontal: DJTokens.spaceXl),
          padding: const EdgeInsets.all(DJTokens.spaceLg),
          decoration: BoxDecoration(
            color: const Color(DJTokens.surfaceElevated),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: borderColor, width: 3),
            boxShadow: [
              BoxShadow(
                color: borderColor.withValues(alpha: 0.3),
                blurRadius: 20,
                spreadRadius: 2,
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Card type label
              Text(
                widget.card.type.label,
                style: TextStyle(
                  color: borderColor,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 1.2,
                ),
              ),
              const SizedBox(height: DJTokens.spaceMd),
              // Card emoji
              Text(
                widget.card.emoji,
                style: const TextStyle(fontSize: 48),
              ),
              const SizedBox(height: DJTokens.spaceMd),
              // Card title
              Text(
                widget.card.title,
                key: const Key('party-card-title'),
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Color(DJTokens.textPrimary),
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: DJTokens.spaceSm),
              // Card description (the challenge)
              Text(
                widget.card.description,
                key: const Key('party-card-description'),
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Color(DJTokens.textSecondary),
                  fontSize: 16,
                ),
              ),
              const SizedBox(height: DJTokens.spaceLg),
              // Challenge label
              Text(
                Copy.partyCardTitle,
                style: TextStyle(
                  color: const Color(DJTokens.textSecondary).withValues(alpha: 0.6),
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        );
      }
    }
    ```
    **Design decisions:**
    - **Slide-up + flip animation** (FR55): Card slides up from bottom (400ms easeOut), then flips to reveal (500ms easeOutBack). Two-phase animation creates drama
    - **`didUpdateWidget`**: When host re-deals, card.id changes → replay flip animation (re-reveal new card)
    - **Color-coded borders** per card type: blue (vocal 0xFF4A9EFF), purple (performance 0xFFAB47BC), gold (group 0xFFFFB300) with matching glow shadow
    - **No accept/dismiss buttons** — that's Story 4.5. This overlay only displays the dealt card
    - **Key('party-card-deal')** on main container for testing
    - Uses `DJTokens` spacing and colors consistently
    - `surfaceElevated` background matches the elevated card pattern used throughout the app

- [x] Task 13: Integrate card deal overlay into party screen (AC: #1)
  - [x] 13.1 In `apps/flutter_app/lib/screens/party_screen.dart`, add import:
    ```dart
    import 'package:karamania/widgets/party_card_deal_overlay.dart';
    ```

  - [x] 13.2 Add the PartyCardDealOverlay in the Stack. Place AFTER the moment card overlay block and BEFORE the reaction feed. The overlay should be shown when in `partyCardDeal` state AND a card has been dealt:
    ```dart
    // Party card deal overlay — during partyCardDeal state with dealt card
    if (partyProvider.djState == DJState.partyCardDeal &&
        partyProvider.currentCard != null)
      Positioned.fill(
        child: PartyCardDealOverlay(
          card: partyProvider.currentCard!,
        ),
      ),
    ```
    **CRITICAL:** This is a `Positioned.fill` overlay (same as moment card and ceremony displays) — covers the full screen. The card appears centered within.

- [x] Task 14: Add host re-deal button to host controls (AC: #2)
  - [x] 14.1 In `apps/flutter_app/lib/widgets/host_controls_overlay.dart`, add a conditional "Re-deal Card" button during `partyCardDeal` state. Inside the `if (_expanded) ...[` block (line 57), add BEFORE the existing Invite button (line 58). Access DJ state via `partyProvider.djState` (provider is already available at line 34):
    ```dart
    // Re-deal card button — only during partyCardDeal state
    if (partyProvider.djState == DJState.partyCardDeal) ...[
      _ControlButton(
        key: const Key('host-redeal-card'),
        label: Copy.hostControlRedealCard,
        icon: Icons.refresh,
        color: vibe.accent,
        onTap: () {
          _collapse();
          SocketClient.instance.emitCardRedraw();
        },
      ),
      const SizedBox(height: DJTokens.spaceSm),
    ],
    ```
    **Design:** Uses existing `_ControlButton` widget pattern (line 266). The `partyProvider` is already available at line 34 via `context.watch<PartyProvider>()`. Re-deal triggers `card:redraw` socket event which is host-validated on server.

  - [x] 14.2 In `apps/flutter_app/lib/constants/copy.dart`, add the re-deal button label alongside the other host control copy:
    ```dart
    static const String hostControlRedealCard = 'Re-deal Card';
    ```

- [x] Task 15: Server tests (AC: #1, #2, #3, #4)
  - [x] 15.1 Create `apps/server/tests/services/party-card-pool.test.ts`:
    - Test `PARTY_CARDS` contains exactly 19 cards
    - Test 7 cards have type 'vocal'
    - Test 7 cards have type 'performance'
    - Test 5 cards have type 'group'
    - Test all card IDs are unique
    - Test all cards have required fields (id, title, description, type, emoji, minParticipants)
    - Test `getEligibleCards(1)` returns only vocal + performance cards (14 cards)
    - Test `getEligibleCards(3)` returns all 19 cards
    - Test `getEligibleCards(2)` excludes group cards (minParticipants=3)
    - Test all vocal/performance cards have `minParticipants: 1`
    - Test all group cards have `minParticipants: 3`

  - [x] 15.2 Create `apps/server/tests/services/card-dealer.test.ts`:
    - Test `dealCard` returns a valid PartyCard
    - Test `dealCard` with participantCount=1 never returns group cards
    - Test `dealCard` with participantCount=3 can return any card type
    - Test `dealCard` avoids repeats within a session (deal all 14 non-group cards, verify no duplicates)
    - Test `dealCard` resets when pool exhausted (after dealing all eligible cards, next deal works)
    - Test `redealCard` returns a different card than the excluded one
    - Test `redealCard` with only 1 eligible card returns that card (edge case)
    - Test `clearDealtCards` resets tracking
    - Test sessions are independent (dealing in session A doesn't affect session B)

    **Mock pattern:** No external dependencies to mock — pure logic tests.

  - [x] 15.3 Create `apps/server/tests/socket-handlers/card-handlers.test.ts`:
    - Test `card:redraw` handler validates host via exported `validateHost` (non-host silently ignored)
    - Test `card:redraw` handler only fires during `partyCardDeal` state
    - Test `card:redraw` handler returns early if no current card in metadata
    - Test valid re-deal broadcasts new `card:dealt` event via `broadcastCardDealt`
    - Test re-deal updates DJ context metadata with new card
    - Test re-deal calls `persistDjState` with updated context
    - Test re-deal calls `appendEvent` with `card:redealt` event
    - Test re-deal calls `recordActivity`
    - Test re-deal returns early if sessionId or userId missing

    **Mock pattern:** Follow `soundboard-handlers.test.ts`:
    ```typescript
    vi.mock('../services/dj-state-store.js');
    vi.mock('../services/card-dealer.js');
    vi.mock('../services/dj-broadcaster.js');
    vi.mock('../services/activity-tracker.js');
    vi.mock('../services/event-stream.js');
    vi.mock('../dj-engine/serializer.js');
    vi.mock('../services/session-manager.js');
    vi.mock('./host-handlers.js');
    ```

  - [x] 15.4 ~~Update `apps/server/tests/dj-engine/states.test.ts`~~ — file does not exist. `isPlaceholder` and `getNextCycleState` behavior verified via `machine.test.ts` and `transitions.test.ts`.

  - [x] 15.5 Update `apps/server/tests/dj-engine/timers.test.ts`:
    - Update existing test that checks partyCardDeal timer — should now be 15000ms (was 5000ms)

  - [x] 15.6 **Regression tests**: Run full server test suite — all existing tests must pass. Update any tests that hardcoded `isPlaceholder: true` or `5000` for partyCardDeal timer. Expected baseline: 606 server tests (from 4.3) + ~25 new tests.

- [x] Task 16: Flutter tests (AC: #1, #2)
  - [x] 16.1 Create `apps/flutter_app/test/constants/party_cards_test.dart`:
    - Test `PartyCardType.vocal.borderColor` is blue (0xFF4A9EFF)
    - Test `PartyCardType.performance.borderColor` is purple (0xFFAB47BC)
    - Test `PartyCardType.group.borderColor` is gold (0xFFFFB300)
    - Test `PartyCardData.fromPayload` parses valid payload correctly
    - Test `PartyCardData.fromPayload` handles all three card types

  - [x] 16.2 Create `apps/flutter_app/test/widgets/party_card_deal_overlay_test.dart`:
    - Test renders card with correct title (`Key('party-card-title')`)
    - Test renders card with correct description (`Key('party-card-description')`)
    - Test renders card container (`Key('party-card-deal')`)
    - Test renders card emoji
    - Test renders card type label
    - Test when card changes (host re-deal), widget updates to show new card
    - **DO NOT test:** exact animation values, timing, pixel positions

  - [x] 16.3 Update `apps/flutter_app/test/socket/client_test.dart`:
    - Test `card:dealt` listener calls `partyProvider.onCardDealt()` with correct `PartyCardData`
    - Test `card:dealt` listener handles malformed payload gracefully (no crash)
    - Test `emitCardRedraw()` emits `'card:redraw'` event

  - [x] 16.4 Update `apps/flutter_app/test/state/party_provider_test.dart`:
    - Test `onCardDealt()` sets `currentCard` and notifies listeners
    - Test card state clears when leaving `partyCardDeal` state via `onDjStateUpdate()`

  - [x] 16.5 **Regression tests**: Run full Flutter test suite — all existing tests must pass. Expected baseline: 394 Flutter tests (from 4.3) + ~15 new tests.

## Dev Notes

### Architecture: Server-Orchestrated Card Dealing

Card dealing follows the **same orchestration pattern as ceremonies** (server-authoritative):

1. DJ engine transitions to `partyCardDeal` state (via cycle from songSelection)
2. `processDjTransition()` detects new state is `partyCardDeal`
3. `orchestrateCardDeal()` is called — selects random card, persists to metadata, broadcasts
4. Timer starts (15s) — auto-advances to `song` via TIMEOUT if no interaction
5. Story 4.5 will add: singer accepts/dismisses → fires CARD_DONE → advances to song

**Key difference from ceremonies:** Ceremonies have two-phase orchestration (anticipation → reveal). Card dealing is single-phase (deal → display). The card is revealed immediately.

[Source: _bmad-output/project-context.md#Core Principle — "Server-authoritative architecture"]

### Existing Infrastructure (DO NOT Recreate)

**Already built — consume as-is:**
- **DJState.partyCardDeal** (`dj-engine/types.ts:11`): State already exists in DJ engine. **MODIFY** `isPlaceholder` and timer only
- **CARD_DEALT, CARD_DONE transitions** (`dj-engine/types.ts:41-42`): Already defined. **DO NOT MODIFY**
- **getNextCycleState** (`dj-engine/states.ts:62-79`): Already handles partyCardDeal → song. **DO NOT MODIFY**
- **Low-participant bypass** (`dj-engine/states.ts:67`): songSelection skips to song when < 3 participants. **DO NOT MODIFY** — this already prevents partyCardDeal for tiny groups
- **Card socket events** (`shared/events.ts:37-41`): CARD_DEALT, CARD_ACCEPTED, CARD_DISMISSED, CARD_REDRAW already defined. **DO NOT MODIFY**
- **DJState.partyCardDeal background** (`dj_theme.dart`): `0xFF1A0A1A` (dark red tint) already defined for partyCardDeal state. **DO NOT MODIFY**
- **DJ state label** (`copy.dart:78`): `djStatePartyCardDeal = 'Party Card Deal'` already defined. **DO NOT MODIFY**
- **Host controls overlay** (`host_controls_overlay.dart`): Already includes partyCardDeal as valid override target. **EXTEND** with re-deal button only
- **Participation scoring** (`participation-scoring.ts:25-26`): `card:accepted` and `card:completed` already mapped as engaged tier (5pts). **DO NOT MODIFY** — Story 4.5 will trigger these
- **checkCardCompletion** (`session-manager.ts:179-182`): Placeholder returning false. **DO NOT MODIFY** in 4.4 — Story 4.5 will implement
- **Award generator cardCompleted** (`award-generator.ts`): Already uses `cardCompleted` in affinity matching. **DO NOT MODIFY** — will activate once 4.5 populates card:completed events
- **processDjTransition** (`session-manager.ts:465-536`): Orchestration hub. **EXTEND** with partyCardDeal orchestration block
- **broadcastDjState** (`dj-broadcaster.ts:42-49`): Already broadcasts state changes. **DO NOT MODIFY**
- **processTransition** (`dj-engine/machine.ts:40-83`): Pure transition function. **DO NOT MODIFY**
- **validateHost** (`host-handlers.ts:17`): Currently private. **EXPORT** it (add `export` keyword) so card-handlers.ts can reuse it
- **Connection handler** (`connection-handler.ts`): Handler registration. **EXTEND** with `registerCardHandlers`
- **Activity tracker** (`services/activity-tracker.ts`): `recordActivity(sessionId)`. **DO NOT MODIFY**
- **Event stream** (`services/event-stream.ts`): `appendEvent()`. **EXTEND** SessionEvent union with card event types
- **Timer scheduler** (`services/timer-scheduler.ts`): Already handles partyCardDeal timeout. **DO NOT MODIFY**

### What This Story DOES Build

- **Card pool definition** (19 cards with types, descriptions, emojis, participant requirements)
- **Card dealer service** (random selection with repeat avoidance, re-deal support)
- **Card deal orchestration** (server-side, triggered on partyCardDeal state entry)
- **Card deal broadcaster** (server → all clients via card:dealt event)
- **Card deal Flutter widget** (slide-up flip animation, color-coded borders)
- **Card state in PartyProvider** (card data, cleared on state change)
- **Host re-deal** (card:redraw event, host-validated)
- **DJ engine activation** (isPlaceholder removed, timer set to 15s)

### CARD_DEALT Transition — Not Used in 4.4

The `CARD_DEALT` DJ transition type exists in `types.ts` (line 41) and is in the `allowedTransitions` for `partyCardDeal`. However, **nothing in Story 4.4 fires this transition**. Card dealing is done via the `orchestrateCardDeal()` function call (not a state transition). The `TIMEOUT` transition handles auto-advancement to `song`. Story 4.5 will use `CARD_DONE` when the singer completes card interaction. `CARD_DEALT` may be vestigial — **DO NOT remove it** as it's pre-existing in the DJ engine.

### What This Story Does NOT Build

- **No accept/dismiss interaction** — Story 4.5 adds accept, dismiss, and redraw for the singer
- **No scoring integration** — Story 4.5 triggers `card:accepted` and `card:completed` scoring events
- **No group involvement participant selection** — Story 4.6 implements random participant selection for group cards
- **No card acceptance rate tracking** — Story 4.5 implements per-session tracking
- **No card completion flag update** — `checkCardCompletion` stays false until Story 4.5
- **No singer-specific card targeting** — cards are broadcast to all participants (performer tracking is Epic 5)
- **No card-specific audio cues** — could be added later with `AudioEngine`

### Previous Story Intelligence (Story 4.3)

Key learnings to apply:
- **Import paths matter**: Use `session-manager.js` for orchestration, `dj-state-store.js` for DJ state, `activity-tracker.js` for keepalive, `dj-broadcaster.js` for broadcasts
- **Handler signature**: `registerXxxHandlers(socket, io)` — takes BOTH socket and io
- **Orchestration pattern**: Follow ceremony orchestration (lines 492-514 in session-manager.ts) — orchestrate AFTER transition, store in metadata, broadcast, fire-and-forget persist
- **`mounted` check after async gaps** (Timer callbacks, animation completion) — apply in Flutter animations
- **Test baseline: 606 server tests, 394 Flutter tests**

### Code Review Patterns from 4.1-4.3

Common issues found and fixed:
- [H1] Wrong import paths for service functions — double-check against actual source
- [H2] Wrong function names — verify exact function signatures in source files
- [H3] Duplicate event logging — orchestration logs events, handlers log events, don't double-log
- [M1] Wrong provider field access pattern — `_partyProvider?.` in SocketClient
- [M4] Missing `recordActivity()` call for session keepalive
- [H1 from 4.2] Map deletion during iteration — collect keys first, then delete
- [H3 from 4.3] Extracted constants to separate files when copy.dart becomes cluttered

**Apply these lessons:** Double-check every import path, function name, and service call against the actual source files. Verify `validateHost` and `persistDjState` exports.

### DJ Engine State Flow for Card Dealing

```
songSelection ─── (TIMEOUT/SONG_SELECTED) ───→ partyCardDeal ─── (TIMEOUT/CARD_DONE) ───→ song
                                                     │
                                           orchestrateCardDeal()
                                           ├── dealCard() → random card
                                           ├── store in metadata
                                           ├── persistDjState()
                                           └── broadcastCardDealt()
```

When `participantCount < 3`, `getNextCycleState` skips partyCardDeal entirely: songSelection → song directly.

### Project Structure Notes

New files:
- `apps/server/src/services/party-card-pool.ts`
- `apps/server/src/services/card-dealer.ts`
- `apps/server/src/socket-handlers/card-handlers.ts`
- `apps/server/tests/services/party-card-pool.test.ts`
- `apps/server/tests/services/card-dealer.test.ts`
- `apps/server/tests/socket-handlers/card-handlers.test.ts`
- `apps/flutter_app/lib/constants/party_cards.dart`
- `apps/flutter_app/lib/widgets/party_card_deal_overlay.dart`
- `apps/flutter_app/test/constants/party_cards_test.dart`
- `apps/flutter_app/test/widgets/party_card_deal_overlay_test.dart`

Modified files:
- `apps/server/src/dj-engine/states.ts` — Remove isPlaceholder from partyCardDeal
- `apps/server/src/dj-engine/timers.ts` — Update partyCardDeal timer from 5s to 15s
- `apps/server/src/services/dj-broadcaster.ts` — Add broadcastCardDealt function
- `apps/server/src/services/session-manager.ts` — Add orchestrateCardDeal, imports for card dealer + broadcaster
- `apps/server/src/services/event-stream.ts` — Add card:dealt and card:redealt event types
- `apps/server/src/socket-handlers/host-handlers.ts` — Export validateHost function (add export keyword)
- `apps/server/src/socket-handlers/connection-handler.ts` — Import and register registerCardHandlers
- `apps/flutter_app/lib/state/party_provider.dart` — Add card state fields, onCardDealt handler, clear on state change
- `apps/flutter_app/lib/socket/client.dart` — Add card:dealt listener, emitCardRedraw method
- `apps/flutter_app/lib/constants/copy.dart` — Add party card copy strings
- `apps/flutter_app/lib/screens/party_screen.dart` — Add PartyCardDealOverlay integration
- `apps/flutter_app/lib/widgets/host_controls_overlay.dart` — Add re-deal button during partyCardDeal
- `apps/server/tests/dj-engine/states.test.ts` — Update isPlaceholder assertion
- `apps/server/tests/dj-engine/timers.test.ts` — Update timer duration assertion
- `apps/flutter_app/test/socket/client_test.dart` — Add card:dealt and emitCardRedraw tests
- `apps/flutter_app/test/state/party_provider_test.dart` — Add card state tests

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 4, Story 4.4] — Party Card Pool & Deal System: 19-card pool, slide-up flip animation, type differentiation, host override
- [Source: _bmad-output/planning-artifacts/epics.md#FR54] — Auto-deals by default, host can override or disable dealing
- [Source: _bmad-output/planning-artifacts/epics.md#FR55] — Card presented with slide-up flip animation
- [Source: _bmad-output/planning-artifacts/epics.md#FR56] — 7 vocal modifier cards
- [Source: _bmad-output/planning-artifacts/epics.md#FR57] — 7 performance modifier cards
- [Source: _bmad-output/planning-artifacts/epics.md#FR58] — 5 group involvement cards
- [Source: _bmad-output/planning-artifacts/epics.md#NFR12] — Low-participant degradation: skip partyCardDeal when < 3 participants
- [Source: _bmad-output/project-context.md#Core Principle] — Server-authoritative architecture
- [Source: _bmad-output/project-context.md#Server Boundaries] — socket-handlers call services, NEVER persistence directly
- [Source: _bmad-output/project-context.md#Flutter Boundaries] — ONLY SocketClient calls mutation methods on providers
- [Source: _bmad-output/project-context.md#Socket.io Event Catalog] — card namespace: dealt, accepted, dismissed, redraw (Bidirectional)
- [Source: _bmad-output/project-context.md#Testing Rules] — DO NOT test animations/visual effects, DO test state transitions and data flow
- [Source: _bmad-output/project-context.md#Anti-Patterns] — No hardcoded strings, use copy.dart
- [Source: apps/server/src/shared/events.ts#line37-41] — Card events already defined: CARD_DEALT, CARD_ACCEPTED, CARD_DISMISSED, CARD_REDRAW
- [Source: apps/server/src/dj-engine/types.ts#line11] — DJState.partyCardDeal already defined
- [Source: apps/server/src/dj-engine/types.ts#line41-42] — CARD_DEALT and CARD_DONE transitions already defined
- [Source: apps/server/src/dj-engine/states.ts#line22-27] — partyCardDeal state config (isPlaceholder: true — change to false)
- [Source: apps/server/src/dj-engine/states.ts#line62-67] — getNextCycleState: songSelection → partyCardDeal (or song if < 3 participants)
- [Source: apps/server/src/dj-engine/timers.ts#line13] — partyCardDeal timer: 5000ms (change to 15000ms)
- [Source: apps/server/src/dj-engine/transitions.ts#line55-56] — CARD_DEALT and CARD_DONE use getNextCycleState
- [Source: apps/server/src/dj-engine/machine.ts#line40-83] — processTransition: pure function returning context + side effects
- [Source: apps/server/src/services/session-manager.ts#line465-536] — processDjTransition: orchestration hub (ceremony at line 492-514)
- [Source: apps/server/src/services/session-manager.ts#line179-182] — checkCardCompletion: placeholder returning false (Story 4.5 updates)
- [Source: apps/server/src/services/dj-broadcaster.ts#line42-49] — broadcastDjState pattern
- [Source: apps/server/src/services/dj-broadcaster.ts#line72-84] — broadcastCeremonyAnticipation pattern (follow for broadcastCardDealt)
- [Source: apps/server/src/services/participation-scoring.ts#line25-26] — card:accepted and card:completed already mapped (Story 4.5 triggers)
- [Source: apps/server/src/services/event-stream.ts#line1-24] — SessionEvent union type (extend with card events)
- [Source: apps/server/src/socket-handlers/connection-handler.ts#line49] — Registration point for new handler
- [Source: apps/server/src/socket-handlers/host-handlers.ts#line17] — validateHost function (PRIVATE — must export for card-handlers.ts to import)
- [Source: apps/flutter_app/lib/widgets/host_controls_overlay.dart#line266] — _ControlButton widget class pattern for menu buttons
- [Source: apps/flutter_app/lib/widgets/host_controls_overlay.dart#line34] — partyProvider access via context.watch<PartyProvider>()
- [Source: apps/flutter_app/lib/state/party_provider.dart#line49-81] — State fields and ceremony state pattern
- [Source: apps/flutter_app/lib/state/party_provider.dart#line174-224] — Ceremony handlers pattern (follow for onCardDealt)
- [Source: apps/flutter_app/lib/state/party_provider.dart#line247-257] — State clearing on DJ state change (follow for card clearing)
- [Source: apps/flutter_app/lib/socket/client.dart] — Socket listener and emit patterns
- [Source: apps/flutter_app/lib/widgets/ceremony_display.dart] — Animation pattern (slide + scale)
- [Source: apps/flutter_app/lib/widgets/moment_card_overlay.dart] — Card overlay pattern (Positioned.fill)
- [Source: apps/flutter_app/lib/widgets/host_controls_overlay.dart] — Host controls with partyCardDeal as valid target
- [Source: apps/flutter_app/lib/theme/dj_tokens.dart] — Design tokens (spacing, colors)
- [Source: apps/flutter_app/lib/theme/dj_theme.dart] — partyCardDeal background color: 0xFF1A0A1A
- [Source: apps/flutter_app/lib/constants/copy.dart#line78] — djStatePartyCardDeal label already defined
- [Source: _bmad-output/implementation-artifacts/4-3-soundboard-effects.md] — Previous story: 606 server tests, 394 Flutter tests

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

N/A

### Completion Notes List

- All 16 tasks implemented following red-green-refactor cycle
- Server: 19-card pool (7 vocal, 7 performance, 5 group) with random dealing, session-scoped repeat avoidance, and host re-deal support
- DJ engine: `partyCardDeal` activated (isPlaceholder: false), timer set to 15s for auto-advance via TIMEOUT
- Orchestration: `orchestrateCardDeal()` follows ceremony orchestration pattern — deals card, stores in metadata (PostgreSQL JSONB), broadcasts to all clients
- Card handler: `card:redraw` event with host validation, re-deal logic, metadata persistence, and event stream logging
- Flutter: `PartyCardDealOverlay` widget with two-phase slide-up (400ms) + flip reveal (500ms) animation, color-coded borders (blue/purple/gold by type)
- `didUpdateWidget` replays flip animation on host re-deal (card.id change)
- PartyProvider: reactive card state with clearing on state transition
- SocketClient: `card:dealt` listener with `fromPayload` parsing, `emitCardRedraw()` for host re-deal
- Host controls: conditional re-deal button during `partyCardDeal` state
- NFR12: group cards filtered when < 3 participants via `getEligibleCards()`
- Fix: removed unused `DJState` import from `party-card-pool.ts`
- Fix: added `card:dealt` and `card:redealt` to `SessionEvent` union before orchestration code that uses them
- Fix: DJTokens values used directly as `Color` objects (not wrapped in `Color()` constructor)
- Server tests: 637 passed (606 baseline + 31 new), 2 skipped
- Flutter tests: 412 passed (394 baseline + 18 new)

### File List

**New files:**
- `apps/server/src/services/party-card-pool.ts` — 19-card pool definition with `getEligibleCards()` filtering
- `apps/server/src/services/card-dealer.ts` — Random card dealing with repeat avoidance, re-deal, session cleanup
- `apps/server/src/socket-handlers/card-handlers.ts` — Host re-deal handler (`card:redraw`)
- `apps/flutter_app/lib/constants/party_cards.dart` — `PartyCardType` enum, `PartyCardData` class with `fromPayload`
- `apps/flutter_app/lib/widgets/party_card_deal_overlay.dart` — Slide-up flip animation overlay
- `apps/server/tests/services/party-card-pool.test.ts` — 12 tests
- `apps/server/tests/services/card-dealer.test.ts` — 9 tests
- `apps/server/tests/socket-handlers/card-handlers.test.ts` — 10 tests
- `apps/flutter_app/test/constants/party_cards_test.dart` — 6 tests
- `apps/flutter_app/test/widgets/party_card_deal_overlay_test.dart` — 7 tests

**Modified files:**
- `apps/server/src/dj-engine/states.ts` — `isPlaceholder: false` for partyCardDeal
- `apps/server/src/dj-engine/timers.ts` — Timer 5000 → 15000ms
- `apps/server/src/services/dj-broadcaster.ts` — Added `broadcastCardDealt()`
- `apps/server/src/services/session-manager.ts` — Added `orchestrateCardDeal()`, card deal block in `processDjTransition()`, `clearDealtCards()` in `endSession()`
- `apps/server/src/services/event-stream.ts` — Added `card:dealt` and `card:redealt` event types
- `apps/server/src/socket-handlers/host-handlers.ts` — Exported `validateHost`
- `apps/server/src/socket-handlers/connection-handler.ts` — Registered `registerCardHandlers`
- `apps/flutter_app/lib/state/party_provider.dart` — Added card state, `onCardDealt()`, clearing on state change
- `apps/flutter_app/lib/socket/client.dart` — Added `card:dealt` listener, `emitCardRedraw()`
- `apps/flutter_app/lib/constants/copy.dart` — Added party card copy strings
- `apps/flutter_app/lib/screens/party_screen.dart` — Added `PartyCardDealOverlay` integration
- `apps/flutter_app/lib/widgets/host_controls_overlay.dart` — Added re-deal button
- `apps/server/tests/dj-engine/timers.test.ts` — Updated timer assertion
- `apps/flutter_app/test/socket/client_test.dart` — Added 2 card tests
- `apps/flutter_app/test/state/party_provider_test.dart` — Added 3 card state tests
