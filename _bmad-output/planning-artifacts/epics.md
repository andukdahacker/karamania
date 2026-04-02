---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
  - pivot-update-2026-04-02
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/architecture.md'
  - '_bmad-output/planning-artifacts/ux-design-specification.md'
  - '_bmad-output/project-context.md'
  - '_bmad-output/planning-artifacts/sprint-change-proposal-2026-04-02.md'
lastEdited: '2026-04-02'
editHistory:
  - date: '2026-04-02'
    changes: 'Lyrics-sync pivot update per approved sprint change proposal. Added FR116-FR140 (25 new FRs) and NFR40-NFR47 (8 new NFRs) to requirements inventory. Added 3 new epics: Epic 11 (Lyrics Sync Engine, 9 stories), Epic 12 (Interactive Lyrics Games, 3 stories), Epic 13 (Progressive Feature Unlock, 5 stories). Added Epic 10 (UX Redesign, 11 stories including 4 new pivot stories 10.8-10.11). Modified Epic 2 (+Story 2.10 Song Detection Integration), Epic 4 (Story 4.7 rewritten - lightstick removed, hype signal retained; FR63-64 removed), Epic 5 (+Story 5.10 Detection Source Abstraction; ACRCloud primary, Lounge API demoted), Epic 7 (interludes gated to Social Layer). Updated FR Coverage Map with new FR mappings. Updated Additional Requirements with Audio Intelligence architecture.'
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
FR116: System detects the currently playing song via audio fingerprinting using the device microphone. Detection uses a 5-10 second audio capture burst, with results returned within 5 seconds including song title, artist, ISRC code, and playback time offset
FR117: System performs periodic re-recognition every 30 seconds to correct lyrics drift and detect song changes. Each re-sync burst captures 5 seconds of audio
FR118: When re-sync returns a different song than currently displayed, the system transitions to the new song's lyrics within 3 seconds (fetch + render)
FR119: System supports cover-song identification mode for detecting karaoke backing tracks that differ from original recordings
FR120: If audio fingerprinting detection fails after 3 consecutive attempts (15 seconds total), the system presents a manual song search allowing the user to type song title/artist. Manual selection triggers lyrics fetch and display
FR121: System optionally pairs with YouTube TV via the TV remote control API (host enters TV code) for passive song detection and queue control at YouTube-equipped venues. TV API detection supplements audio fingerprinting — if both detect, the fingerprinting service's time offset is used for lyrics sync accuracy
FR122: System maintains a detection status indicator showing current state: "Listening...", "Song detected: [title]", "No match — search manually"
FR123: System retrieves synced lyrics in LRC format from a lyrics database (primary: community-driven free source, fallback: commercial lyrics API) using detected song title + artist + duration
FR124: System displays synced lyrics with 60fps line-by-line scrolling (no frame drops) synchronized to the song's playback position, starting from the time offset returned by the audio fingerprinting service
FR125: System caches retrieved lyrics locally by song identifier (ISRC or title+artist hash). Cached lyrics are used on subsequent detections of the same song without API calls. Cache persists across sessions
FR126: When no synced lyrics are available for a detected song, the system displays the song title and artist prominently with a "Lyrics not available" message while maintaining the reactive light show and all other features
FR127: System auto-detects chant moments by identifying lyric lines that appear 2 or more times in the LRC data (chorus/hook lines). These lines are marked as chant candidates
FR128: Chant moments display with a crescendo animation: the chant text starts at normal size and progressively grows larger over the 3-5 seconds preceding the chant timestamp, reaching maximum size at the moment the chant line is sung
FR129: During chant moments, all connected phones display the chant text simultaneously with a synchronized visual highlight (screen flash, enlarged text, universal color). The reactive light show intensifies to maximum brightness during chant moments
FR130: The DJ/host can manually promote or demote chant moments via the host controls overlay — adding custom chant markers or removing auto-detected ones that don't fit
FR131: During song playback, the system randomly selects lyric lines to blank out (target: 1-2 per song, never during chant moments, never the first or last line). The blanked line shows "[???]" for 3 seconds before revealing the actual lyric
FR132: Guess The Next Line activates only after Progressive Feature Unlock Interaction Layer (songs 3-4 onward). Not active during Base Layer songs 1-2
FR133: For songs with 2+ performers, the host or any participant can activate Duet Mode from the song controls. Duet Mode assigns colors to performers (blue and gold for 2 performers, additional colors for 3+)
FR134: In Duet Mode, each performer's phone highlights their assigned lyric lines in their color. Other performers' lines appear dimmed. Chorus/chant lines display in both/all colors indicating "everyone sings"
FR135: Non-performing audience members see all colors on their screen, showing who should be singing which part
FR136: During song playback, each phone's screen background pulses color synchronized to the song's energy level — soft slow breathing during verses, intensifying pulses approaching the chorus, bright rapid pulses during the chorus, peak brightness during chant moments
FR137: Light show color intensity is derived from the song's audio energy, mapped to LRC section positions: verse timestamps = low energy (30% brightness, 2s pulse cycle), pre-chorus = rising energy (60% brightness, 1s cycle), chorus = high energy (100% brightness, 0.5s cycle)
FR138: All connected phones display the same color palette and pulse timing for a given song moment, creating a coordinated room-wide light effect
FR139: Light show is always active during song playback (Base Layer feature). No user action required to activate. Users cannot disable the light show independently — it is part of the core lyrics display experience
FR140: System tracks each user's personal song count from their join time. Features activate per-user based on their count: Songs 1-2 (Base Layer): synced lyrics, reactive light show, chant highlights, duet colors. Songs 3-4 (Interaction Layer): Guess The Next Line activates. Songs 5+ (Social Layer): party card challenges, interludes, ceremonies, all interactive features. Late joiners begin at their own Song 1 regardless of session progress

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
NFR40: Audio fingerprinting song recognition must achieve >70% accuracy in commercial karaoke rooms with typical ambient noise levels (conversation, singing, echo). Measured across minimum 3 different venue setups during PoC
NFR41: Time from song start to first lyric displayed must be <10 seconds (includes audio capture, fingerprinting API call, lyrics database fetch, and initial render)
NFR42: Lyrics sync drift must not exceed 2 seconds over a 5-minute song. Periodic re-sync (every 30 seconds) must correct drift to within 500ms
NFR43: Battery drain from periodic audio recognition (5-10s burst every 30s) must not exceed 12% per hour on a device with >80% battery health, measured on a 2-year-old mid-range Android device
NFR44: Lyrics cache must store at least 500 songs locally. Cache lookup must complete in <50ms. Cache persistence across app restarts required
NFR45: Reactive light show must maintain 60fps animation without impacting lyrics scroll performance or WebSocket message handling
NFR46: Chant moment crescendo animation must begin exactly 3 seconds before the chant timestamp (±200ms tolerance) based on the local timer synced to the fingerprinting service's time offset
NFR47: Audio fingerprinting API usage must remain within the service plan quota. A typical 3-hour session with 30-second re-sync intervals generates ~360 recognition requests. Cached song detection (same song re-detected) should skip API call and use local timer only

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
- Audio Intelligence layer: ACRCloud fingerprinting pipeline, LRCLIB/Musixmatch lyrics API, chant detection algorithm, reactive light show engine, progressive feature unlock manager
- New client components: LyricsSyncService, LyricsDisplayWidget, LightShowEngine, ChantDetector, ProgressiveUnlockManager, DuetManager
- New data models: lyrics_cache (local SQLite/Hive), detection_events, user_layer_state (per-user song counter + feature unlock state)
- New dependencies: ACRCloud SDK (flutter_acrcloud), LRCLIB API, flutter_lyric package
- New permissions: Microphone (RECORD_AUDIO) for audio fingerprinting
- Battery target: <12%/hr with periodic audio capture (5-10s burst every 30s)
- MVP schema extended: add lyrics_cache and user_layer_state tables
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
FR63: REMOVED - Lightstick mode replaced by Reactive Phone Light Show (FR136-139)
FR64: REMOVED - Lightstick mode replaced by Reactive Phone Light Show (FR136-139)
FR65: Epic 4 - Camera flash/screen hype signal
FR66: Epic 4 - Hype signal available alongside reactions and the reactive light show
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
FR116: Epic 11 - Audio fingerprinting song detection via device microphone
FR117: Epic 11 - Periodic re-recognition every 30s for drift correction and song change
FR118: Epic 11 - Song change transition within 3 seconds
FR119: Epic 11 - Cover-song identification mode for karaoke backing tracks
FR120: Epic 11 - Manual song search fallback after 3 failed attempts
FR121: Epic 5 - TV API supplements audio fingerprinting (updated Story 5.7)
FR122: Epic 11 - Detection status indicator (Listening/Detected/No match)
FR123: Epic 11 - Synced lyrics fetch in LRC format from lyrics database
FR124: Epic 11 - 60fps line-by-line lyrics scrolling synchronized to playback
FR125: Epic 11 - Local lyrics cache by song identifier
FR126: Epic 11 - Graceful "no lyrics" state with song title display
FR127: Epic 11 - Auto-detect chant moments from repeated lyric lines
FR128: Epic 11 - Chant crescendo animation (3-5s progressive text growth)
FR129: Epic 11 - Synchronized chant display on all phones with visual highlight
FR130: Epic 11 - Host manual chant moment promotion/demotion
FR131: Epic 12 - Guess The Next Line blanked lyrics during playback
FR132: Epic 12 - Guess The Next Line gated to Interaction Layer (songs 3-4+)
FR133: Epic 12 - Duet Mode activation and color assignment
FR134: Epic 12 - Duet Mode performer-specific lyric highlighting
FR135: Epic 12 - Duet Mode audience view with all performer colors
FR136: Epic 11 - Reactive light show color pulses synchronized to song energy
FR137: Epic 11 - Light show intensity mapped to LRC section positions
FR138: Epic 11 - Coordinated color palette and pulse timing across all phones
FR139: Epic 11 - Light show always active during song playback (Base Layer)
FR140: Epic 13 - Progressive feature unlock per-user song counter and layer gating

## Epic List

### Epic 1: Party Foundation
Host can create a party, guests can join via QR code or party code, and everyone sees each other in a live lobby. The real-time WebSocket infrastructure, basic authentication (guest + Firebase), and web landing page are established. This is the foundational layer that proves the core real-time connection. Includes Flutter scaffold with design token system (DJTokens, spacing, typography), DJTapButton primitive, vibe theming provider, and all foundational UX primitives that every subsequent screen depends on.
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR45, FR46, FR47, FR48, FR49, FR53, FR96, FR105, FR106, FR107
**Cross-cutting foundations:** Design tokens, DJTapButton, vibe system, LoadingState enum, AccessibilityProvider, Space Grotesk font setup

### Epic 2: Core DJ Engine & Song Experience
The party runs automatically -- the DJ engine cycles through states (song selection -> party card deal -> song -> ceremony -> interlude -> repeat), the host controls the flow via a persistent overlay, and audio cues mark every transition. Participants experience the core game loop. The state machine includes placeholder transitions for party cards (Epic 4), ceremonies (Epic 3), and interludes (Epic 7) that those epics implement with full behavior. Event stream logging is established here as core infrastructure for all subsequent epics. **Pivot update:** Song state now integrates with audio fingerprinting detection (Epic 11) — SONG_DETECTED sub-state added, layer-check guards gate card deals and interlude transitions based on progressive unlock state.
**FRs covered:** FR9, FR10, FR11, FR12, FR14, FR16, FR17, FR26, FR29, FR30, FR31, FR32, FR33, FR42, FR50
**Cross-cutting concerns:** DJ engine requires 100% unit test coverage; every epic that adds states/transitions must include regression tests. Event stream (FR42) is the audit trail consumed by Epic 8 finale and analytics.
**Pivot additions:** Story 2.10 (Song Detection Integration with DJ Engine)

### Epic 3: Ceremonies & Awards
After each song, performers receive fun, contextual awards with dramatic ceremony reveals. Full ceremonies include anticipation buildup, confetti, and moment card generation. Quick ceremonies deliver a brief award flash. Ceremony audio plays through the host phone as the dominant source. Participation scoring system is established here (passive/active/engaged tiers) and extended by Epic 4 (card challenges) and Epic 8 (end-of-night awards).
**FRs covered:** FR18a, FR18b, FR19, FR20, FR25, FR34, FR35, FR40

