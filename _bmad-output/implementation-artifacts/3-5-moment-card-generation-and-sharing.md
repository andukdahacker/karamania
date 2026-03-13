# Story 3.5: Moment Card Generation & Sharing

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a party participant,
I want a shareable moment card created for each Full ceremony,
so that I can share my karaoke highlights with friends outside the party.

## Acceptance Criteria

1. **Given** a Full ceremony has completed **When** the award is revealed **Then** a moment card is generated combining the performer name, song title, and award (FR18b, FR34) **And** the moment card is rendered client-side as a 9:16 Instagram Story format widget **And** the card reflects the current party vibe's visual style (accent colors, background)
2. **Given** a moment card has been generated **When** a participant wants to share it **Then** they can share via the native mobile share sheet with a single tap (FR35) **And** the share uses `share_plus` to send the rendered image **And** the share intent tap is tracked as a viral signal metric (event stream log)
3. **Given** the moment card is displayed **When** the participant views it during the celebration window **Then** the card appears as an overlay after the reveal animation completes **And** auto-dismisses after 10 seconds if not shared **And** the card includes performer name, award title, vibe-styled background, and Karamania branding

## Tasks / Subtasks

- [x] Task 1: Extend ceremony reveal broadcast to include songTitle (AC: #1)
  - [x] 1.1 In `apps/server/src/dj-engine/types.ts`, add `currentSongTitle` to `DJContext`:
    ```typescript
    currentSongTitle: string | null;
    ```
    Add after `currentPerformer` field.
  - [x] 1.2 In `apps/server/src/dj-engine/machine.ts`, initialize `currentSongTitle: null` in the initial context and preserve it through transitions. Follow the same pattern as `currentPerformer`.
  - [x] 1.3 In `apps/server/src/dj-engine/serializer.ts`, add `currentSongTitle` to serialization/deserialization. Follow same pattern as `currentPerformer`.
  - [x] 1.4 Update `orchestrateFullCeremony` in `apps/server/src/services/session-manager.ts` to extract `context.currentSongTitle` and include it in the `ceremony:reveal` broadcast payload:
    ```typescript
    broadcastCeremonyReveal(sessionId, {
      award,
      performerName,
      tone,
      songTitle,  // NEW
    });
    ```
  - [x] 1.5 Update `broadcastCeremonyReveal` in `apps/server/src/services/dj-broadcaster.ts` to accept `songTitle` in the data parameter:
    ```typescript
    export function broadcastCeremonyReveal(
      sessionId: string,
      data: {
        award: string;
        performerName: string | null;
        tone: string;
        songTitle: string | null;  // NEW
      },
    ): void
    ```
  - [x] 1.6 Update `ceremony:revealed` event stream log in `orchestrateFullCeremony` to include `songTitle` in data. **CRITICAL:** The `SessionEvent` type union in `apps/server/src/services/event-stream.ts` (line 21) must ALSO be updated — add `songTitle: string | null` to the `ceremony:revealed` data type:
    ```typescript
    | { type: 'ceremony:revealed'; ts: number; data: { award: string; performerName: string | null; ceremonyType: 'full' | 'quick'; songTitle: string | null } }
    ```
    Without this type update, TypeScript will reject the `songTitle` field in the `appendEvent` call.
  - [x] 1.7 **IMPORTANT: Song title is NOT populated until Epic 5** — `currentSongTitle` will always be `null` for now. The field is added now so the data pipeline is ready. The moment card widget handles `null` songTitle gracefully (omits it from display). Do NOT fake song titles or add placeholder data.

- [x] Task 2: Update Flutter ceremony state to include songTitle (AC: #1)
  - [x] 2.1 In `apps/flutter_app/lib/state/party_provider.dart`, add `_ceremonySongTitle` field:
    ```dart
    String? _ceremonySongTitle;
    ```
    Add after `_ceremonyTone` field. Add getter:
    ```dart
    String? get ceremonySongTitle => _ceremonySongTitle;
    ```
  - [x] 2.2 Update `onCeremonyReveal` to accept and store `songTitle`:
    ```dart
    void onCeremonyReveal({
      required String award,
      required String? performerName,
      required String tone,
      String? songTitle,  // NEW — nullable, not populated until Epic 5
    }) {
      _ceremonyAward = award;
      _ceremonyTone = tone;
      _ceremonySongTitle = songTitle;
      if (performerName != null) _ceremonyPerformerName = performerName;
      notifyListeners();
    }
    ```
  - [x] 2.3 Update `_clearCeremonyState()` to clear `_ceremonySongTitle`:
    ```dart
    void _clearCeremonyState() {
      _ceremonyPerformerName = null;
      _ceremonyRevealAt = null;
      _ceremonyAward = null;
      _ceremonyTone = null;
      _ceremonySongTitle = null;  // NEW
    }
    ```
  - [x] 2.4 Add `_showMomentCard` boolean state + `_momentCardTimer`:
    ```dart
    bool _showMomentCard = false;
    Timer? _momentCardTimer;

    bool get showMomentCard => _showMomentCard;
    ```
  - [x] 2.5 Add method to show/dismiss moment card:
    ```dart
    void showMomentCardOverlay() {
      _showMomentCard = true;
      _momentCardTimer?.cancel();
      _momentCardTimer = Timer(const Duration(seconds: 10), () {
        dismissMomentCard();
      });
      notifyListeners();
    }

    void dismissMomentCard() {
      _showMomentCard = false;
      _momentCardTimer?.cancel();
      _momentCardTimer = null;
      notifyListeners();
    }
    ```
    **NOTE:** `showMomentCardOverlay` is called by `SocketClient` when `ceremony:reveal` is received (Full ceremony only). `dismissMomentCard` is called by user tap (share or dismiss) or auto-timer, and also in `_clearCeremonyState`.
  - [x] 2.6 Update `_clearCeremonyState` to also dismiss moment card:
    ```dart
    _showMomentCard = false;
    _momentCardTimer?.cancel();
    _momentCardTimer = null;
    ```
  - [x] 2.7 Override `dispose()` to cancel the timer:
    ```dart
    @override
    void dispose() {
      _momentCardTimer?.cancel();
      super.dispose();
    }
    ```

- [x] Task 3: Wire songTitle in socket client (AC: #1)
  - [x] 3.1 In `apps/flutter_app/lib/socket/client.dart`, update the `ceremony:reveal` listener to pass `songTitle`:
    ```dart
    on('ceremony:reveal', (data) {
      final payload = data as Map<String, dynamic>;
      partyProvider.onCeremonyReveal(
        award: payload['award'] as String,
        performerName: payload['performerName'] as String?,
        tone: payload['tone'] as String,
        songTitle: payload['songTitle'] as String?,  // NEW
      );
      // Trigger moment card overlay for Full ceremony
      partyProvider.showMomentCardOverlay();
    });
    ```
    **CRITICAL:** `showMomentCardOverlay()` is called here — ONLY `SocketClient` calls mutation methods on providers. The moment card appears after the reveal event, which already fires after the 2s anticipation phase. The card overlay and ceremony reveal animation are concurrent (card fades in during the celebration window).

- [x] Task 4: Create MomentCard widget (AC: #1, #3)
  - [x] 4.1 Create `apps/flutter_app/lib/widgets/moment_card.dart`:
    ```dart
    import 'package:flutter/material.dart';
    import 'package:karamania/constants/copy.dart';
    import 'package:karamania/theme/dj_theme.dart';
    import 'package:karamania/theme/dj_tokens.dart';

    /// Shareable moment card rendered at 9:16 aspect ratio.
    /// Content: performer name, song title (when available), award, vibe styling.
    class MomentCard extends StatelessWidget {
      const MomentCard({
        super.key,
        required this.award,
        required this.vibe,
        this.performerName,
        this.songTitle,
      });

      final String award;
      final PartyVibe vibe;
      final String? performerName;
      final String? songTitle;

      @override
      Widget build(BuildContext context) {
        return AspectRatio(
          aspectRatio: 9 / 16,
          child: Container(
            key: const Key('moment-card'),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    vibe.bg,
                    vibe.bg.withValues(alpha: 0.8),
                    DJTokens.bgColor,
                  ],
                ),
                borderRadius: BorderRadius.circular(DJTokens.spaceMd),
              ),
              padding: const EdgeInsets.symmetric(
                horizontal: DJTokens.spaceXl,
                vertical: DJTokens.spaceXl,
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Spacer(flex: 2),
                  // Confetti emojis
                  Text(
                    (vibeConfettiEmojis[vibe] ?? vibeConfettiEmojis[PartyVibe.general]!).join(' '),
                    style: const TextStyle(fontSize: DJTokens.iconSizeLg),
                  ),
                  const SizedBox(height: DJTokens.spaceLg),
                  // Performer name
                  if (performerName != null) ...[
                    Text(
                      performerName!,
                      key: const Key('moment-card-performer'),
                      textAlign: TextAlign.center,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            color: DJTokens.textSecondary,
                          ),
                    ),
                    const SizedBox(height: DJTokens.spaceSm),
                  ],
                  // Award title — star of the card
                  Text(
                    award,
                    key: const Key('moment-card-award'),
                    textAlign: TextAlign.center,
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.displayLarge?.copyWith(
                          color: vibe.accent,
                          fontWeight: FontWeight.bold,
                        ),
                  ),
                  const SizedBox(height: DJTokens.spaceMd),
                  // Vibe flavor text
                  Text(
                    vibeAwardFlavors[vibe] ?? '',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          color: DJTokens.textSecondary,
                        ),
                  ),
                  // Song title (when available — Epic 5)
                  if (songTitle != null) ...[
                    const SizedBox(height: DJTokens.spaceMd),
                    Text(
                      songTitle!,
                      key: const Key('moment-card-song'),
                      textAlign: TextAlign.center,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                            color: DJTokens.textSecondary,
                            fontStyle: FontStyle.italic,
                          ),
                    ),
                  ],
                  const Spacer(flex: 3),
                  // Karamania branding — visible but not dominant
                  Text(
                    Copy.appTitle,
                    key: const Key('moment-card-branding'),
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: DJTokens.textSecondary.withValues(alpha: 0.5),
                          letterSpacing: 4,
                        ),
                  ),
                  const SizedBox(height: DJTokens.spaceSm),
                ],
              ),
            ),
          );
      }
    }
    ```
    **Design decisions:**
    - `MomentCard` is a pure render widget — NO `RepaintBoundary` here. The `MomentCardOverlay` wraps it in `RepaintBoundary` for screenshot capture (Task 5)
    - 9:16 aspect ratio per UX spec — Instagram Story format
    - Gradient background using vibe colors — makes each card feel unique
    - `maxLines` + `overflow: TextOverflow.ellipsis` for defensive text rendering (budget Android devices)
    - Karamania branding at bottom — visible but not dominant per UX spec
    - Song title conditional — omitted when null (Epic 5 dependency)
    - All copy and constants from approved sources — no hardcoded strings/colors
    - `StatelessWidget` — no animation state, just renders the card content

- [x] Task 5: Create MomentCardOverlay widget with share functionality (AC: #2, #3)
  - [x] 5.1 Create `apps/flutter_app/lib/widgets/moment_card_overlay.dart`:
    ```dart
    import 'dart:typed_data';
    import 'dart:ui' as ui;

    import 'package:flutter/material.dart';
    import 'package:flutter/rendering.dart';
    import 'package:share_plus/share_plus.dart';
    import 'package:karamania/constants/copy.dart';
    import 'package:karamania/constants/tap_tiers.dart';
    import 'package:karamania/socket/client.dart';
    import 'package:karamania/theme/dj_theme.dart';
    import 'package:karamania/theme/dj_tokens.dart';
    import 'package:karamania/widgets/dj_tap_button.dart';
    import 'package:karamania/widgets/moment_card.dart';

    /// Overlay that shows the moment card with share + dismiss actions.
    /// Auto-dismisses after 10 seconds (managed by PartyProvider).
    class MomentCardOverlay extends StatefulWidget {
      const MomentCardOverlay({
        super.key,
        required this.award,
        required this.vibe,
        required this.onDismiss,
        this.performerName,
        this.songTitle,
      });

      final String award;
      final PartyVibe vibe;
      final VoidCallback onDismiss;
      final String? performerName;
      final String? songTitle;

      @override
      State<MomentCardOverlay> createState() => _MomentCardOverlayState();
    }

    class _MomentCardOverlayState extends State<MomentCardOverlay>
        with SingleTickerProviderStateMixin {
      final GlobalKey _cardKey = GlobalKey();
      late final AnimationController _fadeController;
      late final CurvedAnimation _fadeAnimation;

      @override
      void initState() {
        super.initState();
        _fadeController = AnimationController(
          vsync: this,
          duration: const Duration(milliseconds: 300),
        );
        _fadeAnimation = CurvedAnimation(
          parent: _fadeController,
          curve: Curves.easeOut,
        );
        _fadeController.forward();
      }

      @override
      void dispose() {
        _fadeAnimation.dispose();
        _fadeController.dispose();
        super.dispose();
      }

      Future<void> _shareMomentCard() async {
        try {
          final boundary = _cardKey.currentContext?.findRenderObject()
              as RenderRepaintBoundary?;
          if (boundary == null) return;

          final image = await boundary.toImage(pixelRatio: 3.0);
          final byteData = await image.toByteData(
            format: ui.ImageByteFormat.png,
          );
          if (byteData == null) return;

          final pngBytes = byteData.buffer.asUint8List();

          // Track share intent as viral signal (Task 8)
          SocketClient.instance.emitMomentCardShared();

          await SharePlus.instance.share(
            ShareParams(
              files: [
                XFile.fromData(
                  pngBytes,
                  mimeType: 'image/png',
                  name: 'karamania-moment.png',
                ),
              ],
            ),
          );

          widget.onDismiss();
        } catch (_) {
          // Share sheet cancelled or failed — dismiss gracefully
          widget.onDismiss();
        }
      }

      @override
      Widget build(BuildContext context) {
        return FadeTransition(
          opacity: _fadeAnimation,
          child: Container(
            key: const Key('moment-card-overlay'),
            color: DJTokens.bgColor.withValues(alpha: 0.85),
            child: SafeArea(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Spacer(),
                  // Moment card with capture key
                  Expanded(
                    flex: 5,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: DJTokens.spaceXl,
                      ),
                      child: RepaintBoundary(
                        key: _cardKey,
                        child: MomentCard(
                          award: widget.award,
                          vibe: widget.vibe,
                          performerName: widget.performerName,
                          songTitle: widget.songTitle,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: DJTokens.spaceLg),
                  // Share button — one tap, native share sheet
                  DJTapButton(
                    key: const Key('moment-card-share-btn'),
                    tier: TapTier.social,
                    onTap: _shareMomentCard,
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.share,
                          color: DJTokens.textPrimary,
                          size: DJTokens.spaceLg,
                        ),
                        const SizedBox(width: DJTokens.spaceSm),
                        Text(
                          Copy.momentCardShare,
                          style: Theme.of(context).textTheme.labelLarge,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: DJTokens.spaceMd),
                  // Dismiss tap target
                  GestureDetector(
                    key: const Key('moment-card-dismiss-btn'),
                    onTap: widget.onDismiss,
                    child: Padding(
                      padding: const EdgeInsets.all(DJTokens.spaceMd),
                      child: Text(
                        Copy.momentCardDismiss,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ),
                  ),
                  const Spacer(),
                ],
              ),
            ),
          ),
        );
      }
    }
    ```
    **Design decisions:**
    - `RepaintBoundary` with `GlobalKey` wraps `MomentCard` for screenshot capture — captures ONLY the card content, not buttons/overlay background
    - `MomentCard` is a pure render widget with NO `RepaintBoundary` — the overlay provides it
    - `pixelRatio: 3.0` for high-quality image output (retina)
    - `XFile.fromData` with PNG bytes — no temporary file management needed. **NOTE:** `XFile` is re-exported by `share_plus` — import from `package:share_plus/share_plus.dart`. Verify `XFile.fromData` constructor accepts `(Uint8List, {String? mimeType, String? name})` in share_plus ^12.0.1
    - `FadeTransition` for smooth appearance (300ms) — created in `initState` per Story 3.3 pattern
    - Auto-dismiss managed by `PartyProvider._momentCardTimer` (10s), overlay just calls `onDismiss`
    - **DO NOT test:** animation timings, fade effects

- [x] Task 6: Add copy constants for moment card (AC: #2, #3)
  - [x] 6.1 In `apps/flutter_app/lib/constants/copy.dart`, add after the Ceremony section:
    ```dart
    // Moment card
    static const String momentCardShare = 'Share Moment';
    static const String momentCardDismiss = 'Tap to dismiss';
    ```

- [x] Task 7: Render moment card overlay in party screen (AC: #3)
  - [x] 7.1 In `apps/flutter_app/lib/screens/party_screen.dart`, add import:
    ```dart
    import 'package:karamania/widgets/moment_card_overlay.dart';
    ```
  - [x] 7.2 Add the moment card overlay as a `Stack` layer on top of the existing content. The overlay should appear when `partyProvider.showMomentCard` is true AND ceremony type is 'full':
    ```dart
    // In the build method, wrap the existing body content in a Stack:
    body: Stack(
      children: [
        // Existing AnimatedContainer with all ceremony/state content
        AnimatedContainer(
          // ... existing content ...
        ),
        // Moment card overlay — only during Full ceremony celebration window
        if (partyProvider.showMomentCard &&
            partyProvider.ceremonyType == 'full' &&
            partyProvider.ceremonyAward != null)
          MomentCardOverlay(
            award: partyProvider.ceremonyAward!,
            vibe: displayVibe,
            performerName: partyProvider.ceremonyPerformerName,
            songTitle: partyProvider.ceremonySongTitle,
            onDismiss: () => partyProvider.dismissMomentCard(),
          ),
      ],
    ),
    ```
    **CRITICAL:** The overlay sits ON TOP of the ceremony display (Stack ordering). The ceremony reveal animation plays underneath. The overlay fades in during the celebration window (T+3s to T+10s from ceremony start). When the DJ transitions out of ceremony state, `_clearCeremonyState` dismisses the overlay automatically.

    **NOTE on `onDismiss` calling `partyProvider.dismissMomentCard()`:** This is a UI action (user tapped dismiss or share completed), not a socket event. The widget calls `dismissMomentCard()` directly on the provider. This is acceptable per Flutter boundaries — the rule is "ONLY SocketClient calls mutation methods on providers" for server-driven state changes. User-initiated UI state (showing/hiding overlays) can be managed directly. However, if this feels like a boundary violation, the alternative is to have `SocketClient` expose a `dismissMomentCard()` method that delegates to the provider. **Decision: direct call is acceptable** — `showMomentCard` is pure UI state, not server-driven game state.

- [x] Task 8: Log share intent as viral signal metric (AC: #2)
  - [x] 8.1 In `apps/flutter_app/lib/socket/client.dart`, add a method to emit share tracking:
    ```dart
    void emitMomentCardShared() {
      _socket?.emit('card:shared', {
        'type': 'moment',
        'timestamp': DateTime.now().millisecondsSinceEpoch,
      });
    }
    ```
  - [x] 8.2 **IMPORTANT:** The `card:shared` event is NOT in the current event catalog. For MVP, track this client-side only — do NOT add a new server-side handler. The moment card overlay can call `SocketClient.instance.emitMomentCardShared()` before `onDismiss` in the share flow. The server will silently ignore unknown events. In a future story, a server handler can be added to persist share metrics.
  - [x] 8.3 The `_shareMomentCard` method in `MomentCardOverlay` (Task 5) already includes the `SocketClient.instance.emitMomentCardShared()` call and `import 'package:karamania/socket/client.dart'`. No separate code change needed — the tracking is built into the share flow.

- [x] Task 9: Server tests (AC: #1)
  - [x] 9.1 Update `apps/server/tests/services/dj-broadcaster.test.ts`:
    - Update `broadcastCeremonyReveal` test to verify `songTitle` is included in the payload
    - Test `broadcastCeremonyReveal` with `songTitle: null` — still broadcasts correctly
    - Test `broadcastCeremonyReveal` with `songTitle: 'Bohemian Rhapsody'` — includes in payload
  - [x] 9.2 Update `apps/server/tests/services/session-manager-ceremony.test.ts`:
    - Test `orchestrateFullCeremony` includes `songTitle` from context in reveal broadcast
    - Test `orchestrateFullCeremony` with `currentSongTitle: null` — songTitle is null in broadcast
    - Test `ceremony:revealed` event includes `songTitle` in data
  - [x] 9.3 Update DJ engine tests to cover `currentSongTitle` field:
    - Serialization round-trip includes `currentSongTitle`
    - Initial context has `currentSongTitle: null`
  - [x] 9.4 **Regression tests**: Run full test suite — all 547+ existing tests still pass

- [x] Task 10: Flutter tests (AC: #1, #2, #3)
  - [x] 10.1 Create `apps/flutter_app/test/widgets/moment_card_test.dart`:
    - Test MomentCard renders award title
    - Test MomentCard renders performer name when provided
    - Test MomentCard omits performer name when null
    - Test MomentCard renders song title when provided
    - Test MomentCard omits song title when null
    - Test MomentCard renders Karamania branding
    - Test MomentCard renders confetti emojis for vibe
    - Test MomentCard widget key is `moment-card`
    - **DO NOT test:** gradient colors, exact font sizes, spacing values
  - [x] 10.2 Create `apps/flutter_app/test/widgets/moment_card_overlay_test.dart`:
    - Test overlay renders MomentCard
    - Test overlay shows share button with correct text
    - Test overlay shows dismiss text
    - Test tapping dismiss calls onDismiss callback
    - Test overlay widget key is `moment-card-overlay`
    - **DO NOT test:** fade animation, screenshot capture (platform-specific), share_plus interaction
  - [x] 10.3 Update `apps/flutter_app/test/state/party_provider_test.dart` (or create `party_provider_moment_card_test.dart`):
    - Test `onCeremonyReveal` with `songTitle` stores it correctly
    - Test `onCeremonyReveal` without `songTitle` defaults to null
    - Test `ceremonySongTitle` getter returns stored value
    - Test `showMomentCardOverlay` sets `showMomentCard` to true and notifies
    - Test `dismissMomentCard` sets `showMomentCard` to false and notifies
    - Test `_clearCeremonyState` clears `_ceremonySongTitle` and dismisses moment card
    - Test auto-dismiss: moment card timer fires after 10s (use fake timers)
  - [x] 10.4 Update `apps/flutter_app/test/socket/client_test.dart`:
    - Test `ceremony:reveal` handler passes `songTitle` to provider
    - Test `ceremony:reveal` handler calls `showMomentCardOverlay`

## Dev Notes

### Architecture: Client-Side Rendering

The moment card is rendered entirely client-side using Flutter widgets. There is NO server-side image generation. The flow:

1. Server broadcasts `ceremony:reveal` with `{award, performerName, tone, songTitle}`
2. Flutter `SocketClient` receives event → updates `PartyProvider` → triggers `showMomentCardOverlay()`
3. `MomentCardOverlay` renders `MomentCard` widget inside `RepaintBoundary`
4. On share tap: `RenderRepaintBoundary.toImage()` → PNG bytes → `share_plus` native share sheet
5. On dismiss tap (or 10s auto-timer): overlay removed

This approach ensures:
- **Zero latency** — no server round-trip for image generation
- **Offline-capable** — card renders from locally cached state
- **Vibe-aware** — uses current `PartyVibe` colors directly from Flutter state
- **Device-adaptive** — Flutter handles responsive rendering

[Source: _bmad-output/planning-artifacts/ux-design-specification.md — "Moment card appears → one tap → native share sheet"]

### Song Title Limitation (Epic 5 Dependency)

`DJContext.currentSongTitle` is added in this story but will be `null` until Epic 5 implements song detection and metadata resolution. The `MomentCard` widget gracefully omits the song title section when it's null. The data pipeline (server broadcast → socket listener → provider → widget) is fully wired — Epic 5 just needs to populate the field.

This follows the same pattern as `currentPerformer` — the field exists in DJContext but isn't populated until the relevant epic. Stories 3.3 and 3.4 already handle null performer gracefully.

[Source: _bmad-output/implementation-artifacts/3-4-quick-ceremony.md — "Performer Tracking Limitation"]

### Full Ceremony Only

Moment cards are generated ONLY for Full ceremonies, NOT Quick ceremonies. The UX spec explicitly states: "No moment card, no share prompt, no confetti — just a quick shoutout" for Quick ceremonies. The `showMomentCardOverlay()` call is in the `ceremony:reveal` listener only (Full ceremony path), not in `ceremony:quick`.

[Source: _bmad-output/planning-artifacts/ux-design-specification.md — Quick Ceremony section]

### Auto-Dismiss Pattern

The 10-second auto-dismiss timer is managed by `PartyProvider`, not by the overlay widget. This ensures:
- Timer cleanup when DJ state transitions (via `_clearCeremonyState`)
- Timer cancellation on share or manual dismiss
- Single source of truth for overlay visibility state

The overlay widget itself is stateless with respect to visibility — it just renders when `showMomentCard` is true.

### Screenshot Capture Approach

Using `RenderRepaintBoundary.toImage()` — built into Flutter, no additional packages needed:
- `pixelRatio: 3.0` for retina-quality output
- `ui.ImageByteFormat.png` for universal share compatibility
- `XFile.fromData()` from `share_plus` — no temporary file writes
- The `RepaintBoundary` wraps ONLY the `MomentCard` widget (not buttons/overlay background)

**Alternative considered:** `screenshot` package — adds dependency for a single API call that Flutter already provides natively. Rejected for simplicity.

### Share Tracking (Viral Signal)

Share intent is tracked by emitting a `card:shared` socket event. The server currently has no handler for this event — Socket.io silently ignores unknown events. This is intentional MVP behavior: the event is emitted so that when a server handler is added later, no client changes are needed.

The UX spec emphasizes tracking share destination (group chat vs. public social) to measure viral coefficient. The native share sheet doesn't reliably report which app was selected across platforms, so the metric tracks "share intent" (tapped share) rather than "share completed to X platform."

[Source: _bmad-output/planning-artifacts/ux-design-specification.md — "Emotional Design Principles #4: FOMO"]

### Existing Share Infrastructure

`share_plus: ^12.0.1` is already in `pubspec.yaml` and used in `party_screen.dart` (line ~490) for party invite sharing:
```dart
SharePlus.instance.share(ShareParams(text: Copy.sharePartyMessage + ...));
```

Moment card sharing uses the same package but with `files` parameter instead of `text` (image share).

### Widget Hierarchy During Full Ceremony

```
PartyScreen (Scaffold)
├── Stack
│   ├── AnimatedContainer (existing ceremony content)
│   │   └── CeremonyDisplay (anticipation → reveal animation)
│   └── MomentCardOverlay (when showMomentCard == true)
│       ├── RepaintBoundary (_cardKey)
│       │   └── MomentCard (9:16 aspect, vibe-styled)
│       ├── Share button (DJTapButton)
│       └── Dismiss text (GestureDetector)
```

The overlay appears ON TOP of the ceremony display. The reveal animation plays underneath during the celebration window. When the DJ transitions to the next state, both the ceremony display and moment card overlay are removed.

### Provider Boundary Clarification

`dismissMomentCard()` is called directly by the widget (not via SocketClient). This is acceptable because `showMomentCard` is **UI display state**, not server-driven game state. The Flutter boundary rule ("ONLY SocketClient calls mutation methods on providers") applies to server-driven state changes like `onCeremonyReveal`, `onDjStateUpdate`, etc. User-initiated UI visibility toggles are direct widget→provider calls — same pattern as `_wakelockToggle` in the constructor.

### Defensive Rendering (Budget Android)

Per UX spec: "Share-worthy artifacts need defensive design: text truncation, dynamic font scaling, overflow handling for long display names."

The `MomentCard` widget uses:
- `maxLines: 2` + `TextOverflow.ellipsis` for performer name
- `maxLines: 3` + `TextOverflow.ellipsis` for award title
- `maxLines: 2` + `TextOverflow.ellipsis` for song title
- `AspectRatio(9/16)` ensures consistent card shape across devices

### What This Story Does NOT Build

- **No image persistence** — cards are generated on-demand, not saved to device
- **No server-side image generation** — pure client-side rendering
- **No setlist poster** — Story 8.3
- **No capture bubble integration** — Epic 6
- **No Firebase Storage upload** — media storage is Epic 6
- **No new audio cues** — moment card is visual only
- **No song title population** — Epic 5 (field added, always null for now)
- **No share destination tracking** — native share sheet doesn't expose this reliably

### Existing Code to NOT Modify

- `dj-engine/ceremony-selection.ts` — No changes. Selection logic independent
- `dj-engine/transitions.ts` — No changes
- `dj-engine/states.ts` — No changes
- `services/award-generator.ts` — No changes. Consumed as-is
- `services/participation-scoring.ts` — No changes
- `services/rate-limiter.ts` — No changes
- `widgets/ceremony_display.dart` — No changes. Full ceremony widget stays independent
- `widgets/quick_ceremony_display.dart` — No changes
- `audio/state_transition_audio.dart` — No changes
- `socket-handlers/` — No changes (no new server-side socket handler for card:shared)
- `broadcastCeremonyAnticipation` — No changes (anticipation payload unchanged)
- `broadcastCeremonyQuick` — No changes (quick ceremony gets no moment card)

### Previous Story Intelligence (Story 3.4)

Story 3.4 established:
- Quick ceremony pattern — reused for understanding what NOT to apply moment cards to
- `ceremonyRevealTimers` Map — moment card timer is separate (provider-managed, not server-managed)
- CurvedAnimation in initState pattern — applied to MomentCardOverlay fade animation
- 547 server tests, 329 Flutter tests — regression baseline
- `_clearCeremonyState()` cleanup — extended for moment card state

Key code review fixes from 3.3/3.4 applied:
- CurvedAnimation created in `initState()`, disposed in `dispose()`
- Container→Center simplification (use Container only when decoration needed)
- `SingleTickerProviderStateMixin` when only one controller needed

### Git Intelligence

Recent commits follow pattern: `"Implement Story X.Y: Title with code review fixes"`
- Story 3.4 was the most recent commit (7b8362e)
- All ceremony infrastructure is established and tested
- dj-broadcaster follows one-export-per-broadcast-type pattern
- Test file pattern: extend existing test files, create new ones only for new widgets

### Project Structure Notes

New files:
- `apps/flutter_app/lib/widgets/moment_card.dart`
- `apps/flutter_app/lib/widgets/moment_card_overlay.dart`
- `apps/flutter_app/test/widgets/moment_card_test.dart`
- `apps/flutter_app/test/widgets/moment_card_overlay_test.dart`

Modified files:
- `apps/server/src/dj-engine/types.ts` — Add `currentSongTitle` to DJContext
- `apps/server/src/dj-engine/machine.ts` — Initialize `currentSongTitle: null`
- `apps/server/src/dj-engine/serializer.ts` — Serialize/deserialize `currentSongTitle`
- `apps/server/src/services/dj-broadcaster.ts` — Add `songTitle` to `broadcastCeremonyReveal` payload
- `apps/server/src/services/session-manager.ts` — Pass `songTitle` in `orchestrateFullCeremony`, include in event stream log
- `apps/server/src/services/event-stream.ts` — Add `songTitle: string | null` to `ceremony:revealed` SessionEvent type
- `apps/flutter_app/lib/state/party_provider.dart` — Add `_ceremonySongTitle`, `_showMomentCard`, `_momentCardTimer`, `showMomentCardOverlay()`, `dismissMomentCard()`
- `apps/flutter_app/lib/socket/client.dart` — Pass `songTitle` in `ceremony:reveal` handler, call `showMomentCardOverlay()`, add `emitMomentCardShared()`
- `apps/flutter_app/lib/screens/party_screen.dart` — Add `MomentCardOverlay` in Stack
- `apps/flutter_app/lib/constants/copy.dart` — Add `momentCardShare`, `momentCardDismiss`

Existing test files to extend:
- `apps/server/tests/services/dj-broadcaster.test.ts` — Update `broadcastCeremonyReveal` tests
- `apps/server/tests/services/session-manager-ceremony.test.ts` — Update full ceremony tests
- `apps/flutter_app/test/socket/client_test.dart` — Update `ceremony:reveal` tests

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 3, Story 3.5] — Moment card AC: performer name + song title + award, native share sheet, vibe-styled
- [Source: _bmad-output/planning-artifacts/epics.md#FR18b] — System generates moment card combining performer name, song title, and award
- [Source: _bmad-output/planning-artifacts/epics.md#FR34] — Shareable moment card per Full ceremony
- [Source: _bmad-output/planning-artifacts/epics.md#FR35] — Share moment card via native share sheet
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — Share Design] — 9:16 format, one-tap, auto-dismiss 10s, Karamania brand visible but not dominant
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — Ceremony Beat-by-Beat] — Celebration Window T+3s to T+10s, share-ready overlay
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — Emotional Design #4] — FOMO viral signal, share tracking
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — Quick Ceremony] — No moment card, no share prompt
- [Source: _bmad-output/planning-artifacts/architecture.md — Memory & Sharing] — FR34-39 covered by award-generator, capture system, REST share
- [Source: _bmad-output/project-context.md#Server Boundaries] — session-manager is ONLY orchestrator
- [Source: _bmad-output/project-context.md#Flutter Boundaries] — ONLY SocketClient calls mutation methods on providers
- [Source: _bmad-output/project-context.md#Anti-Patterns] — No hardcoded strings, no hardcoded colors, use DJTokens
- [Source: _bmad-output/project-context.md#Testing Rules] — DO NOT test animations/visual effects/confetti/color values
- [Source: apps/server/src/shared/events.ts] — CEREMONY_REVEAL event constant
- [Source: apps/server/src/dj-engine/types.ts] — DJContext interface, DJState enum
- [Source: apps/server/src/services/dj-broadcaster.ts] — broadcastCeremonyReveal pattern
- [Source: apps/server/src/services/session-manager.ts] — orchestrateFullCeremony, ceremony event logging
- [Source: apps/flutter_app/lib/state/party_provider.dart] — ceremony state fields, _clearCeremonyState
- [Source: apps/flutter_app/lib/socket/client.dart] — ceremony:reveal listener pattern
- [Source: apps/flutter_app/lib/screens/party_screen.dart] — ceremony rendering, share_plus usage pattern
- [Source: apps/flutter_app/lib/widgets/ceremony_display.dart] — CeremonyDisplay widget pattern
- [Source: apps/flutter_app/lib/constants/copy.dart] — ceremony copy constants
- [Source: apps/flutter_app/lib/theme/dj_theme.dart] — PartyVibe colors, DJState enum
- [Source: apps/flutter_app/lib/theme/dj_tokens.dart] — spacing, color constants
- [Source: apps/flutter_app/pubspec.yaml] — share_plus: ^12.0.1 already included
- [Source: _bmad-output/implementation-artifacts/3-4-quick-ceremony.md] — Previous story: 547 server tests, 329 Flutter tests, ceremony patterns

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

### Completion Notes List

- All 10 tasks and subtasks implemented following story spec exactly
- `currentSongTitle` field wired through entire data pipeline (server types → serializer → broadcaster → session-manager → event-stream → Flutter socket client → PartyProvider → widgets) — always null until Epic 5
- MomentCard renders at 9:16 aspect ratio with vibe gradient, confetti emojis, performer name, award title, vibe flavor text, optional song title, and Karamania branding
- MomentCardOverlay wraps MomentCard in RepaintBoundary for screenshot capture, uses share_plus for native share sheet
- Auto-dismiss 10s timer managed by PartyProvider, not overlay widget
- Share intent tracked via `card:shared` socket event (server silently ignores — no handler yet)
- MomentCardOverlay test required ChangeNotifierProvider<AccessibilityProvider> wrapper for DJTapButton dependency
- Server tests: 555 passed (added ~8 new tests for songTitle serialization, broadcaster, session-manager)
- Flutter tests: 351 passed (added 20 new tests across 4 test files, zero regressions)

### Change Log

- Added `currentSongTitle: string | null` to DJContext interface and initialization
- Added `currentSongTitle` serialization/deserialization with validation
- Added `songTitle` to `broadcastCeremonyReveal` payload
- Added `songTitle` to `orchestrateFullCeremony` reveal broadcast and event stream log
- Added `songTitle: string | null` to `ceremony:revealed` SessionEvent type
- Added `_ceremonySongTitle`, `_showMomentCard`, `_momentCardTimer` to PartyProvider
- Added `showMomentCardOverlay()` and `dismissMomentCard()` methods to PartyProvider
- Updated `_clearCeremonyState()` to clear songTitle and moment card state
- Updated `ceremony:reveal` socket handler to pass songTitle and trigger moment card overlay
- Added `emitMomentCardShared()` method to SocketClient
- Added `momentCardShare` and `momentCardDismiss` copy constants
- Added MomentCardOverlay rendering in party_screen Stack

#### Code Review Fixes (2026-03-13)
- [H1] Added `mounted` check after async gaps in `_shareMomentCard()` to prevent `setState() after dispose()`
- [M1] Wrapped MomentCardOverlay in `Positioned.fill` in party_screen Stack for consistent full-screen overlay pattern
- [M2] Improved socket client test to verify combined ceremony+moment card flow instead of duplicating provider tests
- [M3] Added `debugPrint` error logging in `_shareMomentCard()` catch block instead of silent swallow
- [L2] Made `currentPerformer` undefined handling consistent with `currentSongTitle` in serializer

### File List

**New files:**
- `apps/flutter_app/lib/widgets/moment_card.dart` — MomentCard StatelessWidget (9:16 aspect, vibe-styled)
- `apps/flutter_app/lib/widgets/moment_card_overlay.dart` — MomentCardOverlay with share + dismiss actions
- `apps/flutter_app/test/widgets/moment_card_test.dart` — 8 tests for MomentCard rendering
- `apps/flutter_app/test/widgets/moment_card_overlay_test.dart` — 5 tests for MomentCardOverlay

**Modified files:**
- `apps/server/src/dj-engine/types.ts` — Added `currentSongTitle` to DJContext
- `apps/server/src/dj-engine/machine.ts` — Initialize `currentSongTitle: null`
- `apps/server/src/dj-engine/serializer.ts` — Serialize/deserialize `currentSongTitle`
- `apps/server/src/services/dj-broadcaster.ts` — Added `songTitle` to `broadcastCeremonyReveal`
- `apps/server/src/services/session-manager.ts` — Pass `songTitle` in ceremony orchestration
- `apps/server/src/services/event-stream.ts` — Added `songTitle` to `ceremony:revealed` type
- `apps/flutter_app/lib/state/party_provider.dart` — Added songTitle, moment card state/timer
- `apps/flutter_app/lib/socket/client.dart` — Pass songTitle, trigger overlay, add emitMomentCardShared
- `apps/flutter_app/lib/screens/party_screen.dart` — Add MomentCardOverlay in Stack
- `apps/flutter_app/lib/constants/copy.dart` — Added moment card copy constants
- `apps/server/tests/factories/dj-state.ts` — Added `currentSongTitle: null` to factory
- `apps/server/tests/services/dj-broadcaster.test.ts` — Updated/added songTitle tests
- `apps/server/tests/services/session-manager-ceremony.test.ts` — Updated/added songTitle tests
- `apps/server/tests/dj-engine/serializer.test.ts` — Added currentSongTitle serialization tests
- `apps/flutter_app/test/state/party_provider_test.dart` — Added moment card test group (7 tests)
- `apps/flutter_app/test/socket/client_test.dart` — Added songTitle and overlay trigger tests
