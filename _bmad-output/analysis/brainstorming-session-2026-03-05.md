---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: []
session_topic: 'Cross-platform playlist integration + seamless song data capture for karaoke party gamification'
session_goals: 'Discover viable technical approaches and creative workarounds that eliminate user friction while delivering song-level data for dynamic game mechanics'
selected_approach: 'ai-recommended'
techniques_used: ['Question Storming', 'Cross-Pollination', 'First Principles Thinking']
ideas_generated: [33]
context_file: ''
session_active: false
workflow_completed: true
facilitation_notes: 'User has strong product instincts — challenged Spotify API assumptions correctly, kept focus on real user behavior, corrected architectural flow based on actual party dynamics'
---

# Brainstorming Session Results

**Facilitator:** Ducdo
**Date:** 2026-03-05

## Session Overview

**Topic:** Cross-platform playlist integration + seamless song data capture for karaoke party gamification
**Goals:** Discover viable technical approaches and creative workarounds that eliminate user friction while delivering song-level data for dynamic game mechanics

### Context Guidance

_Users want to pool playlists from multiple music apps into a master list, pick songs for karaoke night, and have mini-games/challenges revolve around those songs and genres. Key constraints: no known APIs for cross-platform playlist aggregation, no double-entry (users already input songs into karaoke machine), need actual song-level data (not just genre)._

### Session Setup

_Solo brainstorming session focused on solving a technical/UX problem at the intersection of music platform integration, karaoke machine interaction, and frictionless data capture. The core tension: how to get rich song data into the app seamlessly without redundant user input across multiple music platforms._

## Technique Selection

**Approach:** AI-Recommended Techniques
**Analysis Context:** Cross-platform playlist integration with focus on eliminating friction while capturing song-level data

**Recommended Techniques:**

- **Question Storming:** Map the full problem space by generating only questions — surface blind spots, challenge assumptions about what's possible, and identify what we truly know vs. assume
- **Cross-Pollination:** Raid solutions from music tech, smart home, gaming, social apps, and other industries that solve similar data-capture-without-friction problems
- **First Principles Thinking:** Strip away all assumptions and rebuild from fundamental truths — phones in a room, music playing, songs have metadata — to construct novel solution architectures

**AI Rationale:** The problem combines technical unknowns (API availability) with UX constraints (no double-entry). This sequence moves from mapping the unknown → stealing proven patterns → rebuilding from scratch, maximizing the chance of discovering genuinely novel approaches.

## Technique Execution Results

### Question Storming (Phase 1)

**Interactive Focus:** Forensic investigation of the karaoke environment — what do we actually know about the TV, the pairing mechanism, the user behavior, the social dynamics?

**Key Discoveries:**
- YouTube TV uses a pairing code mechanism — users already enter a code from their phone
- Song titles are displayed on screen but only for 3-5 seconds (unreliable for OCR)
- Users browse songs on their phone, then type into the karaoke machine (double-entry friction point)
- The group dynamic is "shouting suggestions" — phones in hand, nearest person controls the machine
- The real problem isn't playlist integration — it's **decision fatigue** ("what should we sing?")

**Breakthrough:** The TV pairing code is a huge clue — led directly to the Lounge API discovery.

### Cross-Pollination (Phase 2)

**Building on Previous:** Armed with Question Storming insights, raided solutions from Jackbox Games, Spotify Blend, Shazam, Kahoot, Tinder, Waze, and AirDrop.

**Live Research Conducted:**
- YouTube Lounge API — reverse-engineered, open-source libraries exist (Node.js, Python, Go, Rust). Can pair via TV code, read now-playing, read/write queue.
- Music Platform APIs — Spotify (public playlists via Client Credentials, private needs OAuth with 5-user dev limit), YouTube Music (free, API key only, no limits), Apple Music ($99/year)
- Audio Fingerprinting — ACRCloud supports cover song ID (84-89% accuracy) but unreliable in noisy karaoke venues
- Song Metadata — MusicBrainz (free, no auth) supports ISRC-based cross-platform matching