### Epic 4: Audience Participation & Party Cards
While songs play, the audience actively participates -- sending emoji reactions, triggering soundboard effects, and activating hype signals. Singers receive challenge cards from a curated pool of 19 that shape performances and contribute to scoring. **Pivot update:** Lightstick mode (FR63-64) REMOVED and replaced by Reactive Phone Light Show (Epic 11, FR136-139). Party card challenges gated to Social Layer (songs 5+ per user) via Progressive Feature Unlock (Epic 13). Hype signal (FR65) retained as standalone feature alongside reactions and light show.
**FRs covered:** FR22, FR23, FR24, FR54, FR55, FR56, FR57, FR58, FR59, FR60, FR61, FR62, FR65, FR66
**FRs removed:** FR63, FR64 (lightstick mode → replaced by Epic 11 light show)
**Dependency note:** Epic 6 (Media Capture) depends on the reaction event stream from this epic for peak detection (FR73). Party card gating depends on Epic 13 (Progressive Feature Unlock).
**Pivot modifications:** Story 4.7 rewritten (lightstick removed, hype signal retained)

### Epic 5: Song Integration & Discovery
The group discovers and selects songs together. Friends import playlists from YouTube Music and Spotify, the suggestion engine finds songs everyone knows with confirmed karaoke versions, and Quick Pick or Spin the Wheel makes selection a group activity. **Pivot update:** ACRCloud audio fingerprinting (Epic 11) is now the PRIMARY song detection method. YouTube TV pairing via Lounge API is DEMOTED to optional enhancement — supplements fingerprinting at YouTube-equipped venues. A unified SongContext interface abstracts detection sources so downstream consumers (lyrics, DJ engine, ceremonies) don't care how the song was detected.
**FRs covered:** FR27, FR74, FR75, FR76, FR77, FR78, FR79, FR80, FR81, FR82, FR83, FR84, FR85, FR86, FR87, FR88, FR89, FR90, FR91, FR92, FR93, FR94, FR95, FR121
**Pivot additions:** Story 5.10 (Detection Source Abstraction — unified SongContext interface)

### Epic 6: Media Capture & Sharing
Participants capture photos, videos, and audio during key moments via a floating capture bubble or persistent capture icon. Media uploads happen in the background. Reaction peak detection triggers capture prompts automatically.
**FRs covered:** FR38, FR39, FR44, FR67, FR68, FR69, FR70, FR71, FR72, FR73
**Dependency note:** Requires Epic 4 reaction event stream for peak detection (FR73). Must be implemented after Epic 4.

### Epic 7: Interlude Games & Icebreaker
Between songs, mini-games keep energy high -- Kings Cup group rules, Dare Pull random challenges, Quick Vote opinion polls, and a first-session icebreaker. Democratic voting lets the group decide what happens next. Universal activities are front-loaded in the first 30 minutes. **Pivot update:** Interludes (Kings Cup, Dare Pull) gated to Social Layer (songs 5+ per user) via Progressive Feature Unlock (Epic 13). Quick Vote remains universal (single-tap, no spotlight). Icebreaker unchanged (pre-song activity). Group sing-along now cross-references chant moments (FR127-129) from Epic 11.
**FRs covered:** FR13, FR15, FR21, FR28a, FR28b, FR51
**Dependency note:** Reuses the democratic voting mechanism built in Epic 5 (FR27) for activity selection. Interlude gating depends on Epic 13 (Progressive Feature Unlock).

### Epic 8: Finale & Session Persistence
The party ends with a memorable 4-step finale -- highlight awards, session stats, a shareable setlist poster, and one-tap feedback. All session data (event stream, awards, participation scores) is persisted to PostgreSQL for future recall. Consumes the event stream established in Epic 2 (FR42) and participation scores from Epic 3 (FR40).
**FRs covered:** FR36, FR37, FR41, FR43, FR52, FR99, FR103, FR104

### Epic 9: Session Timeline & Memories
Authenticated users revisit past parties via a Session Timeline home screen. Tapping a session reveals full details -- participants, setlist, awards, media gallery. Guest-to-account upgrade preserves all data. "Let's go again!" drives re-engagement through existing group chats.
**FRs covered:** FR97, FR98, FR100, FR101, FR102, FR108, FR109, FR110, FR111, FR112, FR113, FR114, FR115

### Epic 10: UX Redesign & Brand Identity
Comprehensive visual and interaction redesign bringing brand identity, consistent styling, and polished UX across all screens. **Pivot update:** During-song screen completely redesigned around lyrics-first layout. New stories added for lyrics display, duet mode visuals, progressive unlock transitions, and detection/fallback UX. Lightstick screens/wireframes removed.
**FRs covered:** UX polish stories (10.1-10.7), FR124 (lyrics display), FR133-FR135 (duet visuals), FR140 (progressive unlock transitions), FR122 (detection status UX)
**Pivot additions:** Stories 10.8-10.11 (Lyrics Display Screen, Duet Mode Visuals, Progressive Unlock Transitions, Detection & Fallback UX)

### Epic 11: Lyrics Sync Engine
The core differentiator — real-time song detection via audio fingerprinting, synced lyrics display on every phone, chant moment detection with crescendo animations, and a reactive phone light show that pulses with the music. This is the "audio intelligence layer" that makes Karamania the only karaoke companion that knows what song is playing and reacts to it in real-time. Works at ANY venue regardless of karaoke system — just a microphone listening to what's playing.
**FRs covered:** FR116, FR117, FR118, FR119, FR120, FR122, FR123, FR124, FR125, FR126, FR127, FR128, FR129, FR130, FR136, FR137, FR138, FR139
**NFRs:** NFR40 (recognition accuracy), NFR41 (lyrics latency), NFR42 (sync drift), NFR43 (battery drain), NFR44 (lyrics cache), NFR45 (light show fps), NFR46 (chant timing), NFR47 (API quota)
**Dependency note:** Requires Epic 1 (WebSocket infrastructure) and Epic 2 (DJ engine song state). Provides song detection data consumed by Epic 12 (Interactive Lyrics Games) and Epic 13 (Progressive Feature Unlock). Detection source abstracted via Epic 5 Story 5.10 (SongContext interface).

### Epic 12: Interactive Lyrics Games
Interactive features layered on top of the lyrics sync engine — Guess The Next Line blanks random lyrics for the audience to anticipate, and Duet Colors assigns performer-specific colors to lyric lines for multi-singer songs. These features activate progressively (Guess The Next Line at Interaction Layer, songs 3-4+).
**FRs covered:** FR131, FR132, FR133, FR134, FR135
**Dependency note:** Requires Epic 11 (lyrics sync engine for lyric data) and Epic 13 (progressive unlock for feature gating).

### Epic 13: Progressive Feature Unlock
Per-user feature gating system that reveals capabilities gradually over the session. Each user tracks their own song count from join time. Base Layer (songs 1-2): synced lyrics, reactive light show, chant highlights, duet colors. Interaction Layer (songs 3-4): Guess The Next Line activates. Social Layer (songs 5+): party card challenges, interludes, ceremonies, all interactive features. Late joiners start at their own Song 1 regardless of session progress.
**FRs covered:** FR140
**Cross-cutting impact:** Gates features in Epic 4 (party cards → Social Layer), Epic 7 (interludes → Social Layer, Quick Vote universal), Epic 12 (Guess The Next Line → Interaction Layer). Requires Epic 2 DJ engine awareness of user layer state for transition guards.

---

## Epic 1: Party Foundation

Host can create a party, guests can join via QR code or party code, and everyone sees each other in a live lobby. The real-time WebSocket infrastructure, basic authentication (guest + Firebase), and web landing page are established. This is the foundational layer that proves the core real-time connection. Includes Flutter scaffold with design token system (DJTokens, spacing, typography), DJTapButton primitive, vibe theming provider, and all foundational UX primitives that every subsequent screen depends on.

### Story 1.1: Flutter App Scaffold & Design Token System

As a developer,
I want a fully scaffolded Flutter app with design tokens, core primitives, and foundational UX infrastructure,
So that all subsequent screens and features build on a consistent, accessible design system.

**Acceptance Criteria:**

**Given** the Flutter project is created with `--org com.karamania --project-name karamania`
**When** the app is built and launched
**Then** the DJTokens class provides all 12 constant design tokens (spacing: xs=4, sm=8, md=16, lg=24, xl=32; plus typography and color tokens) and 4 vibe-shifting tokens
**And** the DJTapButton widget implements three tap tiers (Consequential 64x64px, Social 56x56px, Private 48x48px) with haptic firing before handler on touch-down and scale feedback per tier
**And** a vibe theming provider supports 5 party vibes (PartyVibe enum) propagating through the visual layer
**And** the LoadingState enum (idle, loading, success, error) is available for per-operation async state tracking
**And** an AccessibilityProvider supports prefers-reduced-motion / MediaQuery.disableAnimations
**And** Space Grotesk variable font is loaded and subsetted for Latin + Vietnamese (<25KB) with 6 type roles
**And** a centralized string constants module (`constants/copy.dart`) is created for all user-facing strings (NFR38)
**And** all vibe palettes meet WCAG AA contrast ratio (>4.5:1 for normal text, >3:1 for large text) (NFR17)
**And** SafeArea wraps all content with no content behind notch/dynamic island/gesture bar

### Story 1.2: Server Foundation & Database Schema

As a developer,
I want a production-ready server with database connectivity and initial schema,
So that all backend features have a solid foundation to build on.

**Acceptance Criteria:**

