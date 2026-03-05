---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
status: complete
totalEpics: 12
totalStories: 76
totalFRsCovered: 112
totalNFRsCovered: 38
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/architecture.md'
  - '_bmad-output/planning-artifacts/ux-design-specification.md'
---

# karaoke-party-app - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for karaoke-party-app, decomposing the requirements from the PRD, UX Design, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

**1. Party Management (9 FRs)**
- FR1: Host can create a new party session and receive a unique QR code and 4-digit party code
- FR2: Guest can join an active party by scanning a QR code or entering a party code in their browser
- FR3: Guest can enter a display name to identify themselves in the party (no account required)
- FR4: All participants can see a live party lobby showing who has joined and the current player count
- FR5: Host can start the party when ready, transitioning all connected phones to the first activity
- FR6: Guest can join a party mid-session and receive a catch-up summary of current party stats
- FR7: Host can re-display the QR code and party code at any point during an active session
- FR8: System displays a waiting state when fewer than 3 players are present, showing current player count, a QR code, and a share prompt to invite more participants
- FR53: System provides visual feedback within 200ms during the join process showing party status and player count before the WebSocket connection is fully established

**2. DJ Engine & Party Flow (9 FRs)**
- FR9: System automatically cycles through activity states (party card deal > song > ceremony > interlude > volunteer/vote > repeat) without manual intervention, governed by a formal state diagram with defined transitions, guards, and timeouts
- FR10: System provides bridge moment activities during physical-world transitions (first song prompt, song selection, mic handoff)
- FR54: System deals a random party card to the next singer during the pre-song state, selected from the curated pool of 19 cards. App auto-deals by default; host can override card selection or disable dealing for a turn
- FR11: System can enter a pause state, triggered by host action or by detecting 90+ seconds of inactivity across all users
- FR12: System resumes from pause to the next state in the DJ cycle when host un-pauses or activity resumes
- FR13: System presents democratic voting with 2-3 options for the group to decide what happens next
- FR14: System selects ceremony weight following defined rules: Full for first song and post-interlude songs, never two consecutive Full ceremonies, default to Quick after song 5, Skip available via host override
- FR15: System front-loads universal participation activities in the first 30 minutes of a session
- FR51: System can run a first-session icebreaker activity that all participants complete with a single tap, with results visible to the group

**3. Performance & Spotlight (8 FRs)**
- FR16: Host can signal that a song has ended via a persistent, always-visible trigger during song state
- FR17: System displays a pre-song hype announcement on all phones showing the next performer's name
- FR18a: System collects crowd votes during a Full ceremony with a 15-second window, accepting votes as participants pick up their phones (staggered participation)
- FR18b: System auto-generates a ceremony award title from a categorized template pool: scores 1-2 map to comedic/ironic titles, 3 to neutral titles, 4-5 to praise titles
- FR18c: System generates a moment card combining performer details, award, and crowd score at the end of a Full ceremony
- FR19: System conducts a Quick ceremony: 10-second thumbs up/down poll with a one-liner reaction auto-generated from the vote split
- FR20: System generates award titles from a pool of 20+ templates, categorized by score range
- FR21: System supports group sing-along activities where all participants are included without individual spotlight

**4. Audience Participation (8 FRs)**
- FR22: All participants can send emoji reactions during performances, visible within 100ms on all connected phones
- FR23: System tracks reaction streaks and displays streak milestones at 5, 10, 20, and 50 consecutive reactions
- FR24: All participants can trigger soundboard effects (4-6 sounds) that play audibly through their phone speaker
- FR25: System plays the primary ceremony audio (fanfares, reveals) through the host's phone as the dominant audio source
- FR26: System plays a unique audio cue for every DJ state transition, each at least 0.5s duration
- FR27: All participants can vote in ceremony scoring and democratic activity selection
- FR28a: System supports a library of 3 interlude mini-games (Kings Cup, Dare Pull, Quick Vote) deployable by the DJ engine
- FR28b: MVP interlude library includes: Kings Cup (group rule card), Dare Pull (random dare assigned to random player), Quick Vote (binary opinion poll)

**4b. Party Cards (8 FRs)**
- FR55: System maintains a curated pool of 19 party cards across three types: vocal modifiers (7), performance modifiers (7), and group involvement (5)
- FR56: Vocal modifier cards: Chipmunk Mode, Barry White, The Whisperer, Robot Mode, Opera Singer, Accent Roulette, Beatboxer
- FR57: Performance modifier cards: Blind Karaoke, Method Actor, The Statue, Slow Motion, The Drunk Uncle, News Anchor, Interpretive Dance
- FR58: Group involvement cards: Name That Tune, Backup Dancers, Crowd Conductor, Tag Team, Hype Squad
- FR59: Singer can accept or dismiss a dealt party card with a single tap. One free redraw per turn
- FR60: Group involvement cards select random participants and announce the selection on all phones
- FR61: System tracks party card acceptance rate and challenge completion per session
- FR62: Completed party card challenges contribute to ceremony awards and weighted participation scoring (5 pts)

**4c. Audience Participation Modes (4 FRs)**
- FR63: During song state, audience participants can toggle between lean-in mode and lightstick mode
- FR64: Lightstick mode renders a full-screen animated glow effect with color change
- FR65: Audience participants can activate a camera flash/screen hype signal as real-time encouragement
- FR66: Lightstick mode and hype signal are available alongside reactions with free switching

**4d. Prompted Media Capture (7 FRs)**
- FR67: System displays a floating capture bubble at key moments: session start, reaction peaks, post-ceremony pause, and session end
- FR68: Any participant can pop the capture bubble to initiate a media capture: photo, video (5s max), or audio snippet
- FR69: System captures photo, video, and audio inline on browsers that support media recording APIs with graceful fallback
- FR70: Captured media is tagged with session ID, timestamp, capture trigger type, and current DJ state
- FR71: Media uploads are queued and sent in background with automatic retry
- FR72: All captured media is stored server-side per session, accessible to all session participants post-session
- FR73: System auto-detects reaction peaks and triggers a capture bubble on all phones

**5. Song Integration & Discovery (22 FRs)**
- FR74: Host can pair the app with a YouTube TV session by entering the TV pairing code
- FR75: System connects to the YouTube TV session via the Lounge API and receives real-time nowPlaying events
- FR76: System resolves each detected video_id to structured song metadata via YouTube Data API v3 within 5 seconds
- FR77: System parses karaoke video titles into structured {song, artist} data using title parsing rules
- FR78: System can push songs to the YouTube TV queue via the Lounge API addVideo command
- FR79: System maintains the Lounge API session throughout the party with automatic reconnection
- FR80: System detects the music platform from a pasted URL and routes to the appropriate import handler
- FR81: System reads YouTube Music playlist contents via the YouTube Data API v3 (no user login required)
- FR82: System reads Spotify public playlist contents via the Spotify Web API Client Credentials flow
- FR83: When a Spotify playlist is private, system displays a 3-step visual guide to make it public
- FR84: System normalizes imported songs across platforms with duplicate merging and overlap count
- FR85: System maintains a pre-built Karaoke Catalog Index (minimum 10,000 tracks)
- FR86: System computes song suggestions as: (imported songs U previously sung) intersect Karaoke Catalog Index
- FR87: System ranks suggestions by: group overlap count, genre momentum, not-yet-sung
- FR88: Quick Pick mode displays 5 AI-suggested songs with majority voting
- FR89: Spin the Wheel mode loads 8 AI-suggested songs into an animated wheel with one veto per round
- FR90: Participants can toggle between Quick Pick and Spin the Wheel modes
- FR91: Cold start fallback to Karaoke Classics subset (top 200 universally known karaoke songs)
- FR92: Suggestion-only mode when host skips TV pairing
- FR93: In suggestion-only mode, selected song displayed prominently for manual entry at venue
- FR94: Host can manually mark a song as "now playing" in suggestion-only mode
- FR95: TV pairing is optional at party creation

**5f. Authentication & Identity (10 FRs)**
- FR96: System offers optional sign-in via Google or Facebook OAuth (Firebase Auth) or guest with name-only entry
- FR97: Guest users can upgrade to a full account at any point without losing session data
- FR98: Authenticated users have a persistent profile (display name, avatar, creation date)
- FR99: On party end, system writes session summary to PostgreSQL
- FR100: Authenticated users can view their party history
- FR101: Media captures from authenticated users are linked to their profile; guest captures accessible for 7 days
- FR102: All media stored in Firebase Storage, organized by session ID
- FR103: System writes session summary within 30 seconds of party end with retry logic
- FR104: Authenticated host recorded as session owner for future features
- FR105: WebSocket handshake validates Firebase JWT for authenticated users; guest users receive session-scoped token

**6. Host Controls (5 FRs)**
- FR29: Host has a persistent floating action button that expands to a control overlay within 1 tap
- FR30: Host can skip the current activity and advance to the next DJ state
- FR31: Host can manually pause and resume the DJ engine
- FR32: Host can override the DJ's next activity selection
- FR33: Host can access skip, pause, queue management, kick player, and end party controls from the overlay

**7. Memory & Sharing (7 FRs)**
- FR34: System generates a shareable moment card for each Full ceremony
- FR35: Participant can share a moment card via native mobile share sheet
- FR36: System generates an end-of-night setlist poster
- FR37: Participant can share the setlist poster via native mobile share sheet
- FR38: System prompts participants to capture moments via floating capture bubble at 4 defined trigger points
- FR39: Any participant can manually initiate a media capture at any time via persistent capture icon
- FR52: System orchestrates an end-of-night finale sequence (top 3 awards, stats, setlist poster, feedback)

**8. Session Intelligence & Analytics (5 FRs)**
- FR40: System tracks weighted participation scores (passive: 1pt, active: 3pts, engaged: 5pts)
- FR41: System generates end-of-night awards recognizing both singing and non-singing contributions
- FR42: System logs every state transition, user action, and DJ decision as structured event stream
- FR43: System presents post-session North Star prompt ("Would you use Karamania next time?")
- FR44: System tracks share intent taps as a viral signal metric

**9. Connection & Resilience (6 FRs)**
- FR45: System maintains real-time WebSocket connections between all participant phones and server
- FR46: System detects participant disconnection via heartbeat monitoring
- FR47: System automatically reconnects within a 5-minute window and syncs to current DJ state within 2 seconds
- FR48: System preserves participant's session history and participation scores through disconnection
- FR49: System continues operating normally when any participant (including host) disconnects with host failover after 60s
- FR50: System prevents phone screen auto-lock during active participation states

**TOTAL: 112 Functional Requirements**

### NonFunctional Requirements

**Performance (9 NFRs)**
- NFR1: DJ state transitions propagate to all devices within 200ms
- NFR2: Emoji reactions appear on all phones within 100ms
- NFR3: Soundboard audio begins playback within 50ms of tap
- NFR4: Ceremony vote collection completes within exactly 15 seconds of server-side timer
- NFR5: 60fps rendering and <100ms input response with up to 12 simultaneous participants at peak rate
- NFR6: Audio assets pre-loaded and playable within 50ms after initial session load
- NFR7: Total JS bundle size under 100KB gzipped (excluding audio assets)
- NFR26: Event stream logging asynchronous, <5ms latency impact on user-facing operations
- NFR27: Ceremony reveal on all devices within 100ms window using server-coordinated timing

**Reliability (7 NFRs)**
- NFR8: DJ engine continues operating if any participant (including host) disconnects
- NFR9: Brief reconnection (<5s) completes without error state, spinner, or page reload
- NFR10: Session state fully recoverable from server — no client-only state
- NFR11: Concurrent ceremony votes handled without race conditions or vote loss
- NFR12: Graceful degradation below 3 participants (skip group interludes, reduce ceremony to pass/fail)
- NFR13: On server restart, active sessions gracefully terminated with message to all clients
- NFR28: Client memory usage must not grow by more than 10MB over a 3-hour session

**Usability (7 NFRs)**
- NFR14: All primary interactions completable with a single tap on 48x48px minimum target
- NFR15: No text input beyond initial name entry
- NFR16: All screens usable on first encounter without instructions; single-sentence tooltip on first appearance
- NFR17: WCAG AA contrast ratio (4.5:1 normal text, 3:1 large text) in low-light conditions
- NFR18: Distinct audio cue for each state transition type, minimum 0.5s, audible at phone speaker volume
- NFR19: Host controls accessible within 1 second from any screen state
- NFR20: No configuration, settings, or preferences required — zero setup beyond name entry

**Security (5 NFRs)**
- NFR21: Party codes expire after session end and not reusable
- NFR22: No PII stored beyond display name and session data (guest); limited OAuth PII (authenticated)
- NFR23: Rate limiting: 10 events/5s, then diminishing returns (50% fewer points, dimming feedback)
- NFR24: Session data isolated — no cross-session access
- NFR25: WebSocket connections authenticated to their session

**Authentication & Persistence (4 NFRs)**
- NFR34: Firebase Auth JWT validated on WebSocket handshake; guest session token TTL = 6 hours; handshake <500ms
- NFR35: Guest-to-account upgrade without disconnecting WebSocket or losing data; <5s including OAuth redirect
- NFR36: PostgreSQL session summary writes asynchronous, <5s for 12 participants and 20+ songs
- NFR37: Media access control enforces ownership; guest media via time-limited signed URL (7-day expiry)

**Song Integration (5 NFRs)**
- NFR29: Playlist import <5 seconds for up to 200 tracks
- NFR30: YouTube Data API v3 usage within 10,000 units/day free tier; <500 units per party session
- NFR31: Graceful degradation to suggestion-only mode if Lounge API fails
- NFR32: Karaoke Catalog Index pre-built server-side; no live API calls during party sessions
- NFR33: Spotify Client Credentials token managed server-side with automatic refresh

**Localization (1 NFR)**
- NFR38: All user-facing strings in centralized string constants module; fonts support Vietnamese diacritics (UTF-8)

**TOTAL: 38 Non-Functional Requirements**

### Additional Requirements

**From Architecture:**
- Starter template: Composed monorepo using `create vite` (svelte-ts template) + manual server scaffold + pnpm workspaces + Turborepo
- Monorepo structure: `packages/client` (Svelte 5 SPA), `packages/server` (Node.js + Socket.io), `packages/shared` (TypeScript interfaces)
- TypeScript 5.x strict mode across all packages, ES modules throughout
- Svelte 5 with runes (not SvelteKit), Tailwind CSS v4.2, Space Grotesk + Inter fonts
- Vite 7.3 for client build, tsx for server development, Vitest 4.0 for testing
- Railway deployment: Node.js Hobby ($5/mo) + PostgreSQL (usage-based)
- Firebase Auth for social OAuth + anonymous guest join
- Firebase Storage for media captures (Blaze plan)
- Drizzle ORM for PostgreSQL schema and queries
- Same-server MVP: Express serves Vite production build + Socket.io on same process
- Environment configuration via `.env` with `dotenv`, fail-fast validation at startup
- Required env vars: DATABASE_URL, FIREBASE_PROJECT_ID, FIREBASE_STORAGE_BUCKET, FIREBASE_SERVICE_ACCOUNT_KEY, YOUTUBE_API_KEY, SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, PORT, NODE_ENV, LOG_LEVEL
- Structured JSON logging via `pino`
- Health check endpoint: `GET /health` returning sessionCount, memoryUsage, uptime, dbConnected
- Graceful shutdown handler: stop connections, broadcast party:ended, wait 5s for ACKs, exit
- Memory monitoring: `process.memoryUsage()` every 60s, warn at 80% of 512MB heap, reject at 90%
- Implementation sequence: Sprint 0 (scaffold + Firebase + Railway), Sprint 1 (DJ engine, SessionManager, Socket.io, auth, DB, stores, reconnection, audio, PWA, shutdown), Sprint 2 (media capture), Sprint 3 (external APIs)
- Single-process Node.js handling ~10-50 concurrent parties at MVP scale