**Key Patterns Stolen:**
- Jackbox "room code" onboarding — TV code IS the party code
- Spotify Blend taste-merging — find the overlap across friends' playlists
- Shazam "magic moment" — audio ID as a party trick, not core mechanic

### First Principles Thinking (Phase 3)

**Atomic Truths Identified:**
1. A group of friends is in the same room
2. Each person has a smartphone with internet
3. A TV/screen is playing karaoke videos from YouTube
4. The TV has a pairing code visible on screen
5. Songs have metadata (title, artist, genre, duration)
6. Each person listens to music on at least one streaming platform
7. Those platforms have shareable playlist URLs

**Assumptions Challenged:**
- "Users need to import playlists before the party" → FALSE. Import happens when they join the party room.
- "The app needs to integrate with every music platform" → FALSE. YouTube is already in the room. Spotify is a bonus.
- "Playlist import is the core feature" → FALSE. It's cold-start onboarding. The Lounge API is the real core.
- "The app needs to suggest songs from day one" → FALSE. Pre-built Karaoke Classics catalog provides zero-setup suggestions.

**Architecture Reframe:** Two-Mode Architecture — passive Lounge API (always-on core) + playlist import (cold-start assist only).

## Complete Idea Inventory (33 Ideas)

### Theme 1: Core Data Pipeline

| # | Idea | Description | Priority |
|---|---|---|---|
| 7 | **Lounge API Passive Listener** | Pair via TV code, auto-detect every song via nowPlaying events | P0 |
| 8 | **Lounge API Queue Controller** | Push songs to TV queue via addVideo/insertVideo commands | P0 |
| 9 | **Video ID → Metadata Pipeline** | video_id → YouTube Data API → get-artist-title parser → {song, artist} | P0 |
| 26 | **Simplest Possible Pipeline** | 4 API calls, YouTube-only, no other platforms needed for core | P0 |
| 1 | Audio Fingerprinting Listener | Phone mic + ACRCloud to identify songs passively | Future |
| 2 | Cast Session Piggyback | Join existing Cast session to read metadata | Superseded by #7 |
| 13 | Shazam Magic Moment | Audio ID as a fun party trick, not core mechanic | Future |

### Theme 2: Cold Start & Playlist Import

| # | Idea | Description | Priority |
|---|---|---|---|
| 3 | **Playlist URL Paste & Parse** | Paste YouTube Music or Spotify link, app reads all songs | P1 |
| 32 | **Spotify "Make Public" Prompt** | Visual guide to toggle playlist public, sidesteps OAuth wall | P1 |
| 25 | **Karaoke Classics Catalog** | Pre-built DB from karaoke YouTube channels, zero-setup fallback | P1 |
| 10 | **Karaoke Channel Index** | Scrape Sing King, KaraFun, Stingray into searchable DB | P1 |
| 22 | **Tiered Input** | Auto-detect URL domain, route to right API | P1 |
| 18 | YouTube-First Strategy | YouTube Music as primary, others secondary | Architecture |
| 19 | Spotify "Make Public" Prompt (early version) | Merged into #32 | — |
| 20 | Screenshot OCR Fallback | OCR playlist screenshots for any platform | Future |
| 27 | Group Chat Collection | Paste links in group chat before party | Superseded by in-app flow |
| 4 | Playlist Screenshot OCR | Share screenshot, OCR extracts songs | Future |
| 17 | AirDrop Proximity Sharing | Bluetooth LE auto-detect nearby devices | Future |
| 21 | Manual Song Search + Autocomplete | MusicBrainz-powered search as universal fallback | Future |

### Theme 3: Suggestion Intelligence

