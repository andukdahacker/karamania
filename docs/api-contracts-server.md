# Karamania Server — API Contracts

## Base URL

- Local: `http://localhost:3000`
- Production: `https://api.karamania.app`
- OpenAPI Spec: `GET /openapi.json`

## Authentication

Two authentication methods:

1. **Firebase Auth** — `Authorization: Bearer <firebase-id-token>`
2. **Guest JWT** — `Authorization: Bearer <guest-jwt>` (HS256, 6h expiry)

---

## Health

### GET /health
Health check with database connectivity.

**Response 200:**
```json
{ "status": "ok", "database": "connected", "timestamp": "2026-03-24T..." }
```

**Response 503:**
```json
{ "error": { "code": "DATABASE_UNREACHABLE", "message": "..." } }
```

---

## Authentication

### POST /api/auth/guest
Guest authentication to join an active party.

**Request:**
```json
{ "displayName": "string", "partyCode": "string" }
```

**Response 200:**
```json
{ "token": "jwt-string", "guestId": "uuid", "sessionId": "uuid", "vibe": "general", "status": "active" }
```

**Errors:** 400 (missing displayName), 403 (session full — max 12), 404 (party code not found)

---

## Sessions

### POST /api/sessions
Create a new party session. Auth optional (Firebase for authenticated host, none for guest host).

**Request:**
```json
{ "displayName": "string (required for guest)", "vibe": "general|kpop|rock|ballad|edm", "venueName": "string" }
```

**Response 201:**
```json
{ "sessionId": "uuid", "partyCode": "ABCD", "token": "jwt (guest only)", "guestId": "uuid (guest only)" }
```

### GET /api/sessions
List user's past sessions (paginated). **Auth: Required (Firebase)**

**Query:** `limit` (default 20), `offset` (default 0)

**Response 200:**
```json
{ "data": [{ "id": "uuid", "venueName": "...", "endedAt": "ISO", "participantCount": 5, "topAward": { "title": "...", "tone": "comedic" }, "thumbnailUrl": "signed-url|null" }], "total": 10, "limit": 20, "offset": 0 }
```

### GET /api/sessions/:id
Full session detail (host only). **Auth: Required (Firebase)**

**Response 200:** Full session data with stats, participants (with scores, awards), setlist (with positions, awards), media (with signed URLs), awards list.

### GET /api/sessions/:id/share
Public session sharing (no auth). Only returns data for ended sessions with summary.

**Response 200:**
```json
{ "venueName": "...", "createdAt": "ISO", "endedAt": "ISO", "vibe": "general", "stats": { "songCount": 8, "participantCount": 5, "totalReactions": 342 }, "participants": [{ "displayName": "...", "participationScore": 45, "topAward": "..." }], "setlist": [{ "position": 1, "title": "...", "artist": "...", "performerName": "...", "awardTitle": "..." }], "mediaUrls": ["signed-url"] }
```

---

## Catalog

### GET /api/catalog/search
Search songs by title or artist (case-insensitive ILIKE). **No auth.**

**Query:** `q` (search string), `limit` (default 20), `offset` (default 0)

**Response 200:**
```json
{ "data": [{ "id": "uuid", "songTitle": "...", "artist": "...", "youtubeVideoId": "...", "channel": "...", "isClassic": false }], "total": 100, "limit": 20, "offset": 0 }
```

### GET /api/catalog/stats
**Response 200:** `{ "totalTracks": 5000, "classicTracks": 200 }`

### GET /api/catalog/classics
**Response 200:** Array of classic catalog tracks.

---

## Playlists

### POST /api/playlists/import
Import from YouTube, YouTube Music, or Spotify. **Auth: Optional (required if sessionId provided).**

**Request:**
```json
{ "playlistUrl": "https://open.spotify.com/playlist/...", "sessionId": "uuid (optional)" }
```

**Response 200:**
```json
{ "tracks": [{ "songTitle": "...", "artist": "...", "youtubeVideoId": "..." }], "matched": [{ "catalogTrackId": "uuid", "songTitle": "...", "artist": "...", "youtubeVideoId": "..." }], "unmatchedCount": 5, "totalFetched": 50, "poolStats": { "newSongs": 10, "updatedOverlaps": 3, "totalPoolSize": 25 } }
```

**Errors:** 400 (invalid URL), 403 (private playlist), 404 (not found), 502 (API failure)

---

## Suggestions

### GET /api/sessions/:sessionId/suggestions
Song recommendations from session pool. **Auth: Required (Firebase or Guest).**

**Query:** `count` (default 5)

**Response 200:** Array of suggested songs with scores and overlap counts.

---

## Captures (Media)

### POST /api/sessions/:sessionId/captures
Create capture metadata. **No auth required.**

**Request:**
```json
{ "captureType": "photo|video|audio", "triggerType": "session_start|reaction_peak|post_ceremony|session_end|manual", "durationMs": 5000, "userId": "uuid" }
```

**Response 201:** Capture metadata with `storagePath`.

### GET /api/sessions/:sessionId/captures
List session captures. **Auth: Required.** Must be session participant.

