# Story 1.1: Flutter App Scaffold & Design Token System

Status: ready-for-dev

## Story

As a developer,
I want a fully scaffolded Flutter app with design tokens, core primitives, and foundational UX infrastructure,
So that all subsequent screens and features build on a consistent, accessible design system.

## Acceptance Criteria

1. **Given** the Flutter project is created with `--org com.karamania --project-name karamania`
   **When** the app is built and launched
   **Then** the DJTokens class provides 8 constant color tokens, 1 timing token, 5 spacing tokens, and the PartyVibe enum provides 4 vibe-shifting tokens per vibe

2. **And** the DJTapButton widget implements three tap tiers (Consequential 64x64px, Social 56x56px, Private 48x48px) with tier-specific haptic behavior and scale feedback

3. **And** a vibe theming provider supports 5 party vibes (PartyVibe enum) propagating through the visual layer

4. **And** the LoadingState enum (idle, loading, success, error) is available for per-operation async state tracking

5. **And** an AccessibilityProvider supports prefers-reduced-motion / MediaQuery.disableAnimations

6. **And** Space Grotesk variable font is loaded and subsetted for Latin + Vietnamese (<25KB) with 6 type roles (minimum 16px for body text)

7. **And** a centralized string constants module (`constants/copy.dart`) is created with all vibe-keyed content maps

8. **And** all vibe palettes meet WCAG AA contrast ratio (>4.5:1 for normal text, >3:1 for large text) (NFR17)

9. **And** SafeArea wraps all content with no content behind notch/dynamic island/gesture bar

## Tasks / Subtasks