**From UX Design:**
- Mobile-only portrait mode: 360-412px width range, no desktop or tablet
- Primary browsers: Chrome Android (60-70%), iOS Safari (20-30%)
- Dual-attention design: passive mode (audio-first, phone face-down) vs active mode (screen-primary, ceremonies/voting)
- Host "Song Over!" trigger: 500ms long-press with fill animation + haptic feedback
- Share flow: 2 taps or fewer from artifact to native share sheet; 9:16 Instagram Story dimensions
- Transition design: 2-second animated transitions + sound cues between DJ states; 1-second silence before ceremony reveals
- Server-coordinated synchronized reveals across all devices (ceremony awards, major DJ transitions)
- First-tap audio unlock via icebreaker; fallback "tap to unmute" for late joiners/page refresh
- iOS Safari quirks: AudioContext unlock on tap, WebSocket suspension on screen lock, video capture via native picker
- Vibration API for Chrome Android only; audio-only fallback for iOS
- Pre-loaded audio buffers via Web Audio API
- Defensive rendering for share artifacts: text truncation, dynamic font scaling, overflow handling
- Budget Android device support (Galaxy A series, 3GB RAM)
- Screen Wake Lock API with iOS video hack fallback
- Reduced motion support for accessibility
- Copy style guide required before Sprint 2: tone, vocabulary, 10+ example strings per DJ state
- All ceremony text, DJ prompts, and system messages from single copy constants file

### FR Coverage Map

- FR1: Epic 1 - Party creation with QR code and party code
- FR2: Epic 1 - Guest join via QR scan or code entry
- FR3: Epic 1 - Guest display name entry
- FR4: Epic 1 - Live party lobby with player list
- FR5: Epic 1 - Host starts party, transitions all phones
- FR6: Epic 1 - Mid-session join with catch-up summary
- FR7: Epic 1 - Host re-displays QR/party code
- FR8: Epic 1 - Waiting state below 3 players
- FR9: Epic 2 - DJ auto-cycling state machine
- FR10: Epic 2 - Bridge moment activities
- FR11: Epic 2 - Pause state (host or inactivity)
- FR12: Epic 2 - Resume from pause
- FR13: Epic 2 - Democratic voting
- FR14: Epic 2 - Ceremony weight selection rules
- FR15: Epic 2 - Front-load participation in first 30 min
- FR16: Epic 3 - Host "Song Over!" trigger
- FR17: Epic 3 - Pre-song hype announcement
- FR18a: Epic 3 - Full ceremony crowd voting (15s)
- FR18b: Epic 3 - Auto-generated ceremony award titles
- FR18c: Epic 3 - Moment card generation (Full ceremony)
- FR19: Epic 3 - Quick ceremony (10s thumbs up/down)
- FR20: Epic 3 - Award title template pool (20+)
- FR21: Epic 3 - Group sing-along activities
- FR22: Epic 4 - Real-time emoji reactions
- FR23: Epic 4 - Reaction streak tracking and milestones
- FR24: Epic 4 - Soundboard effects (4-6 sounds)
- FR25: Epic 4 - Ceremony audio via host phone
- FR26: Epic 4 - Audio cues for DJ state transitions
- FR27: Epic 4 - Ceremony and democratic voting
- FR28a: Epic 4 - Interlude mini-game library (3 games)
- FR28b: Epic 4 - Interlude content (Kings Cup, Dare Pull, Quick Vote)
- FR29: Epic 5 - Host FAB and control overlay
- FR30: Epic 5 - Skip current activity
- FR31: Epic 5 - Pause/resume DJ engine
- FR32: Epic 5 - Override next activity
- FR33: Epic 5 - Full host control suite (skip, pause, queue, kick, end)
- FR34: Epic 10 - Shareable moment card per Full ceremony
- FR35: Epic 10 - Share moment card via native share sheet
- FR36: Epic 10 - End-of-night setlist poster
- FR37: Epic 10 - Share setlist poster via native share sheet
- FR38: Epic 9 - Capture bubble at 4 trigger points
- FR39: Epic 9 - Manual capture via persistent icon
- FR40: Epic 3 - Weighted participation score tracking
- FR41: Epic 10 - End-of-night awards (singing + non-singing)
- FR42: Epic 2 - Structured event stream logging
- FR43: Epic 10 - Post-session North Star prompt
- FR44: Epic 10 - Share intent tap tracking
- FR45: Epic 1 - WebSocket connections
- FR46: Epic 1 - Heartbeat disconnection detection
- FR47: Epic 6 - Auto-reconnection (5-min window, 2s sync)
- FR48: Epic 6 - Score/history preservation through disconnection
- FR49: Epic 6 - Host failover after 60s absence
- FR50: Epic 1 - Screen wake lock
- FR51: Epic 2 - First-session icebreaker
- FR52: Epic 10 - End-of-night finale sequence
- FR53: Epic 1 - Join process visual feedback (<200ms)
- FR54: Epic 7 - Party card dealing during pre-song state
- FR55: Epic 7 - 19-card pool (vocal/performance/group)
- FR56: Epic 7 - Vocal modifier card definitions
- FR57: Epic 7 - Performance modifier card definitions
- FR58: Epic 7 - Group involvement card definitions
- FR59: Epic 7 - Accept/dismiss/redraw flow
- FR60: Epic 7 - Group card random participant selection
- FR61: Epic 7 - Card acceptance/completion tracking
- FR62: Epic 7 - Card challenge scoring contribution
- FR63: Epic 8 - Lean-in vs lightstick mode toggle
- FR64: Epic 8 - Lightstick full-screen glow with color picker
- FR65: Epic 8 - Camera flash/screen hype signal
- FR66: Epic 8 - Free mode switching during songs
- FR67: Epic 9 - Floating capture bubble at key moments
- FR68: Epic 9 - Pop-to-capture (photo/video/audio)
- FR69: Epic 9 - Inline media recording with iOS fallback
- FR70: Epic 9 - Media tagging (session, timestamp, trigger, state)
- FR71: Epic 9 - Background upload queue with retry
- FR72: Epic 9 - Server-side media storage per session
- FR73: Epic 9 - Reaction peak auto-detection
- FR74: Epic 11 - YouTube TV pairing via code
- FR75: Epic 11 - Lounge API nowPlaying events
- FR76: Epic 11 - Video ID to song metadata resolution
- FR77: Epic 11 - Karaoke video title parsing
- FR78: Epic 11 - Push songs to YouTube TV queue
- FR79: Epic 11 - Lounge API session maintenance
- FR80: Epic 11 - Platform detection from pasted URL
- FR81: Epic 11 - YouTube Music playlist import
- FR82: Epic 11 - Spotify playlist import
- FR83: Epic 11 - Spotify private playlist guide
- FR84: Epic 11 - Cross-platform song normalization
- FR85: Epic 11 - Pre-built Karaoke Catalog Index (10K+ tracks)
- FR86: Epic 11 - Suggestion computation (intersection matching)
- FR87: Epic 11 - Suggestion ranking algorithm
- FR88: Epic 11 - Quick Pick mode (5 songs, majority vote)
- FR89: Epic 11 - Spin the Wheel mode (8 songs, animated)
- FR90: Epic 11 - Quick Pick / Spin the Wheel toggle
- FR91: Epic 11 - Cold start fallback (Karaoke Classics)
- FR92: Epic 11 - Suggestion-only mode (no TV pairing)
- FR93: Epic 11 - Suggestion-only song display
- FR94: Epic 11 - Manual "now playing" marking
- FR95: Epic 11 - Optional TV pairing at party creation
- FR96: Epic 12 - Optional OAuth sign-in (Google/Facebook)
- FR97: Epic 12 - Guest-to-account upgrade
- FR98: Epic 12 - Persistent user profiles
- FR99: Epic 12 - Session summary to PostgreSQL
- FR100: Epic 12 - Party history view
- FR101: Epic 12 - Media linked to profiles (7-day guest access)
- FR102: Epic 12 - Firebase Storage media organization
- FR103: Epic 12 - Session summary write with retry
- FR104: Epic 12 - Session ownership for hosts
- FR105: Epic 1 (partial: guest session-scoped token) + Epic 12 (full: Firebase JWT validation)

### NFR Mapping Strategy

NFRs are not assigned to individual epics but will be embedded as acceptance criteria in relevant stories during story creation. Key NFR-to-epic affinities:

- **NFR1, NFR26, NFR27:** Epic 2 (DJ state sync) + Epic 3 (ceremony reveal timing)
- **NFR2, NFR5, NFR28:** Epic 4 (reactions performance, memory)
- **NFR3, NFR6, NFR18:** Epic 4 (audio performance)
- **NFR4, NFR11:** Epic 3 (ceremony voting)
- **NFR7:** Epic 1 (bundle size — tracked from scaffold onward)
- **NFR8, NFR10, NFR12, NFR13:** Epic 2 (DJ resilience) + Epic 6 (connection resilience)
- **NFR9:** Epic 6 (reconnection UX)
- **NFR14, NFR15, NFR16, NFR17, NFR19, NFR20:** Cross-cutting usability — every epic's stories
- **NFR21, NFR22, NFR24, NFR25:** Epic 1 (session security)
- **NFR23:** Epic 4 (rate limiting on reactions/soundboard)
- **NFR29-NFR33:** Epic 11 (song integration performance/resilience)
- **NFR34, NFR35:** Epic 12 (auth persistence)
- **NFR36, NFR37:** Epic 12 (PostgreSQL writes, media access control)
- **NFR38:** Cross-cutting localization — every epic's stories (centralized string constants)

### Playtest Checkpoints

- **After Epic 2+3:** Validate DJ engine + ceremony loop with real users. Does the auto-cycling feel magical or robotic? Do synchronized reveals create the collective gasp? Is the Song Over! trigger natural for the host? Gate Epics 4+ on playtest findings.
- **After Epic 6:** Validate reconnection on real venue WiFi (Vietnam karaoke venues). Does the 3-tier reconnection actually work transparently? Test on budget Android devices.

## Epic List

### Epic 1: Party Foundation & Join Flow
Users can create a party, share a QR code/party code, join via browser, and see who's in the room. The foundational real-time infrastructure that everything else builds on. Includes guest session token authentication on WebSocket handshake (FR105 partial — guest token path only; full Firebase JWT validation deferred to Epic 12).
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR53, FR45, FR46, FR50, FR105 (partial: guest session-scoped token)
**Implementation note:** This epic covers monorepo scaffold (Sprint 0) + core WebSocket/session infrastructure. Expect high story count — consider splitting into Story Group A (scaffold + infra) and Story Group B (party management UX). Stories must include explicit NFR acceptance criteria per Bob's recommendation.