### GET /api/sessions/:sessionId/captures/:captureId/upload-url
Get signed upload URL (15-min expiry). **Auth: Required.** Must be capture owner.

### GET /api/sessions/:sessionId/captures/:captureId/download-url
Get signed download URL (7-day expiry). **Auth: Required.** Guest download access expires 7 days after session ends.

---

## Users

### GET /api/users/me
Current user profile. **Auth: Required (Firebase).**

**Response 200:**
```json
{ "data": { "id": "uuid", "displayName": "...", "avatarUrl": "...", "createdAt": "ISO" } }
```

### POST /api/users/upgrade
Upgrade guest to authenticated account. **Auth: Required.**

**Request:**
```json
{ "firebaseToken": "...", "guestId": "uuid", "sessionId": "uuid", "guestDisplayName": "...", "captureIds": ["uuid"] }
```

**Response 200:** Upgraded user profile with linked participant and capture counts.

---

## Media Gallery

### GET /api/users/me/media
User's captures across all sessions with signed download URLs. **Auth: Required (Firebase).**

**Query:** `limit` (default 40), `offset` (default 0)

**Response 200:** Paginated array of captures with session context (venue name, session date).

---

## Socket.IO Events

### Connection
```
auth: { token, sessionId, displayName, userId }
transport: websocket
pingInterval: 10s, pingTimeout: 5s
```

### Key Events (Server → Client)

| Event | Payload | Description |
|-------|---------|-------------|
| `party:participants` | `{participants, count}` | Updated participant list |
| `party:joined` | `{userId, displayName, count}` | New participant joined |
| `party:started` | `{sessionId}` | Party started |
| `party:ended` | — | Party ended |
| `party:hostTransferred` | `{newHostId, displayName}` | Host changed |
| `dj:stateChanged` | `{state, metadata, timer...}` | DJ state transition |
| `dj:pause` / `dj:resume` | — | Pause/resume |
| `ceremony:anticipation` | `{performerName, revealAt}` | Full ceremony started |
| `ceremony:reveal` | `{award, tone, vibe}` | Award revealed |
| `ceremony:quick` | `{award, performerName}` | Quick ceremony |
| `reaction:broadcast` | `{userId, emoji, displayName}` | Reaction sent |
| `reaction:streak` | `{count, emoji, milestone}` | Streak milestone |
| `sound:play` | `{soundId, userId}` | Sound effect |
| `card:dealt` | `{card, singerId}` | Party card dealt |
| `card:groupActivated` | `{selectedIds, names, announcement}` | Group card activated |
| `quickpick:started` | `{songs, timer}` | Quick pick round started |
| `song:quickpick` | `{votes}` | Vote update |
| `spinwheel:started` | `{segments, timer}` | Spin wheel started |
| `spinwheel:result` | `{phase, targetIndex, rotation}` | Spin result |
| `interlude:voteStarted` | `{options, timer}` | Activity vote started |
| `interlude:gameStarted` | `{activityId, card, duration}` | Game started |
| `icebreaker:started` | `{question, options, duration}` | Icebreaker started |
| `finale:awards` | `[{userId, title, category...}]` | Finale awards |
| `finale:stats` | `{songCount, reactions...}` | Session stats |
| `finale:setlist` | `[{position, title, artist...}]` | Final setlist |
| `tv:status` | `{status}` | TV connection status |
| `song:detected` | `{videoId, title, artist}` | TV song detection |
| `capture:bubble` | `{triggerType}` | Capture prompt |

### Key Events (Client → Server)

| Event | Payload | Description |
|-------|---------|-------------|
| `party:vibeChanged` | `{vibe}` | Change party vibe |
| `party:start` | — | Start the party (host) |
| `host:pause` / `host:resume` | — | Pause/resume |
| `host:skip` | — | Skip current state |
| `host:override` | `{targetState}` | Jump to state |
| `host:songOver` | — | End current song |
| `host:endParty` | — | End the party |
| `host:kickPlayer` | `{userId}` | Remove participant |
| `reaction:sent` | `{emoji}` | Send emoji reaction |
| `sound:play` | `{soundId}` | Play sound effect |
| `card:accepted` / `card:dismissed` | — | Card response |
| `card:redraw` | — | Request new card |
| `song:quickpick` | `{catalogTrackId, vote}` | Quick pick vote |
| `song:spinwheel` | `{action}` | Spin/veto |
| `song:modeChanged` | `{mode}` | Toggle quickPick/spinWheel |
| `interlude:vote` | `{activityId}` | Activity vote |
| `interlude:quickVote` | `{option}` | Quick vote (A/B) |
| `icebreaker:vote` | `{optionId}` | Icebreaker vote |
| `lightstick:toggled` | `{active}` | Lightstick on/off |
| `hype:fired` | — | Hype signal |
| `tv:pair` | `{pairingCode}` | Pair TV |
| `tv:unpair` | — | Unpair TV |
| `capture:started` / `capture:complete` | `{type, trigger}` | Capture lifecycle |
| `finale:feedback` | `{score}` | Submit feedback (1-5) |
