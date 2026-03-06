---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/architecture.md'
  - '_bmad-output/planning-artifacts/ux-design-specification.md'
  - '_bmad-output/project-context.md'
---

# karaoke-party-app - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for karaoke-party-app, decomposing the requirements from the PRD, UX Design, and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: Host can create a new party session and receive a unique QR code and 4-digit party code
FR2: Guest can join an active party by scanning a QR code or entering a party code -- QR codes open a web landing page that deep-links into the installed Flutter app or redirects to the app store for first-time users
FR3: Guest can enter a display name to identify themselves in the party (no account required)
FR4: All participants can see a live party lobby showing who has joined and the current player count
FR5: Host can start the party when ready, transitioning all connected phones to the first activity
FR6: Guest can join a party mid-session and receive a catch-up summary of current party stats
FR7: Host can re-display the QR code and party code at any point during an active session
FR8: System displays a waiting state when fewer than 3 players are present, showing current player count, a QR code, and a share prompt to invite more participants
FR9: System automatically cycles through activity states (party card deal -> song -> ceremony -> interlude -> volunteer/vote -> repeat) without manual intervention, governed by a formal state diagram with defined transitions, guards, and timeouts
FR10: System provides bridge moment activities during physical-world transitions (first song prompt, song selection, mic handoff)
FR11: System can enter a pause state, triggered by host action or by detecting 90+ seconds of inactivity across all users
FR12: System resumes from pause to the next state in the DJ cycle (if mid-song -> song, if mid-ceremony -> ceremony, if mid-interlude -> interlude) when host un-pauses or activity resumes
FR13: System presents democratic voting with 2-3 options for the group to decide what happens next
FR14: System selects ceremony type following defined rules: Full for first song and post-interlude songs, never two consecutive Full ceremonies, default to Quick after song 5. Host can skip any ceremony
FR15: System front-loads universal participation activities in the first 30 minutes of a session
FR16: Host can signal that a song has ended via a persistent, always-visible trigger during song state
FR17: System displays a pre-song hype announcement on all phones showing the next performer's name
FR18a: System auto-generates a ceremony award title from a pool of 20+ templates, driven by session context: party card accepted/completed, reaction volume during song, song position in session, performer's cumulative stats. No audience voting or performance scoring
FR18b: System generates a moment card combining performer name, song title, and award at the end of a Full ceremony
FR19: System conducts a Quick ceremony: brief award flash with one-liner title and short animation
FR20: Award templates cover a range of tones (comedic, hype, absurd, wholesome) selected contextually -- not mapped to performance scores
FR21: System supports group sing-along activities where all participants are included without individual spotlight
FR22: All participants can send emoji reactions during performances, visible within 100ms (per NFR2) on all connected phones
FR23: System tracks reaction streaks and displays streak milestones at 5, 10, 20, and 50 consecutive reactions to the reacting user
FR24: All participants can trigger soundboard effects (4-6 sounds) that play audibly through their phone speaker
FR25: System plays the primary ceremony audio (fanfares, reveals) through the host's phone as the dominant audio source
FR26: System plays a unique audio cue (minimum 4 distinct sounds: song start, ceremony start, interlude start, party card deal) for every DJ state transition, each at least 0.5s duration
FR27: All participants can vote in democratic activity selection and song selection (Quick Pick, Spin the Wheel)
FR28a: System supports a library of 3 interlude mini-games (Kings Cup, Dare Pull, Quick Vote) deployable by the DJ engine, selected via weighted random with no immediate repeats
FR28b: MVP interlude library includes: Kings Cup (group rule card), Dare Pull (random dare assigned to random player), Quick Vote (binary opinion poll)
FR29: Host has a persistent floating action button (bottom-right corner) that expands to a control overlay within 1 tap, providing party control without leaving the participant experience
FR30: Host can skip the current activity and advance to the next DJ state
FR31: Host can manually pause and resume the DJ engine
FR32: Host can override the DJ's next activity selection
FR33: Host can access skip, pause, queue management, kick player, and end party controls from the overlay (FR29) without navigating away from the participant view
FR34: System generates a shareable moment card for each Full ceremony containing performer name, song title, and award
FR35: Participant can share a moment card via native mobile share sheet
FR36: System generates an end-of-night setlist poster showing all songs, performers, date, and awards
FR37: Participant can share the setlist poster via native mobile share sheet
FR38: System prompts participants to capture moments via the floating capture bubble (see FR67) at 4 defined trigger points: session start, reaction peaks (FR72 threshold), post-ceremony reveals, and session end
FR39: Any participant can manually initiate a media capture at any time via a persistent capture icon in the participant toolbar -- independent of the bubble prompt system
FR40: System tracks weighted participation scores for each user across three tiers (passive: 1pt, active: 3pts, engaged: 5pts)
FR41: System generates end-of-night awards recognizing both singing and non-singing contributions
FR42: System logs every state transition, user action, and DJ decision as a structured event stream with schema: {sessionId, userId, eventType, timestamp, metadata}
FR43: System presents a post-session North Star prompt ("Would you use Karamania next time?") during the finale ceremony
FR44: System tracks share intent taps as a viral signal metric
FR45: System maintains real-time WebSocket connections between all participant phones and the server
FR46: System detects participant disconnection via heartbeat monitoring and updates participant lists accordingly
FR47: System automatically reconnects a disconnected participant within a 5-minute window and syncs them to the current DJ state within 2 seconds of reconnection without user action
FR48: System preserves a participant's session history and participation scores through disconnection events
FR49: System continues operating normally when any participant (including host) disconnects -- DJ engine proceeds, votes count present participants only, host controls transfer to next-longest-connected participant after 60s host absence
FR50: System prevents phone screen auto-lock during active participation states using native wake lock APIs
FR51: System can run a first-session icebreaker activity that all participants complete with a single tap, with results visible to the group
FR52: System orchestrates an end-of-night finale sequence in 4 steps: (1) highlight awards reveal with animation, (2) session stats summary (songs, reactions, participation), (3) setlist poster with share prompt, (4) one-tap post-session feedback ("Would you use again?" 1-5 scale) -- total finale duration 60-90 seconds
FR53: System provides visual feedback within 200ms during the join process showing party status and player count before the WebSocket connection is fully established
FR54: System deals a random party card to the next singer during the pre-song state, selected from the curated pool of 19 cards. App auto-deals by default; host can override card selection or disable dealing for a turn
FR55: System maintains a curated pool of 19 party cards across three types: vocal modifiers (7 cards), performance modifiers (7 cards), and group involvement (5 cards)
FR56: Vocal modifier cards: Chipmunk Mode (highest pitch possible), Barry White (deepest voice), The Whisperer (dramatic whisper), Robot Mode (monotone deadpan), Opera Singer (belt like La Scala), Accent Roulette (app assigns random accent), Beatboxer (add beatbox between lines)
FR57: Performance modifier cards: Blind Karaoke (sing facing away from screen), Method Actor (full Broadway drama), The Statue (no body movement), Slow Motion (all movements slow-mo), The Drunk Uncle (wedding toast gone wrong), News Anchor (dead serious delivery), Interpretive Dance (every lyric gets a gesture)
FR58: Group involvement cards: Name That Tune (group guesses song from intro), Backup Dancers (singer picks 2 people who must dance behind them), Crowd Conductor (singer directs who sings when during chorus), Tag Team (app picks random participant to take over at chorus), Hype Squad (app assigns 2 audience members who must stand and cheer the entire song)
FR59: Singer can accept or dismiss a dealt party card with a single tap. Singer gets one free redraw per turn -- after redraw, must accept or dismiss
FR60: Group involvement cards (Tag Team, Backup Dancers, Hype Squad) select random participants and announce the selection on all phones. No consent flow -- social dynamics handle opt-outs
FR61: System tracks party card acceptance rate and challenge completion per session
FR62: Completed party card challenges contribute to ceremony awards and weighted participation scoring (Engaged tier: 5 pts)
FR63: During song state, audience participants can toggle between lean-in mode (reactions/soundboard) and lightstick mode (phone screen becomes a glowing visual prop)
FR64: Lightstick mode renders a full-screen animated glow effect. User can change color. Free-form -- no synchronization required between devices
FR65: Audience participants can activate a camera flash/screen hype signal as real-time encouragement to the performer. Screen-based pulse effect with device flashlight activation (native API -- works uniformly on both iOS and Android)
FR66: Lightstick mode and hype signal are available alongside reactions -- participants can switch between modes freely during a song
FR67: System displays a floating capture bubble at key moments: session start, reaction peaks (auto-detected spike in reaction rate), post-ceremony pause, and session end. Bubble is dismissable by ignoring it -- no interruption to non-interested participants
FR68: Any participant can pop the capture bubble to initiate a media capture: photo, video (5s max), or audio snippet. One-tap to pop, one-tap to start capture
FR69: System captures photo, video, and audio inline using native device camera and microphone APIs -- uniform behavior on both iOS and Android. Capture completes without navigating away from the app
FR70: Captured media is tagged with session ID, timestamp, capture trigger type (peak/ceremony/manual), and current DJ state for future highlight reel assembly
FR71: Media uploads are queued and sent in background -- capture never blocks the party experience. Failed uploads retry automatically on next stable connection
FR72: All captured media is stored server-side per session, accessible to all session participants post-session
FR73: System auto-detects reaction peaks (sustained reaction rate spike above baseline threshold) and triggers a capture bubble on all phones. Peak detection logic is server-side to ensure consistent triggering
FR74: Host can pair the app with a YouTube TV session by entering the TV pairing code displayed on the TV screen
FR75: System connects to the YouTube TV session via the Lounge API and receives real-time nowPlaying events containing the current video_id
FR76: System resolves each detected video_id to structured song metadata {title, artist, channel, thumbnail} via the YouTube Data API v3 within 5 seconds of song start
FR77: System parses karaoke video titles (e.g., "Song Title - Artist (Karaoke Version)") into structured {song, artist} data using title parsing rules
FR78: System can push songs to the YouTube TV queue via the Lounge API addVideo command -- selected songs from Quick Pick or Spin the Wheel auto-queue on the TV without manual karaoke machine input
FR79: System maintains the Lounge API session throughout the party. If the connection drops, the system attempts automatic reconnection for up to 60 seconds before prompting the host to re-enter the TV code
FR80: System detects the music platform from a pasted URL (music.youtube.com -> YouTube Music, open.spotify.com -> Spotify) and routes to the appropriate import handler
FR81: System reads YouTube Music playlist contents via the YouTube Data API v3 using an API key (no user login required). Paginated retrieval for playlists with 50+ tracks
FR82: System reads Spotify public playlist contents via the Spotify Web API Client Credentials flow (no user login required). App owner maintains a Spotify developer account
FR83: When a Spotify playlist is private and cannot be read, the system displays a 3-step visual guide instructing the user to make their playlist public, then retry the paste
FR84: System normalizes imported songs across platforms by matching on title + artist name. Duplicate songs from multiple friends' playlists are merged, with an overlap count tracking how many friends share each song
FR85: System maintains a pre-built Karaoke Catalog Index scraped from popular karaoke YouTube channels (minimum 10,000 tracks) containing {song, artist, youtube_video_id} for each entry
FR86: System computes song suggestions as: (imported playlist songs UNION previously sung songs) INTERSECT Karaoke Catalog Index -- only songs with confirmed karaoke versions appear as suggestions
FR87: System ranks suggestions by: (1) group overlap count -- songs known by more friends rank higher, (2) genre momentum -- if the last 3 songs were the same genre, bias toward a different genre, (3) not-yet-sung -- songs not performed in the current session rank higher
FR88: Quick Pick mode displays 5 AI-suggested songs as cards showing song title, artist, thumbnail, and group overlap badge (e.g., "4/5 know this"). All participants vote thumbs up or skip. First song to reach majority approval is selected. If no majority within 15 seconds, the highest-voted song wins
FR89: Spin the Wheel mode loads 8 AI-suggested songs into an animated wheel. Any participant can tap SPIN. The wheel animates and lands on a song, which is auto-queued. Group gets one veto per round (re-spin)
FR90: Participants can toggle between Quick Pick and Spin the Wheel modes at any time via a mode switch control. Quick Pick is the default mode
FR91: When no playlists have been imported and no songs have been sung yet (cold start), the system falls back to suggesting songs from the Karaoke Classics subset of the catalog (top 200 universally known karaoke songs)
FR92: If the host skips TV pairing (venue does not use YouTube for karaoke), the app operates in suggestion-only mode: playlist import, suggestion engine, Quick Pick, and Spin the Wheel all function normally, but songs are not auto-queued on the TV and passive song detection is disabled
FR93: In suggestion-only mode, when a song is selected via Quick Pick or Spin the Wheel, the app displays the song title and artist prominently so the group can manually enter it into whatever karaoke system the venue uses
FR94: In suggestion-only mode, the host can manually mark a song as "now playing" from the suggestion list, enabling the game engine to receive song metadata for challenges and genre-based mechanics
FR95: TV pairing is optional at party creation -- the host can start a party without pairing and add the TV connection later if desired
FR96: System offers optional sign-in via Google or Facebook OAuth (Firebase Auth) on the join screen. Users can also join as a guest with name-only entry -- the default path
FR97: Guest users can upgrade to a full account at any point during or after a session without losing any session data, participation scores, or captured media
FR98: Authenticated users have a persistent profile storing display name, avatar (from OAuth provider), and account creation date
FR99: On party end, the system writes a session summary to PostgreSQL containing: session ID, date, venue (if entered), participant list, song list, awards, participation scores, and party card stats
FR100: Authenticated users can view their party history via a Session Timeline screen -- the app's home screen when no party is active. See FR108-FR115 for full timeline and session detail specifications
FR101: Media captures (photos, video clips, audio snippets) from authenticated users are linked to their user profile and accessible via a personal media gallery post-session. Guest captures are linked to session ID only and accessible to all session participants for 7 days
FR102: All media is stored in Firebase Storage, organized by session ID and tagged with capturing user ID (if authenticated). Authenticated users retain access to their captures indefinitely; guest session media expires after 7 days
FR103: System writes session summary to PostgreSQL within 30 seconds of party end. If the write fails, the system retries up to 3 times with exponential backoff. If all retries fail, session data is logged to server disk for manual recovery
FR104: Authenticated host creating a party is recorded as the session owner. Session ownership enables future features (re-share setlist poster, view full session stats, manage session media)
FR105: WebSocket handshake validates Firebase JWT for authenticated users. Guest users receive a server-issued session-scoped token. Both token types grant identical in-session permissions -- auth status affects persistence only, never in-party capabilities
FR106: Web landing page detects the user's platform (iOS/Android), checks if the app is installed via Universal Links / App Links, and either deep-links into the app with the party code pre-filled or redirects to the appropriate app store with a "Download to join the party" message
FR107: Web landing page allows manual party code entry for users who type the URL directly (not via QR scan)
FR108: Authenticated users see a Session Timeline as the app's home/default screen -- a reverse-chronological list of past karaoke sessions. Each entry shows: session date, venue name (if entered), number of participants, the user's top award from that session, and a thumbnail from captured media (if available)
FR109: Tapping a session entry opens a Session Detail screen showing: (1) session header (date, venue, duration, participant count), (2) participant list with each person's top award and participation score, (3) full setlist with performer names and awards per song, (4) media gallery -- all photos, video clips, and audio captured during the session, (5) the setlist poster generated at session end
FR110: Session Detail screen is scrollable as a single continuous view -- no tabs or sub-navigation. Media gallery displays as an inline grid within the session detail flow
FR111: Authenticated users can share a session via native share sheet -- generates a shareable link that opens a read-only web view of the session detail (setlist, awards, stats, media). No app required to view the shared link
FR112: Session Detail includes a "Let's go again!" action that generates a pre-composed message (venue name, date suggestion, link to download Karamania) for the user to share via their preferred messaging app (WhatsApp, Zalo, iMessage, etc.) using the native share sheet. No in-app messaging -- leverages existing group chats
FR113: Guest users see a prompt to create an account to unlock session history. The Session Timeline is not accessible to guests -- guest home screen shows only the "Start Party" / "Join Party" actions
FR114: Session Timeline loads the 20 most recent sessions initially, with infinite scroll for older sessions
FR115: If an authenticated user has zero past sessions, the Session Timeline shows an empty state with a "Start your first party" call-to-action