- [ ] Task 1: Flutter project scaffold (AC: #1)
  - [ ] 1.1 Run `flutter create --org com.karamania --project-name karamania apps/flutter_app` (requires Flutter SDK 3.41.2 stable)
  - [ ] 1.2 Set up directory structure: `lib/theme/`, `lib/state/`, `lib/socket/`, `lib/audio/`, `lib/constants/`, `lib/screens/`, `lib/widgets/`, `lib/api/generated/`
  - [ ] 1.3 Configure `analysis_options.yaml` with Dart linter rules -- must include `always_use_package_imports` to enforce `package:karamania/...` imports
  - [ ] 1.4 Add `pubspec.yaml` dependencies: `provider` (v6.x), `go_router`, `socket_io_client`, `firebase_core`, `firebase_auth`
  - [ ] 1.5 Create `dart_defines_local.json.example` with SERVER_URL and FIREBASE_* placeholders. Dev command: `flutter run --dart-define-from-file=dart_defines_local.json`
  - [ ] 1.6 Set portrait-only orientation lock via `SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp])` in `main()` before `runApp()`
  - [ ] 1.7 Configure `main.dart`: Firebase init (`Firebase.initializeApp()`), `MultiProvider` wrapping `MaterialApp` with all 6 providers (see Task 10)
  - [ ] 1.8 Set up `app.dart` with GoRouter config (placeholder routes: `/`, `/party`). Back button during party must show confirm exit dialog, not pop route
  - [ ] 1.9 Disable Android overscroll glow with custom `ScrollBehavior` applied on `MaterialApp.scrollBehavior`
  - [ ] 1.10 Set platform targets: `minSdkVersion 26` in `android/app/build.gradle`, iOS deployment target 15.0 in Xcode project settings

- [ ] Task 2: DJTokens design token class (AC: #1, #8)
  - [ ] 2.1 Create `lib/theme/dj_tokens.dart` with 8 constant color tokens (surfaces + text + interactive):
    - Surfaces: `bgColor` (#0A0A0F), `surfaceColor` (#1A1A2E), `surfaceElevated` (#252542)
    - Text: `textPrimary` (#F0F0F0), `textSecondary` (#9494B0 -- adjusted for WCAG AA on surfaceColor)
    - Interactive: `actionConfirm` (#4ADE80), `actionDanger` (#EF4444)
    - Timing: `transitionFast` (Duration 150ms)
  - [ ] 2.2 Add 5 spacing constants: `spaceXs` (4.0), `spaceSm` (8.0), `spaceMd` (16.0), `spaceLg` (24.0), `spaceXl` (32.0)
  - [ ] 2.3 NOTE: `textAccent`, `actionPrimary`, `ceremonyGlow`, `ceremonyBg` are NOT constants -- they shift per vibe. Access them via `PartyVibe` enum. `DJTokens` may expose `PartyVibe.general` values as static defaults for non-party contexts only
  - [ ] 2.4 Verify all constant color combinations pass WCAG AA contrast ratios (>4.5:1 normal text, >3:1 large text)

- [ ] Task 3: Vibe theming system (AC: #3, #8)
  - [ ] 3.1 Create `PartyVibe` enum in `lib/theme/dj_theme.dart` (5 vibes: general, kpop, rock, ballad, edm). Architecture file tree only lists `dj_tokens.dart` and `dj_theme.dart` under `theme/` -- keep vibe enum in `dj_theme.dart`, not a separate file
  - [ ] 3.2 Each vibe defines 4 shifting tokens: `accent`, `glow`, `bg`, `primary` (these map to conceptual names `ceremonyGlow` and `ceremonyBg`):
    - general: accent=#FFD700, glow=#FFD700, bg=#1A0A2E, primary=#6C63FF
    - kpop: accent=#FF0080, glow=#FF69B4, bg=#1A0A20, primary=#CC00FF (NOTE: UX spec inline example shows #FF6B9D -- that is wrong, use #FF0080 from the full enum definition)
    - rock: accent=#FF4444, glow=#FF6600, bg=#1A0A0A, primary=#CC4422
    - ballad: accent=#FF9966, glow=#FFCC88, bg=#1A1210, primary=#CC8866
    - edm: accent=#00FFC8, glow=#00C8FF, bg=#0A1A1A, primary=#00C8FF
  - [ ] 3.3 Verify all 5 vibe accent colors pass WCAG AA on their respective ceremony bg
  - [ ] 3.4 Create `DJState` enum in `dj_theme.dart` with values: `lobby`, `songSelection`, `partyCardDeal`, `song`, `ceremony`, `interlude`, `finale`
  - [ ] 3.5 Add DJ state-to-background-color mapping in `dj_theme.dart`:
    - `lobby` => #0A0A1A
    - `songSelection` => #0F0A1E
    - `partyCardDeal` => #1A0A1A
    - `song` => #0A0A0F
    - `ceremony` => vibe.bg (ceremony bg from PartyVibe)
    - `interlude` => #0F1A2E
    - `finale` => #1A0A2E
  - [ ] 3.6 Create `ThemeData` factory that applies DJTokens + vibe palette

- [ ] Task 4: DJTapButton widget (AC: #2)
  - [ ] 4.1 Create `TapTier` enum in `lib/constants/tap_tiers.dart` with three tiers:
    - `consequential`: 64x64px min, 500ms long-press hold, `HapticFeedback.heavyImpact` fires ON CONFIRM (after 500ms completes -- NOT on touch-down), scale(0.92), fill animation showing progress during hold, early release = no action + visual reset
    - `social`: 56x56px min, immediate fire on touch-down, 200ms debounce, `HapticFeedback.lightImpact` on touch-down, scale(0.95)
    - `private`: 48x48px min, immediate fire on touch-down, 200ms debounce, no haptic, scale(0.97)
  - [ ] 4.2 Create `DJTapButton` StatefulWidget in `lib/widgets/dj_tap_button.dart` -- requires `AnimationController` for scale and fill animations
  - [ ] 4.3 Accept a required `Key` parameter -- all interactive widgets must have Keys for testing (architecture rule 8)
  - [ ] 4.4 Implement `AnimatedScale` feedback per tier
  - [ ] 4.5 Implement fill animation for consequential tier (visual progress bar during 500ms hold). Under reduced motion: no fill animation, instant confirmation at 500ms
  - [ ] 4.6 Ensure hit area extends 8px beyond visible bounds (fat finger protection). Minimum 12px gap between adjacent tappable elements
  - [ ] 4.7 Support `AccessibilityProvider` reduced-motion: instant scale (no animation), static fill for consequential tier
  - [ ] 4.8 Graceful haptic fallback: if device doesn't support vibration, skip silently -- no fallback UI
  - [ ] 4.9 Add `FocusNode` with custom highlight using vibe accent color for WCAG 2.4.7 focus visibility

- [ ] Task 5: LoadingState enum (AC: #4)
  - [ ] 5.1 Create `LoadingState` enum in `lib/state/loading_state.dart`: `idle`, `loading`, `success`, `error`
  - [ ] 5.2 Per-operation pattern: e.g. `playlistImportState`, not global `isLoading`

- [ ] Task 6: AccessibilityProvider (AC: #5)
  - [ ] 6.1 Create `lib/state/accessibility_provider.dart` extending `ChangeNotifier`
  - [ ] 6.2 Implement `reducedMotion` getter reading `MediaQuery.disableAnimations`
  - [ ] 6.3 Register in `MultiProvider` in `main.dart`
  - [ ] 6.4 Document reduced motion widget behaviors for subsequent stories (convention: decorative elements use `ExcludeSemantics`, animations become instant/static, no confetti/glow/pulse)

- [ ] Task 7: Typography system with Space Grotesk (AC: #6)
  - [ ] 7.1 Download Space Grotesk variable font
  - [ ] 7.2 Subset font for Latin + Vietnamese characters (target <25KB) using `fonttools`: `pyftsubset SpaceGrotesk-VariableFont.ttf --unicodes="U+0000-00FF,U+0100-024F,U+1E00-1EFF" --flavor=woff2`
  - [ ] 7.3 Place subsetted font file in `assets/fonts/`
  - [ ] 7.4 Declare in `pubspec.yaml` fonts section
  - [ ] 7.5 Define 6 type roles in `dj_theme.dart` ThemeData:
    - Display: 32px, weight 700
    - Title: 24px, weight 700
    - Subtitle: 16px, weight 600
    - Body: 16px, weight 400 (PRD minimum: 16px body text)
    - Caption: 12px, weight 400 (non-interactive labels only)
    - Button: 16px, weight 700
  - [ ] 7.6 Apply via `TextTheme` in `ThemeData` factory. Fallback: system sans-serif
  - [ ] 7.7 Type usage rules: award titles/winner names UPPERCASE, primary action buttons UPPERCASE, secondary buttons sentence case, no italics anywhere, minimum 14px for any interactive text

- [ ] Task 8: String constants module (AC: #7)
  - [ ] 8.1 Create `lib/constants/copy.dart`
  - [ ] 8.2 Add vibe-keyed confetti emoji pools:
    - General: `['🎉', '✨', '🌟', '🎊']`
    - K-pop: `['💖', '💜', '✨']`
    - Rock: `['🔥', '⚡']`
    - Ballad: `['✨', '🌟']`
    - EDM: `['💎', '✨']`
  - [ ] 8.3 Add vibe-keyed reaction button sets:
    - General: `['🔥', '👏', '😂', '💀']`
    - K-pop: `['🔥', '👏', '😍', '💀']`
    - Rock: `['🔥', '🤘', '😂', '💀']`
    - Ballad: `['❤️', '😭', '👏', '🥹']`
    - EDM: `['🔥', '👏', '🎧', '💀']`
  - [ ] 8.4 Add vibe-keyed award copy flavors:
    - General: "Absolute showstopper"
    - K-pop: "Main vocal energy"
    - Rock: "Shredded the vocals"
    - Ballad: "Hit us right in the feels"
    - EDM: "Dropped the vocals hard"
  - [ ] 8.5 Add vibe emoji labels: General=🎤, K-pop=💖, Rock=🎸, Ballad=🎵, EDM=🎧
  - [ ] 8.6 Structure for future string additions as screens are built. Note: Flutter `intl` package recommended by PRD (NFR38) for future Vietnamese localization -- structure copy.dart to enable easy extraction

- [ ] Task 9: SafeArea and base layout scaffold (AC: #9)
  - [ ] 9.1 Create base layout pattern wrapping all content in `SafeArea` (top bar: `SafeArea(bottom: false)`, bottom actions: `SafeArea(top: false)`)
  - [ ] 9.2 Implement `ConstrainedBox` with `maxWidth: 428` + center alignment (PRD range: 320px-428px)
  - [ ] 9.3 Apply `EdgeInsets.symmetric(horizontal: DJTokens.spaceMd)` default padding -- use `MediaQuery.textScaleFactorOf` awareness for dynamic spacing
  - [ ] 9.4 Configure `SystemChrome.setSystemUIOverlayStyle()` for status bar matching DJ state backgrounds
  - [ ] 9.5 Wrap party screen area with `AnimatedContainer(duration: DJTokens.transitionFast, color: party.backgroundColor)` driven by `PartyProvider`
  - [ ] 9.6 Add `Semantics(liveRegion: true)` on status display areas (TopBar region) for WCAG 4.1.3

- [ ] Task 10: Stub providers for future stories
  - [ ] 10.1 Create stub `lib/state/party_provider.dart` with `PartyProvider extends ChangeNotifier` -- include `DJState` field (default: `DJState.lobby`), `PartyVibe` field, `backgroundColor` getter using DJ state mapping. Use explicit `// TODO:` comments for unbuilt features, never convincing fakes
  - [ ] 10.2 Create stub `lib/state/auth_provider.dart` with `AuthProvider extends ChangeNotifier`
  - [ ] 10.3 Create stub `lib/state/capture_provider.dart` with `CaptureProvider extends ChangeNotifier`
  - [ ] 10.4 Create stub `lib/state/timeline_provider.dart` with `TimelineProvider extends ChangeNotifier`
  - [ ] 10.5 Register all 6 providers in `MultiProvider`: PartyProvider, AuthProvider, CaptureProvider, TimelineProvider, AccessibilityProvider + SocketClient stub
  - [ ] 10.6 All providers must be pure reactive state containers -- zero business logic. Mutation methods follow pattern: `void onXChanged(T value) { _x = value; notifyListeners(); }`

- [ ] Task 11: Tests (AC: all)
  - [ ] 11.1 Create `test/theme/dj_tokens_test.dart` -- verify all 8 constant color tokens + 5 spacing values exist and have expected types
  - [ ] 11.2 Create `test/theme/dj_theme_test.dart` -- verify 5 vibes with 4 shifting tokens each, DJState enum has 7 values, DJ state background color mapping completeness
  - [ ] 11.3 Create `test/theme/contrast_test.dart` -- automated WCAG AA contrast ratio MATH validation (compute luminance ratios on constant values). NOTE: This tests mathematical contrast, not rendered widget colors. Project context says "DO NOT test color values" meaning visual rendering -- contrast math on constants is permitted
  - [ ] 11.4 Create `test/widgets/dj_tap_button_test.dart` -- three tiers: verify consequential requires 500ms hold + fires haptic on confirm (not touch-down), social fires on touch-down with haptic, private fires on touch-down without haptic. Test early-release cancellation for consequential tier. Test debounce. Test `Key` is required
  - [ ] 11.5 Create `test/state/accessibility_provider_test.dart` -- reduced motion detection
  - [ ] 11.6 Create `test/constants/copy_test.dart` -- verify all 5 vibes have entries in each vibe-keyed map (confetti, reactions, awards)
  - [ ] 11.7 Test files mirror `lib/` structure. Place any shared test data in `test/factories/` directory (one factory per domain object, no inline test data)

## Dev Notes

### Architecture Compliance

- **Server-authoritative architecture**: This story is purely client-side Flutter scaffold. No game logic. Server counterpart is Story 1.2
- **Provider pattern**: Use `ChangeNotifier` with `MultiProvider` at root. Providers are read-only from widgets (`context.watch<T>()`). Only `SocketClient` calls mutation methods on providers. No widget creates its own socket listener
- **No business logic in providers**: Providers are reactive state containers only -- not controllers. No data transformation, no validation, no computation beyond simple getters
- **No provider-to-provider access**: Each provider is an independent state container
- **No barrel files**: Import directly from specific files using `package:karamania/...`
- **async/await exclusively**: No `.then()` chains in Dart -- always use `async/await` with `try/catch`
- **TODO stubs for unbuilt dependencies**: Never write convincing fake implementations. Use `// TODO: Implement in Story X.Y` comments
- **Dark-only app**: No light mode. Entire design built for dark KTV rooms
- **Error philosophy**: No error toasts, no "something went wrong" messages, no retry buttons. Errors are invisible -- silent reconnect, graceful degradation. Showing errors on someone's phone during a party is embarrassing

### Key Implementation Details

- **Flutter SDK**: Version 3.41.2 stable (architecture-specified)
- **textSecondary color**: Use `#9494B0` (NOT `#8888AA` from early spec) -- adjusted to pass WCAG AA 4.5:1 on `surfaceColor`. The UX spec contrast validation section confirms this adjustment
- **Vibe-shifting tokens**: `textAccent`, `actionPrimary`, `ceremonyGlow`, `ceremonyBg` are NOT in DJTokens as constants -- they live in `PartyVibe` enum and shift per vibe. Access via the vibe provider, not DJTokens. DJTokens may expose `PartyVibe.general` defaults for non-party contexts
- **DJTapButton haptic timing**: Haptic behavior is TIER-SPECIFIC:
  - Consequential: haptic fires ON CONFIRM (after 500ms hold completes). Fill animation shows progress during hold. Early release = cancel + visual reset
  - Social: haptic fires on touch-DOWN (immediate). Tap fires immediately with 200ms debounce
  - Private: NO haptic. Tap fires immediately with 200ms debounce
- **Font subsetting**: Must include Vietnamese diacritics (a, o, u, d, etc.) for participant names. Use `fonttools` CLI: `pyftsubset SpaceGrotesk-VariableFont.ttf --unicodes="U+0000-00FF,U+0100-024F,U+1E00-1EFF" --flavor=woff2`
- **No scroll during ceremonies**: Layout patterns should not enable scrolling in ceremony contexts
- **Portrait lock**: Set in `main()` before `runApp()`
- **Firebase init**: `main.dart` must call `Firebase.initializeApp()` before `runApp()`. Requires `firebase_core` in pubspec.yaml
- **Information never by color alone**: Use size, position, and text labels in addition to color for all semantic information

### Naming Conventions (ENFORCED)

- **Files**: `snake_case.dart` (e.g., `dj_tokens.dart`, `party_provider.dart`)
- **Classes**: `PascalCase` (e.g., `DJTokens`, `PartyProvider`, `DJTapButton`)
- **Functions/methods**: `camelCase` (e.g., `onStateChanged`, `playSound`)
- **Constants**: `camelCase` (Dart convention: `ceremonyBg`, `spaceXl`)
- **Enums**: `PascalCase` with `camelCase` values (e.g., `PartyVibe.kpop`, `DJState.ceremony`)
- **Widget keys**: `Key('kebab-case-descriptor')` (e.g., `Key('dj-tap-button')`) -- REQUIRED on all interactive widgets and state-driven containers
- **Imports**: `package:karamania/...` for cross-directory imports

### Anti-Patterns (NEVER DO THESE)

| Wrong | Right |
|-------|-------|
| `Padding(padding: EdgeInsets.all(16))` | `Padding(padding: EdgeInsets.all(DJTokens.spaceMd))` |
| `Color(0xFF6C63FF)` in a widget | Vibe provider accent or `DJTokens` constant |
| `setState(() { djState = newState; })` | `context.watch<PartyProvider>().djState` |
| Hardcoded strings in widgets | All copy in `constants/copy.dart` |
| `import '../state/party_provider.dart'` | `import 'package:karamania/state/party_provider.dart'` |
| Barrel file `export {} from './sub-module'` | Import directly from the file |
| Global `isLoading` boolean | Per-operation `LoadingState` enum |
| `.then((result) => {...}).catch(...)` | `final result = await ...; try/catch` |
| Inline test data `{ id: '1', name: 'test' }` | `createTestX({ id: '1' })` from `test/factories/` |
| `generateRandomAward()` (convincing fake) | `// TODO: Implement in Story 3.2` |

### File Structure (Target)

```
apps/flutter_app/
  lib/
    main.dart                    # Entry: Firebase init, portrait lock, MultiProvider, MaterialApp
    app.dart                     # GoRouter config, deep link setup, back-button handling
    theme/
      dj_tokens.dart             # 8 constant color tokens + timing + 5 spacing
      dj_theme.dart              # PartyVibe enum, DJState enum, ThemeData factory, state color mapping
    state/
      party_provider.dart        # Stub: DJ state, participants, vibe, backgroundColor
      auth_provider.dart         # Stub: Firebase Auth state
      capture_provider.dart      # Stub: Media capture state
      timeline_provider.dart     # Stub: Session history
      accessibility_provider.dart # Reduced motion support
      loading_state.dart         # LoadingState enum
    socket/
      client.dart                # Stub: SocketClient singleton (// TODO: Story 1.3)
    audio/                       # Empty - Story 2.7
    constants/
      copy.dart                  # All UI strings, vibe-keyed maps (emoji, reactions, awards)
      tap_tiers.dart             # TapTier enum (consequential, social, private)
    screens/                     # Empty - populated by later stories
    widgets/
      dj_tap_button.dart         # Core tap widget consuming TapTier
    api/
      generated/                 # Empty - Story 1.2
  assets/
    fonts/
      SpaceGrotesk-Variable.ttf  # Subsetted <25KB
    sounds/                      # Empty - later stories
  test/
    theme/
      dj_tokens_test.dart
      dj_theme_test.dart
      contrast_test.dart
    widgets/
      dj_tap_button_test.dart
    state/
      accessibility_provider_test.dart
    constants/
      copy_test.dart
    factories/                   # Shared test data factories
  dart_defines_local.json.example
  pubspec.yaml
  analysis_options.yaml
```

### Testing Requirements

- **DO test**: Token constants exist, vibe enum completeness, DJState enum completeness, contrast ratio math on constant values, tap tier behavior (hold/confirm/cancel/debounce), accessibility provider, copy.dart vibe-keyed map completeness
- **DO NOT test**: Widget color rendering, animations, visual effects, confetti, transition timings. "Color values" prohibition means visual rendering -- mathematical contrast validation on constants is permitted
- Test files mirror `lib/` structure
- Shared test factories in `test/factories/` -- one per domain object, no inline test data
- Every test is independent, no shared mutable state

### Project Structure Notes

- Monorepo root: project root. Flutter app lives in `apps/flutter_app/`
- No monorepo tool (no Melos, no workspaces)
- Server (`apps/server/`) and web landing (`apps/web_landing/`) are separate -- not part of this story
- `_bmad-output/` is planning/implementation artifacts, not source code
- NFR7: App install size must remain under 50MB. Flutter runtime ~5-8MB + Dart code ~3-5MB + audio ~500KB. All animations are code-driven, no sprite sheets

### References

- [Source: _bmad-output/planning-artifacts/architecture.md - "Current Verified Versions"] -- Flutter SDK 3.41.2, Provider v6.x
- [Source: _bmad-output/planning-artifacts/architecture.md - "Complete Project Directory Structure"] -- Full file tree (theme/ has dj_tokens.dart + dj_theme.dart only)
- [Source: _bmad-output/planning-artifacts/architecture.md - "Enforcement Guidelines"] -- 15 implementation rules including Key(), async/await, AppError, TODO stubs
- [Source: _bmad-output/planning-artifacts/architecture.md - "Frontend Architecture"] -- 4 providers in MultiProvider, SocketClient singleton
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md - "Complete Token File"] -- 8 constant tokens (vibe-shifting tokens removed from constants)
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md - "Color System -- Vibe-Adaptive"] -- PartyVibe enum, 4 shifting tokens per vibe
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md - "Typography System"] -- Space Grotesk, 6 type roles, usage rules
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md - "Component Strategy > DJTapButton"] -- TapTier in constants/tap_tiers.dart, tier-specific haptic timing
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md - "DJ State Integration"] -- DJState enum, 7 state background colors
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md - "Contrast Ratio Validation"] -- textSecondary adjusted to #9494B0
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md - "Responsive Strategy"] -- SafeArea, ConstrainedBox maxWidth:428
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md - "Reduced Motion Support"] -- AccessibilityProvider, per-widget behavior table
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md - "WCAG AA Compliance"] -- FocusNode highlight, Semantics liveRegion
- [Source: _bmad-output/planning-artifacts/prd.md - "Layout & Touch Design"] -- Minimum 16px body text, 320-428px viewport range
- [Source: _bmad-output/planning-artifacts/prd.md - NFR38] -- intl package recommended for Vietnamese localization
- [Source: _bmad-output/planning-artifacts/prd.md - NFR7] -- App install size <50MB
- [Source: _bmad-output/project-context.md] -- Project rules, naming conventions, anti-patterns, async/await mandate

## Dev Agent Record

### Agent Model Used



### Debug Log References

### Completion Notes List

### File List

