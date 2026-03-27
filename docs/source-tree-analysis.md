# Karamania — Source Tree Analysis

## Complete Directory Structure

```
karamania/
├── apps/
│   ├── flutter_app/                    # 📱 Flutter Mobile App (Part: flutter_app)
│   │   ├── lib/
│   │   │   ├── main.dart               # ★ Entry point (dev flavor)
│   │   │   ├── main_dev.dart           # Dev flavor entry
│   │   │   ├── main_staging.dart       # Staging flavor entry
│   │   │   ├── main_production.dart    # Production flavor entry
│   │   │   ├── app.dart                # KaramaniaApp root widget + GoRouter config
│   │   │   ├── config/
│   │   │   │   ├── app_config.dart     # Flavor-based config (Firebase keys, server URL)
│   │   │   │   └── bootstrap.dart      # App startup: Firebase init, providers, audio engine
│   │   │   ├── state/                  # Provider/ChangeNotifier state managers
│   │   │   │   ├── auth_provider.dart          # Auth state (Firebase + guest)
│   │   │   │   ├── party_provider.dart         # Core party state (DJ state, songs, votes, ceremonies)
│   │   │   │   ├── capture_provider.dart       # Media capture lifecycle
│   │   │   │   ├── timeline_provider.dart      # Session history pagination
│   │   │   │   ├── session_detail_provider.dart # Past session detail
│   │   │   │   ├── accessibility_provider.dart # Reduced motion detection
│   │   │   │   ├── upload_provider.dart        # Upload queue reactive wrapper
│   │   │   │   └── loading_state.dart          # LoadingState enum
│   │   │   ├── screens/               # Route-based screens
│   │   │   │   ├── home_screen.dart           # / — Landing, create/join party
│   │   │   │   ├── join_screen.dart           # /join — Party code entry
│   │   │   │   ├── lobby_screen.dart          # /lobby — Pre-game setup
│   │   │   │   ├── party_screen.dart          # /party — Main gameplay (8 DJ state overlays)
│   │   │   │   ├── session_detail_screen.dart # /session/:id — Past session replay
│   │   │   │   └── media_gallery_screen.dart  # /media — User media library
│   │   │   ├── widgets/               # 44 reusable UI components
│   │   │   │   ├── reaction_bar.dart          # Emoji reaction buttons
│   │   │   │   ├── reaction_feed.dart         # Floating emoji particles
│   │   │   │   ├── soundboard_bar.dart        # Sound effect buttons
│   │   │   │   ├── now_playing_bar.dart       # TV-detected song display
│   │   │   │   ├── selected_song_display.dart # Queued song display
│   │   │   │   ├── host_controls_overlay.dart # FAB menu for host actions
│   │   │   │   ├── ceremony_display.dart      # Award anticipation + reveal
│   │   │   │   ├── quick_ceremony_display.dart # Quick ceremony variant
│   │   │   │   ├── moment_card.dart           # Shareable 9:16 moment card
│   │   │   │   ├── moment_card_overlay.dart   # Moment card share flow
│   │   │   │   ├── finale_overlay.dart        # Multi-step finale sequence
│   │   │   │   ├── awards_parade_widget.dart  # Animated award reveals
│   │   │   │   ├── finale_setlist_widget.dart # Shareable setlist poster
│   │   │   │   ├── setlist_poster_widget.dart # 9:16 concert poster renderer
│   │   │   │   ├── session_stats_widget.dart  # Stat cards grid
│   │   │   │   ├── feedback_prompt_widget.dart # Post-finale emoji feedback
│   │   │   │   ├── quick_pick_overlay.dart    # Song voting UI
│   │   │   │   ├── spin_the_wheel_overlay.dart # Spinning wheel selector
│   │   │   │   ├── party_card_deal_overlay.dart # Card reveal animation
│   │   │   │   ├── icebreaker_overlay.dart    # Icebreaker voting
│   │   │   │   ├── interlude_vote_overlay.dart # Activity voting
│   │   │   │   ├── kings_cup_overlay.dart     # Kings Cup game
│   │   │   │   ├── dare_pull_overlay.dart     # Dare game with slot machine
│   │   │   │   ├── quick_vote_overlay.dart    # Binary opinion poll
│   │   │   │   ├── group_singalong_overlay.dart # Group sing-along
│   │   │   │   ├── group_card_announcement_overlay.dart # Group card selection
│   │   │   │   ├── capture_bubble.dart        # Floating capture prompt
│   │   │   │   ├── capture_overlay.dart       # Photo/video/audio capture
│   │   │   │   ├── capture_toolbar_icon.dart  # Upload progress indicator
│   │   │   │   ├── lightstick_mode.dart       # Full-screen lightstick glow
│   │   │   │   ├── hype_signal_button.dart    # Hype button + flash
│   │   │   │   ├── tv_pairing_overlay.dart    # TV code entry
│   │   │   │   ├── dj_tap_button.dart         # Tier-based tap widget
│   │   │   │   ├── emoji_text.dart            # Platform-native emoji
│   │   │   │   ├── song_over_button.dart      # Long-press song end
│   │   │   │   ├── song_mode_toggle.dart      # QuickPick/SpinWheel toggle
│   │   │   │   ├── playlist_import_card.dart  # URL-based playlist import
│   │   │   │   ├── spotify_guide.dart         # Public playlist instructions
│   │   │   │   ├── reconnecting_banner.dart   # Connection status banner
│   │   │   │   ├── bridge_moment_display.dart # Between-song filler
│   │   │   │   ├── streak_milestone_overlay.dart # Reaction streak celebration
│   │   │   │   ├── tag_team_flash_widget.dart # Tag-team chorus notification
│   │   │   │   ├── session_timeline_card.dart # Past session card
│   │   │   │   └── session_stats_widget.dart  # Stats display
│   │   │   ├── socket/
│   │   │   │   └── client.dart         # ★ Socket.IO singleton (950 lines, 40+ events)
│   │   │   ├── api/
│   │   │   │   ├── api_service.dart    # ★ REST client (sessions, auth, playlists, captures, users)
│   │   │   │   ├── auth_middleware.dart # Bearer token injection
│   │   │   │   ├── http_client_adapter.dart # HTTP adapter
│   │   │   │   └── generated/          # Auto-generated OpenAPI client
│   │   │   ├── audio/
│   │   │   │   ├── audio_engine.dart   # SoLoud wrapper, fire-and-forget playback
│   │   │   │   ├── state_transition_audio.dart # DJ state → sound mapping
│   │   │   │   └── sound_cue.dart      # 24 sound effect definitions
│   │   │   ├── theme/
│   │   │   │   ├── dj_theme.dart       # 5 vibes, 8 DJ states, Material theme
│   │   │   │   └── dj_tokens.dart      # Design tokens (colors, spacing)
│   │   │   ├── models/
│   │   │   │   ├── finale_award.dart
│   │   │   │   ├── session_stats.dart
│   │   │   │   └── setlist_entry.dart
│   │   │   ├── constants/
│   │   │   │   ├── copy.dart           # All user-facing strings (384 lines)
│   │   │   │   ├── tap_tiers.dart      # Interaction tier definitions
│   │   │   │   ├── soundboard_config.dart # 6 sound effects
│   │   │   │   └── party_cards.dart    # Party card data (19 cards)
│   │   │   └── services/
│   │   │       ├── media_storage_service.dart # Firebase Storage upload
│   │   │       └── upload_queue.dart   # Background upload with retry
│   │   ├── test/                       # ~50 test files mirroring lib/ structure
│   │   ├── assets/
│   │   │   ├── fonts/                  # SpaceGrotesk variable font
│   │   │   ├── icons/                  # SVG vibe icons
│   │   │   └── sounds/                 # Audio cue files
│   │   ├── android/                    # Android platform config
│   │   ├── ios/                        # iOS platform config
│   │   └── pubspec.yaml               # ★ Flutter dependencies
│   │
│   ├── server/                         # 🖥️ Fastify Backend (Part: server)
│   │   ├── src/
│   │   │   ├── index.ts               # ★ Entry point (Fastify + Socket.IO setup)
│   │   │   ├── config.ts              # Zod-validated env config
│   │   │   ├── routes/                # REST API endpoints
│   │   │   │   ├── auth.ts            # POST /api/auth/guest
│   │   │   │   ├── sessions.ts        # GET/POST /api/sessions
│   │   │   │   ├── catalog.ts         # GET /api/catalog/search, stats, classics
│   │   │   │   ├── playlists.ts       # POST /api/playlists/import
│   │   │   │   ├── suggestions.ts     # GET /api/sessions/:id/suggestions
│   │   │   │   ├── captures.ts        # CRUD /api/sessions/:id/captures
│   │   │   │   ├── users.ts           # GET /api/users/me, POST /api/users/upgrade
│   │   │   │   ├── share.ts           # GET /api/sessions/:id/share
│   │   │   │   ├── media-gallery.ts   # GET /api/users/me/media
│   │   │   │   ├── health.ts          # GET /health
│   │   │   │   ├── web-landing.ts     # Static files + .well-known
│   │   │   │   └── middleware/
│   │   │   │       └── rest-auth.ts   # Firebase token middleware
│   │   │   ├── socket-handlers/       # 15 Socket.IO event handler modules
│   │   │   │   ├── connection-handler.ts   # ★ Main connection lifecycle
│   │   │   │   ├── auth-middleware.ts      # Socket auth (Firebase + guest JWT)
│   │   │   │   ├── auth-upgrade-handler.ts # Guest-to-authenticated upgrade
│   │   │   │   ├── party-handlers.ts       # Vibe change, party start
│   │   │   │   ├── host-handlers.ts        # Host controls (pause, skip, end)
│   │   │   │   ├── song-handlers.ts        # Quick pick, spin wheel, mode change
│   │   │   │   ├── reaction-handlers.ts    # Emoji reactions + streaks + peaks
│   │   │   │   ├── soundboard-handlers.ts  # Sound effects broadcast
│   │   │   │   ├── card-handlers.ts        # Party card lifecycle
│   │   │   │   ├── lightstick-handlers.ts  # Lightstick + hype with cooldown
│   │   │   │   ├── interlude-handlers.ts   # Activity voting + quick votes
│   │   │   │   ├── icebreaker-handlers.ts  # Icebreaker question voting
│   │   │   │   ├── capture-handlers.ts     # Capture event tracking
│   │   │   │   ├── tv-handlers.ts          # TV pair/unpair
│   │   │   │   └── finale-handlers.ts      # Feedback submission
│   │   │   ├── services/              # 36 business logic modules
│   │   │   │   ├── session-manager.ts      # ★ Central orchestration hub (~1000+ lines)
│   │   │   │   ├── dj-state-store.ts       # In-memory DJ context cache
│   │   │   │   ├── dj-broadcaster.ts       # Socket.IO broadcast hub
│   │   │   │   ├── connection-tracker.ts   # Connection state management
│   │   │   │   ├── activity-tracker.ts     # Session activity timestamps
│   │   │   │   ├── event-stream.ts         # Append-only event log (60+ event types)
│   │   │   │   ├── timer-scheduler.ts      # setTimeout wrapper with pause/resume
│   │   │   │   ├── inactivity-monitor.ts   # Auto-pause after 90s idle
│   │   │   │   ├── participation-scoring.ts # Point tiers (passive/active/engaged)
│   │   │   │   ├── rate-limiter.ts         # Reaction/sound rate limiting
│   │   │   │   ├── streak-tracker.ts       # Reaction streak milestones
│   │   │   │   ├── peak-detector.ts        # Reaction spike detection (3x baseline)
│   │   │   │   ├── award-generator.ts      # Per-song award generation (24 templates)
│   │   │   │   ├── finale-award-generator.ts # Multi-category finale awards
│   │   │   │   ├── session-summary-builder.ts # Finale summary assembly
│   │   │   │   ├── session-summary-fallback.ts # Disk fallback for failed DB writes
│   │   │   │   ├── card-dealer.ts          # Party card random dealing
│   │   │   │   ├── group-card-selector.ts  # Group participant selection
│   │   │   │   ├── party-card-pool.ts      # 19 card definitions
│   │   │   │   ├── quick-pick.ts           # Song voting system
│   │   │   │   ├── spin-wheel.ts           # Spinning wheel state machine
│   │   │   │   ├── song-pool.ts            # Imported song tracking
│   │   │   │   ├── song-detection.ts       # Multi-tier song detection
│   │   │   │   ├── suggestion-engine.ts    # Song recommendation ranking
│   │   │   │   ├── capture-service.ts      # Capture metadata persistence
│   │   │   │   ├── capture-trigger.ts      # Bubble emission throttling
│   │   │   │   ├── media-storage.ts        # Firebase Storage signed URLs
│   │   │   │   ├── guest-token.ts          # JWT generation/verification
│   │   │   │   ├── party-code.ts           # 4-char party code generation
│   │   │   │   ├── activity-voter.ts       # Interlude activity voting
│   │   │   │   ├── dare-pull-dealer.ts     # Dare card random dealing
│   │   │   │   ├── kings-cup-dealer.ts     # Kings Cup rule cards
│   │   │   │   ├── quick-vote-dealer.ts    # Binary poll questions
│   │   │   │   ├── singalong-dealer.ts     # Group sing-along prompts
│   │   │   │   ├── icebreaker-dealer.ts    # Icebreaker questions
│   │   │   │   └── retry.ts               # Exponential backoff utility
│   │   │   ├── dj-engine/             # ★ Pure state machine (zero deps)
│   │   │   │   ├── machine.ts         # createDJContext, processTransition
│   │   │   │   ├── types.ts           # DJState, DJContext, DJTransition, DJSideEffect
│   │   │   │   ├── states.ts          # State configs, cycle logic, NFR12 degradation
│   │   │   │   ├── transitions.ts     # Guards and state computation
│   │   │   │   ├── timers.ts          # Timer durations per state
│   │   │   │   ├── ceremony-selection.ts # Full vs quick ceremony rules
│   │   │   │   └── serializer.ts      # JSONB round-trip serialization
│   │   │   ├── shared/
│   │   │   │   ├── constants.ts       # VALID_VIBES, DEFAULT_VIBE
│   │   │   │   ├── errors.ts          # AppError, error handlers
│   │   │   │   ├── events.ts          # 50+ Socket.IO event constants
│   │   │   │   ├── socket-types.ts    # SocketData, AuthenticatedSocket
│   │   │   │   ├── song-normalizer.ts # Cross-platform song matching
│   │   │   │   ├── title-parser.ts    # Karaoke video title parsing
│   │   │   │   └── schemas/           # 17 Zod schema files (REST + Socket.IO)
│   │   │   ├── integrations/
│   │   │   │   ├── firebase-admin.ts  # Firebase Admin SDK
│   │   │   │   ├── lounge-api.ts      # YouTube Lounge API (TV control)
│   │   │   │   ├── tv-integration.ts  # TV integration interface
│   │   │   │   ├── youtube-data.ts    # YouTube Data API v3
│   │   │   │   └── spotify-data.ts    # Spotify Web API
│   │   │   ├── persistence/
│   │   │   │   ├── session-repository.ts  # Sessions + participants CRUD
│   │   │   │   ├── user-repository.ts     # User profiles + guest upgrade
│   │   │   │   ├── catalog-repository.ts  # Karaoke catalog search + upsert
│   │   │   │   └── media-repository.ts    # Media captures + relinking
│   │   │   └── db/
│   │   │       ├── connection.ts      # Kysely PostgreSQL connection (pool: 10)
│   │   │       └── types.ts           # Generated DB types (kysely-codegen)
│   │   ├── migrations/
│   │   │   ├── 001-initial-schema.ts  # 5 tables, 8 indexes
│   │   │   └── 002-session-summary.ts # Add summary JSONB column
│   │   ├── bots/                       # 🤖 Bot system for local dev + testing (NEW)
│   │   │   ├── manager.ts            # CLI bot spawner (--bots N --party CODE --behavior X)
│   │   │   └── bot-behaviors.ts      # Behavior profiles (passive/active/chaos/spectator)
│   │   ├── k6/                        # ⚡ k6 performance tests (NEW)
│   │   │   ├── party-load.js         # 12 VUs, 5 min party simulation (p95 <200ms)
│   │   │   ├── reaction-throughput.js # 12 VUs, 2 min reaction stress test
│   │   │   └── helpers/auth.js       # Shared guest auth helper
│   │   ├── tests/                     # ~90+ test files (Vitest)
│   │   │   ├── routes/                # 12 REST endpoint tests
│   │   │   ├── socket-handlers/       # 19 real-time event tests
│   │   │   ├── services/              # 35 business logic tests
│   │   │   ├── persistence/           # 5 repository tests
│   │   │   ├── dj-engine/             # 4 state machine tests
│   │   │   ├── integrations/          # 4 external API tests
│   │   │   ├── shared/                # 3 utility tests
│   │   │   ├── migrations/            # 1 schema test (real DB)
│   │   │   ├── integration/           # 🆕 Socket integration tests (real server + bots)
│   │   │   │   ├── party-flow.test.ts        # Full party lifecycle
│   │   │   │   ├── socket-lifecycle.test.ts  # Connect/disconnect, host transfer
│   │   │   │   └── auth-upgrade.test.ts      # Guest-to-account upgrade
│   │   │   ├── e2e/                   # 🆕 End-to-end tests (multi-bot scenarios)
│   │   │   │   └── party-lifecycle.e2e.test.ts
│   │   │   ├── concurrency/           # 🆕 Race condition tests
│   │   │   │   ├── concurrent-reactions.test.ts
│   │   │   │   └── concurrent-voting.test.ts
│   │   │   ├── helpers/               # 🆕 Test infrastructure
│   │   │   │   ├── bot-client.ts     # Real Socket.io client wrapper
│   │   │   │   ├── test-server.ts    # Real Fastify+Socket.io server
│   │   │   │   └── test-db.ts        # Database seeding + cleanup
│   │   │   └── factories/             # Test data factories
│   │   ├── package.json               # ★ Server dependencies
│   │   ├── tsconfig.json              # TypeScript config (ES2022, strict)
│   │   ├── .env.example               # Environment variable template
│   │   └── .env                       # Local dev config (gitignored)
│   │
│   └── web_landing/                    # 🌐 Static Web Landing (Part: web_landing)
│       ├── index.html                 # Landing page (join party flow)
│       ├── share.html                 # Session sharing page
│       ├── style.css                  # Design system (CSS variables)
│       ├── script.js                  # Deep linking + platform detection
│       ├── share.js                   # Share page data fetching
│       └── .well-known/
│           ├── apple-app-site-association  # iOS Universal Links
│           └── assetlinks.json            # Android App Links
│
├── .github/
│   └── workflows/
│       ├── server-ci.yml              # Server CI (Node 24, PostgreSQL 16, Vitest)
│       └── flutter-ci.yml            # Flutter CI (Flutter 3.32, analyze + test)
├── docker-compose.yml                 # Local PostgreSQL 16
├── SETUP_AND_DEPLOYMENT.md            # Comprehensive deployment guide
├── _bmad/                             # BMAD workflow tooling
└── _bmad-output/                      # Planning + implementation artifacts
    ├── planning-artifacts/            # PRD, architecture, UX, epics
    └── implementation-artifacts/      # ~70 story specs + sprint status
```