### NonFunctional Requirements

NFR1: DJ state transitions must propagate to all connected devices within 200ms of server-side state change
NFR2: Emoji reactions must appear on all phones within 100ms of the originating tap
NFR3: Soundboard audio must begin playback within 50ms of tap on the originating device
NFR4: Ceremony award generation and reveal must complete within 3 seconds of the host triggering "Song Over!"
NFR5: The app must maintain 60fps rendering and <100ms input response time with up to 12 simultaneously connected participants, each sending reactions at peak rate (2 taps/second)
NFR6: Audio assets must be bundled with the app and playable within 50ms of trigger -- no network round-trip on playback
NFR7: App install size must remain under 50MB (including audio assets and Flutter runtime)
NFR8: The DJ engine must continue operating if any participant (including host) disconnects -- zero single points of failure
NFR9: A participant's reconnection after a brief network interruption (<5s) must complete without showing an error state or loading spinner -- the participant's view resumes at the current DJ state
NFR10: Session state must be fully recoverable from the server -- no client-only state that would be lost on app restart
NFR11: The system must handle concurrent democratic votes (activity selection, Quick Pick) from all participants without race conditions or vote loss
NFR12: When participant count drops below 3, the system skips group interludes (Kings Cup, Dare Pull), disables party cards that require 3+ participants, defaults to Quick ceremony type, and continues DJ engine cycling with song -> ceremony -> song
NFR13: On server restart, active sessions are gracefully terminated with a "session ended unexpectedly" message to all connected clients. Full session persistence and recovery deferred to v2
NFR14: All primary interactions (reactions, voting, soundboard) must be completable with a single tap on a target no smaller than 48x48px
NFR15: No interaction in the app requires text input beyond the initial name entry
NFR16: All participant-facing screens must be usable on first encounter without instructions -- every interactive element uses standard mobile patterns (tap, swipe), icons include text labels, and new features show a single-sentence tooltip on first appearance only
NFR17: All text and interactive elements must meet WCAG AA contrast ratio (4.5:1 for normal text, 3:1 for large text) against their backgrounds, verified in simulated low-light display conditions
NFR18: State transitions must play a distinct audio cue (minimum 0.5s, unique per transition type: song start, ceremony start, interlude start, party card deal) audible at phone speaker volume -- participants may be watching the karaoke screen, not their phone
NFR19: Host controls must be accessible within 1 second from any participant screen state (no navigation required)
NFR20: The app must not require any configuration, settings, or preferences from any participant -- zero setup beyond name entry
NFR21: Party codes must expire after session end and not be reusable
NFR22: For guest users, no personally identifiable information stored beyond display name and session participation data. For authenticated users, PII is limited to: display name, email, avatar URL (from OAuth provider), and session participation data. No additional PII collection beyond what the OAuth provider returns
NFR23: Rate limiting on reaction and soundboard events: after 10 events in 5 seconds, each subsequent event earns 50% fewer participation points and visual feedback dims proportionally. No hard block -- user can always tap, but reward and feedback diminish to near-zero after 20 events in 5 seconds. Resets after 5 seconds of inactivity
NFR24: Session data must be isolated -- no participant can access or affect another party's session
NFR25: WebSocket connections must be authenticated to their session -- a connection cannot inject events into a different party
NFR26: Event stream logging must be asynchronous and must not add more than 5ms latency to any user-facing operation
NFR27: Ceremony award reveal must appear on all connected devices within a 200ms window of each other, using server-coordinated timing
NFR28: Client memory usage must not grow by more than 15MB over a 3-hour session with typical interaction patterns. No memory leaks in reaction rendering, ceremony animations, or WebSocket message handling
NFR29: Playlist import must complete within 5 seconds for playlists of up to 200 tracks (including API call, parsing, and intersection matching against karaoke catalog)
NFR30: YouTube Data API v3 usage must remain within the free tier quota of 10,000 units per day. Playlist reads (1 unit each) and video metadata lookups (1 unit each) must be batched efficiently -- a typical party session must consume fewer than 500 quota units
NFR31: If the YouTube Lounge API connection fails or becomes unavailable (unofficial API breakage), the system must degrade gracefully to suggestion-only mode (FR92) without crashing, losing session state, or interrupting the active party. Host sees a single non-blocking notification
NFR32: Karaoke Catalog Index must be pre-built and stored server-side -- catalog matching must not require live API calls during a party session. Catalog refresh happens offline on a weekly or configurable schedule
NFR33: Spotify Client Credentials token must be managed server-side. Token refresh must happen automatically before expiry -- no participant action required and no token exposure to the client
NFR34: Firebase Auth JWT must be validated on WebSocket handshake for authenticated users. Guest users receive a server-issued session-scoped token with a TTL matching the maximum session duration (6 hours). Both paths must complete handshake within 500ms
NFR35: Guest-to-account upgrade must complete without disconnecting the WebSocket, interrupting the current DJ state, or losing any accumulated session data. The upgrade flow must complete in under 5 seconds including native OAuth flow (Firebase Auth Flutter SDK)
NFR36: PostgreSQL session summary writes at party end must not block the real-time party experience -- writes are asynchronous and must complete within 5 seconds for sessions with up to 12 participants and 20+ songs
NFR37: Media access control must enforce ownership: authenticated users can access only their own captures and captures from sessions they participated in. Guest session media is accessible to all session participants via a time-limited signed URL (7-day expiry)
NFR38: All user-facing strings must be defined in a centralized string constants module (not hardcoded in widgets) to enable Vietnamese localization extraction in the fast-follow phase. Flutter's intl package structure recommended. Fonts must support Vietnamese diacritics (UTF-8)
NFR39: Web landing page must load in <2s on 4G, be under 50KB total, and correctly handle deep-link routing on iOS 15+ and Android 8+. Graceful fallback to app store redirect when deep link fails

