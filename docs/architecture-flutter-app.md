# Karamania Flutter App — Architecture Document

## Overview

The Karamania Flutter app is a cross-platform mobile client (iOS + Android) built with Flutter/Dart 3.9. It provides the user-facing interface for the karaoke party experience — from creating/joining parties to real-time gameplay with reactions, song voting, ceremonies, and media capture. State management uses the Provider pattern with ChangeNotifier.

## Technology Stack

| Category | Technology | Version | Justification |
|----------|-----------|---------|---------------|
| Framework | Flutter | SDK ^3.9.2 | Cross-platform mobile |
| State | Provider / ChangeNotifier | ^6.1.2 | Simple, reactive state management |
| Navigation | go_router | ^14.8.1 | Declarative routing with deep links |
| Real-time | socket_io_client | ^3.0.2 | WebSocket communication |
| Auth | firebase_auth + firebase_core | ^5.5.1 / ^3.12.1 | Google sign-in + anonymous auth |
| Storage | firebase_storage | ^12.4.4 | Media upload (authenticated users) |
| Audio | flutter_soloud | ^3.4.6 | Low-latency sound effects |
| HTTP | dart_open_fetch (generated) + http | git / ^1.6.0 | REST API client |
| QR | qr_flutter | ^4.1.0 | QR code generation for party codes |
| Sharing | share_plus | ^12.0.1 | Native share sheet |
| Camera | image_picker | ^1.1.2 | Photo/video capture |
| Audio Recording | record | ^5.2.0 | Audio capture |
| Connectivity | connectivity_plus | ^6.1.4 | Network state detection |
| Persistence | shared_preferences | ^2.5.3 | Upload queue persistence |
| SVG | flutter_svg | ^2.0.17 | Vibe icon rendering |
| Wakelock | wakelock_plus | ^1.2.8 | Screen-on during party |
| Torch | torch_light | ^1.1.0 | Flashlight for hype signal |

## Architecture Pattern

**Provider-based MVVM with Socket.IO event-driven updates.**

```
┌─────────────────────────────────────────────────────────┐
│                      Screens (6)                        │
│  home, join, lobby, party, session_detail, media_gallery│
├─────────────────────────────────────────────────────────┤
│                    Widgets (44)                          │
│  Overlays, bars, buttons, displays, cards               │
├─────────────────────────────────────────────────────────┤
│                  State Providers (8)                     │
│  auth, party, capture, timeline, session_detail,        │
│  accessibility, upload, loading_state                    │
├──────────────────┬──────────────────────────────────────┤
│  Socket Client   │         API Service                  │
│  Singleton       │    REST endpoints                    │
│  40+ listeners   │    (generated + manual)              │
│  30+ emitters    │                                      │
├──────────────────┴──────────────────────────────────────┤
│                Audio Engine + Services                   │
│  SoLoud wrapper, upload queue, media storage            │
├─────────────────────────────────────────────────────────┤
│              Firebase + Config + Theme                   │
│  Auth, Storage, flavors, design tokens                  │
└─────────────────────────────────────────────────────────┘
```

## Screen Architecture

| Screen | Route | Purpose |
|--------|-------|---------|
| HomeScreen | `/` | Landing — create/join party, session timeline, profile |
| JoinScreen | `/join?code=XXXX` | Party code entry + display name |
| LobbyScreen | `/lobby` | Pre-game: QR code, vibe selector, playlist import, participants |
| PartyScreen | `/party` | Main gameplay: 8 DJ state overlays, reactions, controls |
| SessionDetailScreen | `/session/:id` | Past session: stats, participants, setlist, media, awards |
| MediaGalleryScreen | `/media` | User's captured media library (paginated grid) |

### Deep Linking
```
/?code=XXXX     → redirects to /join?code=XXXX
/?session=ID    → redirects to /session/ID
karamania://join?code=XXXX     (custom scheme)
karamania://session/SESSION_ID  (custom scheme)
```

## State Management

### Providers (MultiProvider in bootstrap.dart)

**PartyProvider** — Largest provider, manages the entire active party state:
- DJ engine state tracking (8 states → widget rendering)
- Session metadata (partyCode, vibe, participants, host status)
- Song selection state (Quick Pick votes, Spin the Wheel phases)
- Ceremony state (anticipation timing, reveal, moment cards)
- Interlude/icebreaker state
- Party cards (deal, accept, dismiss, redraw)
- Reactions feed, streaks, milestones
- Lightstick mode and hype cooldown
- TV pairing and detected songs
- Playlist import tracking
- Wakelock management (on during song states, off during lobby)
- Connection status

**AuthProvider** — Authentication lifecycle:
- Three states: unauthenticated, authenticatedFirebase, authenticatedGuest
- Firebase Auth state listener
- Guest token management
- Guest-to-account upgrade flow

**CaptureProvider** — Media capture:
- Bubble visibility (15s auto-dismiss, 60s cooldown)
- Active capture mode (photo/video/audio)
- Guest capture ID tracking for post-upgrade relinking

**TimelineProvider** — Session history pagination
**SessionDetailProvider** — Past session detail loading
**AccessibilityProvider** — Reduced motion from MediaQuery
**UploadProvider** — Upload queue reactive wrapper

### Data Flow

```
Socket.IO Event → SocketClient → PartyProvider.notifyListeners() → Widgets rebuild
User Action → Widget → SocketClient.emit() → Server → Socket.IO broadcast → all clients
REST Call → ApiService → Provider state update → Widget rebuild
```

## Socket.IO Client (950 lines)

Singleton pattern with comprehensive event handling:

**Connection:**
- WebSocket transport, auth via token/sessionId/userId
- Reconnection: 500ms initial, 3s max, 20 attempts
- 5s grace period before showing reconnection UI

**40+ Event Listeners** across 15 categories:
- Party lifecycle, DJ state, ceremonies, reactions, sounds, cards, song selection, interludes, icebreaker, finale, TV, captures, hype, auth

**30+ Event Emitters** for user actions:
- Host controls (pause, skip, end), voting, reactions, soundboard, cards, lightstick, hype, captures, TV pairing

**Business Logic:**
- `createParty()` — REST session create + socket connect + audio role setup
- `joinParty()` — REST guest auth + socket connect
- State transition audio integration

## Widget Architecture (44 widgets)

### Interaction Tiers (DJTapButton)
| Tier | Size | Behavior | Haptic |
|------|------|----------|--------|
| Consequential | 64px | 500ms long-press hold | heavyImpact |
| Social | 56px | Immediate tap | lightImpact |
| Private | 48px | Immediate tap | None |

### Widget Categories

**Game Overlays (12):** QuickPickOverlay, SpinTheWheelOverlay, IcebreakerOverlay, InterludeVoteOverlay, KingsCupOverlay, DarePullOverlay, QuickVoteOverlay, GroupSingAlongOverlay, PartyCardDealOverlay, GroupCardAnnouncementOverlay, CeremonyDisplay, QuickCeremonyDisplay

**Finale (5):** FinaleOverlay, AwardsParadeWidget, SessionStatsWidget, FinaleSetlistWidget, FeedbackPromptWidget

**Media (4):** CaptureBubble, CaptureOverlay, CaptureToolbarIcon, MomentCardOverlay/MomentCard

**Bars (4):** ReactionBar, ReactionFeed, SoundboardBar, NowPlayingBar

**Controls (5):** HostControlsOverlay, SongOverButton, SongModeToggle, LightstickMode, HypeSignalButton

**Display (6):** SelectedSongDisplay, BridgeMomentDisplay, StreakMilestoneOverlay, TagTeamFlashWidget, ReconnectingBanner, TvPairingOverlay

**Sharing (4):** SetlistPosterWidget, PlaylistImportCard, SpotifyGuide, SessionTimelineCard

## Audio System

**AudioEngine** — Fire-and-forget SoLoud wrapper:
- Pre-loads 24 sound cues on startup
- Per-role volume adjustment (host=1.0, participant=0.6)
- Graceful degradation (failures logged, not thrown)

**StateTransitionAudio** — Maps DJ state changes to sound cues:
- Each of 8 states has a dedicated sound
- Pause/resume chimes
- Ceremony at reduced volume for non-hosts

**24 Sound Cues:** State transitions (6), UI feedback (4), soundboard effects (6), finale (1), and more

## Theming

**5 Party Vibes:** general, kpop, rock, ballad, edm
- Each has accent color, glow color, background, primary color, SVG icon

**8 DJ State Colors:** State-specific backgrounds (vibe-colored for ceremony, fixed for others)

**Design Tokens (DJTokens):**
- Background: #0A0A0F, Surface: #1A1A2E
- Text: #F0F0F0 (primary), #A0A0B0 (secondary)
- Action confirm: #4ADE80, Action danger: #FF4444
- Spacing: 4px → 32px scale

## API Integration

### REST Endpoints (ApiService)
- Session CRUD, guest auth, playlist import, capture management
- User profile, guest-to-account upgrade
- Session timeline, session detail, media gallery
- Auth middleware: Bearer token injection

### Generated Client (dart_open_fetch)
Auto-generated from server's OpenAPI spec (`/openapi.json`)

## Services

**UploadQueue** — Background media upload:
- Singleton with connectivity awareness
- Sequential processing (one at a time)
- Exponential backoff retry (2s→60s, max 5 attempts)
- SharedPreferences persistence across app restarts

**MediaStorageService** — Upload abstraction:
- Firebase Storage SDK for authenticated users
- Signed URL HTTP PUT for guests
- Progress callbacks

## Build Flavors

| Flavor | Entry Point | Config |
|--------|------------|--------|
| dev | `main.dart` / `main_dev.dart` | Local server, dev Firebase |
| staging | `main_staging.dart` | Staging server, staging Firebase |
| production | `main_production.dart` | Production server, production Firebase |

**Build command:** `flutter build apk --flavor production --dart-define-from-file=dart_defines_production.json`

## Testing

**~72 test files** mirroring `lib/` structure:

| Category | Files | Coverage |
|----------|-------|----------|
| State providers | 11 | Party, auth, capture, timeline, session detail, upload, accessibility |
| Widget tests | 32 | All overlays, buttons, controls, displays, bars |
| Screen tests | 6 | All 6 screens |
| Service/API | 3 | Upload queue, media storage, API client |
| Audio | 3 | Engine, cues, state transitions |
| Theme/tokens | 3 | DJ theme, tokens, contrast compliance |
| Models | 5 | Setlist entry, session stats, quick pick, spin wheel, vote tally |
| Config/routing | 2 | App config, deep links |
| Constants | 2 | Copy strings, party cards |

**Patterns:**
- **flutter_test** + **mocktail** for mocking
- `fake_async` for timer-dependent logic
- `MultiProvider` test harnesses for widget tests
- **AppConfig.initializeForTest()** for test-safe configuration

**CI:** GitHub Actions (`.github/workflows/flutter-ci.yml`) — Flutter 3.32.x, `flutter analyze` + `flutter test`, pub dependency caching