### Epic 2: The Automated DJ
The party runs itself — the DJ engine automatically cycles through activities, runs the icebreaker, provides bridge moments during physical transitions, and pauses/resumes intelligently. Every action is logged as a structured event stream. Participation scoring schema designed here (event stream feeds Epic 3's score population).
**FRs covered:** FR9, FR10, FR11, FR12, FR13, FR14, FR15, FR51, FR42
**Implementation note:** This is THE core product. Stories must define the participation scoring event schema (tier categorization: passive/active/engaged) as part of the event stream design — downstream epics will consume this schema for score calculation and awards. PLAYTEST CHECKPOINT: After Epic 2+3 completion, conduct real-world playtest before proceeding to validate the DJ engine + ceremony loop feels magical, not robotic.

### Epic 3: Performance & Ceremony
Singers get their spotlight moment — crowd voting, dramatic synchronized reveals, auto-generated awards, and moment cards. Participation scoring begins tracking everyone's engagement. This is the product's emotional core — the synchronized reveal IS the product.
**FRs covered:** FR16, FR17, FR18a, FR18b, FR18c, FR19, FR20, FR21, FR40
**Implementation note:** Stories MUST include choreographed reveal UX as explicit acceptance criteria: server-coordinated timing (NFR27: 100ms sync window), 1-second silence before reveal, 2-second animated transitions, anticipation phase that absorbs timing drift. "Voting works and score shows" is NOT sufficient — the ceremony experience must be designed as a show. PLAYTEST CHECKPOINT: Validate with real users after this epic.

### Epic 4: Audience Engagement
Non-singers stay engaged with real-time emoji reactions, soundboard effects, voting, audio cues, and interlude mini-games between songs.
**FRs covered:** FR22, FR23, FR24, FR25, FR26, FR27, FR28a, FR28b

### Epic 5: Host Controls
Host manages the party from a floating overlay — skip, pause, override, kick, end party — without leaving the participant experience.
**FRs covered:** FR29, FR30, FR31, FR32, FR33

### Epic 6: Connection Resilience
Seamless reconnection and host failover ensure the party never breaks, even on unreliable venue WiFi.
**FRs covered:** FR47, FR48, FR49
**Implementation note:** Only 3 FRs but architecturally dense — three-tier reconnection protocol, per-client event buffer cursors, host failover logic. Expect 5-7 stories minimum despite low FR count. Vietnam venue WiFi is unreliable; this epic is critical for real-world viability.

### Epic 7: Party Cards
Challenge cards add variety to performances — vocal modifiers, performance challenges, and group involvement cards that pull audience members into the action.
**FRs covered:** FR54, FR55, FR56, FR57, FR58, FR59, FR60, FR61, FR62

### Epic 8: Audience Modes
Lightstick mode and hype signal let the audience create atmosphere during songs — full-screen glow effects, color picking, and camera flash encouragement.
**FRs covered:** FR63, FR64, FR65, FR66
**Implementation note:** Lightstick full-screen glow animation must be performance-tested on budget Android devices (Galaxy A series, 3GB RAM) at 60fps. Include a dedicated performance story — GPU animation on low-end hardware is a distinct concern from feature functionality.

### Epic 9: Media Capture
Participants capture photos, video, and audio at key moments — prompted by floating bubbles at reaction peaks and ceremonies, or triggered manually anytime.
**FRs covered:** FR38, FR39, FR67, FR68, FR69, FR70, FR71, FR72, FR73

### Epic 10: Memory & Sharing
The party becomes shareable — moment cards become sharable artifacts, setlist poster, end-of-night awards, a dramatic finale sequence, and post-session feedback. The viral flywheel. Note: moment card *generation* (FR18c) happens in Epic 3; this epic handles *sharing* and the end-of-night experience.
**FRs covered:** FR34, FR35, FR36, FR37, FR41, FR43, FR44, FR52
**Implementation note:** FR34 (shareable moment card) builds on FR18c (moment card generation from Epic 3). Stories must clearly distinguish: Epic 3 generates the card data + initial display; Epic 10 adds share-ready rendering (9:16, defensive layout) + native share sheet integration.

### Epic 11: Song Discovery & Integration
Smart song suggestions powered by friends' playlists and YouTube TV integration — Quick Pick voting, Spin the Wheel, karaoke catalog matching, and suggestion-only fallback for any venue.
**FRs covered:** FR74, FR75, FR76, FR77, FR78, FR79, FR80, FR81, FR82, FR83, FR84, FR85, FR86, FR87, FR88, FR89, FR90, FR91, FR92, FR93, FR94, FR95

### Epic 12: Identity & Party History
Optional accounts with persistent profiles, party history, and personal media gallery — turning one-time guests into returning users. Completes the authentication story: Epic 1 establishes guest session tokens; this epic adds Firebase Auth OAuth (Google/Facebook) and JWT validation on WebSocket handshake.
**FRs covered:** FR96, FR97, FR98, FR99, FR100, FR101, FR102, FR103, FR104, FR105 (full: Firebase JWT validation path)

---

## Epic 1: Party Foundation & Join Flow

Users can create a party, share a QR code/party code, join via browser, and see who's in the room. The foundational real-time infrastructure that everything else builds on.

### Story 1.1: Monorepo Scaffold & Dev Environment

As a developer,
I want a fully configured monorepo with client, server, and shared packages,
So that all future stories have a consistent, working development environment.

**Acceptance Criteria:**

**Given** the repository is cloned and `pnpm install` is run
**When** `pnpm dev` is executed at the monorepo root
**Then** the Vite dev server starts serving the Svelte 5 client on a local port
**And** the Node.js server starts with `tsx` on a separate port
**And** both packages use TypeScript 5.x strict mode with ES modules
**And** a shared types package exists at `packages/shared` with workspace protocol linking

**Given** the monorepo is initialized
**When** the project structure is inspected
**Then** `turbo.json` defines `dev`, `build`, `test`, and `lint` pipelines
**And** `pnpm-workspace.yaml` lists `packages/*`
**And** `tsconfig.base.json` exists at root with strict settings extended per package
**And** `.env.example` documents all required environment variables (DATABASE_URL, FIREBASE_PROJECT_ID, FIREBASE_STORAGE_BUCKET, PORT, NODE_ENV, LOG_LEVEL)

**Given** the client package exists
**When** `pnpm build` is run in the client package
**Then** Vite produces a production build in `packages/client/dist/`
**And** Tailwind CSS v4.2 is configured with CSS-first `@theme`
**And** Space Grotesk and Inter fonts are loaded
**And** the gzipped JS bundle is under 100KB (NFR7 baseline)

**Given** the server package exists
**When** `pnpm build` is run in the server package
**Then** TypeScript compiles successfully
**And** Express is configured to serve the client dist in production mode
**And** Socket.io is initialized on the same HTTP server
**And** `pino` structured JSON logging is configured
**And** environment variables are validated at startup — server fails fast if required vars are missing

**Given** testing is configured
**When** `pnpm test` is run at the monorepo root
**Then** Vitest runs for both client and server packages
**And** at least one placeholder test passes per package

### Story 1.1b: Database Schema & ORM Setup

As a developer,
I want the PostgreSQL database schema defined and migrated via Drizzle ORM,
So that all future stories have a working persistence layer for session summaries, user profiles, and media metadata.

**Acceptance Criteria:**

**Given** Railway PostgreSQL is provisioned and `DATABASE_URL` is configured
**When** the Drizzle schema is defined
**Then** the following tables exist with appropriate columns and constraints:
- `profiles` (Firebase uid, display name, avatar URL, created_at)
- `parties` (party code, host_uid, started_at, ended_at, settings)
- `participants` (uid, party_id, role, joined_at)
- `session_summaries` (setlist, awards, stats, ceremony results as JSONB)
- `moments` (type, timestamp, description, media_url, uid, party_id)
- `media` (storage_path, uid, party_id, moment_type, created_at)
**And** foreign key relationships are defined between tables (participants → parties, participants → profiles, etc.)
**And** indexes exist on frequently queried columns: `idx_participants_party_id`, `idx_parties_host_uid`, `idx_media_party_id`

**Given** the Drizzle schema is defined
**When** `drizzle-kit push` is run against the Railway PostgreSQL instance
**Then** all tables are created successfully
**And** the migration completes without errors

**Given** the database is provisioned
**When** the server starts
**Then** the Drizzle client initializes a connection pool to Railway PostgreSQL
**And** the `GET /health` endpoint includes `dbConnected: true` when the connection is healthy
**And** the server fails fast at startup if `DATABASE_URL` is missing or the connection fails

**Given** the Drizzle schema uses TypeScript
**When** the schema file is inspected
**Then** TypeScript types use `camelCase` mapping to `snake_case` SQL columns via Drizzle's column naming
**And** the schema is defined in `packages/server/src/db/schema.ts`
**And** the Drizzle client is initialized in `packages/server/src/db/client.ts`

### Story 1.2: WebSocket Server & Guest Session Authentication

As a system,
I want authenticated WebSocket connections with guest session tokens,
So that all real-time communication is secure and session-isolated from the start.

**Acceptance Criteria:**

**Given** a client attempts to connect via Socket.io without a session token
**When** the WebSocket handshake occurs
**Then** the server issues a session-scoped guest token with a TTL of 6 hours (NFR34)
**And** the handshake completes within 500ms (NFR34)
**And** the token is returned to the client for reconnection use

**Given** a client connects with a valid guest session token
**When** the WebSocket handshake occurs
**Then** the server validates the token and associates the connection with the existing session
**And** the connection is accepted without issuing a new token

**Given** a client connects with an expired or invalid token
**When** the WebSocket handshake occurs
**Then** the server rejects the connection with a clear error code
**And** the client can request a fresh token

**Given** two active party sessions exist
**When** a participant in session A sends a Socket.io event
**Then** the event is delivered only to participants in session A (NFR24)
**And** no participant in session B receives the event (NFR25)

**Given** the server receives a SIGTERM signal
**When** graceful shutdown initiates
**Then** the server stops accepting new connections
**And** broadcasts `party:ended { reason: 'server_restart' }` to all connected rooms
**And** waits up to 5 seconds for disconnect ACKs before `process.exit(0)`

**Given** the server is running
**When** `GET /health` is requested
**Then** the response returns `{ sessionCount, memoryUsage, uptime }` with 200 status

### Story 1.3: Client Shell & Real-Time Connection

As a participant,
I want my phone to establish and maintain a real-time connection to the party server,
So that I receive live updates and can interact with the party.

**Acceptance Criteria:**

**Given** the Svelte client app loads in a mobile browser
**When** the app initializes
**Then** a Socket.io connection is established to the server
**And** a guest session token is received and stored in memory
**And** the connection status is reflected in a Svelte store (connected/disconnected)

**Given** a WebSocket connection is active
**When** the connection drops unexpectedly
**Then** Socket.io's built-in reconnection attempts begin automatically
**And** the UI displays a non-blocking connection status indicator

**Given** the client is connected
**When** the server emits an event to the client's room
**Then** the Svelte store updates reactively within 200ms (NFR1)

**Given** the app is loaded on a mobile device
**When** the user is in an active participation state
**Then** the Screen Wake Lock API is activated to prevent auto-lock (FR50)
**And** on iOS Safari, the video-element fallback is used if Wake Lock API is unavailable

**Given** the app renders on mobile
**When** any interactive element is displayed
**Then** tap targets are at least 48x48px (NFR14)
**And** text meets WCAG AA contrast ratio against backgrounds (NFR17)
**And** all user-facing strings are sourced from a centralized string constants module (NFR38)

### Story 1.4: Create a Party (Host)

As a host,
I want to create a new party session and get a QR code and party code,
So that I can invite friends to join my karaoke night.

**Acceptance Criteria:**

**Given** a user opens the app
**When** they tap "Create Party"
**Then** the server creates a new party session with a unique 4-digit party code (FR1)
**And** a QR code is generated encoding the join URL with the party code
**And** the host is connected to the party's Socket.io room
**And** the party code expires when the session ends and cannot be reused (NFR21)

**Given** the party is created
**When** the host views the party screen
**Then** both the QR code and 4-digit code are prominently displayed for sharing
**And** no text input is required beyond what was already entered (NFR15, NFR20)

**Given** the party session is active
**When** the host's display name is set
**Then** the display name is stored server-side with session participation data only — no PII beyond the name (NFR22)

### Story 1.5: Join a Party (Guest)

As a guest,
I want to join an active party by scanning a QR code or entering a party code,
So that I can participate in the karaoke night from my phone.

**Acceptance Criteria:**

**Given** a guest scans the QR code from the host's screen
**When** their mobile browser opens the join URL
**Then** the app loads and displays a name entry screen (FR2)
**And** the join URL resolves to the correct active party session

**Given** a guest opens the app directly
**When** they enter a valid 4-digit party code
**Then** the app connects to the matching active party session (FR2)

**Given** a guest enters an invalid or expired party code
**When** they attempt to join
**Then** the app displays a clear error message (not a technical error string)
**And** allows them to try again

**Given** a guest is on the name entry screen
**When** they enter a display name and tap "Join"
**Then** a guest session token is issued (FR105 partial)
**And** a WebSocket connection is established to the party room
**And** no account creation or sign-up is required (FR3)

**Given** a guest is joining
**When** the WebSocket connection is being established
**Then** visual feedback appears within 200ms showing party status and player count (FR53)
**And** the transition to the lobby is smooth once the connection is confirmed

### Story 1.6: Party Lobby & Live Player List

As a participant,
I want to see a live lobby showing who has joined the party,
So that I know when my friends have connected and we're ready to start.

**Acceptance Criteria:**

**Given** a participant has joined the party
**When** they are in the lobby
**Then** they see a live player list showing all connected participants with display names (FR4)
**And** the current player count is visible

**Given** the lobby is displayed
**When** a new participant joins
**Then** the player list updates in real-time on all connected phones
**And** the player count increments

**Given** the lobby is displayed
**When** a participant disconnects
**Then** the player list updates on all phones via heartbeat detection (FR46)
**And** the player count decrements

**Given** the lobby is displayed on any device
**When** the screen is viewed
**Then** all elements are usable without instructions (NFR16)
**And** the layout renders correctly in portrait mode at 360-412px width

### Story 1.7: Host Starts the Party

As a host,
I want to start the party when everyone is ready,
So that all connected phones transition to the first activity together.

**Acceptance Criteria:**

**Given** the host is in the lobby with connected participants
**When** the host taps "Start Party"
**Then** all connected phones transition simultaneously to the first activity state (FR5)
**And** the DJ engine state machine initializes (preparing for Epic 2)
**And** the transition propagates to all devices within 200ms (NFR1)

**Given** the host is in the lobby
**When** fewer than 3 participants are connected
**Then** the "Start Party" button is disabled or hidden
**And** the waiting state displays current player count, QR code, and a share prompt to invite more (FR8)

**Given** the party has started
**When** the host wants to re-display the QR code and party code
**Then** a re-share option is accessible that shows the QR and 4-digit code again (FR7)
**And** this can be triggered at any point during the active session

### Story 1.8: Mid-Session Join & Waiting State

As a late-arriving guest,
I want to join a party that's already in progress,
So that I can participate without the host needing to restart.

**Acceptance Criteria:**

**Given** a party is actively running (past the lobby phase)
**When** a new guest enters the party code or scans the QR
**Then** they join the party mid-session (FR6)
**And** they receive a catch-up summary showing current party stats (songs sung, current activity, player count)
**And** they are synced to the current DJ state

**Given** a mid-session joiner has connected
**When** their phone enters an active participation state
**Then** Screen Wake Lock activates (FR50)
**And** they can immediately participate in the current activity

**Given** the party is running with fewer than 3 active participants
**When** a participant disconnects bringing the count below threshold
**Then** the system transitions to a waiting state (FR8)
**And** the waiting state shows current player count, QR code, and share prompt
**And** the DJ engine pauses gracefully until the threshold is restored

---

## Epic 2: The Automated DJ

The party runs itself — the DJ engine automatically cycles through activities, runs the icebreaker, provides bridge moments during physical transitions, and pauses/resumes intelligently. Every action is logged as a structured event stream.

### Story 2.1: DJ State Machine Core & Unit Tests

As a system,
I want a server-side state machine that governs all party flow transitions,
So that the DJ engine can automatically cycle through activities with defined rules.

**Acceptance Criteria:**

**Given** the DJ state machine module exists as a pure function
**When** a state and event are provided
**Then** the machine returns the next state based on defined transition rules
**And** guards prevent invalid transitions (e.g., cannot skip from lobby directly to ceremony)
**And** the machine is fully deterministic — same input always produces same output

**Given** the state machine defines the core loop
**When** the party is running
**Then** it cycles through: song_selection > party_card_deal > song > ceremony > interlude > vote > repeat (FR9)
**And** each state has defined entry/exit actions, timeouts, and allowed transitions

**Given** the state machine is implemented
**When** unit tests are run
**Then** 100% of states, transitions, guards, and timeout behaviors are covered
**And** all tests pass deterministically without network or timing dependencies

**Given** any participant (including host) disconnects
**When** the DJ engine is cycling
**Then** the state machine continues operating without interruption (NFR8)
**And** votes and activities count only present participants

**Given** the state machine defines timeouts
**When** a timed state (e.g., ceremony voting) reaches its timeout
**Then** the machine auto-transitions to the next state
**And** timeout durations are configurable per state

**Given** the participation scoring event schema
**When** the state machine transitions or records a user action
**Then** the event payload follows the schema: `{sessionId, userId, eventType, timestamp, metadata}` (FR42 schema design)
**And** events are categorized into tiers: passive (1pt), active (3pt), engaged (5pt) — schema only, scoring logic deferred to Epic 3

### Story 2.2: Event Stream Logging

As a system,
I want every state transition, user action, and DJ decision logged as structured events,
So that the session is fully observable and replayable for debugging and analytics.

**Acceptance Criteria:**

**Given** the DJ engine transitions between states
**When** any state change occurs
**Then** a structured event is logged with schema: `{sessionId, userId, eventType, timestamp, metadata}` (FR42)
**And** the event type distinguishes state transitions, user actions, and DJ decisions

**Given** a user performs any action (reaction, vote, soundboard tap, etc.)
**When** the action is processed by the server
**Then** a corresponding action event is logged to the event stream
**And** logging is asynchronous and adds no more than 5ms latency to the user-facing operation (NFR26)

**Given** the dual event log architecture
**When** events are stored
**Then** a stateLog tracks DJ state transitions (ordered, cursor-addressable for reconnection)
**And** an actionLog tracks all user actions (append-only, used for analytics and scoring)

**Given** the server processes events under load
**When** 12 participants are sending actions simultaneously
**Then** no events are dropped or duplicated
**And** event ordering is preserved per session

**Given** a session ends
**When** the event stream is reviewed
**Then** the complete session timeline can be reconstructed from logged events

### Story 2.3: DJ-Client State Synchronization

As a participant,
I want my phone to always show the current DJ state in real-time,
So that I see the right screen at the right time without manual navigation.

**Acceptance Criteria:**

**Given** the DJ engine transitions to a new state on the server
**When** the state change is broadcast via Socket.io
**Then** all connected clients receive the new state within 200ms (NFR1)
**And** each client's Svelte djStore updates reactively

**Given** the client receives a DJ state update
**When** the djStore value changes
**Then** App.svelte routes to the correct screen/component for that state
**And** no manual navigation or page reload is required
**And** the transition between screens is immediate (animation added in future stories)

**Given** the server is the single source of truth for DJ state (NFR10)
**When** the client attempts to derive or cache DJ state locally
**Then** there is no client-side state machine — clients are thin renderers of server state

**Given** the DJ engine is in any state
**When** a new participant joins mid-session
**Then** the server sends the current DJ state to the joining client
**And** the client renders the correct screen immediately

**Given** the party has fewer than 3 active participants
**When** the count drops below threshold
**Then** the DJ engine activates degraded mode: skips group interludes, reduces ceremony to pass/fail (NFR12)
**And** all clients reflect the degraded state appropriately

### Story 2.4: Icebreaker Activity

As a participant,
I want to complete a fun icebreaker activity when the party starts,
So that I learn how the app works through play and my audio is unlocked.

**Acceptance Criteria:**

**Given** the host starts the party (from Epic 1 Story 1.7)
**When** the DJ engine initializes
**Then** the first activity is an icebreaker (FR51)
**And** all connected participants see the icebreaker screen simultaneously

**Given** the icebreaker is displayed
**When** a participant taps their response (e.g., "Tap your favorite decade")
**Then** the response is recorded with a single tap — no text input (NFR15)
**And** results are visible to the group in real-time
**And** the tap event serves as the AudioContext unlock gesture for iOS Safari

**Given** all participants have responded (or timeout is reached)
**When** the icebreaker completes
**Then** group results are displayed briefly
**And** the DJ engine transitions to the next state in the cycle

**Given** it is the first 30 minutes of the session
**When** the DJ engine selects activities
**Then** universal participation activities are front-loaded (FR15)
**And** the icebreaker is the first of these activities

**Given** the icebreaker screen is displayed
**When** any participant views it
**Then** the interaction is self-evident without instructions (NFR16)
**And** all text is sourced from the centralized string constants module (NFR38)

### Story 2.5: Bridge Moments

As a participant,
I want smooth transition activities during physical-world moments,
So that there's no dead air while the next singer gets the mic or picks a song.

**Acceptance Criteria:**

**Given** the DJ engine reaches a physical-world transition point
**When** the transition occurs (first song prompt, song selection, mic handoff)
**Then** the system displays a bridge moment activity on all phones (FR10)
**And** the bridge moment keeps participants engaged during the real-world pause

**Given** a bridge moment is active
**When** the physical transition completes (e.g., next singer is ready)
**Then** the DJ engine auto-transitions to the next state
**Or** the bridge moment times out and transitions automatically

**Given** bridge moments are displayed
**When** participants view them
**Then** they require minimal interaction (single tap or passive viewing)
**And** they feel natural, not robotic — filler that adds energy, not friction

**Given** multiple bridge moment types exist
**When** the DJ engine selects one
**Then** the selection varies to avoid repetition within a session

### Story 2.6: Pause & Resume

As a host,
I want the DJ engine to pause when needed and resume smoothly,
So that the party adapts to real-world interruptions like food breaks or bathroom runs.

**Acceptance Criteria:**

**Given** the DJ engine is actively cycling
**When** the host triggers a pause action
**Then** the DJ engine enters the pause state (FR11)
**And** all connected clients display a paused indicator
**And** the pause state is broadcast within 200ms (NFR1)

**Given** the DJ engine is actively cycling
**When** 90+ seconds of inactivity is detected across all users
**Then** the system auto-pauses (FR11)
**And** participants see a paused state with a playful message (not a technical timeout)

**Given** the DJ engine is paused
**When** the host un-pauses or activity resumes
**Then** the DJ engine resumes to the correct next state in the cycle (FR12)
**And** if paused mid-song, resumes to song state
**And** if paused mid-ceremony, resumes to ceremony state
**And** if paused mid-interlude, resumes to interlude state

**Given** the DJ engine is paused
**When** all participants remain inactive
**Then** the system stays paused indefinitely without crashing or timing out
**And** the pause state is recoverable on resume

### Story 2.7: Ceremony Weight Selection

As a system,
I want defined rules for selecting ceremony intensity after each song,
So that the party has variety — big celebrations for special moments, quick ones to keep momentum.

**Acceptance Criteria:**

**Given** a song has ended and the DJ engine transitions to ceremony
**When** the ceremony weight is selected
**Then** the system follows these rules (FR14):
- Full ceremony for the first song of the session
- Full ceremony for the first song after an interlude
- Never two consecutive Full ceremonies
- Default to Quick ceremony after song 5
- Skip ceremony available via host override only

**Given** the ceremony weight rules
**When** the DJ engine evaluates the session history
**Then** the selection is deterministic based on song count, previous ceremony type, and interlude placement
**And** the selected weight (Full/Quick/Skip) is included in the state transition event

**Given** the host overrides ceremony weight
**When** they select Skip for a particular song
**Then** the DJ engine skips the ceremony and advances to the next state
**And** the override is logged in the event stream (FR42)

### Story 2.8: Democratic Voting

As a participant,
I want to vote on what the group does next,
So that the party feels collaborative and everyone has a say.

**Acceptance Criteria:**

**Given** the DJ engine reaches a voting state
**When** a democratic vote is triggered
**Then** all connected participants see 2-3 options for the next activity (FR13)
**And** the options are displayed simultaneously on all phones

**Given** a vote is in progress
**When** a participant taps their choice
**Then** the vote is recorded with a single tap (NFR14)
**And** the vote is sent to the server and tallied in real-time

**Given** the voting period ends (timeout or all participants voted)
**When** votes are tallied
**Then** the winning option is selected and the DJ engine transitions to that activity
**And** in case of a tie, the system selects randomly among tied options
**And** the vote result is broadcast to all participants

**Given** a participant disconnects during voting
**When** the vote is tallied
**Then** only present participants' votes are counted (NFR8)
**And** the vote completes normally without waiting for the disconnected participant

**Given** the party has fewer than 3 active participants
**When** a vote would normally occur
**Then** the system skips the vote and the DJ engine auto-selects the next activity (NFR12)

---

## Epic 3: Performance & Ceremony

Singers get their spotlight moment — crowd voting, dramatic synchronized reveals, auto-generated awards, and moment cards. Participation scoring begins tracking everyone's engagement. This is the product's emotional core — the synchronized reveal IS the product.

### Story 3.1: Song Over! Trigger & Pre-Song Hype

As a host,
I want a deliberate trigger to signal a song has ended, and as a participant, I want to see who's performing next,
So that the transition from singing to ceremony feels like a show, not a button press.

**Acceptance Criteria:**

**Given** the DJ engine is in the song state
**When** the host views their screen
**Then** the "Song Over!" trigger is persistently visible and always accessible (FR16)
**And** it is visually distinct from all other interactive elements to prevent accidental activation

**Given** the host wants to end the current song
**When** they long-press the "Song Over!" trigger for 500ms
**Then** a fill animation provides visual confirmation during the press
**And** haptic feedback fires on supported devices (Chrome Android Vibration API)
**And** the ceremony state is triggered on release at full fill
**And** accidental taps (< 500ms) do not trigger the ceremony

**Given** the DJ engine transitions to the pre-song state for the next performer
**When** the next singer is announced
**Then** all phones display a hype announcement showing the next performer's name (FR17)
**And** the announcement appears simultaneously on all devices within 200ms (NFR1)
**And** the hype screen is visually energetic — this builds anticipation, not just displays text

**Given** the hype announcement is displayed
**When** participants view it
**Then** all text is sourced from the centralized string constants module (NFR38)
**And** the performer name handles long display names gracefully (text truncation/scaling)

### Story 3.2: Full Ceremony Voting

As a participant,
I want to vote on the singer's performance during a Full ceremony,
So that the crowd collectively scores the performance and builds anticipation for the award.

**Acceptance Criteria:**

**Given** the DJ engine transitions to a Full ceremony state
**When** the voting screen appears
**Then** all participants see a voting interface simultaneously
**And** the voting scale allows scoring (1-5 range)
**And** tap targets are at least 48x48px (NFR14)

**Given** the voting window is open
**When** a participant picks up their phone and votes
**Then** the vote is accepted — staggered participation is supported (FR18a)
**And** participants who vote early and participants who vote late within the window are both counted

**Given** the voting window opens
**When** 15 seconds elapse on the server-side timer
**Then** the voting window closes exactly at 15 seconds regardless of client clock variations (NFR4)
**And** no votes are accepted after the window closes

**Given** multiple participants submit votes simultaneously
**When** the server processes the votes
**Then** all votes are recorded without race conditions or vote loss (NFR11)
**And** the final score is calculated as the aggregate of all submitted votes

**Given** a participant disconnects during voting
**When** the vote is tallied
**Then** only connected participants' votes count (NFR8)
**And** the ceremony proceeds normally

**Given** the party has fewer than 3 participants
**When** a ceremony would normally be Full
**Then** voting reduces to pass/fail instead of the full 1-5 scale (NFR12)

### Story 3.3: Ceremony Award Generation

As a system,
I want to auto-generate ceremony award titles based on crowd scores,
So that every performer gets a unique, tone-appropriate award that matches how the crowd responded.

**Acceptance Criteria:**

**Given** the ceremony voting has completed and a score is calculated
**When** the award title is generated
**Then** the system selects from a categorized template pool (FR18b, FR20):
- Scores 1-2: comedic/ironic titles (e.g., "The Brave Attempt Award")
- Score 3: neutral titles (e.g., "The Crowd Pleaser")
- Scores 4-5: praise titles (e.g., "Vocal Assassin")
**And** selection is random within the matched category to avoid repetition

**Given** the award template pool
**When** the pool is inspected
**Then** it contains 20+ templates total across all categories (FR20)
**And** templates are stored as data constants, not hardcoded in logic
**And** all award text is sourced from the centralized string constants module (NFR38)

**Given** an award is generated
**When** the same score range occurs multiple times in a session
**Then** the system avoids repeating the same award title within the same session where possible

**Given** a Quick ceremony produces a vote result
**When** the one-liner reaction is generated
**Then** it is auto-generated from the vote split (e.g., "8 thumbs up, 2 thumbs down — the crowd has spoken!")
**And** the tone matches the overall sentiment (positive, mixed, or negative)

### Story 3.4: Synchronized Ceremony Reveal

As a participant,
I want the award reveal to happen simultaneously on every phone in the room with dramatic timing,
So that the collective gasp and room reaction create a shared magical moment.

**Acceptance Criteria:**

**Given** the ceremony voting has completed and the award is generated
**When** the reveal sequence begins
**Then** all phones enter an anticipation phase (drumroll, screen dim, countdown pulse)
**And** the anticipation phase lasts 2-3 seconds, absorbing timing drift between devices

**Given** the anticipation phase completes
**When** the reveal moment arrives
**Then** ALL audio cuts for exactly 1 second across all devices — complete silence
**And** then the award reveal fires with full animation and sound
**And** the reveal appears on all connected devices within a 100ms window of each other (NFR27)

**Given** the server coordinates the reveal timing
**When** the reveal is triggered
**Then** the server sends a future timestamp to all clients
**And** clients schedule the reveal display at that exact timestamp
**And** the anticipation phase masks any timing drift between devices (up to 200ms)

**Given** the reveal is displayed
**When** the moment card appears (FR18c)
**Then** it combines: performer name, song title (if available), award title, and crowd score
**And** the card uses a 2-second animated entrance transition
**And** the animation is performant on budget Android devices (Galaxy A series, 3GB RAM)

**Given** the Full ceremony reveal sequence
**When** measured end-to-end
**Then** the total flow is: voting (15s) → anticipation (2-3s) → silence (1s) → reveal with animation (2s)
**And** this choreography is the same on every device in the room

### Story 3.5: Quick Ceremony

As a participant,
I want a fast, lightweight ceremony after most songs,
So that every performance gets acknowledged without slowing down the party.

**Acceptance Criteria:**

**Given** the DJ engine selects a Quick ceremony (per Story 2.7 weight rules)
**When** the ceremony state begins
**Then** all participants see a thumbs up / thumbs down voting interface (FR19)
**And** the voting window is 10 seconds (server-timed)

**Given** the Quick ceremony voting completes
**When** results are tallied
**Then** a one-liner reaction is auto-generated from the vote split (FR19)
**And** the reaction tone matches the sentiment (e.g., "unanimous praise" vs "the crowd is divided")
**And** the result is displayed on all phones simultaneously

**Given** the Quick ceremony completes
**When** the result is shown
**Then** the display duration is brief (3-5 seconds)
**And** the DJ engine auto-transitions to the next state
**And** no moment card is generated for Quick ceremonies (moment cards are Full ceremony only)

**Given** the Quick ceremony is displayed
**When** participants interact
**Then** voting requires a single tap on targets at least 48x48px (NFR14)
**And** the experience is self-evident without instructions (NFR16)

### Story 3.6: Group Sing-Along

As a participant,
I want group sing-along activities where everyone is included,
So that shy participants and non-singers feel part of the performance without individual spotlight.

**Acceptance Criteria:**

**Given** the DJ engine reaches a group sing-along state
**When** the activity begins
**Then** all participants see a group activity screen — no individual is spotlighted (FR21)
**And** the screen indicates this is a collective moment

**Given** the group sing-along is active
**When** participants view their phones
**Then** the experience is passive-friendly — no mandatory individual actions required
**And** participants can still send reactions if they choose

**Given** the group sing-along completes
**When** the DJ engine transitions
**Then** the ceremony following a group activity uses appropriate weight (per FR14 rules)
**And** awards reflect the group nature (not individual performer awards)

### Story 3.7: Participation Score Tracking

As a system,
I want to track weighted participation scores for every user across three tiers,
So that engagement is measured and recognized — not just singing, but all forms of participation.

**Acceptance Criteria:**

**Given** the participation scoring system is active
**When** a user performs actions during the session
**Then** actions are scored across three tiers (FR40):
- Passive (1pt): being connected, viewing screens
- Active (3pt): sending reactions, voting in ceremonies, tapping soundboard
- Engaged (5pt): singing a song, completing a party card challenge, initiating a media capture

**Given** a user action is logged in the event stream (from Story 2.2)
**When** the scoring engine processes the event
**Then** the appropriate tier points are added to the user's session score
**And** scoring reads from the event stream schema defined in Story 2.1

**Given** a participant has accumulated a score
**When** they disconnect and reconnect (reconnection handled by connection resilience stories)
**Then** their score is preserved server-side and restored on reconnection

**Given** the session is in progress
**When** participation scores are queried
**Then** the server returns current scores for all participants
**And** scores are available for ceremony awards (current epic) and end-of-night awards (Epic 10)

**Given** the scoring engine processes events
**When** measured for performance
**Then** score calculation adds no perceptible latency to user-facing operations
**And** scores are updated asynchronously from the event stream

---

## Epic 4: Audience Engagement

Non-singers stay engaged with real-time emoji reactions, soundboard effects, voting, audio cues, and interlude mini-games between songs.

### Story 4.1: Real-Time Emoji Reactions

As a participant,
I want to send emoji reactions during performances that appear on everyone's phones instantly,
So that I can express my excitement and feel connected to the room's energy.

**Acceptance Criteria:**

**Given** the DJ engine is in a state that allows reactions (song, ceremony reveal)
**When** a participant taps an emoji reaction
**Then** the reaction is broadcast to all connected phones within 100ms (NFR2)
**And** the reaction renders as a visual animation (emoji rain/burst) on all screens

**Given** reactions are being sent by multiple participants
**When** up to 12 participants send reactions at peak rate (2 taps/second)
**Then** the app maintains 60fps rendering and <100ms input response (NFR5)
**And** no reactions are dropped or delayed

**Given** a participant sends reactions rapidly
**When** they exceed 10 events in 5 seconds
**Then** each subsequent event earns 50% fewer participation points (NFR23)
**And** visual feedback dims proportionally
**And** after 20 events in 5 seconds, reward and feedback are near-zero
**And** the user can always tap — no hard block
**And** rate limiting resets after 5 seconds of inactivity

**Given** reactions are rendered over a 3-hour session
**When** client memory usage is measured
**Then** memory growth from reaction rendering does not exceed 10MB total (NFR28)
**And** old reaction animations are cleaned up and garbage collected

**Given** the reaction UI is displayed
**When** a participant taps
**Then** tap targets are at least 48x48px (NFR14)
**And** reactions require a single tap with no text input (NFR15)

### Story 4.2: Reaction Streaks & Milestones

As a participant,
I want to see streak milestones when I send consecutive reactions,
So that I feel rewarded for sustained engagement and motivated to keep the energy going.

**Acceptance Criteria:**

**Given** a participant sends consecutive reactions without a significant pause
**When** they reach streak milestones
**Then** the system displays streak indicators at 5, 10, 20, and 50 consecutive reactions (FR23)
**And** milestone feedback is shown only to the reacting user (not broadcast to all)

**Given** a streak is in progress
**When** the participant stops reacting for a defined pause threshold
**Then** the streak resets to zero
**And** the next reaction starts a new streak

**Given** streak milestones are displayed
**When** the milestone animation renders
**Then** it is visually distinct from regular reactions (larger, different animation)
**And** it does not block or interfere with continued reaction tapping

**Given** reaction streaks are tracked
**When** the data is queried
**Then** streak activity contributes to participation scoring (active tier: 3pts per milestone reached)

### Story 4.3: Soundboard Effects

As a participant,
I want to trigger sound effects from a soundboard that play through my phone speaker,
So that I can add hype, humor, and atmosphere to the room during performances.

**Acceptance Criteria:**

**Given** the DJ engine is in a state that allows soundboard use
**When** a participant taps a soundboard button
**Then** the selected sound plays audibly through their phone speaker within 50ms (NFR3)
**And** 4-6 distinct sound effects are available (e.g., air horn, crowd cheer, drumroll, sad trombone)

**Given** audio assets for the soundboard
**When** the app loads for the first time in a session
**Then** all soundboard audio is pre-loaded into Web Audio API buffers (NFR6)
**And** subsequent playback requires no network round-trip — instant from buffer

**Given** iOS Safari's AudioContext restriction
**When** the user has completed the icebreaker tap (Story 2.4)
**Then** the AudioContext is unlocked and soundboard effects play normally
**And** if the user joined after the icebreaker, a fallback "tap to unmute" interaction unlocks audio

**Given** a participant taps soundboard effects rapidly
**When** they exceed the rate limit (10 events in 5 seconds)
**Then** the same diminishing returns apply as reactions (NFR23)
**And** sounds still play but participation points and visual feedback diminish

**Given** soundboard buttons are displayed
**When** a participant views them
**Then** each button has a clear icon and text label (NFR16)
**And** tap targets are at least 48x48px (NFR14)

### Story 4.4: Audio System & DJ State Cues

As a participant,
I want to hear distinct audio cues for every DJ state transition and ceremony audio from the host's phone,
So that I know what's happening even when my phone is face-down — audio is the app's primary communication channel in passive mode.

**Acceptance Criteria:**

**Given** the DJ engine transitions between states
**When** a state change occurs
**Then** a unique audio cue plays on all participant phones (FR26)
**And** minimum 4 distinct sounds: song start, ceremony start, interlude start, party card deal (FR26)
**And** each cue is at least 0.5s duration (NFR18)
**And** cues are audible at phone speaker volume in a karaoke venue environment

**Given** a Full ceremony is in progress
**When** ceremony audio plays (fanfares, reveal sounds, drumroll)
**Then** the host's phone serves as the primary/dominant audio source (FR25)
**And** other participants' phones play the same audio at lower relative priority

**Given** all audio assets
**When** the session loads
**Then** all transition cues and ceremony audio are pre-loaded into Web Audio API buffers (NFR6)
**And** playback triggers within 50ms of the state transition event — no loading delay

**Given** iOS Safari's AudioContext behavior
**When** the phone screen locks or the app is backgrounded
**Then** audio may be suspended by the OS
**And** on return to the app, audio context resumes without user action where possible

**Given** the audio system is active over a 3-hour session
**When** memory is measured
**Then** audio buffers do not contribute to memory growth beyond initial load (NFR28)

### Story 4.5: Ceremony & Democratic Voting UI

As a participant,
I want a consistent, intuitive voting interface for both ceremony scoring and democratic group decisions,
So that I can quickly cast my vote without confusion regardless of what I'm voting on.

**Acceptance Criteria:**

**Given** a ceremony vote is triggered (Full or Quick)
**When** the voting UI appears
**Then** the interface clearly indicates what's being voted on (performer scoring)
**And** voting options are displayed (1-5 scale for Full, thumbs up/down for Quick)
**And** participants can vote in ceremony scoring (FR27)

**Given** a democratic vote is triggered
**When** the voting UI appears
**Then** the interface displays 2-3 activity options (FR13, FR27)
**And** each option has a clear label and icon
**And** the voting context is distinct from ceremony voting (different header/framing)

**Given** either type of vote is active
**When** a participant taps their choice
**Then** the vote registers with a single tap (NFR14)
**And** visual confirmation shows the vote was recorded
**And** the participant cannot change their vote after tapping

**Given** the voting UI renders
**When** displayed on any supported device
**Then** all elements are self-evident without instructions (NFR16)
**And** text meets WCAG AA contrast ratios (NFR17)
**And** all voting labels are from the centralized string constants module (NFR38)

### Story 4.6: Interlude Mini-Games

As a participant,
I want fun mini-games between songs,
So that there's never dead air and the group stays energized even when nobody's singing.

**Acceptance Criteria:**

**Given** the DJ engine reaches an interlude state
**When** a mini-game is selected
**Then** the system chooses from the library of 3 games via weighted random with no immediate repeats (FR28a)
**And** the selected game is broadcast to all participants

**Given** Kings Cup is selected
**When** the interlude begins
**Then** a group rule card is displayed to all participants (FR28b)
**And** the rule is clear and requires group participation
**And** the interlude has a defined duration before the DJ engine moves on

**Given** Dare Pull is selected
**When** the interlude begins
**Then** a random dare is assigned to a random participant (FR28b)
**And** the selected participant and dare are announced on all phones
**And** no consent flow is required — social dynamics handle opt-outs

**Given** Quick Vote is selected
**When** the interlude begins
**Then** a binary opinion poll is displayed to all participants (FR28b)
**And** participants vote with a single tap
**And** results are shown in real-time as votes come in

**Given** the party has fewer than 3 active participants
**When** an interlude would normally occur
**Then** group interludes are skipped (NFR12)
**And** the DJ engine advances to the next state in the cycle

**Given** interlude content is displayed
**When** participants view it
**Then** all game text, dares, and rules are sourced from the centralized string constants module (NFR38)
**And** content is self-evident without instructions (NFR16)

---

## Epic 5: Host Controls

Host manages the party from a floating overlay — skip, pause, override, kick, end party — without leaving the participant experience.

### Story 5.1: Host FAB & Control Overlay

As a host,
I want a persistent floating button that expands into a control panel,
So that I can manage the party instantly from any screen without navigating away from the action.

**Acceptance Criteria:**

**Given** the host is in any active party state (song, ceremony, interlude, etc.)
**When** the screen is displayed
**Then** a floating action button (FAB) is persistently visible in the bottom-right corner (FR29)
**And** the FAB does not obscure critical participant content (reactions, voting)
**And** the FAB is visually distinct as a host-only element

**Given** the host taps the FAB
**When** the overlay opens
**Then** the control overlay appears within 1 tap — no navigation required (FR29, NFR19)
**And** the overlay expands over the current screen without replacing it
**And** the host can still see the participant experience behind the overlay

**Given** the control overlay is open
**When** the host taps outside the overlay or taps a close button
**Then** the overlay dismisses and the host returns to the full participant view
**And** the FAB remains visible

**Given** the host is participating (sending reactions, voting)
**When** the FAB is visible
**Then** it does not interfere with single-tap participant interactions
**And** the FAB tap target is at least 48x48px (NFR14)
**And** accidental FAB triggers during reaction tapping are minimized by positioning

**Given** the control overlay is displayed
**When** any host views it
**Then** all controls are self-evident without instructions (NFR16)
**And** all control labels are sourced from the centralized string constants module (NFR38)

### Story 5.2: Party Flow Controls

As a host,
I want to skip, pause, resume, and override the DJ engine,
So that I can adjust the party flow when something isn't working or the group needs a change.

**Acceptance Criteria:**

**Given** the control overlay is open
**When** the host taps "Skip"
**Then** the current activity is skipped and the DJ engine advances to the next state (FR30)
**And** the skip is broadcast to all participants within 200ms (NFR1)
**And** the skip is logged in the event stream (FR42 from Epic 2)

**Given** the control overlay is open
**When** the host taps "Pause"
**Then** the DJ engine enters the pause state (FR31)
**And** all participants see a paused indicator
**And** this uses the same pause mechanism from Story 2.6

**Given** the DJ engine is paused
**When** the host taps "Resume"
**Then** the DJ engine resumes from where it paused (FR31)
**And** resume follows the same rules as Story 2.6 (correct next state based on pause context)

**Given** the control overlay is open
**When** the host taps "Override Next"
**Then** a selection appears showing available next activities (FR32)
**And** the host can choose the next activity instead of the DJ engine's automatic selection
**And** the override is logged in the event stream

**Given** the host uses any flow control
**When** the action is executed
**Then** all controls require a single tap (NFR14)
**And** destructive actions (skip, override) are clearly labeled to prevent accidental use

### Story 5.3: Party Management Controls

As a host,
I want to manage players and end the party from the control overlay,
So that I can handle disruptions and wrap up the night without leaving the participant experience.

**Acceptance Criteria:**

**Given** the control overlay is open
**When** the host accesses player management
**Then** a list of connected participants is displayed (FR33)
**And** the host can kick a player by tapping next to their name
**And** kicked players are disconnected and cannot rejoin with the same session token

**Given** the host kicks a player
**When** the kick is executed
**Then** the kicked participant sees a clear message (not a technical error)
**And** the player list updates on all phones
**And** the kick is logged in the event stream

**Given** the control overlay is open
**When** the host taps "End Party"
**Then** a confirmation prompt appears (irreversible action)
**And** upon confirmation, the DJ engine transitions to the finale/end state
**And** all participants are notified the party is ending

**Given** the control overlay provides queue management (FR33)
**When** the host views the queue
**Then** the upcoming activity sequence is visible
**And** the host can reorder or remove queued activities

**Given** all host controls are accessible from the overlay (FR33)
**When** the host needs skip, pause, queue, kick, or end party
**Then** all are available without navigating away from the participant view
**And** the host can access any control within 1 second from any screen state (NFR19)

---

## Epic 6: Connection Resilience

Seamless reconnection and host failover ensure the party never breaks, even on unreliable venue WiFi.

### Story 6.1: Three-Tier Reconnection Protocol

As a participant,
I want the app to automatically reconnect me if my connection drops,
So that I don't have to manually rejoin or miss any of the party.

**Acceptance Criteria:**

**Given** a participant's WebSocket connection drops
**When** the disconnection is detected
**Then** the system automatically begins reconnection attempts (FR47)
**And** reconnection uses a three-tier strategy:
- Tier 1 (0-10s): Aggressive retry every 1-2 seconds (likely transient WiFi blip)
- Tier 2 (10s-60s): Moderate retry every 5 seconds (possible network switch)
- Tier 3 (60s-5min): Slow retry every 15 seconds (extended outage)
**And** no user action is required to trigger reconnection

**Given** the reconnection window
**When** 5 minutes elapse without successful reconnection
**Then** the reconnection attempts stop
**And** the participant sees a clear message prompting manual rejoin
**And** their session data is preserved server-side for potential manual rejoin

**Given** reconnection succeeds at any tier
**When** the WebSocket connection is re-established
**Then** the participant's guest session token is revalidated
**And** the client syncs to the current DJ state within 2 seconds (FR47)

**Given** the server tracks connected participants
**When** a participant disconnects
**Then** the participant is marked as "disconnecting" (not immediately removed)
**And** they remain in the participant list during the 5-minute reconnection window
**And** they are only removed from the list after the window expires

### Story 6.2: Brief Disconnection — Invisible Recovery

As a participant,
I want brief network interruptions to be completely invisible,
So that a WiFi blip doesn't interrupt my experience with error screens or loading spinners.

**Acceptance Criteria:**

**Given** a participant's connection drops for less than 5 seconds
**When** the connection is re-established
**Then** the recovery completes without showing an error state, loading spinner, or page reload (NFR9)
**And** the participant's view resumes at the current DJ state seamlessly

**Given** a brief disconnection occurs during an active interaction (voting, reacting)
**When** the connection recovers
**Then** any pending actions (votes, reactions) sent during the gap are delivered if still valid
**And** expired actions (vote after window closed) are silently discarded

**Given** a brief disconnection occurs
**When** the UI is updated during recovery
**Then** there is no visible flicker, state reset, or re-render of the current screen
**And** the connection status indicator may briefly show a subtle warning but no modal or blocking UI

**Given** brief disconnections happen repeatedly (unstable WiFi)
**When** each recovery completes
**Then** the experience remains stable — no cumulative state drift or memory growth
**And** the event stream logs each disconnect/reconnect pair for debugging

### Story 6.3: State Sync on Reconnection

As a participant,
I want to see exactly what's happening right now when I reconnect after a longer drop,
So that I'm back in the action immediately without confusion about what I missed.

**Acceptance Criteria:**

**Given** a participant reconnects after a disconnection longer than 5 seconds
**When** the WebSocket connection is re-established
**Then** the server sends the current DJ state and the participant's client renders it immediately
**And** sync completes within 2 seconds of reconnection (FR47)

**Given** the server maintains per-client event buffer cursors
**When** a participant reconnects
**Then** the server determines what events the client missed since disconnection
**And** sends a compressed state snapshot (current state + key context) rather than replaying all missed events
**And** the client transitions directly to the current state

**Given** the DJ engine advanced through multiple states during disconnection
**When** the participant reconnects
**Then** they see the current state — not a replay of missed states
**And** if they missed a ceremony reveal, the moment card is still accessible in session history

**Given** session state is fully server-authoritative (NFR10)
**When** a client reconnects
**Then** no client-side state from before the disconnection is trusted
**And** the server's state snapshot is the single source of truth

### Story 6.4: Score & History Preservation

As a participant,
I want my participation score and session history to survive disconnections,
So that a bad WiFi moment doesn't erase my contributions to the party.

**Acceptance Criteria:**

**Given** a participant has accumulated participation scores
**When** they disconnect
**Then** their scores are preserved server-side (FR48)
**And** scores are not decremented or reset due to disconnection

**Given** a participant reconnects after a disconnection
**When** their session is restored
**Then** their participation score is intact and reflects all pre-disconnection activity
**And** the score continues accumulating from where it left off

**Given** a participant was involved in session history (sang songs, received awards)
**When** they disconnect and reconnect
**Then** their session history is fully preserved (FR48)
**And** ceremony awards, song participation records, and party card completions remain attributed to them

**Given** a participant disconnects during a ceremony vote
**When** the vote completes while they are disconnected
**Then** their already-submitted vote (if any) is counted
**And** if they hadn't voted, the ceremony proceeds without their vote
**And** their score for that ceremony reflects their actual participation

### Story 6.5: Host Failover

As a participant,
I want the party to continue seamlessly if the host's phone disconnects,
So that one person's WiFi problem doesn't kill the party for everyone.

**Acceptance Criteria:**

**Given** the host's WebSocket connection drops
**When** the DJ engine detects the host is disconnected
**Then** the DJ engine continues operating normally — no interruption (FR49, NFR8)
**And** all non-host participants continue their experience without change

**Given** the host has been disconnected for 60 seconds
**When** the failover timer expires
**Then** host controls automatically transfer to the next-longest-connected participant (FR49)
**And** the new host receives the FAB and control overlay (from Epic 5)
**And** all participants are notified of the host transfer with a non-blocking message

**Given** the original host reconnects after failover
**When** their connection is re-established
**Then** they rejoin as a regular participant (not automatically re-promoted to host)
**And** the current host can manually transfer host controls back if desired

**Given** the host disconnects for less than 60 seconds
**When** they reconnect within the failover window
**Then** they retain host status — no failover occurs
**And** the reconnection is handled by the three-tier protocol (Story 6.1)

**Given** all participants including the host disconnect simultaneously
**When** the server detects an empty session
**Then** the DJ engine pauses
**And** the session remains active for the 5-minute reconnection window
**And** the first participant to reconnect becomes the host if the original host doesn't return

---

## Epic 7: Party Cards

Challenge cards add variety to performances — vocal modifiers, performance challenges, and group involvement cards that pull audience members into the action.

### Story 7.1: Party Card Pool & Data Model

As a system,
I want a curated pool of 19 party cards organized by type,
So that the DJ engine can deal varied, entertaining challenges to singers.

**Acceptance Criteria:**

**Given** the party card system is initialized
**When** the card pool is loaded
**Then** it contains exactly 19 cards across three types (FR55):
- 7 vocal modifier cards (FR56)
- 7 performance modifier cards (FR57)
- 5 group involvement cards (FR58)

**Given** vocal modifier cards exist
**When** the pool is queried for vocal modifiers
**Then** the following cards are available (FR56): Chipmunk Mode, Barry White, The Whisperer, Robot Mode, Opera Singer, Accent Roulette, Beatboxer
**And** each card has a title, description, and type identifier

**Given** performance modifier cards exist
**When** the pool is queried for performance modifiers
**Then** the following cards are available (FR57): Blind Karaoke, Method Actor, The Statue, Slow Motion, The Drunk Uncle, News Anchor, Interpretive Dance

**Given** group involvement cards exist
**When** the pool is queried for group involvement cards
**Then** the following cards are available (FR58): Name That Tune, Backup Dancers, Crowd Conductor, Tag Team, Hype Squad

**Given** all card content
**When** card text is displayed
**Then** titles and descriptions are sourced from the centralized string constants module (NFR38)
**And** each card's description clearly explains the challenge in one sentence

### Story 7.2: Card Deal Flow

As a singer,
I want to receive a random challenge card before my song,
So that each performance has a unique twist that adds fun and unpredictability.

**Acceptance Criteria:**

**Given** the DJ engine enters the party_card_deal state (pre-song)
**When** the next singer is identified
**Then** a random party card is dealt from the pool to that singer (FR54)
**And** the dealt card is displayed on the singer's phone
**And** all other participants see that a card has been dealt (card type visible, not full details until accepted)

**Given** the auto-deal is active (default behavior)
**When** a card is dealt
**Then** the selection is random from the full pool of 19 cards
**And** the system avoids dealing the same card twice in a row within a session where possible

**Given** the host wants to control card dealing
**When** the host accesses the control overlay (from Epic 5)
**Then** the host can override the dealt card with a specific selection (FR54)
**Or** the host can disable card dealing for the current turn (FR54)
**And** the override/disable is logged in the event stream

**Given** the card deal screen is displayed
**When** the singer views it
**Then** the card is presented with clear visual design — title, type badge, and challenge description
**And** the interaction is self-evident without instructions (NFR16)

### Story 7.3: Accept, Dismiss & Redraw

As a singer,
I want to accept, dismiss, or redraw my dealt card with a single tap,
So that I have agency over my challenge without slowing down the party.

**Acceptance Criteria:**

**Given** a party card has been dealt to the singer
**When** the singer views the card
**Then** two options are presented: Accept and Dismiss (FR59)
**And** both are single-tap interactions on targets at least 48x48px (NFR14)

**Given** the singer taps Accept
**When** the acceptance is confirmed
**Then** the card challenge is active for the upcoming song
**And** all participants are notified of the accepted challenge
**And** the card acceptance is logged in the event stream

**Given** the singer taps Dismiss
**When** the dismissal is confirmed
**Then** the card is discarded and no challenge is active for the upcoming song
**And** the DJ engine proceeds to the song state

**Given** the singer has not yet used their free redraw this turn
**When** they tap Redraw (instead of Accept/Dismiss)
**Then** a new random card is dealt from the pool (FR59)
**And** the redraw count increments — one free redraw per turn
**And** after the redraw, only Accept or Dismiss are available (no second redraw)

**Given** the singer has already used their free redraw
**When** they view the redrawn card
**Then** the Redraw option is no longer available
**And** they must Accept or Dismiss the current card

### Story 7.4: Group Involvement Cards

As a participant,
I want group involvement cards to pull random audience members into the action,
So that the party feels inclusive and surprises keep everyone on their toes.

**Acceptance Criteria:**

**Given** a group involvement card is accepted (Tag Team, Backup Dancers, Hype Squad, Crowd Conductor, Name That Tune)
**When** the card activates
**Then** the system selects random participants as required by the card (FR60):
- Backup Dancers: singer picks 2 people
- Tag Team: app picks 1 random participant to take over at chorus
- Hype Squad: app assigns 2 audience members
- Crowd Conductor: singer directs group during chorus
- Name That Tune: entire group participates
**And** the selection is announced on all phones simultaneously (FR60)

**Given** random participants are selected
**When** the announcement is displayed
**Then** the selected participants' names are prominently shown
**And** no consent flow is required — social dynamics handle opt-outs (FR60)
**And** the announcement is clear about what the selected participants should do

**Given** a group involvement card requires participants
**When** fewer than the required number of non-singer participants are connected
**Then** the system selects from all available participants
**Or** if impossible (e.g., Backup Dancers with only 1 other participant), the card gracefully adapts its description

**Given** group involvement cards are displayed
**When** participants view them
**Then** all text is sourced from the centralized string constants module (NFR38)

### Story 7.5: Card Tracking & Scoring

As a system,
I want to track party card acceptance rates and challenge completion,
So that card engagement feeds into participation scores and ceremony awards.

**Acceptance Criteria:**

**Given** party cards are dealt during a session
**When** a card is accepted, dismissed, or redrawn
**Then** the system tracks per-session: total cards dealt, acceptance rate, redraw rate, dismissal rate (FR61)
**And** tracking data is stored in the event stream

**Given** a singer accepts and completes a party card challenge
**When** the song ends and ceremony begins
**Then** the completed challenge contributes to ceremony awards (FR62)
**And** the singer receives engaged-tier participation points (5 pts) for completing the challenge (FR62)

**Given** party card stats are tracked
**When** session data is queried
**Then** per-participant card stats are available: cards dealt, accepted, completed
**And** this data is available for downstream consumption by end-of-night awards and session summary persistence

**Given** a card is accepted but the challenge is subjective (e.g., "sing in deepest voice")
**When** the song completes
**Then** challenge completion is assumed if the card was accepted — no verification mechanism required at MVP
**And** the participation points are awarded on acceptance + song completion

---

## Epic 8: Audience Modes

Lightstick mode and hype signal let the audience create atmosphere during songs — full-screen glow effects, color picking, and camera flash encouragement.

### Story 8.1: Mode Toggle & Lean-In Mode

As an audience participant,
I want to switch between lean-in mode and lightstick mode during songs,
So that I can choose how I engage — active reactions or ambient atmosphere.

**Acceptance Criteria:**

**Given** the DJ engine is in the song state
**When** an audience participant views their screen
**Then** the default mode is lean-in mode (reactions and soundboard from Epic 4) (FR63)
**And** a clearly labeled toggle is visible to switch to lightstick mode

**Given** the participant is in lean-in mode
**When** they tap the mode toggle
**Then** the screen transitions to lightstick mode (FR63)
**And** the transition is smooth — no page reload or jarring screen replacement

**Given** the participant is in lightstick mode
**When** they tap the mode toggle
**Then** the screen returns to lean-in mode with reactions and soundboard available
**And** switching is free and unlimited during a song (FR66)

**Given** the participant is in either mode
**When** the DJ engine transitions out of song state (ceremony, interlude, etc.)
**Then** the mode toggle disappears and the participant sees the appropriate next state screen
**And** mode preference is not persisted — each song starts in lean-in mode by default

**Given** the mode toggle is displayed
**When** the participant interacts with it
**Then** the toggle target is at least 48x48px (NFR14)
**And** the toggle is self-evident without instructions (NFR16)

### Story 8.2: Lightstick Mode

As an audience participant,
I want my phone screen to become a glowing visual prop with color selection,
So that the room fills with light and the performer sees a sea of glowing phones.

**Acceptance Criteria:**

**Given** the participant switches to lightstick mode
**When** the mode activates
**Then** the screen renders a full-screen animated glow effect (FR64)
**And** the glow animation is smooth and visually appealing — not a static color fill

**Given** lightstick mode is active
**When** the participant wants to change color
**Then** a color picker is accessible (FR64)
**And** color selection requires a single tap on clearly visible color options
**And** the glow effect updates immediately to the selected color

**Given** lightstick mode is active
**When** the participant is waving their phone
**Then** the animation continues smoothly without frame drops
**And** the glow is free-form — no synchronization required between devices (FR64)

**Given** lightstick mode is active
**When** the participant wants to send a reaction
**Then** reactions are still available alongside lightstick mode (FR66)
**And** a small reaction trigger is accessible without leaving lightstick mode

**Given** lightstick mode renders on screen
**When** the animation is running
**Then** the glow uses GPU-accelerated CSS/canvas rendering
**And** the implementation avoids JavaScript-driven animation loops where possible

### Story 8.3: Camera Flash Hype Signal

As an audience participant,
I want to activate a camera flash or screen pulse as a hype signal to the performer,
So that I can show real-time encouragement that the singer can see and feel from across the room.

**Acceptance Criteria:**

**Given** the DJ engine is in the song state
**When** an audience participant taps the hype signal button
**Then** a screen-based pulse effect fires — a bright flash or strobe on their phone screen (FR65)
**And** on devices that support the Torch API (Chrome Android), the device flashlight also activates briefly
**And** on iOS Safari where Torch API is unavailable, only the screen pulse fires

**Given** the hype signal is activated
**When** the effect plays
**Then** the pulse is brief (200-500ms) — visible but not sustained
**And** a cooldown prevents rapid repeated activation (e.g., 2-second minimum between signals)

**Given** the hype signal is available
**When** the participant is in lean-in mode or lightstick mode
**Then** the hype signal button is accessible in both modes (FR66)
**And** it does not interfere with reactions, soundboard, or lightstick glow

**Given** the hype signal button is displayed
**When** the participant taps it
**Then** the tap target is at least 48x48px (NFR14)
**And** the button is visually distinct from reaction and soundboard controls

### Story 8.4: Audience Mode Performance Validation

As a system,
I want audience modes to run smoothly on budget Android devices,
So that the lightstick glow and hype signal don't drain batteries or cause frame drops on the most common phones in Vietnam.

**Acceptance Criteria:**

**Given** lightstick mode is active on a budget Android device (Galaxy A series, 3GB RAM)
**When** the glow animation runs continuously during a song (3-5 minutes)
**Then** the animation maintains 60fps throughout (NFR5)
**And** no visible frame drops, stuttering, or jank

**Given** lightstick mode runs over a full session
**When** client memory is measured after 3 hours of intermittent use
**Then** lightstick mode contributes no more than 2MB to total memory growth (within NFR28's 10MB budget)
**And** animation resources are properly cleaned up when switching modes

**Given** the hype signal uses the device flashlight (Torch API)
**When** activated repeatedly over a session
**Then** battery impact is minimal due to the brief activation duration and cooldown
**And** the flashlight deactivates reliably after each pulse

**Given** lightstick glow and reactions run simultaneously
**When** a participant is in lightstick mode and sends reactions
**Then** both render without competing for GPU resources
**And** 60fps is maintained for the combined rendering load on budget devices

**Given** reduced motion is preferred by the user (OS accessibility setting)
**When** lightstick mode activates
**Then** the glow animation is simplified or static to respect the preference
**And** the hype signal uses a simple color change instead of a strobe effect

---

## Epic 9: Media Capture

Participants capture photos, video, and audio at key moments — prompted by floating bubbles at reaction peaks and ceremonies, or triggered manually anytime.

### Story 9.1: Floating Capture Bubble

As a participant,
I want a floating bubble to appear at key moments prompting me to capture the moment,
So that I'm reminded to take photos and videos without having to think about it.

**Acceptance Criteria:**

**Given** the party is in progress
**When** a key moment occurs
**Then** a floating capture bubble appears on all participant phones at 4 defined trigger points (FR67, FR38):
- Session start
- Reaction peaks (auto-detected, see Story 9.5)
- Post-ceremony pause (after award reveal)
- Session end

**Given** the capture bubble appears
**When** the participant is not interested
**Then** the bubble is dismissable by simply ignoring it — no tap required to dismiss (FR67)
**And** the bubble auto-hides after a timeout (e.g., 10 seconds)
**And** it does not interrupt or overlay critical interaction areas (voting, reactions)

**Given** the capture bubble appears
**When** the participant views it
**Then** the bubble is visually inviting but non-intrusive
**And** it is clearly a capture prompt (camera icon or similar)
**And** it requires a single tap to pop/activate (FR68)

**Given** the capture bubble is displayed
**When** the participant is in any DJ state
**Then** the bubble does not block the current activity
**And** the party experience continues normally whether or not the bubble is interacted with

### Story 9.2: Pop-to-Capture Flow

As a participant,
I want to quickly capture a photo, short video, or audio snippet when I pop the bubble,
So that I can preserve the moment with minimal friction and get back to the party.

**Acceptance Criteria:**

**Given** the participant pops the capture bubble (single tap)
**When** the capture interface opens
**Then** three capture options are presented: photo, video (5s max), audio snippet (FR68)
**And** each option requires one tap to start capture

**Given** the participant selects photo capture
**When** on a browser that supports getUserMedia
**Then** the photo is captured inline without navigating away from the app (FR69)
**And** a preview is briefly shown before auto-confirming

**Given** the participant selects video capture
**When** on a browser that supports MediaRecorder API (Chrome Android)
**Then** video recording starts inline with a 5-second maximum duration (FR68)
**And** recording stops automatically at 5 seconds or when the participant taps stop

**Given** the participant selects video or audio capture
**When** on iOS Safari or a browser without inline MediaRecorder support
**Then** photo capture remains inline (FR69)
**And** video and audio fall back to the device-native capture picker (FR69)
**And** capture completes without navigating away from the app in all cases

**Given** the capture flow is active
**When** the participant interacts with it
**Then** the entire flow is completable in 2-3 taps maximum (pop bubble → select type → capture)
**And** all controls are at least 48x48px (NFR14)
**And** the flow is self-evident without instructions (NFR16)

### Story 9.3: Media Tagging & Background Upload

As a system,
I want captured media to be tagged with context and uploaded in the background,
So that captures are organized for future highlight reels and never block the party experience.

**Acceptance Criteria:**

**Given** a media capture completes (photo, video, or audio)
**When** the capture is processed
**Then** the media is tagged with (FR70):
- Session ID
- Timestamp
- Capture trigger type (peak, ceremony, manual, session_start, session_end)
- Current DJ state at time of capture

**Given** a capture is tagged
**When** the upload begins
**Then** the upload is queued and sent in the background (FR71)
**And** capture never blocks the party experience — the participant returns to the party immediately

**Given** an upload fails (network issue)
**When** the failure is detected
**Then** the failed upload is queued for automatic retry on next stable connection (FR71)
**And** no error is shown to the participant unless all retries fail

**Given** multiple captures occur in quick succession
**When** the upload queue has multiple items
**Then** uploads are processed sequentially to avoid bandwidth saturation
**And** the queue persists in memory — uploads complete even if the participant navigates between DJ states

**Given** uploads are running in the background
**When** client memory is measured
**Then** queued media does not contribute to excessive memory growth (NFR28)
**And** completed uploads are released from memory promptly

### Story 9.4: Server-Side Media Storage

As a participant,
I want all captured media stored and accessible to everyone in my party after the session,
So that the group can relive the night together through photos, videos, and audio clips.

**Acceptance Criteria:**

**Given** a media upload is received by the server
**When** the upload completes
**Then** the media is stored in Firebase Storage organized by session ID (FR72)
**And** metadata (tags from Story 9.3) is recorded for future retrieval

**Given** a party session has ended
**When** any participant from that session requests the media
**Then** all captured media from the session is accessible to all session participants (FR72)
**And** media is retrievable by session ID

**Given** media is stored in Firebase Storage
**When** storage is organized
**Then** files follow a consistent path structure: `sessions/{sessionId}/media/{captureId}.{ext}`
**And** metadata is queryable by session ID, trigger type, and timestamp

**Given** the storage system
**When** media is uploaded
**Then** the upload uses Firebase Storage client SDK for direct client-to-storage upload
**And** the server records the metadata reference without proxying the file bytes

### Story 9.5: Reaction Peak Detection & Auto-Trigger

As a system,
I want to detect when the room's reaction rate spikes above baseline,
So that capture bubbles automatically appear during the most exciting moments.

**Acceptance Criteria:**

**Given** the party is in a state that allows reactions (song, ceremony)
**When** the server monitors reaction event rates
**Then** peak detection runs server-side to ensure consistent triggering across all devices (FR73)

**Given** the reaction rate spikes above a baseline threshold
**When** the spike is sustained (not a single burst from one user)
**Then** the server triggers a capture bubble event to all connected phones (FR73)
**And** the bubble appears on all phones simultaneously

**Given** peak detection is running
**When** the baseline is calculated
**Then** the baseline adapts to the session's typical reaction rate (not a fixed absolute threshold)
**And** a spike is defined as a sustained rate above the baseline for a defined window (e.g., 3+ seconds)

**Given** a peak is detected
**When** the capture bubble is triggered
**Then** a cooldown period prevents repeated peak triggers in quick succession (e.g., minimum 60 seconds between peak triggers)
**And** the peak event is logged in the event stream with the reaction rate data

**Given** peak detection runs on the server
**When** processing reaction events
**Then** the detection logic adds no perceptible latency to reaction delivery (NFR26 — <5ms)

### Story 9.6: Manual Capture

As a participant,
I want to take a photo, video, or audio clip at any time during the party,
So that I can capture moments that matter to me — not just the system-prompted ones.

**Acceptance Criteria:**

**Given** the party is in any active state
**When** the participant views their screen
**Then** a persistent capture icon is visible in the participant toolbar (FR39)
**And** the icon is always accessible regardless of current DJ state

**Given** the participant taps the capture icon
**When** the capture interface opens
**Then** the same capture flow from Story 9.2 is presented (photo/video/audio)
**And** the capture is independent of the bubble prompt system (FR39)

**Given** a manual capture completes
**When** the media is tagged
**Then** the trigger type is set to "manual" (FR70)
**And** all other tagging (session ID, timestamp, DJ state) follows Story 9.3

**Given** the capture icon is displayed
**When** the participant is in any mode (lean-in, lightstick, ceremony, interlude)
**Then** the icon remains accessible and does not conflict with mode-specific controls
**And** the icon tap target is at least 48x48px (NFR14)

---

## Epic 10: Memory & Sharing

The party becomes shareable — moment cards become sharable artifacts, setlist poster, end-of-night awards, a dramatic finale sequence, and post-session feedback. The viral flywheel.

### Story 10.1: Share-Ready Moment Cards

As a participant,
I want to share ceremony moment cards to my social media with two taps,
So that my friends see my award and want to try Karamania at their next karaoke night.

**Acceptance Criteria:**

**Given** a Full ceremony has completed and a moment card was generated (FR18c from Epic 3)
**When** the moment card is prepared for sharing
**Then** the card is rendered at 9:16 Instagram Story dimensions (FR34)
**And** the Karamania brand is visible but not dominant
**And** the card contains: performer name, song title (if available), award title, and crowd score

**Given** a moment card is rendered
**When** display names or song titles are long
**Then** defensive rendering handles: text truncation, dynamic font scaling, overflow protection
**And** the card remains share-worthy across all device sizes

**Given** the moment card is displayed
**When** the participant taps "Share"
**Then** the native mobile share sheet opens within one tap (FR35)
**And** the total flow is: moment card appears → one tap → native share sheet (2 taps maximum)
**And** no cropping, editing, or save-then-share step is required

**Given** the share sheet opens
**When** the participant selects a sharing target (Instagram Stories, Zalo, Messages, etc.)
**Then** the pre-rendered 9:16 image is shared directly
**And** the share intent tap is logged as a viral signal metric (FR44)

**Given** the moment card is displayed
**When** the participant does not want to share
**Then** dismissing is easy — tap anywhere else or wait for auto-advance
**And** no sharing is forced

### Story 10.2: End-of-Night Awards

As a participant,
I want fun awards at the end of the night that recognize all types of participation,
So that non-singers feel celebrated too and everyone has a memorable takeaway.

**Acceptance Criteria:**

**Given** the party is ending
**When** the award generation runs
**Then** the system generates end-of-night awards recognizing both singing and non-singing contributions (FR41)
**And** awards are computed from participation scores (Epic 3 Story 3.7), ceremony results, reaction data, and party card stats

**Given** awards are generated
**When** the categories are determined
**Then** awards include categories like: top performer (highest ceremony score), hype machine (most reactions), party card champion (most cards completed), crowd favorite, most engaged
**And** every participant who stayed for a meaningful portion of the session receives at least one award

**Given** award titles are generated
**When** displayed to participants
**Then** titles use the same tone and humor as ceremony awards (from Story 3.3)
**And** all award text is sourced from the centralized string constants module (NFR38)

**Given** a top 3 ranking exists
**When** awards are presented
**Then** the top 3 awards are flagged for the finale reveal sequence (Story 10.4)

### Story 10.3: Setlist Poster Generation & Sharing

As a participant,
I want a beautiful setlist poster showing everything we sang tonight,
So that I have a keepsake of the night and something worth sharing with friends who weren't there.

**Acceptance Criteria:**

**Given** the party has ended
**When** the setlist poster is generated
**Then** it contains: all songs performed, performer names, date, and awards (FR36)
**And** songs are listed in performance order

**Given** the setlist poster is rendered
**When** the layout is created
**Then** it uses 9:16 Instagram Story dimensions
**And** the Karamania brand is visible but subtle
**And** defensive rendering handles long song lists, long names, and varying session lengths

**Given** the setlist poster is displayed
**When** the participant taps "Share"
**Then** the native mobile share sheet opens (FR37)
**And** the flow is 2 taps maximum from poster display to shared
**And** the share intent tap is logged (FR44)

**Given** the setlist poster is generated
**When** the session had many songs (10+)
**Then** the poster layout adapts — smaller font, compact spacing, or pagination
**And** the poster remains readable and visually appealing

### Story 10.4: Finale Sequence

As a participant,
I want a dramatic end-of-night sequence that wraps up the party with flair,
So that the night ends on a high note with shared memories and a sense of closure.

**Acceptance Criteria:**

**Given** the host triggers "End Party" (from Epic 5) or the party reaches a natural end
**When** the finale sequence begins
**Then** it executes 4 steps in order (FR52):
1. Top 3 awards reveal with animation
2. Session stats summary (songs sung, total reactions, participation highlights)
3. Setlist poster with share prompt
4. One-tap post-session feedback ("Would you use again?" 1-5 scale)

**Given** the top 3 awards reveal (step 1)
**When** the awards are displayed
**Then** each award reveals with animation — building from #3 to #1
**And** the reveal uses server-coordinated timing for synchronized display across all phones (NFR27)
**And** the anticipation pattern from ceremony reveals applies (brief pause before each reveal)

**Given** the session stats summary (step 2)
**When** stats are displayed
**Then** the summary shows: total songs, total reactions sent, total participation score, number of ceremonies
**And** the display is glanceable — key numbers with visual emphasis

**Given** the setlist poster (step 3)
**When** displayed during the finale
**Then** it uses the poster from Story 10.3
**And** a share prompt is prominently displayed

**Given** the post-session feedback (step 4)
**When** the prompt appears
**Then** "Would you use Karamania next time?" is displayed with a 1-5 scale (FR43)
**And** the response requires a single tap (NFR14)
**And** the feedback is stored for the North Star metric

**Given** the complete finale sequence
**When** measured end-to-end
**Then** total duration is 60-90 seconds (FR52)
**And** each step auto-advances after a defined duration
**And** participants can tap to advance to the next step early

### Story 10.5: Share Intent Tracking & Post-Session Feedback

As a system,
I want to track every share tap and collect post-session feedback,
So that we measure viral potential and the North Star metric for product-market fit.

**Acceptance Criteria:**

**Given** a participant taps a share button (moment card, setlist poster, or any shareable artifact)
**When** the native share sheet opens
**Then** the share intent tap is logged in the event stream (FR44)
**And** the log captures: artifact type (moment card vs setlist), participant ID, timestamp

**Given** share intent tracking
**When** session data is analyzed
**Then** the total share intent count per session is available
**And** the PRD success gate of >1 share intent per session can be measured

**Given** the post-session feedback prompt (from Story 10.4 step 4)
**When** a participant responds with a 1-5 rating
**Then** the rating is stored associated with the session and participant (FR43)
**And** the aggregate score per session can be computed for the North Star metric (>80% "Would use again")

**Given** the feedback prompt
**When** a participant does not respond (ignores or app closes)
**Then** no response is recorded — no default value assumed
**And** the prompt does not block the participant from leaving

**Given** all tracking data
**When** the session ends
**Then** share intent counts and feedback scores are available in the session event stream
**And** data is available for Epic 12's session summary persistence

---

## Epic 11: Song Discovery & Integration

Smart song suggestions powered by friends' playlists and YouTube TV integration — Quick Pick voting, Spin the Wheel, karaoke catalog matching, and suggestion-only fallback for any venue.

### Story 11.1: YouTube TV Pairing

As a host,
I want to pair the app with the YouTube TV at the karaoke venue,
So that the app can detect what's playing and push songs to the TV queue automatically.

**Acceptance Criteria:**

**Given** the host is creating or managing a party
**When** they choose to pair with a TV
**Then** a TV pairing screen prompts them to enter the pairing code displayed on the TV screen (FR74)
**And** TV pairing is optional — the host can skip it at party creation (FR95)
**And** the host can add the TV connection later during an active session (FR95)

**Given** the host enters a valid TV pairing code
**When** the pairing is submitted
**Then** the server establishes a connection to the YouTube TV session via the Lounge API (FR75)
**And** the connection is persistent and bidirectional throughout the party

**Given** the Lounge API connection is established
**When** the party is in progress
**Then** the system maintains the session throughout the party (FR79)
**And** if the connection drops, automatic reconnection is attempted for up to 60 seconds (FR79)
**And** if reconnection fails after 60 seconds, the host is prompted to re-enter the TV code

**Given** the Lounge API is unofficial and could break
**When** the connection fails or becomes unavailable
**Then** the system degrades gracefully to suggestion-only mode (NFR31)
**And** no crash, session state loss, or party interruption occurs
**And** the host sees a single non-blocking notification

### Story 11.2: Passive Song Detection & Metadata

As a system,
I want to detect every song played on the YouTube TV and resolve it to structured metadata,
So that the DJ engine knows what's playing for challenges, ceremonies, and genre-based mechanics.

**Acceptance Criteria:**

**Given** the YouTube TV is paired and playing
**When** a new video starts playing
**Then** the system receives a real-time nowPlaying event containing the current video_id (FR75)

**Given** a video_id is received
**When** the system resolves it
**Then** structured song metadata is returned: {title, artist, channel, thumbnail} (FR76)
**And** resolution completes within 5 seconds of song start (FR76)
**And** resolution uses the YouTube Data API v3

**Given** the video is a karaoke video
**When** the title is parsed
**Then** the system extracts structured {song, artist} data from common karaoke title formats (FR77)
**And** examples: "Song Title - Artist (Karaoke Version)", "Artist - Song Title | Karaoke", etc.
**And** parsing handles variations gracefully — partial matches are acceptable over no match

**Given** YouTube Data API v3 usage
**When** video metadata lookups are made
**Then** lookups are batched efficiently (NFR30)
**And** a typical party session consumes fewer than 500 quota units (NFR30)
**And** total daily usage stays within the 10,000 unit free tier

### Story 11.3: Song Queue Push to TV

As a participant,
I want selected songs to automatically queue on the YouTube TV,
So that nobody has to manually type song names into the karaoke machine.

**Acceptance Criteria:**

**Given** a song is selected via Quick Pick or Spin the Wheel (Stories 11.9, 11.10)
**When** the selection is confirmed
**Then** the system pushes the song to the YouTube TV queue via the Lounge API addVideo command (FR78)
**And** the selected song's karaoke video_id (from the Karaoke Catalog Index) is used

**Given** the push command is sent
**When** the TV receives it
**Then** the song appears in the TV's up-next queue
**And** no manual karaoke machine input is required

**Given** the Lounge API push fails
**When** the failure is detected
**Then** the system retries once
**And** if retry fails, the song title and artist are displayed prominently for manual entry (fallback to FR93 behavior)
**And** no error disrupts the party experience

### Story 11.4: YouTube Music Playlist Import

As a participant,
I want to paste my YouTube Music playlist link so the app knows what songs my group likes,
So that song suggestions are personalized to our taste.

**Acceptance Criteria:**

**Given** a participant pastes a URL
**When** the URL matches `music.youtube.com`
**Then** the system detects it as a YouTube Music playlist and routes to the YouTube import handler (FR80)

**Given** a YouTube Music playlist URL is detected
**When** the import runs
**Then** the system reads playlist contents via the YouTube Data API v3 using an API key (FR81)
**And** no user login is required (FR81)
**And** paginated retrieval handles playlists with 50+ tracks (FR81)

**Given** playlist import runs
**When** the import completes
**Then** total import time is under 5 seconds for up to 200 tracks (NFR29)
**And** each imported track contains: song title, artist name, and source platform

**Given** YouTube API quota
**When** playlist reads are made
**Then** reads use 1 unit each and are batched efficiently (NFR30)

### Story 11.5: Spotify Playlist Import

As a participant,
I want to paste my Spotify playlist link so the app can include my music taste in suggestions,
So that the group's combined playlists power better song recommendations.

**Acceptance Criteria:**

**Given** a participant pastes a URL
**When** the URL matches `open.spotify.com`
**Then** the system detects it as a Spotify playlist and routes to the Spotify import handler (FR80)

**Given** a Spotify playlist URL is detected and the playlist is public
**When** the import runs
**Then** the system reads playlist contents via the Spotify Web API Client Credentials flow (FR82)
**And** no user login is required (FR82)
**And** the app owner's Spotify developer account credentials are used server-side

**Given** a Spotify playlist is private
**When** the import fails due to access restrictions
**Then** the system displays a 3-step visual guide instructing the user to make their playlist public, then retry (FR83)
**And** the guide is clear and uses screenshots or illustrations

**Given** Spotify token management
**When** the Client Credentials token is used
**Then** the token is managed entirely server-side (NFR33)
**And** token refresh happens automatically before expiry
**And** no token is exposed to the client

**Given** playlist import completes
**When** the results are returned
**Then** total import time is under 5 seconds for up to 200 tracks (NFR29)
**And** each imported track contains: song title, artist name, and source platform

### Story 11.6: Cross-Platform Song Normalization

As a system,
I want to merge songs from multiple playlists across platforms into a unified list,
So that duplicate songs are counted as overlap signals rather than appearing twice.

**Acceptance Criteria:**

**Given** songs are imported from YouTube Music and/or Spotify
**When** normalization runs
**Then** songs are matched across platforms by title + artist name (FR84)
**And** matching is fuzzy — handles minor spelling variations, "feat." vs "ft.", etc.

**Given** the same song appears in multiple friends' playlists
**When** duplicates are detected
**Then** duplicates are merged into a single entry (FR84)
**And** an overlap count tracks how many friends share each song (FR84)

**Given** normalization completes
**When** the unified song list is produced
**Then** each entry contains: normalized title, normalized artist, source platforms, overlap count, original track IDs

### Story 11.7: Karaoke Catalog Index

As a system,
I want a pre-built catalog of karaoke songs with confirmed YouTube karaoke video IDs,
So that suggestions only include songs that actually have karaoke versions available.

**Acceptance Criteria:**

**Given** the Karaoke Catalog Index
**When** the catalog is built
**Then** it is scraped from popular karaoke YouTube channels (FR85)
**And** it contains a minimum of 10,000 tracks (FR85)
**And** each entry contains: {song, artist, youtube_video_id}

**Given** the catalog is pre-built
**When** a party session is in progress
**Then** catalog matching does not require live API calls (NFR32)
**And** all intersection matching uses the server-side pre-built index

**Given** the catalog needs updating
**When** a refresh is triggered
**Then** the refresh happens offline on a weekly or configurable schedule (NFR32)
**And** refreshes do not impact active party sessions

**Given** the catalog includes a Karaoke Classics subset
**When** the subset is queried
**Then** it contains the top 200 universally known karaoke songs (FR91)
**And** the subset is used for cold start fallback (Story 11.8)

### Story 11.8: Song Suggestion Engine

As a participant,
I want the app to suggest songs our group will love based on our combined playlists,
So that we spend less time deciding what to sing and more time singing.

**Acceptance Criteria:**

**Given** playlists have been imported and/or songs have been sung
**When** suggestions are computed
**Then** the suggestion set is: (imported playlist songs UNION previously sung songs) INTERSECT Karaoke Catalog Index (FR86)
**And** only songs with confirmed karaoke versions appear as suggestions

**Given** the suggestion set is computed
**When** rankings are applied
**Then** songs are ranked by (FR87):
1. Group overlap count — songs known by more friends rank higher
2. Genre momentum — if the last 3 songs were the same genre, bias toward a different genre
3. Not-yet-sung — songs not performed in the current session rank higher

**Given** no playlists have been imported and no songs have been sung (cold start)
**When** suggestions are requested
**Then** the system falls back to the Karaoke Classics subset (top 200) from the catalog (FR91)

**Given** the suggestion engine runs
**When** results are returned
**Then** computation is fast — suggestions are available within 1 second
**And** the engine can produce suggestions at any point during the session as new data (songs sung, playlists imported) arrives

### Story 11.9: Quick Pick Mode

As a participant,
I want to vote on AI-suggested songs as a group to quickly pick the next song,
So that song selection is fast, democratic, and based on what we all know.

**Acceptance Criteria:**

**Given** the DJ engine reaches a song selection state
**When** Quick Pick mode is active (default mode)
**Then** 5 AI-suggested songs are displayed as cards (FR88)
**And** each card shows: song title, artist, thumbnail, and group overlap badge (e.g., "4/5 know this")

**Given** Quick Pick cards are displayed
**When** participants vote
**Then** each participant can vote thumbs up or skip on each song
**And** voting is single-tap per song (NFR14)

**Given** votes are being collected
**When** a song reaches majority approval (>50% of connected participants)
**Then** that song is immediately selected (FR88)
**And** the selected song is sent to the TV queue if paired (Story 11.3)

**Given** no song reaches majority within 15 seconds
**When** the timeout expires
**Then** the highest-voted song wins (FR88)
**And** ties are broken randomly

**Given** Quick Pick is displayed
**When** a mode switch control is visible
**Then** participants can toggle to Spin the Wheel mode (FR90)
**And** Quick Pick is the default mode (FR90)

### Story 11.10: Spin the Wheel Mode

As a participant,
I want an animated wheel of songs to spin and pick the next song,
So that song selection feels like a game — exciting and unpredictable.

**Acceptance Criteria:**

**Given** a participant switches to Spin the Wheel mode
**When** the wheel loads
**Then** 8 AI-suggested songs are displayed on an animated wheel (FR89)
**And** each segment shows song title and artist

**Given** the wheel is displayed
**When** any participant taps SPIN
**Then** the wheel animates with a satisfying spin animation
**And** the wheel lands on a song (FR89)
**And** the selected song is auto-queued on the TV if paired (Story 11.3)

**Given** the wheel lands on a song
**When** the group doesn't want that song
**Then** the group gets one veto per round — a re-spin (FR89)
**And** after the veto re-spin, the result is final

**Given** Spin the Wheel mode is active
**When** a mode switch control is visible
**Then** participants can toggle back to Quick Pick mode (FR90)

**Given** the wheel animation renders
**When** displayed on budget Android devices
**Then** the animation is smooth and performant
**And** the wheel uses GPU-accelerated rendering

### Story 11.11: Suggestion-Only Fallback Mode

As a host at a venue without YouTube karaoke,
I want the app to still suggest songs even without TV pairing,
So that the group benefits from smart song selection regardless of the venue's karaoke system.

**Acceptance Criteria:**

**Given** the host skips TV pairing (FR92)
**When** the party is in progress
**Then** the app operates in suggestion-only mode
**And** playlist import, suggestion engine, Quick Pick, and Spin the Wheel all function normally (FR92)
**And** songs are NOT auto-queued on the TV and passive song detection is disabled

**Given** a song is selected via Quick Pick or Spin the Wheel in suggestion-only mode
**When** the selection is confirmed
**Then** the app displays the song title and artist prominently (FR93)
**And** the display is designed for the group to manually enter the song into whatever karaoke system the venue uses

**Given** suggestion-only mode is active
**When** the host wants to inform the DJ engine about the current song
**Then** the host can manually mark a song as "now playing" from the suggestion list (FR94)
**And** this enables the DJ engine to receive song metadata for challenges and genre-based mechanics

**Given** the party started without TV pairing
**When** the host wants to add TV pairing mid-session
**Then** they can pair at any time — TV pairing is not locked to party creation (FR95)
**And** once paired, the system transitions from suggestion-only to full mode seamlessly

---

## Epic 12: Identity & Party History

Optional accounts with persistent profiles, party history, and personal media gallery — turning one-time guests into returning users. Completes the authentication story: Epic 1 establishes guest session tokens; this epic adds Firebase Auth OAuth and JWT validation on WebSocket handshake.

### Story 12.1: Firebase Auth Integration

As a user,
I want to optionally sign in with Google or Facebook when joining a party,
So that my participation is linked to a persistent account without being forced to create one.

**Acceptance Criteria:**

**Given** a user is on the join screen
**When** they view sign-in options
**Then** Google OAuth and Facebook OAuth are available via Firebase Auth (FR96)
**And** guest entry with name-only remains the default path (FR96)
**And** no sign-in is required to join or participate — it is always optional

**Given** a user taps "Sign in with Google" or "Sign in with Facebook"
**When** the OAuth flow completes
**Then** Firebase Auth creates or retrieves the user account
**And** a Firebase JWT is issued to the client
**And** the user is connected to the party with their authenticated identity

**Given** a user signs in
**When** their profile data is retrieved from the OAuth provider
**Then** only the following PII is stored: display name, email, avatar URL (NFR22)
**And** no additional PII is collected beyond what the OAuth provider returns

**Given** the join screen is displayed
**When** a user views it
**Then** the OAuth buttons are clearly labeled and self-evident (NFR16)
**And** the guest path is equally prominent — no dark pattern pushing sign-in
**And** all text is sourced from the centralized string constants module (NFR38)

### Story 12.2: Guest-to-Account Upgrade

As a guest participant,
I want to upgrade to a full account mid-session without losing anything,
So that I can decide to keep my party memories after seeing how fun the app is.

**Acceptance Criteria:**

**Given** a guest user is participating in an active session
**When** they choose to upgrade to a full account
**Then** the OAuth flow (Google or Facebook) completes without disconnecting the WebSocket (NFR35)
**And** the current DJ state is not interrupted
**And** no accumulated session data is lost: participation scores, ceremony awards, media captures, party card stats (FR97)

**Given** the upgrade flow initiates
**When** the OAuth redirect occurs and returns
**Then** the entire upgrade completes in under 5 seconds including the OAuth redirect (NFR35)
**And** the guest session token is replaced with a Firebase JWT seamlessly

**Given** the upgrade completes
**When** the user's session is inspected
**Then** all pre-upgrade data is now linked to their authenticated account
**And** media captures previously tagged as guest are re-attributed to the authenticated user (FR97)

**Given** the upgrade option is available
**When** a guest views it
**Then** the upgrade prompt is accessible but non-intrusive (e.g., in a settings or profile area)
**And** it can be triggered at any point during or after a session (FR97)

### Story 12.3: WebSocket JWT Validation

As a system,
I want to validate Firebase JWTs on WebSocket handshake for authenticated users,
So that authenticated connections are verified and session access is properly gated.

**Acceptance Criteria:**

**Given** an authenticated user connects via Socket.io
**When** the WebSocket handshake occurs
**Then** the Firebase JWT is validated server-side (FR105)
**And** the handshake completes within 500ms (NFR34)
**And** the user is associated with their authenticated identity for the session

**Given** an authenticated user presents an expired or invalid JWT
**When** the handshake is attempted
**Then** the server rejects the connection
**And** the client is prompted to re-authenticate

**Given** guest users connect (from Epic 1 Story 1.2)
**When** the handshake occurs
**Then** the existing guest session-scoped token path continues to work
**And** guest token TTL remains 6 hours (NFR34)

**Given** both token types are in use
**When** connections are active in a party
**Then** authenticated and guest users have identical in-session permissions (FR105)
**And** auth status affects persistence only, never in-party capabilities

**Given** an authenticated host creates a party
**When** the session is created
**Then** the host is recorded as the session owner (FR104)
**And** session ownership enables future features (re-share setlist, view full stats, manage media)

### Story 12.4: User Profiles

As an authenticated user,
I want a persistent profile with my name and avatar,
So that I'm recognized across sessions and my identity carries over to future karaoke nights.

**Acceptance Criteria:**

**Given** a user authenticates via OAuth
**When** their profile is created or retrieved
**Then** the profile stores: display name, avatar URL (from OAuth provider), and account creation date (FR98)
**And** the profile persists across sessions

**Given** an authenticated user joins a party
**When** they appear in the lobby and participant list
**Then** their display name and avatar are shown (not the generic guest display)
**And** other participants can see who is authenticated vs guest (subtle indicator)

**Given** a user's profile exists
**When** they join future sessions
**Then** their profile data is pre-populated — no re-entry of display name required

### Story 12.5: Session Summary Persistence

As a system,
I want to write a comprehensive session summary to PostgreSQL when a party ends,
So that party history is permanently recorded for authenticated users to revisit.

**Acceptance Criteria:**

**Given** a party ends (host triggers end or finale completes)
**When** the session summary is generated
**Then** the system writes to PostgreSQL containing (FR99): session ID, date, venue (if entered), participant list, song list, awards, ceremony scores, participation scores, and party card stats

**Given** the session summary write
**When** the write is initiated
**Then** it completes within 30 seconds of party end (FR103)
**And** the write is asynchronous — it does not block the real-time party experience (NFR36)
**And** the write completes within 5 seconds for sessions with up to 12 participants and 20+ songs (NFR36)

**Given** the session summary write fails
**When** the failure is detected
**Then** the system retries up to 3 times with exponential backoff (FR103)
**And** if all retries fail, session data is logged to server disk for manual recovery (FR103)

**Given** the summary is written
**When** the data is stored
**Then** it is queryable by session ID, participant ID, and date
**And** the schema supports the party history view (Story 12.6)

### Story 12.6: Party History View

As an authenticated user,
I want to see a chronological list of all my past karaoke sessions,
So that I can relive the memories and see how my participation has evolved.

**Acceptance Criteria:**

**Given** an authenticated user accesses their party history
**When** the history loads
**Then** a chronological list of past sessions is displayed (FR100)
**And** each entry shows: date, venue (if entered), participant count, personal awards, and personal stats

**Given** personal stats are displayed per session
**When** the user views a session entry
**Then** stats include: songs sung, participation score, top award received (FR100)

**Given** the party history is displayed
**When** the user scrolls through sessions
**Then** sessions load efficiently — paginated or virtualized for users with many sessions
**And** the most recent session appears first

**Given** the user views their history
**When** no sessions exist yet
**Then** a friendly empty state is displayed encouraging them to host or join a party
**And** all text is sourced from the centralized string constants module (NFR38)

### Story 12.7: Media Ownership & Gallery

As an authenticated user,
I want my captured photos, videos, and audio linked to my profile and always accessible,
So that I never lose my party memories — and guests still get temporary access.

**Acceptance Criteria:**

**Given** an authenticated user captures media during a session
**When** the capture is uploaded
**Then** the media is linked to their user profile (FR101)
**And** it is accessible via a personal media gallery post-session
**And** authenticated users retain access to their captures indefinitely (FR102)

**Given** a guest user captures media during a session
**When** the capture is uploaded
**Then** the media is linked to the session ID only (FR101)
**And** it is accessible to all session participants for 7 days (FR101)
**And** after 7 days, guest session media expires

**Given** media is stored in Firebase Storage
**When** the storage is organized
**Then** media is organized by session ID and tagged with capturing user ID if authenticated (FR102)
**And** the storage path follows: `sessions/{sessionId}/media/{captureId}.{ext}`

**Given** media access control is enforced
**When** a user requests media
**Then** authenticated users can access only their own captures and captures from sessions they participated in (NFR37)
**And** guest session media is accessible via time-limited signed URLs with 7-day expiry (NFR37)

**Given** the personal media gallery
**When** an authenticated user views it
**Then** media is organized by session with date and venue labels
**And** photos, videos, and audio clips are playable/viewable inline
**And** the gallery is accessible outside of active party sessions
