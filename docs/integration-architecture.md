# Karamania — Integration Architecture

## Overview

Karamania is a multi-part monorepo with 3 parts that communicate through REST APIs, WebSocket (Socket.IO), and shared deep-linking infrastructure.

## Part Communication Map

```
┌──────────────────────────────────────────────────────────────────┐
│                        External Services                         │
│                                                                  │
│  ┌──────────┐  ┌──────────────┐  ┌─────────────┐  ┌──────────┐ │
│  │ Firebase  │  │ YouTube Data │  │ Spotify Web │  │ YouTube  │ │
│  │ Auth/     │  │ API v3       │  │ API         │  │ Lounge   │ │
│  │ Storage   │  │              │  │             │  │ API      │ │
│  └─────┬────┘  └──────┬───────┘  └──────┬──────┘  └────┬─────┘ │
└────────┼───────────────┼─────────────────┼──────────────┼────────┘
         │               │                 │              │
    ┌────┴────┐    ┌─────┴─────────────────┴──────────────┴──┐
    │         │    │                                          │
    ▼         ▼    ▼                                          │
┌─────────────────────────────────────────────────┐           │
│              SERVER (Fastify 5)                  │           │
│                                                  │           │
│  REST API ◄────────────── HTTP ─────────► Flutter App      │
│  Socket.IO ◄─────────── WebSocket ──────► Flutter App      │
│  Static Files ◄──────── HTTP ───────────► Web Landing      │
│                                                  │           │
│  ┌─────────────────┐                             │           │
│  │  PostgreSQL 16  │                             │           │
│  │  (5 tables)     │                             │           │
│  └─────────────────┘                             │           │
└─────────────────────────────────────────────────┘           │
         ▲                                                     │
         │                              ┌──────────────────────┘
         │                              │
┌────────┴───────────┐    ┌─────────────┴─────────────┐
│   FLUTTER APP      │    │   WEB LANDING             │
│                    │    │                            │
│  Firebase Auth SDK │    │  Deep Link configs         │
│  Firebase Storage  │    │   .well-known/AASA         │
│  socket_io_client  │    │   .well-known/assetlinks   │
│  HTTP (REST API)   │    │  Session sharing page      │
│  Generated client  │    │  Platform detection        │
│  (dart_open_fetch) │    │                            │
└────────────────────┘    └────────────────────────────┘
```

## Integration Points

### 1. Flutter App ↔ Server (REST API)

| Endpoint | Direction | Protocol | Purpose |
|----------|-----------|----------|---------|
| `POST /api/sessions` | App → Server | HTTP | Create party |
| `POST /api/auth/guest` | App → Server | HTTP | Guest join |
| `POST /api/playlists/import` | App → Server | HTTP | Playlist import |
| `GET /api/sessions` | App → Server | HTTP | Session timeline |
| `GET /api/sessions/:id` | App → Server | HTTP | Session detail |
| `POST /api/sessions/:id/captures` | App → Server | HTTP | Capture metadata |
| `GET /.../upload-url` | App → Server | HTTP | Signed upload URL |
| `GET /.../download-url` | App → Server | HTTP | Signed download URL |
| `GET /api/users/me` | App → Server | HTTP | User profile |
| `POST /api/users/upgrade` | App → Server | HTTP | Guest → account |
| `GET /api/users/me/media` | App → Server | HTTP | Media gallery |
| `GET /api/catalog/search` | App → Server | HTTP | Song search |
| `GET /api/sessions/:id/suggestions` | App → Server | HTTP | Suggestions |

### 2. Flutter App ↔ Server (Socket.IO)

**50+ event types** for real-time party interaction:

| Category | Events (sample) | Direction |
|----------|----------------|-----------|
| Party lifecycle | join, start, end, participants, host transfer | Bidirectional |
| DJ state | stateChanged, pause, resume | Server → Client |
| Song selection | quickpick votes, spinwheel phases | Bidirectional |
| Reactions | sent, broadcast, streaks | Bidirectional |
| Soundboard | play (emit + broadcast) | Bidirectional |
| Party cards | dealt, accepted, dismissed, group | Bidirectional |
| Ceremonies | anticipation, reveal, quick | Server → Client |
| Interludes | vote, game start/end | Bidirectional |
| Finale | awards, stats, setlist, feedback | Bidirectional |
| TV | pair, unpair, status, song detected | Bidirectional |
| Captures | bubble, started, complete, persisted | Bidirectional |

### 3. Flutter App → Firebase

| Service | Usage |
|---------|-------|
| Firebase Auth | Google sign-in, anonymous auth, ID token generation |
| Firebase Storage | Media upload (authenticated users via SDK) |