### Additional Requirements

**From Architecture:**

- Monorepo structure: `apps/flutter_app/`, `apps/server/`, `apps/web_landing/` -- no monorepo tool, three independent apps
- Flutter app via `flutter create --org com.karamania --project-name karamania`
- Server: Fastify 5 + Socket.io 4 (manual integration, NOT fastify-socket.io), TypeScript strict ESM
- Server directory structure enforced: `src/{db,dj-engine,socket-handlers,integrations,services,persistence,routes,shared/schemas}`, `migrations/`, `scripts/`, `tests/`
- Web landing page: plain HTML/JS/CSS, no build step
- Railway hosting for server + co-located PostgreSQL; auto-deploy on push to main
- Manual app distribution: TestFlight (iOS) + Google Play internal testing (Android)
- Environment variables: `DATABASE_URL`, `JWT_SECRET`, `YOUTUBE_API_KEY`, `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, Firebase credentials
- GitHub Actions CI: `server-ci.yml` (Vitest + kysely-codegen type check) and `flutter-ci.yml` (flutter test + flutter analyze)
- PostgreSQL with Kysely query builder + kysely-codegen for auto-generated types; hand-written migrations via kysely-ctl
- MVP schema: 5 tables (users, sessions, session_participants, media_captures, karaoke_catalog)
- DJ state serialized as JSONB in sessions table; written on every state transition (async fire-and-forget)
- Event stream: in-memory array during session, batch-written at session end
- Full persistence and crash recovery is MVP scope (supersedes PRD NFR13 deferral to v2)
- Server restart recovery: read active sessions, reconstruct DJ state from JSONB, reconcile timers
- Type generation pipeline: Zod -> @fastify/swagger -> OpenAPI -> dart-open-fetch -> Dart types
- `tools/generate-dart-types.sh` script required
- Socket.io event payloads manually synced for MVP (codegen deferred to v2)
- Firebase Auth (client Flutter SDK + server Admin SDK), Firebase Storage (client direct upload, server signed URLs)
- YouTube Lounge API: persistent HTTP connection, abstracted behind interface
- YouTube Data API v3: <500 units per session, 10K/day free tier
- Spotify Web API: Client Credentials flow, server-side only
- Server-signed JWT for guests via `jose` library (6-hour TTL)
- Unified Socket.io handshake auth middleware for all user types
- Pino structured logging; Sentry free tier for exceptions (server + Flutter client)
- Socket.io namespace:action event naming across 10 namespaces
- REST: `{ data }` or `{ error }` wrapping; Socket.io payloads NOT wrapped
- AppError type consistent across REST and Socket.io
- Flutter: Provider v6.x, GoRouter, single `/party` route with DJ state switching
- SocketClient singleton as only provider mutator
- `wakelock_plus` for screen auto-lock prevention
- LoadingState enum per async operation
- Audio engine with pre-loaded bundled assets (<500KB, 10 core assets)
- Karaoke catalog: 10K+ tracks pre-scraped, offline scraper script, `is_classic` boolean for cold start
- dj-engine/ has zero imports from persistence, integrations, or socket-handlers (pure logic)
- persistence/ is the ONLY layer that imports from db/
- services/session-manager.ts is the ONLY cross-boundary orchestrator
- 100% unit test coverage required for dj-engine
- Shared test factories in tests/factories/
- Graceful degradation: TV pairing -> suggestion-only, low participants -> reduced game set, Firebase Auth failure -> guest fallback, PostgreSQL failure -> 3 retries + disk logging
- Vibe system: PartyVibe enum at party creation propagates through entire visual layer

**From UX Design:**

- Mobile-only, portrait-only, single column layout; target 360-412px viewport width
- SafeArea wrapping all content; no content behind notch/dynamic island/gesture bar
- 8px base unit spacing system (xs=4, sm=8, md=16, lg=24, xl=32)
- Three-tier tap hierarchy: Consequential (64x64px), Social (56x56px), Private (48x48px) with DJTapButton custom widget
- Haptic fires BEFORE handler on touch-down; scale feedback per tier
- WCAG 2.1 AA compliance; all vibe palettes verified >4.5:1 contrast
- No information conveyed by color alone
- prefers-reduced-motion / MediaQuery.disableAnimations support on all animated widgets (20 widgets with specific reduced-motion behaviors)
- Screen reader support via Semantics widgets; liveRegion on key announcements
- Zero navigation paradigm: DJ engine server-push drives all screen changes; no menus, tabs, or back button
- 3-second orientation rule: any screen must communicate its purpose within 3 seconds
- 20 screens across 4 sprint phases
- 36 custom widgets (6 primitives, 23 screen compositions, 2 effect widgets, 5 state providers)
- 12 constant design tokens + 4 vibe-shifting tokens + 5 party vibes
- Space Grotesk variable font, subsetted for Latin + Vietnamese (<25KB)
- 6 type roles with specific sizing and weight rules
- Error handling philosophy: errors are invisible; app absorbs problems silently; no error toasts
- Audio: 3 volume levels (Ambient 40%, Transitional 70%, Ceremonial 100%); spatial audio (host 100%, participants 60%); max 2 simultaneous sources
- Late join: loading skeleton -> catch-up card (3s max) -> current DJ state
- Reconnection: auto-reconnect via socket_io_client (500ms initial, 3s max, 20 attempts)
- Timing patterns: hard deadlines (server-authoritative) for icebreaker 6s, Quick Pick 15s, Spin veto 5s; soft auto-advance for interludes 15-20s, ceremony reveal 8-10s
- Capture bubble: 48x48px floating, bottom-left, auto-dismiss 15s, max 1/60s; pop-to-capture 2 taps
- No preview/edit on captures; auto-upload with background retry
- Quick Pick: 5 cards, vertical scroll, group vote, 15s deadline
- Spin the Wheel: 8 songs, animated wheel, deceleration easing, 1 veto per round
- Party card deal: slide-up with flip animation; accept/dismiss/redraw buttons; 8s soft auto-dismiss; visual card type differentiation (blue/purple/gold borders)
- Interlude games: Kings Cup (10s auto-advance), Dare Pull (slot-machine animation, 15s countdown, never in first 30min), Quick Vote (6s vote window, bar chart results)
- Web landing page: <50KB static HTML, platform detection, deep link with Universal Links / App Links fallback

### FR Coverage Map

FR1: Epic 1 - Host creates party with QR/party code
FR2: Epic 1 - Guest joins via QR code or party code
FR3: Epic 1 - Guest enters display name
FR4: Epic 1 - Live party lobby with player list
FR5: Epic 1 - Host starts party
FR6: Epic 1 - Mid-session join with catch-up summary
FR7: Epic 1 - Host re-displays QR/party code
FR8: Epic 1 - Waiting state when <3 players
FR9: Epic 2 - DJ auto-cycles activity states
FR10: Epic 2 - Bridge moment activities
FR11: Epic 2 - Pause state (host or inactivity)
FR12: Epic 2 - Resume from pause
FR13: Epic 7 - Democratic voting (2-3 options)
FR14: Epic 2 - Ceremony type selection rules
FR15: Epic 7 - Front-load universal activities in first 30 min
FR16: Epic 2 - Host signals song ended
FR17: Epic 2 - Pre-song hype announcement
FR18a: Epic 3 - Auto-generated ceremony award titles
FR18b: Epic 3 - Moment card (performer + song + award)
FR19: Epic 3 - Quick ceremony (brief award flash)
FR20: Epic 3 - Award templates range of tones
FR21: Epic 7 - Group sing-along activities
FR22: Epic 4 - Emoji reactions during performances
FR23: Epic 4 - Reaction streak tracking and milestones
FR24: Epic 4 - Soundboard effects (4-6 sounds)
FR25: Epic 3 - Ceremony audio through host phone
FR26: Epic 2 - Audio cue for every DJ state transition
FR27: Epic 5 - Democratic voting mechanism (built here for song selection, reused by Epic 7 for activity selection)
FR28a: Epic 7 - Library of 3 interlude mini-games
FR28b: Epic 7 - Kings Cup, Dare Pull, Quick Vote
FR29: Epic 2 - Host persistent FAB with control overlay
FR30: Epic 2 - Host skip current activity
FR31: Epic 2 - Host pause/resume DJ engine
FR32: Epic 2 - Host override next activity
FR33: Epic 2 - Host controls (skip, pause, queue, kick, end)
FR34: Epic 3 - Shareable moment card per Full ceremony
FR35: Epic 3 - Share moment card via native share sheet
FR36: Epic 8 - End-of-night setlist poster
FR37: Epic 8 - Share setlist poster via native share sheet
FR38: Epic 6 - Capture bubble at 4 trigger points
FR39: Epic 6 - Manual capture via persistent toolbar icon
FR40: Epic 3 - Weighted participation score tracking (established here, extended by Epic 4 card scoring and Epic 8 end-of-night awards)
FR41: Epic 8 - End-of-night awards (singing + non-singing)
FR42: Epic 2 - Structured event stream logging (DJ engine audit trail, infrastructure for all epics)
FR43: Epic 8 - Post-session North Star prompt
FR44: Epic 6 - Share intent tap tracking
FR45: Epic 1 - Real-time WebSocket connections
FR46: Epic 1 - Disconnection detection via heartbeat
FR47: Epic 1 - Auto-reconnect within 5 min window
FR48: Epic 1 - Session history preserved through disconnection
FR49: Epic 1 - Continued operation on any disconnect
FR50: Epic 2 - Prevent phone screen auto-lock
FR51: Epic 7 - First-session icebreaker activity
FR52: Epic 8 - End-of-night finale sequence (4 steps)
FR53: Epic 1 - Visual feedback within 200ms during join
FR54: Epic 4 - Party card dealt to next singer
FR55: Epic 4 - Curated pool of 19 party cards
FR56: Epic 4 - Vocal modifier cards (7 cards)
FR57: Epic 4 - Performance modifier cards (7 cards)
FR58: Epic 4 - Group involvement cards (5 cards)
FR59: Epic 4 - Accept/dismiss/redraw party card
FR60: Epic 4 - Group involvement card participant selection
FR61: Epic 4 - Party card acceptance rate tracking
FR62: Epic 4 - Card challenges contribute to awards/scoring
FR63: Epic 4 - Toggle lean-in vs lightstick mode
FR64: Epic 4 - Lightstick full-screen glow effect
FR65: Epic 4 - Camera flash/screen hype signal
FR66: Epic 4 - Lightstick and hype alongside reactions
FR67: Epic 6 - Floating capture bubble at key moments
FR68: Epic 6 - Pop bubble to initiate capture
FR69: Epic 6 - Inline photo/video/audio capture
FR70: Epic 6 - Media tagged with session context
FR71: Epic 6 - Background upload queue with retry
FR72: Epic 6 - Server-side media storage per session
FR73: Epic 6 - Auto-detect reaction peaks for capture
FR74: Epic 5 - TV pairing via YouTube pairing code
FR75: Epic 5 - Lounge API nowPlaying events
FR76: Epic 5 - Resolve video_id to song metadata
FR77: Epic 5 - Parse karaoke video titles
FR78: Epic 5 - Push songs to YouTube TV queue
FR79: Epic 5 - Maintain Lounge API session
FR80: Epic 5 - Detect music platform from URL
FR81: Epic 5 - Read YouTube Music playlists
FR82: Epic 5 - Read Spotify public playlists
FR83: Epic 5 - Spotify private playlist guide
FR84: Epic 5 - Normalize and merge songs across platforms
FR85: Epic 5 - Pre-built Karaoke Catalog Index (10K+ tracks)
FR86: Epic 5 - Compute suggestions via catalog intersection
FR87: Epic 5 - Rank suggestions by overlap/genre/novelty
FR88: Epic 5 - Quick Pick mode (5 cards, vote, 15s)
FR89: Epic 5 - Spin the Wheel mode (8 songs, animated)
FR90: Epic 5 - Toggle Quick Pick / Spin the Wheel
FR91: Epic 5 - Cold start Karaoke Classics fallback
FR92: Epic 5 - Suggestion-only mode (no TV)
FR93: Epic 5 - Display selected song for manual entry
FR94: Epic 5 - Host manual "now playing" in suggestion mode
FR95: Epic 5 - TV pairing optional at party creation
FR96: Epic 1 - Optional Google/Facebook sign-in
FR97: Epic 9 - Guest-to-account upgrade without data loss
FR98: Epic 9 - Persistent user profile
FR99: Epic 8 - Session summary written to PostgreSQL
FR100: Epic 9 - Session Timeline screen (home for auth users)
FR101: Epic 9 - Media linked to user profile
FR102: Epic 9 - Firebase Storage media organization
FR103: Epic 8 - Session summary retry with backoff
FR104: Epic 8 - Session ownership for authenticated host
FR105: Epic 1 - WebSocket handshake auth (Firebase + guest JWT)
FR106: Epic 1 - Web landing page with platform detection
FR107: Epic 1 - Web landing page manual code entry
FR108: Epic 9 - Session Timeline reverse-chronological list
FR109: Epic 9 - Session Detail screen (5 sections)
FR110: Epic 9 - Session Detail single scrollable view
FR111: Epic 9 - Share session via native share sheet
FR112: Epic 9 - "Let's go again!" re-engagement action
FR113: Epic 9 - Guest prompt to create account
FR114: Epic 9 - Session Timeline infinite scroll
FR115: Epic 9 - Empty state with "Start your first party" CTA

## Epic List

### Epic 1: Party Foundation
Host can create a party, guests can join via QR code or party code, and everyone sees each other in a live lobby. The real-time WebSocket infrastructure, basic authentication (guest + Firebase), and web landing page are established. This is the foundational layer that proves the core real-time connection. Includes Flutter scaffold with design token system (DJTokens, spacing, typography), DJTapButton primitive, vibe theming provider, and all foundational UX primitives that every subsequent screen depends on.
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR45, FR46, FR47, FR48, FR49, FR53, FR96, FR105, FR106, FR107
**Cross-cutting foundations:** Design tokens, DJTapButton, vibe system, LoadingState enum, AccessibilityProvider, Space Grotesk font setup

### Epic 2: Core DJ Engine & Song Experience
The party runs automatically -- the DJ engine cycles through states (song selection -> party card deal -> song -> ceremony -> interlude -> repeat), the host controls the flow via a persistent overlay, and audio cues mark every transition. Participants experience the core game loop. The state machine includes placeholder transitions for party cards (Epic 4), ceremonies (Epic 3), and interludes (Epic 7) that those epics implement with full behavior. Event stream logging is established here as core infrastructure for all subsequent epics.
**FRs covered:** FR9, FR10, FR11, FR12, FR14, FR16, FR17, FR26, FR29, FR30, FR31, FR32, FR33, FR42, FR50
**Cross-cutting concerns:** DJ engine requires 100% unit test coverage; every epic that adds states/transitions must include regression tests. Event stream (FR42) is the audit trail consumed by Epic 8 finale and analytics.

### Epic 3: Ceremonies & Awards
After each song, performers receive fun, contextual awards with dramatic ceremony reveals. Full ceremonies include anticipation buildup, confetti, and moment card generation. Quick ceremonies deliver a brief award flash. Ceremony audio plays through the host phone as the dominant source. Participation scoring system is established here (passive/active/engaged tiers) and extended by Epic 4 (card challenges) and Epic 8 (end-of-night awards).
**FRs covered:** FR18a, FR18b, FR19, FR20, FR25, FR34, FR35, FR40

### Epic 4: Audience Participation & Party Cards
While songs play, the audience actively participates -- sending emoji reactions, triggering soundboard effects, and toggling lightstick mode or hype signals. Singers receive challenge cards from a curated pool of 19 that shape performances and contribute to scoring.
**FRs covered:** FR22, FR23, FR24, FR54, FR55, FR56, FR57, FR58, FR59, FR60, FR61, FR62, FR63, FR64, FR65, FR66
**Dependency note:** Epic 6 (Media Capture) depends on the reaction event stream from this epic for peak detection (FR73).

### Epic 5: Song Integration & Discovery
The group discovers and selects songs together. Friends import playlists from YouTube Music and Spotify, the suggestion engine finds songs everyone knows with confirmed karaoke versions, and Quick Pick or Spin the Wheel makes selection a group activity. TV pairing auto-queues songs on YouTube.
**FRs covered:** FR27, FR74, FR75, FR76, FR77, FR78, FR79, FR80, FR81, FR82, FR83, FR84, FR85, FR86, FR87, FR88, FR89, FR90, FR91, FR92, FR93, FR94, FR95

### Epic 6: Media Capture & Sharing
Participants capture photos, videos, and audio during key moments via a floating capture bubble or persistent capture icon. Media uploads happen in the background. Reaction peak detection triggers capture prompts automatically.
**FRs covered:** FR38, FR39, FR44, FR67, FR68, FR69, FR70, FR71, FR72, FR73
**Dependency note:** Requires Epic 4 reaction event stream for peak detection (FR73). Must be implemented after Epic 4.

### Epic 7: Interlude Games & Icebreaker
Between songs, mini-games keep energy high -- Kings Cup group rules, Dare Pull random challenges, Quick Vote opinion polls, and a first-session icebreaker. Democratic voting lets the group decide what happens next. Universal activities are front-loaded in the first 30 minutes.
**FRs covered:** FR13, FR15, FR21, FR28a, FR28b, FR51
**Dependency note:** Reuses the democratic voting mechanism built in Epic 5 (FR27) for activity selection.

### Epic 8: Finale & Session Persistence
The party ends with a memorable 4-step finale -- highlight awards, session stats, a shareable setlist poster, and one-tap feedback. All session data (event stream, awards, participation scores) is persisted to PostgreSQL for future recall. Consumes the event stream established in Epic 2 (FR42) and participation scores from Epic 3 (FR40).
**FRs covered:** FR36, FR37, FR41, FR43, FR52, FR99, FR103, FR104

### Epic 9: Session Timeline & Memories
Authenticated users revisit past parties via a Session Timeline home screen. Tapping a session reveals full details -- participants, setlist, awards, media gallery. Guest-to-account upgrade preserves all data. "Let's go again!" drives re-engagement through existing group chats.
**FRs covered:** FR97, FR98, FR100, FR101, FR102, FR108, FR109, FR110, FR111, FR112, FR113, FR114, FR115
