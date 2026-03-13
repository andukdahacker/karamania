# Story 3.4: Quick Ceremony

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a party participant,
I want a brief award flash after less prominent songs,
so that every performer gets recognized without slowing the party's momentum.

## Acceptance Criteria

1. **Given** a Quick ceremony is triggered after a song **When** the ceremony sequence begins **Then** a brief award flash displays with the one-liner award title and a short animation (FR19) **And** the reveal is synchronized across all devices within 200ms (NFR27) **And** no anticipation buildup phase is shown (streamlined compared to Full ceremony) **And** the same award template engine from Story 3.2 generates the award
2. **Given** the ceremony reveal timing **When** the Quick ceremony displays **Then** it auto-advances after 10 seconds (server-scheduled CEREMONY_DONE transition)

## Tasks / Subtasks

- [x] Task 1: Add `broadcastCeremonyQuick` to dj-broadcaster (AC: #1)
  - [x] 1.1 In `apps/server/src/services/dj-broadcaster.ts`, add broadcast function:
    ```typescript
    export function broadcastCeremonyQuick(
      sessionId: string,
      data: {
        award: string;
        performerName: string | null;
        tone: string;
      },
    ): void {
      if (!io) {
        console.warn('[dj-broadcaster] Cannot broadcast — io not initialized');
        return;
      }
      io.to(sessionId).emit(EVENTS.CEREMONY_QUICK, data);
    }
    ```
    - Follows existing `broadcastCeremonyAnticipation` / `broadcastCeremonyReveal` pattern exactly
    - Uses `EVENTS.CEREMONY_QUICK` already defined in `shared/events.ts` (line ~27)
    - Single event — no two-phase approach like full ceremony (no anticipation + reveal)
    - Payload includes `award`, `performerName`, and `tone` for display and analytics

- [x] Task 2: Create `orchestrateQuickCeremony` in session-manager (AC: #1, #2)
  - [x] 2.1 In `apps/server/src/services/session-manager.ts`, add import for new broadcast function:
    ```typescript
    import { broadcastDjState, broadcastDjPause, broadcastDjResume, broadcastCeremonyAnticipation, broadcastCeremonyReveal, broadcastCeremonyQuick } from '../services/dj-broadcaster.js';
    ```
  - [x] 2.2 Add `QUICK_CEREMONY_DURATION_MS` constant near `ANTICIPATION_DURATION_MS`:
    ```typescript
    const QUICK_CEREMONY_DURATION_MS = 10_000; // 10s display then auto-advance
    ```
  - [x] 2.3 Extend the `ceremonyRevealTimers` Map to also track quick ceremony auto-advance timers (reuse the same Map — one active ceremony timer per session at a time):
    No structural changes needed — `clearCeremonyTimers` already handles cleanup. The quick ceremony timer replaces the reveal timer in the same Map entry.
  - [x] 2.4 Add `orchestrateQuickCeremony` function after `orchestrateFullCeremony`:
    ```typescript
    async function orchestrateQuickCeremony(
      sessionId: string,
      context: DJContext,
    ): Promise<void> {
      const performerName = context.currentPerformer;

      // Performer tracking not implemented until Epic 5 — always empty for now
      const performerUserId = '';
      const awardResult = performerUserId
        ? await generateCeremonyAward(sessionId, performerUserId, 'quick')
        : null;

      const award = awardResult?.award ?? DEFAULT_AWARD;
      const tone = awardResult?.tone ?? DEFAULT_AWARD_TONE;

      // Broadcast quick ceremony immediately — no anticipation phase
      broadcastCeremonyQuick(sessionId, {
        award,
        performerName,
        tone,
      });

      // Log ceremony reveal to event stream
      appendEvent(sessionId, {
        type: 'ceremony:revealed',
        ts: Date.now(),
        data: {
          award,
          performerName,
          ceremonyType: 'quick' as const,
        },
      });

      // Schedule auto-advance after display duration
      // Follows handleRecoveryTimeout pattern: retrieve current context, guard state, try-catch
      const advanceTimer = setTimeout(async () => {
        ceremonyRevealTimers.delete(sessionId);
        const currentContext = getSessionDjState(sessionId);
        if (!currentContext || currentContext.state !== DJState.ceremony) return;
        try {
          await processDjTransition(sessionId, currentContext, { type: 'CEREMONY_DONE' });
        } catch {
          // Already transitioned (e.g., HOST_SKIP raced) — safe to ignore
        }
      }, QUICK_CEREMONY_DURATION_MS);

      ceremonyRevealTimers.set(sessionId, advanceTimer);
    }
    ```
    - **No anticipation phase** — award is broadcast immediately via `ceremony:quick` event
    - Reuses `DEFAULT_AWARD` and `DEFAULT_AWARD_TONE` constants (added in Story 3.3 code review)
    - **Auto-advance:** Schedules `CEREMONY_DONE` transition after 10s — this advances the DJ engine to the next state (interlude or songSelection)
    - **CRITICAL: `processDjTransition` signature** is `(sessionId, context, event, userId?)`. Must call `getSessionDjState(sessionId)` to retrieve current `DJContext`, then pass `{ type: 'CEREMONY_DONE' }` as the event. Follows the `handleRecoveryTimeout` pattern.
    - **State guard:** Before firing transition, verify `currentContext.state === DJState.ceremony`. If HOST_SKIP already transitioned out, the guard prevents the call entirely.
    - **Try-catch:** `processTransition` inside `processDjTransition` calls `validateTransitionAllowed()` which throws `DJEngineError` if the transition is invalid from the current state. The catch prevents unhandled rejection warnings.
    - Timer tracked in `ceremonyRevealTimers` — cleared by `clearCeremonyTimers` on HOST_SKIP or session end (already wired from Story 3.3)
    - Logs `ceremony:revealed` with `ceremonyType: 'quick'` — same event type as full ceremony for consistent analytics
  - [x] 2.5 Hook quick ceremony into `processDjTransition`:
    In the ceremony handling block, replace the comment `// Quick ceremony handled by Story 3.4` with:
    ```typescript
    if (resolvedCeremonyType === 'full') {
      // Fire-and-forget — don't block DJ transition pipeline
      void orchestrateFullCeremony(sessionId, newContext);
    } else {
      // Quick ceremony — immediate award flash, auto-advances after 10s
      void orchestrateQuickCeremony(sessionId, newContext);
    }
    ```
    - Both branches are fire-and-forget (`void` prefix) — don't block the transition pipeline
    - `resolvedCeremonyType` already defaults to `'quick'` if metadata is missing (from Story 3.3)
  - [x] 2.6 **Double-advance safety (VERIFIED — no code changes needed):**
    Two timers coexist during quick ceremony:
    - **Quick ceremony timer:** 10s `setTimeout` in `ceremonyRevealTimers` → fires `CEREMONY_DONE`
    - **Engine state timer:** 12s via `scheduleSessionTimer` → fires `TIMEOUT` via `handleRecoveryTimeout`

    **Why this is safe:** `orchestrateQuickCeremony` is called from `processDjTransition` BEFORE the side effects loop that schedules the 12s engine timer. Both timers are independent. The 10s timer fires first → `processDjTransition` transitions out of ceremony → side effects include `cancelTimer` which cancels the 12s engine timer. If the 10s timer somehow fails, the 12s TIMEOUT acts as a safety net.

    **If both fire (race condition):** `validateTransitionAllowed()` in `transitions.ts` throws `DJEngineError('INVALID_TRANSITION')` when attempting a transition not allowed from the current state. The auto-advance callback has a try-catch and state guard that handle this gracefully. No code changes needed — this is inherently safe.

- [x] Task 3: Create Flutter `QuickCeremonyDisplay` widget (AC: #1)
  - [x] 3.1 Create `apps/flutter_app/lib/widgets/quick_ceremony_display.dart`:
    ```dart
    import 'package:flutter/material.dart';
    import 'package:karamania/constants/copy.dart';
    import 'package:karamania/theme/dj_theme.dart';
    import 'package:karamania/theme/dj_tokens.dart';

    class QuickCeremonyDisplay extends StatefulWidget {
      const QuickCeremonyDisplay({
        super.key,
        required this.award,
        required this.vibe,
        this.performerName,
        this.tone,
      });

      final String award;
      final PartyVibe vibe;
      final String? performerName;
      final String? tone;

      @override
      State<QuickCeremonyDisplay> createState() => _QuickCeremonyDisplayState();
    }

    class _QuickCeremonyDisplayState extends State<QuickCeremonyDisplay>
        with SingleTickerProviderStateMixin {
      late final AnimationController _controller;
      late final CurvedAnimation _fadeAnimation;
      late final CurvedAnimation _scaleAnimation;

      @override
      void initState() {
        super.initState();
        _controller = AnimationController(
          vsync: this,
          duration: const Duration(milliseconds: 500),
        );
        // CurvedAnimation created in initState, NOT in build() — Story 3.3 code review fix M3
        _fadeAnimation = CurvedAnimation(parent: _controller, curve: Curves.easeOut);
        _scaleAnimation = CurvedAnimation(parent: _controller, curve: Curves.elasticOut);
        _controller.forward();
      }

      @override
      void dispose() {
        _fadeAnimation.dispose();
        _scaleAnimation.dispose();
        _controller.dispose();
        super.dispose();
      }

      @override
      Widget build(BuildContext context) {
        return Container(
          key: const Key('quick-ceremony-display'),
          child: Center(
            child: FadeTransition(
              opacity: _fadeAnimation,
              child: ScaleTransition(
                scale: Tween<double>(begin: 0.7, end: 1.0).animate(_scaleAnimation),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (widget.performerName != null) ...[
                      Text(
                        widget.performerName!,
                        style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                              color: DJTokens.textSecondary,
                            ),
                      ),
                      const SizedBox(height: DJTokens.spaceSm),
                    ],
                    // Award title — quick flash, needs instant readability
                    // headlineLarge (not displaySmall) ensures visibility in brief display
                    Text(
                      widget.award,
                      key: const Key('quick-ceremony-award-title'),
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                            color: widget.vibe.accent,
                            fontWeight: FontWeight.bold,
                          ),
                    ),
                    const SizedBox(height: DJTokens.spaceSm),
                    // Quick ceremony label
                    Text(
                      Copy.quickCeremonyLabel,
                      style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                            color: DJTokens.textSecondary,
                          ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      }
    }
    ```
    - **No anticipation phase** — immediately shows award with a single scale+fade animation
    - Simpler than `CeremonyDisplay` — no two-phase state, no `revealAt` timing, no confetti
    - Uses `headlineLarge` instead of `displayMedium` for the award title (smaller than full ceremony but still instantly readable in brief display)
    - **CurvedAnimation in initState:** Per Story 3.3 code review fix M3, `CurvedAnimation` objects are created in `initState()` and disposed in `dispose()`, NOT inline in `build()`
    - `SingleTickerProviderStateMixin` (not `TickerProviderStateMixin`) — only one animation controller needed
    - Widget key follows `Key('kebab-case-descriptor')` convention
    - Uses `DJTokens` spacing constants — no hardcoded padding values
    - **DO NOT test:** animations, visual effects, color values, transition timings (per project testing rules)

- [x] Task 4: Update party provider with quick ceremony handler (AC: #1)
  - [x] 4.1 In `apps/flutter_app/lib/state/party_provider.dart`, add `onCeremonyQuick` method alongside existing `onCeremonyAnticipation` and `onCeremonyReveal`:
    ```dart
    void onCeremonyQuick({
      required String award,
      required String? performerName,
      required String tone,
    }) {
      _ceremonyPerformerName = performerName;
      _ceremonyAward = award;
      _ceremonyTone = tone;
      _ceremonyRevealAt = null; // Quick ceremony has no revealAt timing
      notifyListeners();
    }
    ```
    - Reuses existing ceremony state fields — `_ceremonyAward`, `_ceremonyPerformerName`, `_ceremonyTone`
    - Sets `_ceremonyRevealAt = null` — distinguishes quick from full (full always has revealAt)
    - `_clearCeremonyState()` already clears all these fields when leaving ceremony state (from Story 3.3)

- [x] Task 5: Wire `ceremony:quick` socket listener (AC: #1)
  - [x] 5.1 In `apps/flutter_app/lib/socket/client.dart`, add `ceremony:quick` event listener alongside existing ceremony listeners:
    ```dart
    on('ceremony:quick', (data) {
      final payload = data as Map<String, dynamic>;
      partyProvider.onCeremonyQuick(
        award: payload['award'] as String,
        performerName: payload['performerName'] as String?,
        tone: payload['tone'] as String,
      );
    });
    ```
    - Add in the same `_setupListeners()` method where `ceremony:anticipation` and `ceremony:reveal` are registered
    - Follows identical listener pattern (cast data, extract fields, call provider method)
    - **ONLY** `SocketClient` calls mutation methods on providers (per Flutter boundaries)

- [x] Task 6: Update party screen for quick ceremony rendering (AC: #1)
  - [x] 6.1 In `apps/flutter_app/lib/screens/party_screen.dart`:
    - Add import for `QuickCeremonyDisplay`
    - Update the ceremony rendering block to handle both full and quick:
    ```dart
    if (partyProvider.djState == DJState.ceremony) ...[
      if (partyProvider.ceremonyType == 'full' &&
          partyProvider.ceremonyRevealAt != null) ...[
        CeremonyDisplay(
          performerName: partyProvider.ceremonyPerformerName,
          revealAt: partyProvider.ceremonyRevealAt!,
          vibe: displayVibe,
          award: partyProvider.ceremonyAward,
          tone: partyProvider.ceremonyTone,
        ),
      ] else if (partyProvider.ceremonyType == 'quick' &&
                 partyProvider.ceremonyAward != null) ...[
        QuickCeremonyDisplay(
          award: partyProvider.ceremonyAward!,
          vibe: displayVibe,
          performerName: partyProvider.ceremonyPerformerName,
          tone: partyProvider.ceremonyTone,
        ),
      ] else ...[
        // Default fallback content (icon, state label, participant count)
      ],
    ] else ...[
      // existing non-ceremony content
    ]
    ```
    - Full ceremony renders when `ceremonyType == 'full'` AND `ceremonyRevealAt != null` (set by `ceremony:anticipation` event)
    - Quick ceremony renders when `ceremonyType == 'quick'` AND `ceremonyAward != null` (set by `ceremony:quick` event)
    - Default fallback covers the brief moment between DJ state change and ceremony event arrival

- [x] Task 7: Add copy constants for quick ceremony (AC: #1)
  - [x] 7.1 In `apps/flutter_app/lib/constants/copy.dart`, add:
    ```dart
    static const String quickCeremonyLabel = 'Quick Award';
    ```
    - All copy in `constants/copy.dart` — no hardcoded strings in widgets (per anti-patterns)

- [x] Task 8: Update ceremony audio for quick ceremony volume (AC: #1)
  - No changes needed. The `isHost` volume differentiation from Story 3.3 already applies to ALL ceremony state entries. When DJ transitions to ceremony state (regardless of type), `state_transition_audio.dart` plays `SoundCue.ceremonyStart` with host=100%, participant=60%. Quick ceremony uses the same sound cue — no new audio assets required.
  - Verify: `_cueForState(DJState.ceremony)` returns `SoundCue.ceremonyStart` for both ceremony types (it checks state, not ceremony type)

- [x] Task 9: Server tests (AC: #1, #2)
  - [x] 9.1 Extend `apps/server/tests/services/dj-broadcaster.test.ts`:
    - Test `broadcastCeremonyQuick` emits `ceremony:quick` to room with correct payload `{ award, performerName, tone }`
    - Test `broadcastCeremonyQuick` with `performerName: null` — still broadcasts
    - Test `broadcastCeremonyQuick` logs warning when `io` not initialized
    - Follow existing test patterns from `broadcastCeremonyAnticipation` / `broadcastCeremonyReveal` tests
  - [x] 9.2 Extend `apps/server/tests/services/session-manager-ceremony.test.ts`:
    - Test `orchestrateQuickCeremony` calls `generateCeremonyAward` with ceremonyType 'quick'
    - Test `orchestrateQuickCeremony` emits `ceremony:quick` event immediately (no delay) with award data
    - Test `orchestrateQuickCeremony` with no performer (currentPerformer null) — uses fallback award
    - Test `orchestrateQuickCeremony` appends `ceremony:revealed` event with `ceremonyType: 'quick'`
    - Test `orchestrateQuickCeremony` schedules auto-advance after 10s
    - Test auto-advance timer: after 10s, calls `getSessionDjState` then `processDjTransition(sessionId, context, { type: 'CEREMONY_DONE' })`
    - Test auto-advance timer: if `getSessionDjState` returns null (session ended), does NOT call `processDjTransition`
    - Test auto-advance timer: if state is no longer ceremony (HOST_SKIP raced), does NOT call `processDjTransition`
    - Test auto-advance timer: if `processDjTransition` throws `DJEngineError`, error is caught gracefully (no unhandled rejection)
    - Test `clearCeremonyTimers` cancels pending quick ceremony auto-advance timer
    - Test HOST_SKIP during quick ceremony calls `clearCeremonyTimers` (prevents auto-advance)
    - Test ceremony orchestration is called from `processDjTransition` when entering ceremony state with type 'quick'
    - Test both full and quick paths in processDjTransition — verify correct orchestration function is called for each type
    - Use `vi.useFakeTimers()` for timer-dependent tests
    - Mock `broadcastCeremonyQuick`, `generateCeremonyAward`, `getSessionDjState`, `processDjTransition` (for auto-advance verification)
  - [x] 9.3 **Regression tests**: Run full existing test suite to verify no breakage
    - All 534+ existing tests still pass (from Story 3.3 baseline)
    - Verify full ceremony behavior unchanged — `orchestrateFullCeremony` tests still pass
    - Verify processDjTransition ceremony handling still works for full type

- [x] Task 10: Flutter tests (AC: #1, #2)
  - [x] 10.1 Create `apps/flutter_app/test/state/party_provider_quick_ceremony_test.dart`:
    - Test `onCeremonyQuick` sets `ceremonyAward`, `ceremonyPerformerName`, `ceremonyTone` and notifies listeners
    - Test `onCeremonyQuick` sets `ceremonyRevealAt` to null
    - Test ceremony state cleared when DJ state changes away from ceremony (same as full)
    - Test ceremony state cleared on session end
  - [x] 10.2 Create `apps/flutter_app/test/widgets/quick_ceremony_display_test.dart`:
    - Test widget renders award title
    - Test widget shows performer name when provided
    - Test widget shows default content when performer name is null
    - Test widget shows quick ceremony label text
    - Test widget key is `quick-ceremony-display`
    - **DO NOT test:** animation timings, visual effects, color values
  - [x] 10.3 Extend `apps/flutter_app/test/socket/client_test.dart`:
    - Test `ceremony:quick` event calls `partyProvider.onCeremonyQuick` with correct parameters

## Dev Notes

### Quick vs Full Ceremony — Design Differences

| Aspect | Full Ceremony (3.3) | Quick Ceremony (3.4) |
|--------|---------------------|----------------------|
| Server events | `ceremony:anticipation` → (2s delay) → `ceremony:reveal` | Single `ceremony:quick` event |
| Anticipation phase | 2s pulsing animation | None |
| Award display | `displayMedium` + confetti emojis + vibe flavor | `headlineLarge` + bold + simple label, no confetti |
| Synchronization | `revealAt` timestamp for 200ms sync | Immediate broadcast (inherently synchronized) |
| Auto-advance | 12s state TIMEOUT | 10s server-scheduled `CEREMONY_DONE` |
| Widget | `CeremonyDisplay` (StatefulWidget, 2 animation controllers) | `QuickCeremonyDisplay` (StatefulWidget, 1 animation controller) |
| Sound | `SoundCue.ceremonyStart` at host=100%/participant=60% | Same — no changes needed |

### Server Auto-Advance Pattern (AC #2)

Quick ceremony auto-advances after 10 seconds via a **server-scheduled `CEREMONY_DONE` transition**. This is different from the DJ state TIMEOUT timer (12s). The flow:

1. `processDjTransition` enters ceremony state → calls `orchestrateQuickCeremony` (fire-and-forget)
2. `orchestrateQuickCeremony` broadcasts `ceremony:quick` immediately, schedules 10s `setTimeout`
3. **THEN** the side effects loop runs → `scheduleSessionTimer` sets up the 12s TIMEOUT timer
4. At 10s: auto-advance callback fires → retrieves context via `getSessionDjState(sessionId)` → guards `state === DJState.ceremony` → calls `processDjTransition(sessionId, context, { type: 'CEREMONY_DONE' })` with try-catch
5. `processDjTransition` transitions ceremony → next state → side effects include `cancelTimer` → 12s timer cancelled
6. If 10s timer fails: 12s TIMEOUT fires via `handleRecoveryTimeout` as safety net

**Execution order matters:** `orchestrateQuickCeremony` is called BEFORE the side effects loop in `processDjTransition`. Both timers are independent — the quick ceremony uses a direct `setTimeout` (tracked in `ceremonyRevealTimers`), while the engine uses `scheduleSessionTimer`. Do NOT try to replace one with the other.

**`processDjTransition` signature:** `(sessionId: string, context: DJContext, event: DJTransition, userId?: string)`. The auto-advance callback MUST call `getSessionDjState(sessionId)` to get current context first (follows `handleRecoveryTimeout` pattern at ~line 380 in session-manager.ts).

**Double-transition safety (VERIFIED):** `validateTransitionAllowed()` in `transitions.ts` (line ~24) throws `DJEngineError('INVALID_TRANSITION')` when the transition is not allowed from the current state. The auto-advance callback has both a state guard (`context.state !== DJState.ceremony → return`) and a try-catch. The `ceremonyRevealTimers` Map tracks the timer for cleanup — `clearCeremonyTimers(sessionId)` cancels it on HOST_SKIP or session end (already wired from Story 3.3).

[Source: apps/server/src/dj-engine/machine.ts — processTransition, apps/server/src/dj-engine/transitions.ts — validateTransitionAllowed]

### Synchronization for Quick Ceremony (NFR27)

Full ceremony uses a `revealAt` timestamp to synchronize reveal across devices within 200ms. Quick ceremony uses a simpler approach: **immediate broadcast**. Since there's no anticipation delay, the `ceremony:quick` event arrives at all clients nearly simultaneously (Socket.io broadcast to room). The typical broadcast latency is <50ms on the same network, well within the 200ms NFR27 window.

No `revealAt` timestamp is needed because:
- There's no client-side delay to coordinate
- The award is displayed immediately upon event receipt
- Socket.io room broadcasts are already near-simultaneous

### Performer Tracking Limitation (Epic 5 Dependency)

Same limitation as Story 3.3 — `currentPerformer` in `DJContext` is not populated until Epic 5. Quick ceremony displays without performer name. Fallback award `DEFAULT_AWARD` ('Star of the Show') is used when no performer is identified.

[Source: _bmad-output/implementation-artifacts/3-3-full-ceremony-experience.md — "Performer Tracking Limitation" section]

### Ceremony Selection Context

The ceremony selection logic in `ceremony-selection.ts` already determines when quick ceremonies fire:
1. Small groups (<3 participants) → always quick (NFR12)
2. After song 5+ → quick (keep momentum)
3. Consecutive full prevention → quick
4. Default fallback → quick

Quick ceremonies are the MORE COMMON type — they fire more often than full ceremonies. This makes the quick ceremony experience critical for the overall party feel.

[Source: apps/server/src/dj-engine/ceremony-selection.ts — selectCeremonyType rules]

### Event Stream Analytics

Quick ceremony logs the same `ceremony:revealed` event as full ceremony, with `ceremonyType: 'quick'`. This enables analytics like:
- Ratio of full vs quick ceremonies per session
- Average ceremony duration by type
- Quick ceremony award distribution

The `ceremony:typeSelected` event (already logged in `processDjTransition` for both types) provides the "start" timestamp. The `ceremony:revealed` event provides the "end" timestamp. For quick ceremony, the delta should be near-zero (immediate broadcast).

### Architecture vs Implementation: File Locations

Architecture document references `screens/ceremony_screen.dart` for "Full + Quick award reveal choreography". However, Story 3.3 established the pattern as **widgets** in the `widgets/` directory (`widgets/ceremony_display.dart`), not separate screens. Story 3.4 follows the established pattern: create `widgets/quick_ceremony_display.dart`. The ceremony UI is rendered WITHIN `party_screen.dart`, not as a separate screen. Do NOT create a `ceremony_screen.dart` file.

[Source: _bmad-output/planning-artifacts/architecture.md — Flutter Project Structure vs actual implementation]

### What This Story Does NOT Build

- **No confetti/particle effects** — Quick ceremony is intentionally minimal
- **No moment card generation** — Story 3.5 (only for full ceremonies)
- **No glow effects** — Visual polish for later
- **No performer tracking** — Epic 5
- **No new audio assets** — Reuses existing `ceremonyStart` cue

### Existing Code to NOT Modify

- `dj-engine/ceremony-selection.ts` — No changes. Selection logic is independent of ceremony display
- `dj-engine/transitions.ts` — No changes. Transition logic stays the same
- `dj-engine/machine.ts` — No changes. Side effect generation stays the same
- `dj-engine/states.ts` — No changes. Ceremony state config unchanged (isPlaceholder: false, 12s timer stays as safety net)
- `dj-engine/timers.ts` — No changes. 12s timer is a safety net; quick ceremony auto-advances at 10s via scheduled transition
- `services/award-generator.ts` — No changes. Award generation consumed as-is from Story 3.2
- `services/participation-scoring.ts` — No changes
- `services/rate-limiter.ts` — No changes
- `persistence/session-repository.ts` — No changes
- `socket-handlers/party-handlers.ts` — No changes
- `widgets/ceremony_display.dart` — No changes. Full ceremony widget stays independent
- `widgets/song_over_button.dart` — Already implemented and working
- `audio/state_transition_audio.dart` — No changes. Volume differentiation from Story 3.3 already applies to all ceremony states

### Previous Story Intelligence (Story 3.3)

Story 3.3 established:
- Full ceremony orchestration pattern: async function, fire-and-forget from processDjTransition
- `ceremonyRevealTimers` Map for timer tracking — reuse for quick ceremony auto-advance timer
- `clearCeremonyTimers(sessionId)` cleanup on HOST_SKIP and session end — already works for any ceremony type
- `ceremony:revealed` event with `ceremonyType` field — supports both 'full' and 'quick'
- `DEFAULT_AWARD` and `DEFAULT_AWARD_TONE` constants — use for fallback (added in 3.3 code review)
- Flutter ceremony state fields in provider — reusable (`_ceremonyAward`, `_ceremonyPerformerName`, etc.)
- 534 server tests pass across 40 test files — baseline for regression

Key code review fix from 3.3: `revealAt` computed before async award generation — same principle applies (compute values before async work).

[Source: _bmad-output/implementation-artifacts/3-3-full-ceremony-experience.md]

### Git Intelligence

Recent commits follow pattern: `"Implement Story X.Y: Title with code review fixes"`
- Story 3.3 established ceremony orchestration in session-manager
- `orchestrateFullCeremony` is the pattern to follow for `orchestrateQuickCeremony`
- dj-broadcaster pattern: one export function per broadcast type
- Test pattern: extend `session-manager-ceremony.test.ts` (split by concern)

### Project Structure Notes

New files:
- `apps/flutter_app/lib/widgets/quick_ceremony_display.dart`
- `apps/flutter_app/test/state/party_provider_quick_ceremony_test.dart`
- `apps/flutter_app/test/widgets/quick_ceremony_display_test.dart`

Modified files:
- `apps/server/src/services/dj-broadcaster.ts` — Add `broadcastCeremonyQuick`
- `apps/server/src/services/session-manager.ts` — Add `orchestrateQuickCeremony`, hook into `processDjTransition`, add `QUICK_CEREMONY_DURATION_MS` constant
- `apps/flutter_app/lib/state/party_provider.dart` — Add `onCeremonyQuick` method
- `apps/flutter_app/lib/socket/client.dart` — Add `ceremony:quick` listener
- `apps/flutter_app/lib/screens/party_screen.dart` — Render `QuickCeremonyDisplay` for quick ceremonies
- `apps/flutter_app/lib/constants/copy.dart` — Add `quickCeremonyLabel` constant

Existing test files to extend:
- `apps/server/tests/services/dj-broadcaster.test.ts` — Add `broadcastCeremonyQuick` tests
- `apps/server/tests/services/session-manager-ceremony.test.ts` — Add quick ceremony orchestration tests
- `apps/flutter_app/test/socket/client_test.dart` — Add `ceremony:quick` listener tests

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 3, Story 3.4] — Quick ceremony AC: brief award flash, synchronized reveal (NFR27), no anticipation, 8-10s auto-advance, same award engine
- [Source: _bmad-output/planning-artifacts/architecture.md — Ceremonies FR16-21] — Award generation, ceremony types, host "Song Over!" trigger
- [Source: _bmad-output/project-context.md#Server Boundaries] — session-manager is ONLY orchestrator, socket-handlers NEVER call persistence
- [Source: _bmad-output/project-context.md#Flutter Boundaries] — ONLY SocketClient calls mutation methods on providers
- [Source: _bmad-output/project-context.md#Socket.io Event Catalog] — ceremony namespace events
- [Source: _bmad-output/project-context.md#Anti-Patterns] — No hardcoded strings, no hardcoded colors, use DJTokens
- [Source: _bmad-output/project-context.md#Testing Rules] — DO NOT test animations/visual effects/confetti/color values
- [Source: apps/server/src/shared/events.ts] — CEREMONY_QUICK event constant (already defined)
- [Source: apps/server/src/dj-engine/ceremony-selection.ts] — selectCeremonyType rules for quick vs full
- [Source: apps/server/src/services/dj-broadcaster.ts] — broadcastCeremonyAnticipation/Reveal pattern to follow
- [Source: apps/server/src/services/session-manager.ts] — orchestrateFullCeremony pattern, processDjTransition ceremony block, ceremonyRevealTimers Map
- [Source: apps/server/src/services/event-stream.ts] — ceremony:revealed event already supports ceremonyType 'quick'
- [Source: apps/server/src/dj-engine/machine.ts] — processTransition state validation (double-transition safety)
- [Source: apps/flutter_app/lib/state/party_provider.dart] — ceremony state fields, onDjStateUpdate
- [Source: apps/flutter_app/lib/socket/client.dart] — ceremony:anticipation/reveal listener pattern
- [Source: apps/flutter_app/lib/constants/copy.dart] — existing ceremony copy constants
- [Source: apps/flutter_app/lib/screens/party_screen.dart] — ceremony rendering logic
- [Source: apps/flutter_app/lib/widgets/ceremony_display.dart] — full ceremony widget pattern reference
- [Source: _bmad-output/implementation-artifacts/3-3-full-ceremony-experience.md] — Previous story: 534 tests, 40 files, ceremony patterns established

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

- Implemented `broadcastCeremonyQuick` in dj-broadcaster following existing pattern
- Added `orchestrateQuickCeremony` in session-manager — immediate broadcast, 10s auto-advance via setTimeout, state guard + try-catch for race safety
- Hooked quick ceremony into `processDjTransition` alongside full ceremony (both fire-and-forget)
- Created `QuickCeremonyDisplay` widget with scale+fade animation (single controller), no confetti
- Added `onCeremonyQuick` to PartyProvider — reuses existing ceremony fields, sets `_ceremonyRevealAt = null`
- Wired `ceremony:quick` socket listener in SocketClient
- Updated `party_screen.dart` with three-way ceremony rendering: full / quick / fallback
- Added `quickCeremonyLabel` copy constant
- Task 8 (audio) verified — no changes needed, existing ceremony sound cue applies to both types
- Added `broadcastCeremonyQuick` mock to all 9 test files that mock dj-broadcaster
- Server: 547 tests pass (40 files), up from 534 baseline — 13 new tests added
- Flutter: 329 tests pass — 12 new tests across 3 test files

### Change Log

- 2026-03-13: Implemented Story 3.4 Quick Ceremony — all 10 tasks complete, 876 total tests passing
- 2026-03-13: Code review fixes applied — M1: `clearCeremonyTimers` in `endSession`, M2: cached `Tween` animation in `initState`, M3: updated File List with missing files, L1: removed unused `tone` param from `QuickCeremonyDisplay`, L3: replaced unnecessary `Container` with `Center`

### File List

**New files:**
- apps/flutter_app/lib/widgets/quick_ceremony_display.dart
- apps/flutter_app/test/state/party_provider_quick_ceremony_test.dart
- apps/flutter_app/test/widgets/quick_ceremony_display_test.dart

**Modified files:**
- apps/server/src/services/dj-broadcaster.ts — Added `broadcastCeremonyQuick`
- apps/server/src/services/session-manager.ts — Added `orchestrateQuickCeremony`, `QUICK_CEREMONY_DURATION_MS`, import, hooked into `processDjTransition`, added `clearCeremonyTimers` to `endSession` cleanup (code review fix M1)
- apps/flutter_app/lib/state/party_provider.dart — Added `onCeremonyQuick` method
- apps/flutter_app/lib/socket/client.dart — Added `ceremony:quick` listener
- apps/flutter_app/lib/screens/party_screen.dart — Added `QuickCeremonyDisplay` import and rendering branch
- apps/flutter_app/lib/constants/copy.dart — Added `quickCeremonyLabel`
- apps/flutter_app/pubspec.lock — Dependency lock file updated
- _bmad-output/implementation-artifacts/sprint-status.yaml — Sprint tracking updated
- apps/server/tests/services/dj-broadcaster.test.ts — Added `broadcastCeremonyQuick` tests
- apps/server/tests/services/session-manager-ceremony.test.ts — Added quick ceremony orchestration tests, updated mock
- apps/flutter_app/test/socket/client_test.dart — Added `ceremony:quick` listener tests
- apps/server/tests/services/session-manager-dj.test.ts — Added `broadcastCeremonyQuick` mock
- apps/server/tests/socket-handlers/party-start.test.ts — Added `broadcastCeremonyQuick` mock
- apps/server/tests/socket-handlers/party-handlers.test.ts — Added `broadcastCeremonyQuick` mock
- apps/server/tests/socket-handlers/host-handlers.test.ts — Added `broadcastCeremonyQuick` mock
- apps/server/tests/services/inactivity-monitor.test.ts — Added `broadcastCeremonyQuick` mock
- apps/server/tests/services/session-manager-scoring.test.ts — Added `broadcastCeremonyQuick` mock
- apps/server/tests/services/session-manager-recovery.test.ts — Added `broadcastCeremonyQuick` mock
- apps/server/tests/services/session-manager-awards.test.ts — Added `broadcastCeremonyQuick` mock