### 4. Server → Firebase Admin

| Service | Usage |
|---------|-------|
| Firebase Admin Auth | Verify ID tokens, decode user claims |
| Firebase Admin Storage | Generate signed upload/download URLs |

### 5. Server → YouTube Data API v3

| Operation | Purpose |
|-----------|---------|
| Playlist items fetch | Import YouTube/YouTube Music playlists |
| Video details fetch | Song metadata (title, artist, duration) |

### 6. Server → Spotify Web API

| Operation | Purpose |
|-----------|---------|
| Client credentials auth | OAuth2 token for API access |
| Playlist tracks fetch | Import Spotify playlists (paginated, max 500 tracks) |

### 7. Server → YouTube Lounge API

| Operation | Purpose |
|-----------|---------|
| get_screen | Pair via TV pairing code |
| bind | Establish long-poll session |
| pollEvents | Stream now-playing events |
| addToQueue | Queue song on paired TV |
| Reconnection | Exponential backoff (1s→29s = 60s total) |

### 8. Web Landing ← Server (Static Serving)

The server's `web-landing.ts` route serves the web landing directory via `@fastify/static`, including:
- Landing page (`index.html`, `script.js`, `style.css`)
- Share page (`share.html`, `share.js`)
- Deep link configs (`.well-known/apple-app-site-association`, `.well-known/assetlinks.json`)

### 9. Web Landing → Server (API)

| Endpoint | Direction | Purpose |
|----------|-----------|---------|
| `GET /api/sessions/:id/share` | Web → Server | Fetch session data for share page |

## Data Flow

### Party Creation Flow
```
Flutter App                    Server                     PostgreSQL
    │                            │                            │
    ├─ POST /api/sessions ──────►│                            │
    │                            ├─ Insert session ──────────►│
    │                            ├─ Generate party code       │
    │                            ├─ Create DJ context         │
    │◄── {sessionId, partyCode} ─┤                            │
    │                            │                            │
    ├─ Socket.IO connect ───────►│                            │
    │  (auth: token, sessionId)  ├─ Validate token            │
    │                            ├─ Join room (sessionId)     │
    │◄── party:participants ─────┤                            │
```

### Real-time Game State Flow
```
Flutter (Host)              Server                    Flutter (All)
    │                          │                          │
    ├─ host:songOver ─────────►│                          │
    │                          ├─ processTransition()     │
    │                          │  (pure state machine)    │
    │                          ├─ Execute side effects:    │
    │                          │  - cancelTimer            │
    │                          │  - broadcast              │
    │                          │  - scheduleTimer          │
    │                          │  - persist to DB          │
    │                          ├── dj:stateChanged ──────►│
    │                          │                          ├─ Update PartyProvider
    │                          │                          ├─ Play state audio
    │                          │                          ├─ Render new overlay
```

### Media Capture Flow
```
Flutter App              Server                  Firebase Storage
    │                       │                          │
    ├─ capture:started ────►│ (event stream log)       │
    │                       │                          │
    │  [User captures]      │                          │
    │                       │                          │
    ├─ POST captures ──────►│ (create metadata)        │
    │◄─ {captureId, path} ──┤                          │
    │                       │                          │
    ├─ GET upload-url ─────►│                          │
    │◄─ {signedUrl} ────────┤─ Generate signed URL ───►│
    │                       │                          │
    ├─ PUT signedUrl ──────────────────────────────────►│
    │  (upload file)        │                          │
```

## Shared Contracts

### Party Codes
- 4-character alphanumeric (A-Z, 2-9, excluding I/O/L/1 for readability)
- Generated by server, unique per active session (partial unique index)
- Used by Flutter app (QR + manual entry) and web landing (deep links)

### Deep Linking
- `https://karamania.app/?code=XXXX` → Web landing → App
- `https://karamania.app/?session=ID` → Web landing → App
- `karamania://join?code=XXXX` → Direct app scheme
- `karamania://session/ID` → Direct app scheme

### Vibe System
5 vibes shared across all parts: `general`, `kpop`, `rock`, `ballad`, `edm`
- Server: `VALID_VIBES` constant, DB `vibe` column
- Flutter: `PartyVibe` enum, theme colors, reaction emoji sets
- Web: Displayed on share page

### DJ State Machine (8 states)
`lobby → icebreaker → songSelection → partyCardDeal → song → ceremony → interlude → (repeat) → finale`
- Server: Pure engine + persistence
- Flutter: State-driven UI rendering (8 overlay types)