**Given** the server project is initialized in `apps/server/` with Fastify 5 + TypeScript strict ESM
**When** the server starts
**Then** it connects to PostgreSQL via Kysely and runs migrations for `users`, `sessions`, and `session_participants` tables matching the MVP schema
**And** Pino structured logging is configured for all request/response cycles
**And** environment variables are loaded (`DATABASE_URL`, `JWT_SECRET`, `YOUTUBE_API_KEY`, `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, Firebase credentials)
**And** a `/health` endpoint returns server status and database connectivity
**And** Zod type provider is configured with `fastify-type-provider-zod` v6.1.0
**And** the server directory structure follows the architecture: `src/{db,dj-engine,socket-handlers,integrations,services,persistence,routes,shared/schemas}`, `migrations/`, `scripts/`, `tests/`
**And** `kysely-codegen` generates `db/types.ts` from live schema (DO NOT EDIT file)
**And** REST responses follow `{ data: {...} }` or `{ error: { code, message } }` wrapping
**And** GitHub Actions CI pipeline (`server-ci.yml`) runs Vitest + kysely-codegen type check
**And** all file names use `kebab-case.ts` convention
**And** imports use relative paths with `.js` extension, no barrel files, no tsconfig aliases

### Story 1.3: Authentication & WebSocket Infrastructure

As a party participant,
I want to connect securely to the party server via WebSocket with either a guest name or my Google/Facebook account,
So that I can participate in real-time party activities with a verified identity.

**Acceptance Criteria:**

**Given** a user opens the app
**When** they choose to join as a guest with a display name
**Then** the server issues a session-scoped JWT via the `jose` library with a 6-hour TTL
**And** the WebSocket handshake completes within 500ms (NFR34)

**Given** a user opens the app
**When** they sign in via Google or Facebook OAuth (Firebase Auth Flutter SDK) (FR96)
**Then** the Firebase JWT is validated on the server via Firebase Admin SDK
**And** the WebSocket handshake completes within 500ms

**Given** either auth path (guest or Firebase)
**When** the WebSocket connection is established
**Then** both paths produce identical `socket.data` shape
**And** auth status affects persistence only, never in-party capabilities (FR105)
**And** Socket.io uses namespace:action event naming convention
**And** socket handler pattern is established: one file per namespace in `socket-handlers/`, each exporting `registerXHandlers(socket, session)`
**And** WebSocket connections are authenticated to their session -- no cross-session event injection (NFR25)
**And** session data is isolated between parties (NFR24)

### Story 1.4: Party Creation & QR Code Generation

As a host,
I want to create a new karaoke party and receive a QR code and party code,
So that I can invite friends to join my party easily.

**Acceptance Criteria:**

**Given** an authenticated or guest user is on the home screen
**When** they tap "Start Party"
**Then** a new session is created in the database with a unique 4-digit party code and status "lobby"
**And** a QR code is generated that encodes the web landing page URL with the party code
**And** the host sees both the QR code and the 4-digit party code displayed prominently
**And** TV pairing is presented as optional at party creation (FR95)
**And** the host can select a party vibe (PartyVibe enum) that persists to the session record
**And** party codes expire after session end and are not reusable (NFR21)
**And** the interaction requires only single taps on targets no smaller than 48x48px (NFR14)
**And** no configuration, settings, or preferences are required beyond starting the party (NFR20)

### Story 1.5: Web Landing Page & Deep Linking

As a guest receiving a party invitation,
I want to scan a QR code or visit a URL and seamlessly get into the app with the party code pre-filled,
So that joining is frictionless regardless of whether I have the app installed.

**Acceptance Criteria:**

**Given** a user scans the party QR code or visits the landing page URL
**When** the page loads
**Then** it loads in <2s on 4G and is under 50KB total (NFR39)
**And** the page detects the user's platform (iOS/Android)
**And** if the app is installed, Universal Links (iOS 15+) / App Links (Android 8+) deep-link into the app with the party code pre-filled (FR106)
**And** if the app is not installed, the user is redirected to the appropriate app store with a "Download to join the party" message (FR106)
**And** if deep link fails, a graceful fallback to app store redirect is provided (NFR39)

**Given** a user navigates to the landing page directly (not via QR)
**When** the page loads
**Then** a manual party code entry field is displayed (FR107)
**And** the page is plain HTML/JS/CSS with no build step

### Story 1.6: Party Join Flow & Live Lobby

As a guest,
I want to join a party by entering a code and my name, then see who else is in the party,
So that I feel connected to the group before the party starts.

**Acceptance Criteria:**

**Given** a guest has the party code (from QR deep-link or manual entry)
**When** they enter a display name and tap "Join"
**Then** visual feedback appears within 200ms showing party status and player count before WebSocket is fully established (FR53)
**And** the WebSocket connection is established and the guest joins the party session
**And** all participants see a live party lobby showing who has joined and the current player count (FR4)
**And** the lobby updates in real-time as new participants join
**And** no text input is required beyond the display name (NFR15)
**And** the join screen is usable on first encounter without instructions (NFR16)

**Given** fewer than 3 players are in the party
**When** the lobby is displayed
**Then** a waiting state shows current player count, QR code, and a share prompt to invite more participants (FR8)

**Given** no personally identifiable information is stored for guest users beyond display name and session participation data (NFR22)

### Story 1.7: Party Start & Mid-Session Join

As a host,
I want to start the party when enough people have joined, and allow latecomers to join seamlessly,
So that the party begins when the group is ready and nobody is left out.

**Acceptance Criteria:**

**Given** the host is in the lobby with participants
**When** the host taps "Start Party"
**Then** all connected phones transition to the first activity state (FR5)
**And** the session status updates to "active"

**Given** a party is already in progress
**When** a new participant joins mid-session
**Then** they receive a catch-up summary of current party stats (FR6)
**And** the late join flow shows: loading skeleton -> catch-up card (3s max) -> current DJ state

**Given** a party is active
**When** the host wants to invite more people
**Then** the host can re-display the QR code and party code at any point (FR7)

### Story 1.8: Connection Resilience & Disconnection Handling

As a party participant,
I want the party to continue smoothly even if my phone briefly loses connection,
So that network hiccups don't ruin the party experience.

**Acceptance Criteria:**

**Given** a participant is connected to an active party
**When** their connection drops
**Then** disconnection is detected via heartbeat monitoring (FR46)
**And** the participant list updates accordingly on all other devices
**And** the DJ engine and party continue operating normally (FR49)

**Given** a participant has disconnected
**When** they reconnect within 5 minutes
**Then** they are automatically synced to the current DJ state within 2 seconds without user action (FR47)
**And** their session history and participation scores are preserved (FR48)

**Given** a brief network interruption (<5s)
**When** the participant reconnects
**Then** no error state or loading spinner is shown -- the view resumes at current DJ state (NFR9)

**Given** the host disconnects
**When** 60 seconds pass without host reconnection
**Then** host controls transfer to the next-longest-connected participant (FR49)

**Given** any participant disconnects or reconnects
**When** the party state is checked
**Then** all session state is fully recoverable from the server -- no client-only state lost on app restart (NFR10)
**And** auto-reconnect uses socket_io_client (500ms initial, 3s max, 20 attempts)

---

## Epic 2: Core DJ Engine & Song Experience

The party runs automatically -- the DJ engine cycles through states (song selection -> party card deal -> song -> ceremony -> interlude -> repeat), the host controls the flow via a persistent overlay, and audio cues mark every transition. Participants experience the core game loop. The state machine includes placeholder transitions for party cards (Epic 4), ceremonies (Epic 3), and interludes (Epic 7) that those epics implement with full behavior. Event stream logging is established here as core infrastructure for all subsequent epics. Song state now integrates with audio fingerprinting detection (Epic 11) via Story 2.10 — SONG_DETECTED sub-state added, layer-check guards gate card deals and interlude transitions based on progressive unlock state.

### Story 2.1: DJ Engine State Machine (Server)

As a developer,
I want a pure-logic state machine that governs the party game loop,
So that the party cycles through activities automatically with well-defined transitions and guards.

**Acceptance Criteria:**

**Given** the DJ engine is implemented in `dj-engine/` with zero imports from persistence, integrations, or socket-handlers
**When** the engine is initialized for a session
**Then** it implements the core cycle: song selection -> party card deal -> song -> ceremony -> interlude -> repeat (FR9)
**And** all state transitions have defined guards that must be satisfied before transitioning
**And** each state has configurable timeouts that trigger automatic advancement
**And** placeholder transitions exist for party cards (Epic 4), ceremonies (Epic 3), and interludes (Epic 7)
**And** the state machine is fully serializable (toJSON/fromJSON) for persistence round-trips
**And** 100% unit test coverage is achieved for all states, transitions, guards, timers, and serialization round-trips
**And** shared test factories in `tests/factories/` are used -- no inline test data
**And** the engine handles concurrent state transition requests without race conditions (NFR11)

### Story 2.2: DJ State Persistence

As a system operator,
I want DJ state persisted on every transition,
So that the server always has the latest party state in the database as the source of truth.

**Acceptance Criteria:**

**Given** the DJ engine transitions to a new state
**When** the transition completes
**Then** the full DJ state is serialized as JSONB and written to the `sessions.dj_state` column via async fire-and-forget
**And** in-memory state serves as the hot cache while PostgreSQL is the source of truth
**And** persistence writes go through `persistence/` layer only -- the only layer that imports from `db/`
**And** `services/session-manager.ts` orchestrates across layers as the only cross-boundary service

### Story 2.3: Server Restart Recovery

As a system operator,
I want active parties to recover automatically after a server restart,
So that no party is lost due to server issues.

**Acceptance Criteria:**

**Given** the server restarts
**When** active sessions exist in the database
**Then** the server reads active sessions and reconstructs DJ state from the JSONB column
**And** timers are reconciled based on the persisted state and elapsed time since last transition
**And** connected clients receive a `dj:stateChanged` event with the recovered state

**Given** DJ state recovery fails for a session
**When** reconstruction cannot complete
**Then** graceful termination sends "session ended unexpectedly" to all connected clients (NFR13)

**Given** recovery is tested
**When** unit tests run
**Then** all recovery scenarios are covered: mid-song, mid-ceremony, mid-interlude, paused state, and lobby state

### Story 2.4: DJ State Broadcasting & Flutter State Display

As a party participant,
I want to see the current party activity update in real-time on my phone,
So that I always know what's happening in the party.

**Acceptance Criteria:**

**Given** the DJ engine transitions to a new state on the server
**When** the state change is emitted
**Then** all connected participants receive the `dj:stateChanged` event within 200ms (NFR1)
**And** the Flutter app renders at 60fps with <100ms input response time with up to 12 participants (NFR5)

**Given** the Flutter app receives a `dj:stateChanged` event
**When** the SocketClient singleton processes it
**Then** it mutates the appropriate provider (only SocketClient calls mutation methods on providers)
**And** the single `/party` route switches the displayed screen based on the current DJ state
**And** widgets use `context.watch<T>()` for read-only provider access
**And** no widget creates its own socket listener

**Given** a participant is in an active party state
**When** any activity is displayed
**Then** `wakelock_plus` prevents phone screen auto-lock (FR50)

### Story 2.5: Host Controls Overlay

As a host,
I want quick access to party controls without leaving the participant experience,
So that I can manage the party flow seamlessly.

**Acceptance Criteria:**

**Given** the host is viewing any participant screen during an active party
**When** they tap the persistent floating action button (bottom-right corner)
**Then** a control overlay expands within 1 tap, accessible in <1 second from any screen state (FR29, NFR19)

**Given** the host control overlay is open
**When** the host interacts with controls
**Then** they can skip the current activity and advance to the next DJ state (FR30)
**And** they can manually pause the DJ engine (FR31)
**And** they can resume a paused DJ engine (FR31)
**And** they can override the DJ's next activity selection (FR32)
**And** they can kick a player from the session
**And** they can end the party (FR33)
**And** all controls are accessible without navigating away from the participant view (FR33)
**And** all tap targets are no smaller than 48x48px (NFR14)

**Given** a song is in progress
**When** the host views the participant screen
**Then** a persistent, always-visible "Song Over!" trigger is displayed allowing the host to signal that a song has ended (FR16)

### Story 2.6: Pause, Resume & Bridge Moments

As a host,
I want the party to pause gracefully during breaks and build hype before each song,
So that the energy flows naturally with the real-world activity.

**Acceptance Criteria:**

**Given** an active party session
**When** the host triggers pause via the control overlay
**Then** the DJ engine enters pause state and all participants see a paused indicator (FR11)

**Given** an active party session
**When** 90+ seconds of inactivity is detected across all users
**Then** the system auto-triggers pause state (FR11)

**Given** the party is paused
**When** the host un-pauses or activity resumes
**Then** the DJ engine resumes to the next state in the cycle: if mid-song -> song, if mid-ceremony -> ceremony, if mid-interlude -> interlude (FR12)

**Given** a physical-world transition is occurring (first song prompt, song selection, mic handoff)
**When** the DJ engine reaches a bridge moment
**Then** bridge moment activities are displayed to maintain engagement during the transition (FR10)

**Given** the next performer has been determined
**When** the DJ engine enters the pre-song state
**Then** a pre-song hype announcement showing the next performer's name is displayed on all phones (FR17)

### Story 2.7: Audio Cues & State Transition Sounds

As a party participant,
I want to hear distinct sounds when the party transitions between activities,
So that I know what's happening even when I'm not looking at my phone.

**Acceptance Criteria:**

**Given** the DJ engine transitions between states
**When** a state change occurs
**Then** a unique audio cue plays for each transition type: song start, ceremony start, interlude start, and party card deal -- minimum 4 distinct sounds (FR26, NFR18)
**And** each audio cue is at least 0.5s duration (FR26)
**And** audio cues are audible at phone speaker volume (NFR18)

**Given** the app is installed
**When** audio assets are loaded
**Then** all audio is bundled with the app and playable within 50ms of trigger -- no network round-trip (NFR6)
**And** total audio assets contribute to keeping app install size under 50MB (NFR7)
**And** audio assets are <500KB total with 10 core assets

### Story 2.8: Event Stream Logging

As a system,
I want every state transition, user action, and DJ decision logged as structured events,
So that session history can be reconstructed and analytics derived post-session.

**Acceptance Criteria:**

**Given** any state transition, user action, or DJ decision occurs during a party
**When** the event is generated
**Then** it is logged as a structured event with schema: `{sessionId, userId, eventType, timestamp, metadata}` (FR42)
**And** logging is asynchronous and adds no more than 5ms latency to any user-facing operation (NFR26)

**Given** events are being logged during a session
**When** the session is active
**Then** events are stored in an in-memory array

**Given** a session ends
**When** the event stream is finalized
**Then** the complete event stream is batch-written to the `sessions.event_stream` JSONB column in PostgreSQL

### Story 2.9: Ceremony Type Selection Rules

As a system,
I want ceremony types selected automatically based on session context,
So that the ceremony variety keeps the party engaging without repetition.

**Acceptance Criteria:**

**Given** a song has just ended
**When** the DJ engine determines the ceremony type
**Then** Full ceremony is selected for the first song of the session (FR14)
**And** Full ceremony is selected for the first song after an interlude (FR14)
**And** two consecutive Full ceremonies never occur (FR14)
**And** Quick ceremony is the default after song 5 in the session (FR14)

**Given** a ceremony is about to start
**When** the host uses the control overlay
**Then** the host can skip any ceremony entirely (FR14)

**Given** fewer than 3 participants are in the party
**When** the DJ engine selects a ceremony type
**Then** it defaults to Quick ceremony type (NFR12)
**And** group interludes (Kings Cup, Dare Pull) are skipped (NFR12)
**And** party cards requiring 3+ participants are disabled (NFR12)
**And** the DJ engine continues cycling with song -> ceremony -> song (NFR12)

### Story 2.10: Song Detection Integration with DJ Engine (Pivot)

As a system,
I want the DJ engine to be aware of audio fingerprinting song detection events,
So that the party flow reacts to what song is actually playing in the room.

**Acceptance Criteria:**

**Given** the DJ engine is in SONG state
**When** a song detection event is received from the audio fingerprinting service (Epic 11, FR116)
**Then** the engine transitions to a SONG_DETECTED sub-state
**And** the detected song metadata (title, artist, ISRC, time offset) is stored in the current DJ state
**And** the song metadata is broadcast to all connected clients via WebSocket

**Given** the DJ engine receives a song change event (FR118)
**When** the re-recognition detects a different song than currently tracked
**Then** the engine updates the song metadata in DJ state within 3 seconds
**And** all connected clients receive the updated song context

**Given** the DJ engine is evaluating a transition to party card deal or interlude
**When** the transition guard checks the user's progressive unlock layer (Epic 13, FR140)
**Then** party card deals are only permitted for users at Social Layer (songs 5+)
**And** interlude transitions (Kings Cup, Dare Pull) are only permitted when all users have reached Social Layer
**And** Quick Vote interludes remain available at all layers

**Given** no song detection service is available (user denied microphone, API failure)
**When** the DJ engine operates without detection
**Then** the engine falls back to manual "now playing" mode (FR94) and proceeds normally
**And** party cards and interludes remain ungated (legacy behavior without progressive unlock)

---

## Epic 3: Ceremonies & Awards

After each song, performers receive fun, contextual awards with dramatic ceremony reveals. Full ceremonies include anticipation buildup, confetti, and moment card generation. Quick ceremonies deliver a brief award flash. Ceremony audio plays through the host phone as the dominant source. Participation scoring system is established here (passive/active/engaged tiers) and extended by Epic 4 (card challenges) and Epic 8 (end-of-night awards).

### Story 3.1: Participation Scoring System

As a system,
I want to track weighted participation scores for each user across three engagement tiers,
So that contributions beyond singing are recognized and rewarded.

**Acceptance Criteria:**

**Given** a participant is in an active party session
**When** they perform actions during the session
**Then** actions are scored across three tiers: passive (1pt), active (3pts), engaged (5pts) (FR40)
**And** scores are tracked per user per session on the server

**Given** scores are being tracked
**When** the session is active
**Then** the `session_participants.participation_score` column is updated via the persistence layer
**And** score updates are logged to the event stream (FR42)

**Given** the scoring system is established
**When** future epics extend it
**Then** Epic 4 card challenges contribute to the engaged tier (5pts)
**And** Epic 8 consumes scores for end-of-night awards

### Story 3.2: Award Template Engine

As a system,
I want to auto-generate contextual, fun award titles from a diverse template pool,
So that every performer receives a unique and entertaining recognition.

**Acceptance Criteria:**

**Given** a song has just ended and a ceremony is triggered
**When** the system generates an award
**Then** it selects from a pool of 20+ award templates (FR18a)
**And** templates cover a range of tones: comedic, hype, absurd, and wholesome (FR20)
**And** selection is driven by session context: party card accepted/completed, reaction volume during song, song position in session, and performer's cumulative stats (FR18a)
**And** no audience voting or performance scoring is used in award generation (FR18a)
**And** awards are generated server-side within the ceremony timing window

### Story 3.3: Full Ceremony Experience

As a party participant,
I want a dramatic ceremony reveal after key songs that builds anticipation and celebrates the performer,
So that every performance feels like a special moment.

**Acceptance Criteria:**

**Given** a Full ceremony is triggered after a song
**When** the ceremony sequence begins
**Then** an anticipation buildup phase plays with animation on all devices
**And** confetti animation fires on the award reveal
**And** the award reveal appears on all connected devices within a 200ms window of each other using server-coordinated timing (NFR27)
**And** the complete ceremony (award generation and reveal) completes within 3 seconds of the host triggering "Song Over!" (NFR4)

**Given** a Full ceremony is in progress
**When** ceremony audio plays
**Then** fanfares and reveals play through the host's phone as the dominant audio source (FR25)
**And** audio follows the Ceremonial volume level (100%) on host, spatial audio (60%) on participants

**Given** the host signals "Song Over!" via the persistent always-visible trigger during song state (FR16)
**When** the trigger is activated
**Then** the DJ engine transitions to the ceremony state

### Story 3.4: Quick Ceremony

As a party participant,
I want a brief award flash after less prominent songs,
So that every performer gets recognized without slowing the party's momentum.

**Acceptance Criteria:**

**Given** a Quick ceremony is triggered after a song
**When** the ceremony sequence begins
**Then** a brief award flash displays with the one-liner award title and a short animation (FR19)
**And** the reveal is synchronized across all devices within 200ms (NFR27)
**And** no anticipation buildup phase is shown (streamlined compared to Full ceremony)
**And** the same award template engine from Story 3.2 generates the award

**Given** the ceremony reveal timing
**When** the Quick ceremony displays
**Then** it auto-advances after 8-10 seconds (soft auto-advance)

### Story 3.5: Moment Card Generation & Sharing

As a party participant,
I want a shareable moment card created for each Full ceremony,
So that I can share my karaoke highlights with friends outside the party.

**Acceptance Criteria:**

**Given** a Full ceremony has completed
**When** the award is revealed
**Then** a moment card is generated combining the performer name, song title, and award (FR18b, FR34)

**Given** a moment card has been generated
**When** a participant wants to share it
**Then** they can share via the native mobile share sheet with a single tap (FR35)
**And** the share intent tap is tracked as a viral signal metric

**Given** the moment card is displayed
**When** the participant views it
**Then** the card reflects the current party vibe's visual style

---

## Epic 4: Audience Participation & Party Cards

While songs play, the audience actively participates -- sending emoji reactions, triggering soundboard effects, and activating hype signals. Singers receive challenge cards from a curated pool of 19 that shape performances and contribute to scoring. Lightstick mode has been removed and replaced by the Reactive Phone Light Show (Epic 11). Party card challenges are gated to Social Layer (songs 5+ per user) via Progressive Feature Unlock (Epic 13).

### Story 4.1: Emoji Reactions System

As a party participant,
I want to send emoji reactions during performances that appear instantly on everyone's phone,
So that I can cheer on the performer and feel the group energy in real-time.

**Acceptance Criteria:**

**Given** a song is being performed
**When** a participant taps an emoji reaction
**Then** the reaction appears on all connected phones within 100ms of the originating tap (FR22, NFR2)
**And** the app maintains 60fps rendering with up to 12 participants each sending reactions at peak rate (2 taps/second) (NFR5)
**And** client memory usage does not grow by more than 15MB over a 3-hour session with typical reaction patterns (NFR28)
**And** reaction tap targets are no smaller than 48x48px (NFR14)

**Given** a participant is sending reactions rapidly
**When** they exceed 10 events in 5 seconds
**Then** each subsequent event earns 50% fewer participation points and visual feedback dims proportionally (NFR23)
**And** after 20 events in 5 seconds, reward and feedback diminish to near-zero (NFR23)
**And** no hard block occurs -- the user can always tap (NFR23)
**And** rate limiting resets after 5 seconds of inactivity (NFR23)

**Given** rate limiting is implemented
**When** it checks an event
**Then** the pure function in `services/rate-limiter.ts` has no Socket.io dependency

### Story 4.2: Reaction Streaks & Milestones

As a party participant,
I want to see my reaction streak milestones as I cheer continuously,
So that I feel rewarded for sustained engagement during performances.

**Acceptance Criteria:**

**Given** a participant is sending consecutive emoji reactions
**When** they reach streak milestones
**Then** streak milestones are displayed at 5, 10, 20, and 50 consecutive reactions (FR23)
**And** milestones are displayed only to the reacting user

**Given** a participant achieves reaction streaks
**When** the participation score is updated
**Then** reaction activity contributes to the active participation tier (3pts) (FR40)

### Story 4.3: Soundboard Effects

As a party participant,
I want to trigger fun sound effects during performances,
So that I can add comedic or hype moments to the live experience.

**Acceptance Criteria:**

**Given** a song is being performed
**When** a participant taps a soundboard button
**Then** the sound effect (4-6 available sounds) plays audibly through their phone speaker (FR24)
**And** audio playback begins within 50ms of tap (NFR3)
**And** sound assets are bundled with the app -- no network round-trip on playback (NFR6)
**And** soundboard tap targets are no smaller than 48x48px (NFR14)

**Given** a participant is triggering soundboard effects rapidly
**When** rate limiting thresholds are exceeded
**Then** the same rate limiting rules apply as emoji reactions (NFR23)
**And** soundboard events contribute to participation scoring

### Story 4.4: Party Card Pool & Deal System

As a singer,
I want to receive a fun challenge card before my performance,
So that my song has an entertaining twist that engages the whole group.

**Acceptance Criteria:**

**Given** the DJ engine enters the pre-song state for a singer
**When** the party card deal phase begins
**Then** a random party card is dealt from the curated pool of 19 cards (FR54)
**And** the pool contains 7 vocal modifier cards: Chipmunk Mode, Barry White, The Whisperer, Robot Mode, Opera Singer, Accent Roulette, Beatboxer (FR56)
**And** the pool contains 7 performance modifier cards: Blind Karaoke, Method Actor, The Statue, Slow Motion, The Drunk Uncle, News Anchor, Interpretive Dance (FR57)
**And** the pool contains 5 group involvement cards: Name That Tune, Backup Dancers, Crowd Conductor, Tag Team, Hype Squad (FR58)
**And** the card is presented with a slide-up flip animation (FR55)
**And** cards have visual type differentiation: blue borders (vocal), purple borders (performance), gold borders (group involvement)

**Given** the app auto-deals by default
**When** the host wants to intervene
**Then** the host can override card selection or disable dealing for a turn via the control overlay (FR54)

### Story 4.5: Party Card Interaction & Scoring

As a singer,
I want to accept, dismiss, or redraw my challenge card quickly,
So that I have agency over the challenge without slowing the party.

**Acceptance Criteria:**

**Given** a party card has been dealt to a singer
**When** the singer views the card
**Then** they can accept or dismiss the card with a single tap (FR59)
**And** the card has an 8s soft auto-dismiss timer

**Given** a singer doesn't like their card
**When** they tap redraw
**Then** they receive one free redraw per turn (FR59)
**And** after the redraw, they must accept or dismiss -- no further redraws (FR59)

**Given** a singer accepts a party card
**When** the card challenge is tracked
**Then** party card acceptance rate is tracked per session (FR61)
**And** completed party card challenges contribute to ceremony awards and weighted participation scoring at the engaged tier (5pts) (FR62)

### Story 4.6: Group Involvement Cards

As a party participant,
I want group involvement cards to pull random people into the performance,
So that the whole group gets spontaneously involved beyond just watching.

**Acceptance Criteria:**

**Given** a group involvement card is dealt (Tag Team, Backup Dancers, Hype Squad, Crowd Conductor, or Name That Tune)
**When** the card is accepted by the singer
**Then** random participants are selected and the selection is announced on all phones (FR60)
**And** no consent flow is required -- social dynamics handle opt-outs (FR60)

**Given** fewer than 3 participants are in the party
**When** the DJ engine deals party cards
**Then** group involvement cards that require 3+ participants are disabled (NFR12)

### Story 4.7: Hype Signal (Pivot: Lightstick Removed)

As an audience member,
I want to flash encouragement at the performer via a screen pulse and flashlight,
So that I can physically signal my support during their performance.

**Acceptance Criteria:**

**Given** a song is being performed
**When** a participant wants to encourage the performer
**Then** they can activate a hype signal — a screen-based pulse effect with device flashlight activation via native API (FR65)
**And** the hype signal works uniformly on both iOS and Android (FR65)

**Given** the reactive light show is active (Epic 11, FR136-139)
**When** a participant activates the hype signal
**Then** the hype signal is available alongside reactions and the reactive light show (FR66)
**And** participants can trigger hype signals freely during a song without interrupting the light show or lyrics display

**Pivot Note:** Lightstick mode (FR63, FR64) has been REMOVED and replaced by the Reactive Phone Light Show (Epic 11, FR136-139). The light show is automatic, music-synced, and requires zero interaction — a fundamentally different approach from the manual lightstick toggle. Hype signal (FR65) is retained as a deliberate audience action alongside the automatic light show.

---

## Epic 5: Song Integration & Discovery

The group discovers and selects songs together. Friends import playlists from YouTube Music and Spotify, the suggestion engine finds songs everyone knows with confirmed karaoke versions, and Quick Pick or Spin the Wheel makes selection a group activity. ACRCloud audio fingerprinting (Epic 11) is now the primary song detection method. YouTube TV pairing via Lounge API is demoted to optional enhancement. Story 5.10 introduces a unified SongContext interface to abstract detection sources.

### Story 5.1: Karaoke Catalog Index

As a system,
I want a pre-built catalog of 10,000+ karaoke tracks stored server-side,
So that song suggestions can be matched against confirmed karaoke versions without live API calls during parties.

**Acceptance Criteria:**

**Given** the karaoke catalog system is set up
**When** the catalog is populated
**Then** it contains 10,000+ tracks scraped from popular karaoke YouTube channels with `{song_title, artist, youtube_video_id}` per entry (FR85)
**And** an `is_classic` boolean flag marks the top 200 universally known karaoke songs for cold start fallback (FR91)
**And** the `karaoke_catalog` table migration creates `id`, `song_title`, `artist`, `youtube_video_id`, `channel`, `created_at`, `updated_at` columns

**Given** catalog data needs to be refreshed
**When** the offline scraper script in `scripts/` is run
**Then** the catalog is updated without affecting live sessions
**And** catalog refresh happens offline on a weekly or configurable schedule (NFR32)

**Given** a party session is active
**When** song matching is performed
**Then** no live API calls are required -- all matching uses the pre-built catalog (NFR32)

### Story 5.2: Playlist Import - YouTube Music

As a party participant,
I want to paste my YouTube Music playlist link and have my songs imported,
So that my music taste contributes to the group's song suggestions.

**Acceptance Criteria:**

**Given** a participant pastes a URL
**When** the URL matches `music.youtube.com`
**Then** the system detects it as a YouTube Music playlist (FR80)

**Given** a YouTube Music playlist URL is detected
**When** the import begins
**Then** playlist contents are read via the YouTube Data API v3 using an API key -- no user login required (FR81)
**And** paginated retrieval handles playlists with 50+ tracks (FR81)
**And** import completes within 5 seconds for playlists of up to 200 tracks (NFR29)
**And** API usage remains within the free tier quota: <500 units per session, 10,000 units per day (NFR30)

### Story 5.3: Playlist Import - Spotify

As a party participant,
I want to paste my Spotify playlist link and have my songs imported,
So that Spotify users can contribute their music taste to the group.

**Acceptance Criteria:**

**Given** a participant pastes a URL
**When** the URL matches `open.spotify.com`
**Then** the system detects it as a Spotify playlist (FR80)

**Given** a Spotify playlist URL is detected
**When** the import begins
**Then** public playlist contents are read via the Spotify Web API Client Credentials flow -- no user login required (FR82)
**And** the Spotify Client Credentials token is managed server-side with automatic refresh before expiry (NFR33)
**And** no token exposure to the client (NFR33)
**And** import completes within 5 seconds for playlists of up to 200 tracks (NFR29)

**Given** a Spotify playlist is private and cannot be read
**When** the import fails
**Then** the system displays a 3-step visual guide instructing the user to make their playlist public, then retry (FR83)

### Story 5.4: Song Normalization & Suggestion Engine

As a system,
I want to merge imported songs across platforms and generate smart suggestions,
So that the group gets song recommendations everyone knows with confirmed karaoke versions.

**Acceptance Criteria:**

**Given** songs have been imported from multiple participants' playlists
**When** normalization runs
**Then** songs are matched across platforms by title + artist name (FR84)
**And** duplicate songs from multiple friends' playlists are merged with an overlap count tracking how many friends share each song (FR84)

**Given** normalized songs are available
**When** the suggestion engine computes recommendations
**Then** suggestions are: (imported playlist songs UNION previously sung songs) INTERSECT Karaoke Catalog Index -- only songs with confirmed karaoke versions appear (FR86)

**Given** suggestions are generated
**When** they are ranked
**Then** ranking prioritizes: (1) group overlap count -- songs known by more friends rank higher, (2) genre momentum -- if last 3 songs were same genre, bias toward different genre, (3) not-yet-sung -- songs not performed in current session rank higher (FR87)

**Given** no playlists have been imported and no songs have been sung yet (cold start)
**When** the suggestion engine runs
**Then** it falls back to the Karaoke Classics subset (top 200 universally known karaoke songs with `is_classic = true`) (FR91)

### Story 5.5: Quick Pick Mode

As a party group,
I want to vote on song suggestions together with a quick card-based selection,
So that we democratically pick songs everyone wants to hear.

**Acceptance Criteria:**

**Given** the song selection phase begins
**When** Quick Pick mode is active (default mode)
**Then** 5 AI-suggested songs are displayed as cards showing song title, artist, thumbnail, and group overlap badge (e.g., "4/5 know this") (FR88)
**And** all participants can vote thumbs up or skip on each card (FR88)
**And** the first song to reach majority approval is selected (FR88)
**And** if no majority is reached within 15 seconds, the highest-voted song wins (FR88)

**Given** the democratic voting mechanism is built
**When** votes are received concurrently from all participants
**Then** votes are handled without race conditions or vote loss (NFR11)
**And** this voting mechanism (FR27) is reusable by Epic 7 for activity selection

### Story 5.6: Spin the Wheel Mode

As a party group,
I want an animated wheel to randomly select our next song,
So that song selection is exciting and adds an element of surprise.

**Acceptance Criteria:**

**Given** the song selection phase begins
**When** Spin the Wheel mode is active
**Then** 8 AI-suggested songs are loaded into an animated wheel (FR89)
**And** any participant can tap SPIN (FR89)
**And** the wheel animates with deceleration easing and lands on a song (FR89)
**And** the selected song is auto-queued (if TV paired) (FR89)

**Given** the group doesn't like the wheel result
**When** they use their veto
**Then** the group gets one veto per round triggering a re-spin (FR89)
**And** the veto window is 5 seconds

**Given** participants want to change selection mode
**When** they toggle the mode switch
**Then** they can switch between Quick Pick and Spin the Wheel at any time (FR90)
**And** Quick Pick is the default mode (FR90)

### Story 5.7: TV Pairing & YouTube Lounge API

As a host,
I want to pair the app with the venue's YouTube TV,
So that selected songs are automatically queued on the karaoke screen.

**Acceptance Criteria:**

**Given** the TV integration system is being implemented
**When** the Lounge API abstraction is designed
**Then** a `TvIntegration` interface is defined first with methods for connect, disconnect, onNowPlaying, and addToQueue -- enabling Story 5.9's graceful degradation to work against a clean contract

**Given** a venue uses YouTube for karaoke
**When** the host enters the TV pairing code displayed on the TV screen
**Then** the app connects to the YouTube TV session via the Lounge API (FR74)
**And** the connection is a persistent HTTP connection implementing the `TvIntegration` interface

**Given** the Lounge API connection is established
**When** a song plays on the TV
**Then** real-time nowPlaying events containing the current video_id are received (FR75)

**Given** a song is selected via Quick Pick or Spin the Wheel
**When** the selection is confirmed
**Then** the song is pushed to the YouTube TV queue via the Lounge API addVideo command (FR78)

**Given** the Lounge API connection drops
**When** reconnection is attempted
**Then** automatic reconnection is attempted for up to 60 seconds (FR79)
**And** if reconnection fails, the host is prompted to re-enter the TV code (FR79)
**And** the system maintains the Lounge API session throughout the party (FR79)

### Story 5.8: Song Detection & Metadata Resolution

As a system,
I want to identify what song is playing on the TV and extract its metadata,
So that the DJ engine can use song information for challenges and ceremonies.

**Acceptance Criteria:**

**Given** a nowPlaying event is received with a video_id
**When** the system processes it
**Then** the video_id is resolved to structured song metadata `{title, artist, channel, thumbnail}` via the YouTube Data API v3 within 5 seconds of song start (FR76)
**And** API calls are batched efficiently to minimize quota usage (NFR30)

**Given** a karaoke video title (e.g., "Song Title - Artist (Karaoke Version)")
**When** the system parses it
**Then** it extracts structured `{song, artist}` data using title parsing rules (FR77)

### Story 5.9: Suggestion-Only Mode

As a host at a venue without YouTube karaoke,
I want the app to work without TV pairing while still providing song suggestions,
So that the party experience works at any karaoke venue.

**Acceptance Criteria:**

**Given** the host skips TV pairing at party creation
**When** the party runs
**Then** the app operates in suggestion-only mode (FR92)
**And** playlist import, suggestion engine, Quick Pick, and Spin the Wheel all function normally (FR92)
**And** songs are not auto-queued on TV and passive song detection is disabled (FR92)

**Given** a song is selected via Quick Pick or Spin the Wheel in suggestion-only mode
**When** the selection is confirmed
**Then** the song title and artist are displayed prominently so the group can manually enter it into whatever karaoke system the venue uses (FR93)

**Given** the host wants to track what's playing in suggestion-only mode
**When** they use the song list
**Then** the host can manually mark a song as "now playing" enabling game engine metadata for challenges and genre mechanics (FR94)

**Given** TV pairing is optional
**When** the host creates a party
**Then** they can start without pairing and add the TV connection later if desired (FR95)

**Given** the YouTube Lounge API fails or becomes unavailable mid-session
**When** the failure is detected
**Then** the system degrades gracefully to suggestion-only mode without crashing, losing session state, or interrupting the active party (NFR31)
**And** the host sees a single non-blocking notification (NFR31)

### Story 5.10: Detection Source Abstraction (Pivot)

As a developer,
I want a unified SongContext interface that abstracts how a song was detected,
So that downstream consumers (lyrics sync, DJ engine, ceremonies, awards) work identically regardless of whether the song was detected via audio fingerprinting, YouTube Lounge API, or manual selection.

**Acceptance Criteria:**

**Given** the song detection system needs to support multiple sources
**When** the SongContext interface is designed
**Then** it defines a common contract: `{title, artist, isrc?, timeOffset?, detectionSource, confidence, detectedAt}`
**And** `detectionSource` is an enum: `AUDIO_FINGERPRINT`, `LOUNGE_API`, `MANUAL`
**And** the interface is implemented by all three detection paths

**Given** audio fingerprinting (Epic 11) detects a song
**When** the detection result is received
**Then** it is wrapped in a SongContext with `detectionSource: AUDIO_FINGERPRINT` and the time offset from the fingerprinting service
**And** if Lounge API (FR121) also returns a match, the fingerprinting service's time offset takes precedence for lyrics sync accuracy

**Given** the host manually marks a song as "now playing" (FR94)
**When** the selection is confirmed
**Then** a SongContext is created with `detectionSource: MANUAL` and `timeOffset: null`
**And** lyrics sync operates without drift correction (no re-recognition available)

**Given** downstream consumers receive a SongContext
**When** they process song data
**Then** they use only the SongContext interface — no awareness of which detection source provided the data
**And** graceful degradation occurs when optional fields (isrc, timeOffset) are null

---

## Epic 6: Media Capture & Sharing

Participants capture photos, videos, and audio during key moments via a floating capture bubble or persistent capture icon. Media uploads happen in the background. Reaction peak detection triggers capture prompts automatically. Requires Epic 4 reaction event stream for peak detection.

### Story 6.1: Floating Capture Bubble

As a party participant,
I want the app to prompt me to capture moments at key points during the party,
So that I don't miss the best moments worth remembering.

**Acceptance Criteria:**

**Given** an active party session
**When** a trigger point occurs (session start, reaction peak, post-ceremony reveal, or session end)
**Then** a floating capture bubble (48x48px) appears at the bottom-left of the screen on all phones (FR38, FR67)
**And** the bubble is dismissable by ignoring it -- no interruption to non-interested participants (FR67)
**And** the bubble auto-dismisses after 15 seconds if not interacted with
**And** a maximum of 1 bubble is shown per 60 seconds

### Story 6.2: Inline Media Capture

As a party participant,
I want to quickly capture a photo, video, or audio clip without leaving the party screen,
So that capturing moments is seamless and doesn't interrupt my party experience.

**Acceptance Criteria:**

**Given** a capture bubble is displayed
**When** a participant pops the bubble
**Then** capture initiation takes 2 taps: one to pop the bubble, one to start capture (FR68)
**And** the participant can choose photo, video (5s max), or audio snippet (FR69)
**And** capture uses native device camera and microphone APIs with uniform behavior on iOS and Android (FR69)
**And** capture completes without navigating away from the app (FR69)
**And** no preview or edit screen is shown -- capture auto-completes

**Given** a participant wants to capture a moment outside of bubble prompts
**When** they tap the persistent capture icon in the participant toolbar
**Then** they can manually initiate a media capture at any time (FR39)
**And** the manual capture is independent of the bubble prompt system (FR39)

### Story 6.3: Media Tagging & Background Upload

As a system,
I want captured media tagged with context and uploaded without blocking the party,
So that media is organized for post-session access while keeping the live experience smooth.

**Acceptance Criteria:**

**Given** the media capture system is being set up
**When** the database migration runs
**Then** the `media_captures` table is created with columns: `id`, `session_id`, `user_id`, `storage_path`, `trigger_type`, `dj_state_at_capture`, `created_at`

**Given** a media capture is completed
**When** the media is processed
**Then** it is tagged with session ID, timestamp, capture trigger type (peak/ceremony/manual), and current DJ state (FR70)

**Given** tagged media is ready for upload
**When** the upload begins
**Then** uploads are queued and sent in the background -- capture never blocks the party experience (FR71)
**And** failed uploads retry automatically on next stable connection (FR71)

**Given** a participant shares or intends to share media
**When** they tap the share action
**Then** the share intent tap is tracked as a viral signal metric (FR44)

### Story 6.4: Server-Side Media Storage

As a system,
I want all captured media stored securely and accessible to session participants,
So that everyone can revisit their party memories after the session ends.

**Acceptance Criteria:**

**Given** media has been uploaded
**When** it is stored server-side
**Then** all media is stored in Firebase Storage organized by session ID (FR72, FR102)
**And** media is tagged with the capturing user ID if authenticated (FR102)
**And** all captured media is accessible to all session participants post-session (FR72)

**Given** an authenticated user's media
**When** they access it post-session
**Then** they retain access to their captures indefinitely (FR102)

**Given** a guest user's media
**When** it is accessed post-session
**Then** guest session media is accessible via time-limited signed URLs with a 7-day expiry (FR102, NFR37)

**Given** media access control
**When** a user requests media
**Then** authenticated users can access only their own captures and captures from sessions they participated in (NFR37)

### Story 6.5: Reaction Peak Detection

As a system,
I want to automatically detect when the crowd is going wild during a performance,
So that capture prompts fire at the most exciting moments of the party.

**Acceptance Criteria:**

**Given** reactions are being sent during a song performance (Epic 4 reaction event stream)
**When** a sustained reaction rate spike above the baseline threshold is detected
**Then** the system identifies it as a reaction peak (FR73)
**And** a capture bubble is triggered on all phones (FR73)

**Given** peak detection logic
**When** it processes reaction data
**Then** all peak detection runs server-side to ensure consistent triggering across all devices (FR73)
**And** the peak detection threshold is based on baseline reaction rate for the current session

---

## Epic 7: Interlude Games & Icebreaker

Between songs, mini-games keep energy high -- Kings Cup group rules, Dare Pull random challenges, Quick Vote opinion polls, and a first-session icebreaker. Democratic voting lets the group decide what happens next. Universal activities are front-loaded in the first 30 minutes. Reuses the democratic voting mechanism built in Epic 5 (FR27) for activity selection. **Pivot update:** Interludes (Kings Cup, Dare Pull) gated to Social Layer (songs 5+ per user) via Progressive Feature Unlock (Epic 13). Quick Vote remains universal (single-tap, no spotlight). Icebreaker unchanged (pre-song activity). Group sing-along now cross-references chant moments (FR127-129) from Epic 11.

### Story 7.1: Democratic Activity Voting

As a party group,
I want to vote on what activity happens next between songs,
So that the group collectively shapes the party experience.

**Acceptance Criteria:**

**Given** the DJ engine reaches an interlude or activity selection point
**When** the system presents options
**Then** 2-3 activity options are displayed for democratic voting (FR13)
**And** the voting mechanism reuses the infrastructure built in Epic 5 (FR27)
**And** votes from all present participants are counted without race conditions or vote loss (NFR11)

**Given** the session is in its first 30 minutes
**When** the DJ engine selects activities
**Then** universal participation activities are front-loaded -- prioritized over activities that single out individuals (FR15)

**Given** fewer than 3 participants are in the party
**When** activity options are presented
**Then** group interludes (Kings Cup, Dare Pull) are excluded from the options (NFR12)

### Story 7.2: Kings Cup Interlude

As a party group,
I want a group rule card game between songs,
So that everyone participates in a shared silly challenge that keeps the energy up.

**Acceptance Criteria:**

**Given** the DJ engine selects an interlude activity
**When** Kings Cup is chosen
**Then** a group rule card is displayed to all participants simultaneously (FR28b)
**And** the card auto-advances after 10 seconds

**Given** the interlude library selection
**When** Kings Cup is considered
**Then** it is selected via weighted random with no immediate repeats from the 3-game library (FR28a)
**And** Kings Cup is a universal activity eligible for front-loading in the first 30 minutes (FR15)

### Story 7.3: Dare Pull Interlude

As a party group,
I want random dares assigned to random players between songs,
So that individuals get spontaneous spotlight moments that create hilarious memories.

**Acceptance Criteria:**

**Given** the DJ engine selects an interlude activity
**When** Dare Pull is chosen
**Then** a random dare is assigned to a randomly selected player (FR28b)
**And** player selection uses a slot-machine animation
**And** a 15-second countdown timer is displayed for dare completion

**Given** the session timing
**When** the party is in its first 30 minutes
**Then** Dare Pull is never deployed (reserved for after the warm-up period)

**Given** the interlude library selection
**When** Dare Pull is considered
**Then** it is selected via weighted random with no immediate repeats (FR28a)

### Story 7.4: Quick Vote Interlude

As a party group,
I want to vote on fun binary opinion polls between songs,
So that the group bonds over lighthearted debates and sees where everyone stands.

**Acceptance Criteria:**

**Given** the DJ engine selects an interlude activity
**When** Quick Vote is chosen
**Then** a binary opinion poll is presented to all participants (FR28b)
**And** a 6-second vote window is enforced (server-authoritative hard deadline)
**And** results are displayed as a bar chart after the vote window closes

**Given** the interlude library selection
**When** Quick Vote is considered
**Then** it is selected via weighted random with no immediate repeats (FR28a)
**And** Quick Vote is a universal activity eligible for front-loading in the first 30 minutes (FR15)

### Story 7.5: Group Sing-Along Activities

As a party group,
I want group sing-along moments where everyone sings together,
So that the whole group shares the spotlight without anyone feeling singled out.

**Acceptance Criteria:**

**Given** the DJ engine reaches an activity that supports group participation
**When** a group sing-along is triggered
**Then** all participants are included without individual spotlight (FR21)
**And** the activity is presented on all phones simultaneously
**And** group sing-alongs are eligible for front-loading in the first 30 minutes as universal participation activities (FR15)

### Story 7.6: First-Session Icebreaker

As a party host,
I want an icebreaker activity at the start of a new party,
So that everyone gets involved immediately and the group warms up together.

**Acceptance Criteria:**

**Given** a new party session has just started
**When** the first activity begins
**Then** a first-session icebreaker activity is presented to all participants (FR51)
**And** all participants can complete it with a single tap (FR51)
**And** results are visible to the group (FR51)
**And** a 6-second hard deadline is enforced (server-authoritative)

**Given** the icebreaker has already run
**When** the session continues
**Then** the icebreaker does not repeat -- it runs only once per session

---

## Epic 8: Finale & Session Persistence

The party ends with a memorable 4-step finale -- highlight awards, session stats, a shareable setlist poster, and one-tap feedback. All session data (event stream, awards, participation scores) is persisted to PostgreSQL for future recall. Consumes the event stream established in Epic 2 (FR42) and participation scores from Epic 3 (FR40).

### Story 8.1: End-of-Night Awards Generation

As a system,
I want to generate end-of-night awards that recognize all types of contributions,
So that every participant feels valued whether they sang, cheered, or played along.

**Acceptance Criteria:**

**Given** a party session is ending
**When** end-of-night awards are generated
**Then** awards recognize both singing and non-singing contributions (FR41)
**And** award generation consumes participation scores from Epic 3 (FR40) across all three tiers (passive, active, engaged)
**And** award generation considers party card challenge data from Epic 4 (acceptance rate, completions)
**And** award generation uses the event stream from Epic 2 (FR42) for session activity analysis
**And** awards are generated server-side before the finale sequence begins

### Story 8.2: Finale Ceremony Sequence

As a party group,
I want the party to end with a memorable multi-step finale,
So that the night concludes on a high note with shared memories and a sense of celebration.

**Acceptance Criteria:**

**Given** the host ends the party or the party reaches its natural conclusion
**When** the finale sequence begins
**Then** it proceeds through 4 steps in order: (1) highlight awards reveal with animation, (2) session stats summary showing songs sung, total reactions, and participation highlights, (3) setlist poster with share prompt, (4) one-tap post-session feedback (FR52)
**And** the total finale duration is 60-90 seconds (FR52)

**Given** step 4 of the finale
**When** the feedback prompt appears
**Then** a North Star prompt is displayed: "Would you use Karamania next time?" with a 1-5 scale (FR43)
**And** the feedback is completable with a single tap (NFR14)

**Given** the finale is in progress
**When** each step transitions
**Then** transitions are server-coordinated and synchronized across all devices within 200ms (NFR1)

### Story 8.3: Setlist Poster Generation & Sharing

As a party participant,
I want a shareable setlist poster from tonight's party,
So that I can share the full lineup and relive the night with friends who were there.

**Acceptance Criteria:**

**Given** the finale reaches step 3 (setlist poster)
**When** the poster is generated
**Then** it shows all songs performed, performer names, the date, and awards for each song (FR36)
**And** the poster reflects the current party vibe's visual styling

**Given** a participant views the setlist poster
**When** they want to share it
**Then** they can share via the native mobile share sheet with a single tap (FR37)
**And** the share intent tap is tracked as a viral signal metric

### Story 8.4: Session Summary Persistence

As a system,
I want all session data persisted to the database reliably at party end,
So that session history is available for future recall and the Session Timeline feature.

**Acceptance Criteria:**

**Given** a party session ends
**When** the session summary is written
**Then** it is persisted to PostgreSQL containing: session ID, date, venue (if entered), participant list, song list, awards, participation scores, and party card stats (FR99)
**And** the write completes within 5 seconds for sessions with up to 12 participants and 20+ songs (NFR36)
**And** the write is asynchronous and does not block the real-time party experience (NFR36)

**Given** the session summary write fails
**When** a retry is attempted
**Then** the system retries up to 3 times with exponential backoff (FR103)
**And** if all retries fail, session data is logged to server disk for manual recovery (FR103)
**And** the write completes within 30 seconds of party end under normal conditions (FR103)

**Given** the host is authenticated
**When** the session is created
**Then** the authenticated host is recorded as the session owner enabling future features (re-share setlist, view full stats, manage media) (FR104)

---

## Epic 9: Session Timeline & Memories

Authenticated users revisit past parties via a Session Timeline home screen. Tapping a session reveals full details -- participants, setlist, awards, media gallery. Guest-to-account upgrade preserves all data. "Let's go again!" drives re-engagement through existing group chats.

### Story 9.1: User Profile & Account Management

As an authenticated user,
I want a persistent profile that remembers me across sessions,
So that my karaoke history and identity are maintained over time.

**Acceptance Criteria:**

**Given** a user signs in via Google or Facebook OAuth
**When** their account is created or accessed
**Then** a persistent profile is stored containing display name, avatar (from OAuth provider), and account creation date (FR98)
**And** profile data is stored in the `users` table with `firebase_uid`, `display_name`, `avatar_url`, `created_at` columns

### Story 9.2: Guest-to-Account Upgrade

As a guest user,
I want to upgrade to a full account without losing anything from my current session,
So that I can keep my party memories and build a history over time.

**Acceptance Criteria:**

**Given** a guest user is in an active session or viewing post-session content
**When** they choose to upgrade to a full account
**Then** they can sign in via Google or Facebook OAuth (Firebase Auth Flutter SDK) (FR97)
**And** the upgrade completes without disconnecting the WebSocket (NFR35)
**And** the upgrade does not interrupt the current DJ state (NFR35)
**And** no accumulated session data, participation scores, or captured media is lost (FR97)
**And** the upgrade completes in under 5 seconds including the native OAuth flow (NFR35)

**Given** the upgrade is complete
**When** the user's data is migrated
**Then** all session participation records are linked to the new user profile
**And** all captured media is re-associated with the authenticated user ID

### Story 9.3: Session Timeline Screen

As an authenticated user,
I want to see all my past karaoke sessions on my home screen,
So that I can easily revisit and relive my party memories.

**Acceptance Criteria:**

**Given** an authenticated user opens the app with no active party
**When** the home screen loads
**Then** a Session Timeline is displayed as the default screen (FR100, FR108)
**And** sessions are listed in reverse-chronological order (FR108)
**And** each entry shows: session date, venue name (if entered), number of participants, the user's top award from that session, and a thumbnail from captured media (if available) (FR108)

**Given** the Session Timeline has many sessions
**When** the user scrolls
**Then** the 20 most recent sessions load initially with infinite scroll for older sessions (FR114)

**Given** an authenticated user has zero past sessions
**When** the Session Timeline loads
**Then** an empty state is displayed with a "Start your first party" call-to-action (FR115)

### Story 9.4: Session Detail Screen

As an authenticated user,
I want to tap into a past session and see everything that happened,
So that I can relive the full party experience and share specific moments.

**Acceptance Criteria:**

**Given** a user taps a session entry on the Session Timeline
**When** the Session Detail screen opens
**Then** it displays 5 sections: (1) session header with date, venue, duration, and participant count, (2) participant list with each person's top award and participation score, (3) full setlist with performer names and awards per song, (4) media gallery showing all photos, video clips, and audio captured during the session, (5) the setlist poster generated at session end (FR109)

**Given** the Session Detail screen layout
**When** the user views it
**Then** it is scrollable as a single continuous view -- no tabs or sub-navigation (FR110)
**And** the media gallery displays as an inline grid within the session detail flow (FR110)

### Story 9.5: Session Sharing & Re-engagement

As an authenticated user,
I want to share a past session and rally friends for another party,
So that great memories drive future karaoke nights.

**Acceptance Criteria:**

**Given** a user is viewing a Session Detail screen
**When** they tap the share action
**Then** the native share sheet opens with a shareable link (FR111)
**And** the link opens a read-only web view of the session detail (setlist, awards, stats, media) (FR111)
**And** no app is required to view the shared link (FR111)

**Given** a user wants to organize another party
**When** they tap "Let's go again!"
**Then** a pre-composed message is generated containing the venue name, a date suggestion, and a link to download Karamania (FR112)
**And** the message is shared via the native share sheet for the user to send through their preferred messaging app (WhatsApp, Zalo, iMessage, etc.) (FR112)
**And** no in-app messaging is used -- the feature leverages existing group chats (FR112)

### Story 9.6: Media Linking & Guest Access

As a system,
I want media properly linked to user profiles and guest access appropriately scoped,
So that authenticated users build a personal media library while guests get temporary access.

**Acceptance Criteria:**

**Given** an authenticated user has captured media during sessions
**When** they access their profile post-session
**Then** media captures are linked to their user profile and accessible via a personal media gallery (FR101)

**Given** a guest user has captured media
**When** the session ends
**Then** guest captures are linked to session ID only and accessible to all session participants for 7 days (FR101)

**Given** a guest user opens the app
**When** the home screen loads
**Then** they see a prompt to create an account to unlock session history (FR113)
**And** the guest home screen shows only the "Start Party" / "Join Party" actions -- no Session Timeline (FR113)

---

## Epic 10: UX Redesign & Brand Identity

Comprehensive visual and interaction redesign bringing brand identity, consistent styling, and polished UX across all screens. The lyrics-sync pivot redesigns the during-song screen around a lyrics-first layout with reactive light show, chant animations, duet colors, detection status, and progressive unlock transitions. Lightstick mode screens and wireframes have been removed.

### Story 10.1: Home Screen Brand Identity

As a user,
I want the home screen to communicate Karamania's brand identity clearly,
So that I immediately understand what the app does and feel excited to start a party.

**Acceptance Criteria:**

**Given** a user opens the app
**When** the home screen loads
**Then** brand identity elements (logo, tagline, color palette) are prominently displayed
**And** the visual design is consistent with the party vibe system
**And** "Start Party" and "Join Party" actions are immediately visible and tappable (48x48px minimum)

### Story 10.2: Join Screen Layout & Input Sizing

As a guest,
I want the join screen to be clearly laid out with appropriately sized input fields,
So that entering a party code and my name feels effortless.

**Acceptance Criteria:**

**Given** a user is on the join screen
**When** they need to enter a party code or display name
**Then** input fields are appropriately sized for mobile use
**And** the layout follows the 8px spacing system and design tokens
**And** visual feedback appears within 200ms during the join process (FR53)

### Story 10.3: Lobby Guest Waiting & Playlist

As a guest waiting in the lobby,
I want a polished waiting experience with clear status,
So that I know the party hasn't started yet and feel the anticipation building.

**Acceptance Criteria:**

**Given** guests are in the lobby
**When** they are waiting for the host to start
**Then** the lobby screen shows current player count, QR code, and share prompt (FR8)
**And** the visual design matches the selected party vibe
**And** playlist import options are accessible from the lobby

### Story 10.4: Party Screen Song & Performer

As a participant,
I want the song and performer display to be visually polished,
So that the pre-song hype and during-song experience feel exciting.

**Acceptance Criteria:**

**Given** a song is about to start
**When** the pre-song hype announcement displays
**Then** the performer name is shown with branded typography and animation (FR17)
**And** the visual treatment creates genuine excitement for the next performance

### Story 10.5: Ceremony Celebration Energy

As a participant,
I want ceremonies to feel like genuine celebrations,
So that every performer gets their moment of recognition.

**Acceptance Criteria:**

**Given** a Full or Quick ceremony is triggered
**When** the ceremony sequence plays
**Then** animations, confetti, and visual effects create celebration energy
**And** the visual design matches the party vibe's celebration palette
**And** all ceremony timing follows the UX spec (Full: buildup → reveal → moment card; Quick: flash → auto-advance 8-10s)

### Story 10.6: Branded Custom Dialogs

As a user,
I want all dialogs and overlays to match the app's brand,
So that the experience feels cohesive and polished throughout.

**Acceptance Criteria:**

**Given** any dialog or overlay appears in the app
**When** it renders
**Then** it uses branded styling consistent with DJTokens and the active party vibe
**And** no default system dialogs are used in the party experience

### Story 10.7: Color Consistency Across Party Flow

As a user,
I want colors to be consistent and meaningful across the entire party flow,
So that the visual experience is cohesive and color changes feel intentional.

**Acceptance Criteria:**

**Given** a party is active with a selected vibe
**When** the user moves through different DJ states
**Then** color palette transitions are smooth and consistent with the vibe system
**And** all 5 party vibes maintain WCAG AA contrast compliance throughout

### Story 10.8: Lyrics Display Screen (Pivot)

As a participant,
I want the during-song screen to center around synced lyrics with a reactive light show background,
So that I can follow along with the song and feel immersed in the music.

**Acceptance Criteria:**

**Given** a song is detected and lyrics are available
**When** the during-song screen renders
**Then** synced lyrics are displayed with 60fps line-by-line scrolling synchronized to the song's playback position (FR124)
**And** the reactive light show renders as the screen background — color pulses synchronized to song energy (FR136-137)
**And** chant moments display with crescendo animation: text grows progressively over 3-5 seconds before the chant timestamp (FR128)
**And** the detection status indicator shows current state: "Listening...", "Song detected: [title]", "No match — search manually" (FR122)
**And** reactions, soundboard, and hype signal remain accessible via a bottom toolbar during song playback
**And** the layout follows the lyrics-first design from the UX spec — lyrics are the primary content, all other elements are secondary

**Given** no lyrics are available for the detected song
**When** the during-song screen renders
**Then** song title and artist are displayed prominently with "Lyrics not available" message (FR126)
**And** the reactive light show and all other features continue operating normally

### Story 10.9: Duet Mode Visuals (Pivot)

As a participant in a duet performance,
I want to see color-coded lyrics indicating which performer sings which part,
So that duets feel coordinated and visually engaging.

**Acceptance Criteria:**

**Given** Duet Mode is activated for a song with 2+ performers (FR133)
**When** lyrics are displayed
**Then** each performer's assigned lyric lines are highlighted in their color (blue and gold for 2 performers, additional colors for 3+) (FR134)
**And** performers see their own lines highlighted and other performers' lines dimmed (FR134)
**And** chorus/chant lines display in both/all colors indicating "everyone sings" (FR134)
**And** non-performing audience members see all colors on their screen showing who should be singing which part (FR135)
**And** color assignments are visible and distinguishable — not conveyed by color alone (WCAG compliance)

### Story 10.10: Progressive Unlock Transitions (Pivot)

As a participant,
I want new features to appear naturally and smoothly as I progress through songs,
So that the experience teaches itself without overwhelming me early on.

**Acceptance Criteria:**

**Given** a user is in Base Layer (songs 1-2)
**When** features are displayed
**Then** only synced lyrics, reactive light show, chant highlights, and duet colors are available (FR140)
**And** hidden features show no placeholder, disabled state, or "locked" indicator — they simply don't exist yet

**Given** a user transitions from Base Layer to Interaction Layer (song 3)
**When** the transition occurs
**Then** Guess The Next Line activates with a subtle, non-disruptive introduction animation
**And** the first blank appears with a brief tooltip explaining the mechanic (NFR16 — single-sentence, first appearance only)

**Given** a user transitions from Interaction Layer to Social Layer (song 5)
**When** the transition occurs
**Then** party card challenges, interludes, and ceremonies become available
**And** transition animations are smooth and feel like natural feature discovery, not unlocking

**Given** a late joiner enters an in-progress party
**When** they join
**Then** they begin at their own Song 1 regardless of session progress (FR140)
**And** they receive the same progressive unlock experience as everyone else

### Story 10.11: Detection & Fallback UX (Pivot)

As a participant,
I want clear but non-intrusive feedback about song detection status,
So that I know whether lyrics are available without the detection process disrupting the party.

**Acceptance Criteria:**

**Given** the audio fingerprinting service is actively listening
**When** the detection status changes
**Then** the status indicator updates smoothly between states: "Listening..." → "Song detected: [title]" → "No match — search manually" (FR122)
**And** status transitions use subtle animation — no jarring state changes

**Given** audio fingerprinting fails after 3 consecutive attempts (15 seconds)
**When** the manual search fallback appears (FR120)
**Then** a search input is presented allowing the user to type song title/artist
**And** the search input follows the app's no-text-input-beyond-name principle by making manual search feel like a quick assist, not a required step
**And** manual selection triggers lyrics fetch and display immediately

**Given** the user has denied microphone permission
**When** the during-song screen renders
**Then** the detection status shows an appropriate state and offers the manual search as the primary path
**And** the reactive light show operates in ambient mode (generic color cycling, not music-synced)

---

## Epic 11: Lyrics Sync Engine

The core differentiator — real-time song detection via audio fingerprinting, synced lyrics display on every phone, chant moment detection with crescendo animations, and a reactive phone light show that pulses with the music. This is the "audio intelligence layer" that makes Karamania the only karaoke companion that knows what song is playing and reacts to it in real-time.

### Story 11.1: ACRCloud Audio Fingerprint Pipeline

As a system,
I want to capture audio from the device microphone and identify the currently playing song via audio fingerprinting,
So that the app knows what song is playing in the karaoke room without any manual input.

**Acceptance Criteria:**

**Given** the user has granted microphone permission
**When** the DJ engine enters SONG state
**Then** the system captures a 5-10 second audio burst from the device microphone (FR116)
**And** the audio sample is sent to the audio fingerprinting service (ACRCloud)
**And** results are returned within 5 seconds including song title, artist, ISRC code, and playback time offset (FR116)
**And** the result is wrapped in a SongContext via the detection source abstraction (Epic 5, Story 5.10)

**Given** the fingerprinting service returns a match
**When** the result is processed
**Then** song metadata is broadcast to all connected clients via WebSocket
**And** the DJ engine transitions to SONG_DETECTED sub-state (Story 2.10)
**And** the detection status indicator updates to "Song detected: [title]" (FR122)

**Given** battery drain constraints
**When** audio capture is active
**Then** total battery drain from audio recognition must not exceed 12% per hour (NFR43)
**And** the capture uses a 5-10 second burst — not continuous listening

**Given** the app is deployed to both platforms
**When** audio capture is initiated
**Then** it works uniformly on both iOS and Android using the ACRCloud Flutter SDK

### Story 11.2: Periodic Re-Recognition & Song Change

As a system,
I want to periodically re-check what song is playing to correct lyrics drift and detect song changes,
So that lyrics stay synchronized and transitions between songs are handled automatically.

**Acceptance Criteria:**

**Given** a song has been detected and lyrics are displaying
**When** 30 seconds have elapsed since the last recognition
**Then** a 5-second re-sync audio burst is captured and sent to the fingerprinting service (FR117)
**And** if the same song is re-detected, the time offset is used to correct any lyrics drift to within 500ms (NFR42)

**Given** the re-sync returns a different song than currently displayed
**When** the result is processed
**Then** the system transitions to the new song's lyrics within 3 seconds (fetch + render) (FR118)
**And** the DJ engine song metadata is updated
**And** all connected clients receive the updated SongContext

**Given** the same song is re-detected with a cached match
**When** the re-sync processes
**Then** the API call is skipped and the local timer is used for drift correction only (NFR47)
**And** lyrics sync drift does not exceed 2 seconds over a 5-minute song (NFR42)

### Story 11.3: Detection Fallback — Manual Search

As a participant,
I want to manually search for a song when audio fingerprinting can't identify it,
So that I can still get lyrics even in noisy environments or for obscure tracks.

**Acceptance Criteria:**

**Given** audio fingerprinting has failed after 3 consecutive attempts (15 seconds total)
**When** the failure threshold is reached
**Then** the system presents a manual song search allowing the user to type song title/artist (FR120)
**And** the detection status updates to "No match — search manually" (FR122)

**Given** the user types a song title/artist in the manual search
**When** they select a result
**Then** lyrics fetch is triggered immediately using the selected song's metadata
**And** the result is wrapped in a SongContext with `detectionSource: MANUAL`
**And** no periodic re-recognition is performed for manually selected songs (no audio reference)

**Given** cover-song identification is needed
**When** karaoke backing tracks differ from original recordings
**Then** the system uses cover-song identification mode to improve recognition (FR119)

### Story 11.4: Detection Status Indicator

As a participant,
I want to see the current song detection status at a glance,
So that I know whether the system has identified the song and lyrics are incoming.

**Acceptance Criteria:**

**Given** the audio fingerprinting service is in any state
**When** the during-song screen is displayed
**Then** a detection status indicator is visible showing one of: "Listening...", "Song detected: [title]", "No match — search manually" (FR122)
**And** status transitions animate smoothly without jarring state changes
**And** the indicator is positioned to be informative without competing with the lyrics display
**And** audio fingerprinting recognition achieves >70% accuracy in commercial karaoke rooms (NFR40)

### Story 11.5: LRCLIB Lyrics Fetch & Display

As a participant,
I want synced lyrics displayed on my phone synchronized to the song playing in the room,
So that I can follow along and sing with the group.

**Acceptance Criteria:**

**Given** a song has been detected with title, artist, and ISRC
**When** lyrics are fetched
**Then** the system retrieves synced lyrics in LRC format from a lyrics database (primary: LRCLIB community source, fallback: Musixmatch commercial API) using song title + artist + duration (FR123)

**Given** LRC lyrics are retrieved
**When** the lyrics display renders
**Then** synced lyrics scroll line-by-line at 60fps with no frame drops (FR124)
**And** lyrics are synchronized to the song's playback position starting from the time offset returned by the fingerprinting service (FR124)
**And** time from song start to first lyric displayed is <10 seconds (NFR41)

**Given** the reactive light show is rendering
**When** lyrics display is active
**Then** the light show animation maintains 60fps without impacting lyrics scroll performance or WebSocket message handling (NFR45)

### Story 11.6: Local Lyrics Cache

As a system,
I want to cache retrieved lyrics locally so the same song doesn't require repeated API calls,
So that lyrics load faster for frequently played songs and API quota is conserved.

**Acceptance Criteria:**

**Given** lyrics have been successfully fetched for a song
**When** the fetch completes
**Then** lyrics are cached locally by song identifier (ISRC or title+artist hash) (FR125)
**And** the cache stores at least 500 songs (NFR44)
**And** cache lookup completes in <50ms (NFR44)
**And** the cache persists across app restarts and sessions (FR125, NFR44)

**Given** a previously cached song is detected again
**When** the lyrics are needed
**Then** cached lyrics are used without API calls (FR125)
**And** the cache hit bypasses the lyrics database entirely

### Story 11.7: Graceful "No Lyrics" State

As a participant,
I want the app to handle songs without available lyrics gracefully,
So that the party experience continues even when lyrics can't be found.

**Acceptance Criteria:**

**Given** a song has been detected
**When** no synced lyrics are available from either the primary or fallback lyrics source
**Then** the system displays the song title and artist prominently with a "Lyrics not available" message (FR126)
**And** the reactive light show continues operating in ambient mode
**And** all other features (reactions, soundboard, hype signal, party cards) remain functional
**And** the detection status indicator shows the song is detected — only lyrics are unavailable

### Story 11.8: Chant Detection & Crescendo Animation

As a participant,
I want chorus and chant moments highlighted with a growing animation that builds excitement,
So that the whole room knows when to sing together.

**Acceptance Criteria:**

**Given** LRC lyrics are loaded for a song
**When** the system analyzes the lyrics
**Then** chant moments are auto-detected by identifying lyric lines that appear 2 or more times in the LRC data (chorus/hook lines) (FR127)

**Given** a chant moment is approaching
**When** the chant timestamp is 3-5 seconds away
**Then** a crescendo animation begins: the chant text starts at normal size and progressively grows larger, reaching maximum size at the moment the chant line is sung (FR128)
**And** the animation begins exactly 3 seconds before the chant timestamp (±200ms tolerance) (NFR46)

**Given** a chant moment is active
**When** all connected phones display the chant
**Then** the chant text appears simultaneously on all phones with a synchronized visual highlight (screen flash, enlarged text, universal color) (FR129)
**And** the reactive light show intensifies to maximum brightness during chant moments (FR129)

**Given** the host wants to customize chant moments
**When** they use the host controls overlay
**Then** they can manually promote or demote chant moments — adding custom chant markers or removing auto-detected ones (FR130)

### Story 11.9: Reactive Phone Light Show

As a participant,
I want my phone screen to pulse with color synchronized to the music,
So that every phone in the room becomes part of a coordinated light show.

**Acceptance Criteria:**

**Given** a song is playing (detected or manually selected)
**When** the during-song screen is active
**Then** each phone's screen background pulses color synchronized to the song's energy level (FR136)
**And** verse timestamps produce low energy (30% brightness, 2s pulse cycle) (FR137)
**And** pre-chorus produces rising energy (60% brightness, 1s cycle) (FR137)
**And** chorus produces high energy (100% brightness, 0.5s cycle) (FR137)
**And** peak brightness occurs during chant moments (FR136)

**Given** multiple phones are connected
**When** a song moment is playing
**Then** all phones display the same color palette and pulse timing, creating a coordinated room-wide light effect (FR138)

**Given** the light show is a Base Layer feature
**When** any user is in any progressive unlock layer
**Then** the light show is always active during song playback with no user action required (FR139)
**And** users cannot disable the light show independently — it is part of the core lyrics display experience (FR139)

**Given** the light show is rendering with lyrics
**When** the screen updates
**Then** the animation maintains 60fps without impacting lyrics scroll or WebSocket handling (NFR45)

---

## Epic 12: Interactive Lyrics Games

Interactive features layered on top of the lyrics sync engine — Guess The Next Line blanks random lyrics for the audience to anticipate, and Duet Colors assigns performer-specific colors to lyric lines for multi-singer songs. These features activate progressively via Epic 13.

### Story 12.1: Guess The Next Line

As a participant,
I want random lyrics to be blanked out during the song so I can try to guess them,
So that following along with the lyrics becomes a fun, interactive challenge.

**Acceptance Criteria:**

**Given** lyrics are displaying for a song and the user is at Interaction Layer or above (songs 3+) (FR132)
**When** the song is playing
**Then** the system randomly selects lyric lines to blank out (target: 1-2 per song) (FR131)
**And** blanked lines show "[???]" for 3 seconds before revealing the actual lyric (FR131)
**And** blanked lines are never during chant moments, never the first or last line (FR131)

**Given** a user is at Base Layer (songs 1-2)
**When** the song is playing
**Then** Guess The Next Line is not active — all lyrics display normally (FR132)
**And** no placeholder or "locked" indicator is shown

**Given** a blanked line is about to reveal
**When** the 3-second timer expires
**Then** the actual lyric is revealed with a brief highlight animation
**And** the reveal does not disrupt the lyrics scrolling flow

### Story 12.2: Duet Mode Activation & Color Assignment

As a host or participant,
I want to activate Duet Mode for multi-singer songs and assign colors to each performer,
So that everyone knows who should be singing which part.

**Acceptance Criteria:**

**Given** a song has 2 or more performers
**When** the host or any participant activates Duet Mode from the song controls (FR133)
**Then** colors are assigned to performers: blue and gold for 2 performers, additional colors for 3+ (FR133)
**And** the color assignment is broadcast to all connected phones
**And** Duet Mode can be activated at any point during the song

**Given** Duet Mode is active
**When** the activation state changes
**Then** all connected phones update their lyrics display within 200ms (NFR1)

### Story 12.3: Duet Lyrics Display

As a participant in a duet song,
I want lyrics color-coded by performer so I can see who sings what,
So that duets feel coordinated and visually engaging.

**Acceptance Criteria:**

**Given** Duet Mode is active
**When** lyrics display on a performer's phone
**Then** their assigned lyric lines are highlighted in their color (FR134)
**And** other performers' lines appear dimmed (FR134)
**And** chorus/chant lines display in both/all colors indicating "everyone sings" (FR134)

**Given** Duet Mode is active
**When** lyrics display on a non-performing audience member's phone
**Then** all colors are shown, indicating who should be singing which part (FR135)

**Given** accessibility requirements
**When** duet colors are displayed
**Then** color assignments are distinguishable without relying on color alone (WCAG compliance)
**And** text labels or icons supplement color coding for accessibility

---

## Epic 13: Progressive Feature Unlock

Per-user feature gating system that reveals capabilities gradually over the session. Each user tracks their own song count from join time. Features activate per-user based on their song count, creating a natural learning curve that prevents overwhelm. Late joiners start at Song 1 regardless of session progress.

### Story 13.1: Per-User Song Counter & Layer State

As a system,
I want to track each user's personal song count and compute their current feature layer,
So that the progressive unlock system knows which features each user should see.

**Acceptance Criteria:**

**Given** a user joins a party
**When** they are connected
**Then** a personal song counter is initialized at 0 for that user (FR140)
**And** their initial layer state is set to BASE_LAYER

**Given** a song ends (DJ engine transitions from SONG to CEREMONY state)
**When** the user was present for the song
**Then** their personal song counter increments by 1
**And** their layer state is recomputed: songs 1-2 = BASE_LAYER, songs 3-4 = INTERACTION_LAYER, songs 5+ = SOCIAL_LAYER (FR140)
**And** layer state changes are persisted in the session (survives reconnection)

**Given** the user reconnects after a disconnection
**When** their state is restored
**Then** their song counter and layer state are recovered from the server — no regression to BASE_LAYER

### Story 13.2: Base Layer Gating (Songs 1-2)

As a new participant,
I want to see only the core lyrics experience during my first two songs,
So that I'm not overwhelmed by features I haven't had time to understand.

**Acceptance Criteria:**

**Given** a user is at BASE_LAYER (songs 1-2)
**When** the during-song screen renders
**Then** synced lyrics, reactive light show, chant highlights, and duet colors are available (FR140)
**And** Guess The Next Line is NOT active (FR132)
**And** party card challenges are NOT dealt (FR140)
**And** interludes (Kings Cup, Dare Pull) are NOT triggered for this user (FR140)
**And** Quick Vote interludes ARE available (universal, no spotlight)
**And** hidden features show no placeholder, disabled state, or locked indicator — they simply don't exist yet

### Story 13.3: Interaction Layer Activation (Songs 3-4)

As a participant who has been in the party for a few songs,
I want interactive lyrics features to appear naturally,
So that the experience grows more engaging as I settle in.

**Acceptance Criteria:**

**Given** a user's song counter reaches 3 (transition to INTERACTION_LAYER)
**When** the next song begins
**Then** Guess The Next Line feature activates (FR132)
**And** a subtle, non-disruptive introduction animation signals the new feature
**And** the first blank appears with a single-sentence tooltip on first appearance only (NFR16)

**Given** a user is at INTERACTION_LAYER
**When** party-related features are checked
**Then** party card challenges remain gated (not yet at Social Layer)
**And** interludes (Kings Cup, Dare Pull) remain gated

### Story 13.4: Social Layer Activation (Songs 5+)

As a participant who has been engaged for several songs,
I want all social and interactive features to unlock,
So that the full party experience is available when I'm most comfortable.

**Acceptance Criteria:**

**Given** a user's song counter reaches 5 (transition to SOCIAL_LAYER)
**When** the layer transition occurs
**Then** party card challenges become available — cards may be dealt to this user (FR140)
**And** interludes (Kings Cup, Dare Pull) become available when triggered by the DJ engine (FR140)
**And** ceremonies become available — this user's songs receive Full/Quick ceremony treatment (FR140)
**And** all interactive features are fully unlocked

**Given** the DJ engine is evaluating whether to trigger an interlude
**When** user layer states are checked
**Then** interludes requiring group participation (Kings Cup, Dare Pull) only trigger when sufficient users have reached SOCIAL_LAYER
**And** Quick Vote remains available regardless of layer state

### Story 13.5: Late Joiner Ramp-Up

As a participant joining a party already in progress,
I want to start my progressive unlock journey from the beginning,
So that I get the same gradual feature introduction regardless of when I joined.

**Acceptance Criteria:**

**Given** a user joins a party that is already on song 8
**When** they connect
**Then** their personal song counter starts at 0 — they begin at BASE_LAYER (FR140)
**And** they see only Base Layer features during their first 2 songs
**And** they progress through Interaction Layer (their songs 3-4) and Social Layer (their song 5+) independently of other users

**Given** a late joiner is at BASE_LAYER while other users are at SOCIAL_LAYER
**When** the DJ engine evaluates party card dealing
**Then** party cards are NOT dealt to the late joiner (they haven't unlocked cards yet)
**And** party cards ARE dealt to users who have reached SOCIAL_LAYER
**And** the late joiner can still see and react to other users' party card performances