| # | Idea | Description | Priority |
|---|---|---|---|
| 28 | **Intersection-Based Suggestion Engine** | (songs group knows ∪ songs group has sung) ∩ karaoke catalog | P0 |
| 12 | Taste Overlap Scoring | "4/5 of you listen to this" ranks higher | P0 (part of #28) |
| 6 | Song Suggestion Burden Remover | App suggests, group approves — no brainstorming needed | UX philosophy |
| 24 | Snowball Effect | Each session makes suggestions smarter | Retention mechanic |
| 23 | Two-Mode Architecture | Passive Lounge API (core) + playlist import (cold start) | Architecture |

### Theme 4: Song Selection UX

| # | Idea | Description | Priority |
|---|---|---|---|
| 33 | **Dual-Mode Selection** | Quick Pick (default) + Spin the Wheel (party mode) | P0 |
| 29 | **Quick Pick** | 5 AI suggestions, group taps to vote | P0 |
| 30 | **Spin the Wheel** | 8 picks on animated wheel, dramatic reveal | P0 |
| 31 | Host Picks, Group Reacts | One person controls, others veto | Future mode |
| 5 | Shared Song Cart | Collaborative browsing pool | Superseded by #33 |
| 15 | Swipe to Vote | Tinder-style swiping | Too slow |

### Theme 5: Party Infrastructure

| # | Idea | Description | Priority |
|---|---|---|---|
| 11 | **Jackbox Room Code Pattern** | TV code = room code, everyone joins instantly | P1 |
| 14 | Kahoot Scoreboard on TV | Game scores displayed between songs via Lounge API | Future |
| 16 | Waze Crowdsource | Every session makes the app smarter for all users | Future |

## Prioritization Results

### P0 — Core (Must Have for MVP)

1. **Lounge API Core Engine** (#7, #8, #9, #26) — Pair with TV, passively detect songs, push songs to queue, extract metadata. The entire foundation.
2. **Intersection-Based Suggestion Engine** (#28) — Songs the group knows ∩ songs with karaoke versions. Ranked by overlap count and genre momentum.
3. **Quick Pick + Spin the Wheel** (#33, #29, #30) — Dual-mode song selection. Quick Pick for speed, Spin the Wheel for party energy.

### P1 — Launch (High Impact, Build Alongside)

4. **Playlist URL Import** (#3, #32, #22) — YouTube Music + Spotify public playlists. Auto-detect URL domain. "Make Public" guide for private Spotify playlists.
5. **Karaoke Catalog Index** (#25, #10) — Pre-scraped database from karaoke YouTube channels. Zero-setup fallback + karaoke version matching.
6. **Jackbox Room Code** (#11) — TV code IS the party room code. Frictionless onboarding.

### Future Enhancements

- Shazam party trick (#13), Kahoot scoreboard (#14), Screenshot OCR (#4/#20), Audio fingerprinting (#1), Snowball learning across sessions (#24), Crowdsource data (#16), Apple Music support

## Action Plans

### Action Plan 1: Lounge API Core Engine

**Pipeline:** TV code → Lounge API pair → nowPlaying events → video_id → YouTube Data API v3 → get-artist-title parser → {song, artist, genre} → game engine. Also: app pushes songs to queue via addVideo.

**Immediate Next Steps:**
1. Prototype with `youtube-remote` (npm) — pair with a real YouTube TV and read now-playing
2. Chain to YouTube Data API v3 `videos.list` to resolve video_id → metadata
3. Test `get-artist-title` parser against real karaoke video titles
4. Validate full pipeline end-to-end: TV code → song starts → {song, artist} in app within 5 seconds

**Key Risks:**
- Lounge API is unofficial — could break. Mitigation: abstract behind an interface for swappable alternatives.
- Karaoke video title formats vary. Mitigation: fuzzy-match against karaoke catalog index.

**Open-Source Libraries:**
- Node.js: `youtube-remote` (npm), `yt-cast-receiver` (npm), `babbling` (npm)
- Python: `pyytlounge` (pip) — best documented
- Go: `ytcast` | Rust: `youtube-lounge-rs`
- Title parser: `get-artist-title` (npm)

### Action Plan 2: Playlist URL Import (YouTube Music + Spotify)

**YouTube Music:** Extract playlist ID from URL → YouTube Data API v3 `playlistItems.list` (API key only, free, no auth wall) → paginate all tracks → parse titles.

**Spotify:** Extract playlist ID from URL → try Client Credentials flow → if private, show "Make Public" 3-step guide → `GET /v1/playlists/{id}/tracks` → returns full track list with ISRC codes.

**Immediate Next Steps:**
1. Build URL parser detecting domain (music.youtube.com vs open.spotify.com)
2. Implement YouTube Music playlist reader
3. Register Spotify app, implement Client Credentials flow
4. Design "Make Public" guidance UI for private Spotify playlists
5. Normalize songs across platforms via title+artist matching or ISRC via MusicBrainz

**Key Risks:**
- Spotify Dev Mode requires app owner Premium (~$11/mo). Acceptable cost.
- Auto-generated YouTube Music playlists may not be API-accessible. Inform user, suggest custom playlist.

### Action Plan 3: Intersection-Based Suggestion Engine

**Algorithm:**
```
suggestion_pool = (songs_group_listens_to ∪ songs_group_has_sung) ∩ karaoke_catalog
ranked_by: overlap_count → genre_momentum → not_yet_sung → game_triggers → history_boost
```

**Immediate Next Steps:**
1. Scrape top karaoke channels (Sing King, KaraFun, Stingray) → ~10K-30K tracks
2. Build intersection logic: imported songs ∩ karaoke index
3. Implement overlap counting across friends' playlists
4. Add genre momentum: track last 3 songs, bias away from repetition
5. Cold start fallback: Karaoke Classics (top 200 universally known karaoke songs)

### Action Plan 4: Quick Pick + Spin the Wheel

**Quick Pick:** 5 AI suggestions displayed as cards (song, artist, thumbnail, overlap badge) → everyone taps thumbs up/skip → majority wins → auto-queue to TV via Lounge API. Auto-advance after 15 seconds if no majority.

**Spin the Wheel:** 8 suggestions on animated wheel → someone taps SPIN → dramatic animation → landing song gets queued. Optional: 1 veto per round. Can trigger game challenges.

**Immediate Next Steps:**
1. Design Quick Pick card UI
2. Implement real-time voting (Firebase Realtime DB or Supabase Realtime)
3. Build Spin the Wheel animation (e.g. `spin-wheel` npm package)
4. Connect winner to Lounge API `addVideo` to auto-queue on TV
5. Add mode toggle: Quick Pick ↔ Spin the Wheel

## Complete Architecture

```
┌─────────────────────────────────────────────────┐
│              ARRIVING AT THE PARTY               │
│                                                  │
│  Host enters TV code → app pairs via Lounge API  │
│  App creates party room (TV code = room code)    │
│  Friends join room on their phones               │
│         ↓                                        │
│  App prompts: "Share your playlist!"             │
│  Each person pastes YouTube Music / Spotify link │
│         ↓                                        │
│  App reads all playlists via APIs                │
│  Songs matched against Karaoke Index             │
│  Shared song pool built in real-time             │
└────────────────────┬────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────┐
│              KARAOKE IN PROGRESS                 │
│                                                  │
│  Suggestion engine: group overlap ∩ karaoke DB   │
│         ↓                                        │
│  ┌──────────────┐    ┌───────────────────┐      │
│  │  QUICK PICK  │ or │  SPIN THE WHEEL   │      │
│  │ 5 suggestions│    │  8 picks on wheel  │      │
│  │ group votes  │    │  someone spins     │      │
│  └──────┬───────┘    └─────────┬─────────┘      │
│         ↓                      ↓                 │
│     Winner selected                              │
│         ↓                                        │
│  App queues song on TV via Lounge API addVideo   │
│         ↓                                        │
│  Song plays → nowPlaying event → metadata parsed │
│         ↓                                        │
│  Game engine receives {song, artist, genre}      │
│         ↓                                        │
│  Mini-games & challenges triggered               │
│         ↓                                        │
│  Repeat until party ends                         │
└─────────────────────────────────────────────────┘
```

## Technical Research Summary

### YouTube Lounge API (Unofficial, Reverse-Engineered)
- **Pairing:** `POST /api/lounge/pairing/get_screen` with TV code → returns lounge_token
- **Session:** `POST /api/lounge/bc/bind` → long-polling for nowPlaying, onStateChange events
- **Queue control:** `setPlaylist`, `addVideo`, `insertVideo`, `removeVideo`, `clearPlaylist`
- **Libraries:** `youtube-remote` (npm), `pyytlounge` (pip), `ytcast` (Go), `youtube-lounge-rs` (Rust), `yt-cast-receiver` (npm)
- **Risk:** Unofficial API, could break. Has been stable for years with active open-source maintenance.

### YouTube Data API v3 (Official)
- **Playlist items:** `GET /youtube/v3/playlistItems?part=snippet&playlistId={id}` — 1 quota unit, up to 50 items/page
- **Video metadata:** `GET /youtube/v3/videos?part=snippet&id={id}` — 1 quota unit, batch up to 50 IDs
- **Auth:** API key only for public data. No OAuth needed.
- **Quota:** 10,000 units/day (free)

### Spotify Web API
- **Public playlists:** `GET /v1/playlists/{id}/tracks` via Client Credentials flow (server-to-server, no user login)
- **Private playlists:** Requires user OAuth — limited to 5 test users in Development Mode
- **Workaround:** Guide users to make playlists public (one-time toggle)
- **Auth:** Client ID + Secret → `POST /api/token` with `grant_type=client_credentials`
- **Cost:** App owner needs Spotify Premium (~$11/mo). No per-request charges.

### Song Title Parsing
- `get-artist-title` (npm) — parses "Artist - Song Title (Official Video)" → [artist, title]
- `youtube_title_parse` (Python) — handles varied separators
- Cross-reference with MusicBrainz for validation

### Karaoke Catalog Sources
- Sing King Karaoke (14.3M subs), KaraFun (3.2M subs), Stingray Karaoke
- KaraFun has a developer API (WebSocket-based) with search and queue management
- Stingray has a REST API with 140,000+ songs (commercial/licensed)

### Audio Fingerprinting (Future Enhancement)
- ACRCloud: 150M+ tracks, cover song ID mode, 14-day free trial
- Karaoke venue challenges: background noise, key shifts, instrumental-only tracks
- Best as "magic" secondary feature, not primary input method

### Cross-Platform Song Normalization
- MusicBrainz: free, no auth, ISRC-based lookup for cross-platform matching
- Spotify provides ISRC codes in track objects
- YouTube does not provide ISRC — fall back to fuzzy title+artist matching

## Session Summary and Insights

**Key Achievements:**
- Transformed "we don't know if this is possible" into a concrete, proven technical architecture
- Discovered the YouTube Lounge API — the single most impactful finding, enabling zero-friction passive song detection AND queue control
- Reframed the core problem from "playlist integration" to "decision fatigue reduction"
- Validated that Spotify public playlist reading is viable without the OAuth user-limit wall
- Designed a dual-mode song selection UX (Quick Pick + Spin the Wheel) that matches real party energy

**Session Reflections:**
- The First Principles technique was the turning point — it revealed that playlist import is cold-start onboarding, not core functionality
- User's correction that playlist pasting happens AT the party (not before) significantly improved the architecture flow
- User's challenge on Spotify API restrictions was valid and led to the "Make Public" workaround — a simpler, more honest solution than trying to work around OAuth

### Creative Facilitation Narrative

_This session began with what felt like an impossible problem — "we don't know any APIs that allow this." Through systematic Question Storming, we mapped the problem space and discovered the YouTube TV pairing code was a critical clue. Live technical research confirmed the YouTube Lounge API could pair with the TV, read the queue, and control playback — all from a third-party app. Cross-Pollination brought patterns from Jackbox, Spotify Blend, and Shazam that shaped the UX. First Principles Thinking stripped away unnecessary complexity and revealed that the YouTube ecosystem already provides everything needed for the core experience. The session transformed a vague feature wish into a buildable architecture with proven technical foundations._