## Critical Folders

| Folder | Purpose | Key Files |
|--------|---------|-----------|
| `apps/server/src/dj-engine/` | Pure state machine — heart of the party flow | `machine.ts`, `states.ts`, `transitions.ts` |
| `apps/server/src/services/session-manager.ts` | Central orchestration hub connecting all services | ~1000+ lines |
| `apps/server/src/socket-handlers/` | Real-time event processing (15 modules) | `connection-handler.ts` |
| `apps/flutter_app/lib/socket/client.dart` | Socket.IO singleton (40+ events, 30+ emitters) | 950 lines |
| `apps/flutter_app/lib/state/party_provider.dart` | Core party state for Flutter UI | Largest provider |
| `apps/flutter_app/lib/screens/party_screen.dart` | Main gameplay screen (8 DJ state overlays) | Dynamic rendering |
| `apps/server/src/shared/schemas/` | 17 Zod schema files defining all API contracts | REST + Socket.IO |
| `apps/server/bots/` | Bot system for simulating multiplayer parties | `manager.ts`, `bot-behaviors.ts` |
| `apps/server/tests/helpers/` | Integration test infrastructure (real server + bots) | `bot-client.ts`, `test-server.ts`, `test-db.ts` |
| `apps/server/k6/` | k6 performance/load tests (12 VU party simulation) | `party-load.js`, `reaction-throughput.js` |

## Entry Points

| Part | Entry Point | Description |
|------|------------|-------------|
| **server** | `src/index.ts` | Fastify + Socket.IO setup, route registration, session recovery |
| **flutter_app** | `lib/main.dart` (dev), `lib/main_production.dart` (prod) | Flavor initialization + bootstrap |
| **web_landing** | `index.html` | Static landing, served by server's `web-landing.ts` route |
