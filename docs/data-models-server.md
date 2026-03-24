# Karamania Server — Data Models

## Database Schema

PostgreSQL 16 with Kysely ORM. Schema defined in 2 migrations.

### Entity Relationship Diagram

```
┌──────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│    users     │     │      sessions        │     │   karaoke_catalog   │
├──────────────┤     ├──────────────────────┤     ├─────────────────────┤
│ id (PK, UUID)│◄────│ host_user_id (FK)    │     │ id (PK, UUID)       │
│ firebase_uid │     │ id (PK, UUID)        │     │ youtube_video_id (UK)│
│ display_name │     │ party_code (UK*)     │     │ song_title          │
│ avatar_url   │     │ status               │     │ artist              │
│ created_at   │     │ dj_state (JSONB)     │     │ channel             │
└──────────────┘     │ event_stream (JSONB) │     │ is_classic          │
       │             │ summary (JSONB)      │     │ created_at          │
       │             │ vibe                 │     │ updated_at          │
       │             │ venue_name           │     └─────────────────────┘
       │             │ created_at           │
       │             │ ended_at             │
       │             └──────────────────────┘
       │                      │
       │    ┌─────────────────┴──────────────────┐
       │    │                                    │
       ▼    ▼                                    ▼
┌────────────────────────┐          ┌──────────────────────┐
│ session_participants   │          │   media_captures     │
├────────────────────────┤          ├──────────────────────┤
│ id (PK, UUID)          │          │ id (PK, UUID)        │
│ session_id (FK)        │          │ session_id (FK)      │
│ user_id (FK, nullable) │          │ user_id (FK, nullable│
│ guest_name (nullable)  │          │ storage_path         │
│ participation_score    │          │ trigger_type         │
│ top_award              │          │ dj_state_at_capture  │
│ feedback_score (1-5)   │          │ created_at           │
│ joined_at              │          └──────────────────────┘
└────────────────────────┘
```

*UK\* = partial unique index on active sessions only*

---

## Table Definitions

### users

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, auto-generated | User identifier |
| firebase_uid | VARCHAR | UNIQUE, NULLABLE | Firebase Auth UID (null for guests) |
| display_name | VARCHAR | NOT NULL | User display name |
| avatar_url | VARCHAR | NULLABLE | Profile image URL |
| created_at | TIMESTAMP | DEFAULT NOW() | Account creation time |

**Indexes:** `idx_users_firebase_uid` on `firebase_uid`

### sessions

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, auto-generated | Session identifier |
| host_user_id | UUID | FK → users.id | Party host |
| party_code | VARCHAR(4) | NOT NULL | Join code (e.g., "VIBE") |
| status | VARCHAR | CHECK (lobby\|active\|paused\|ended) | Session lifecycle state |
| dj_state | JSONB | DEFAULT '{}' | Serialized DJContext (state machine snapshot) |
| event_stream | JSONB | DEFAULT '[]' | Append-only event log |
| summary | JSONB | NULLABLE | Finale session summary |
| vibe | VARCHAR | DEFAULT 'general' | Party vibe theme |
| venue_name | VARCHAR | NULLABLE | Location name |
| created_at | TIMESTAMP | DEFAULT NOW() | Session creation time |
| ended_at | TIMESTAMP | NULLABLE | Session end time |

**Indexes:**
- `idx_sessions_party_code` on `party_code`
- `idx_sessions_active_party_code` — partial unique index on `party_code WHERE status != 'ended'`

### session_participants

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, auto-generated | Participant record ID |
| session_id | UUID | FK → sessions.id, NOT NULL | Session reference |
| user_id | UUID | FK → users.id, NULLABLE | Authenticated user (null for guests) |
| guest_name | VARCHAR | NULLABLE | Guest display name |
| participation_score | INTEGER | DEFAULT 0 | Accumulated score |
| top_award | VARCHAR | NULLABLE | Best award title |
| feedback_score | INTEGER | NULLABLE, CHECK 1-5 | Post-session feedback rating |
| joined_at | TIMESTAMP | DEFAULT NOW() | Join time |

**Indexes:** `idx_session_participants_session_id` on `session_id`
**Unique Constraint:** Expression-based unique index on `(session_id, COALESCE(user_id, guest_name))` — ensures one entry per user OR guest name per session.

### media_captures

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, auto-generated | Capture identifier |
| session_id | UUID | FK → sessions.id, NOT NULL | Session reference |
| user_id | UUID | FK → users.id, NULLABLE | Capture owner (null for guests) |
| storage_path | VARCHAR | NOT NULL | Firebase Storage path: `{sessionId}/{captureId}.{ext}` |
| trigger_type | VARCHAR | NOT NULL | session_start, reaction_peak, post_ceremony, session_end, manual |
| dj_state_at_capture | JSONB | NULLABLE | DJ state snapshot at capture time |
| created_at | TIMESTAMP | DEFAULT NOW() | Capture time |

**Note:** `user_id` is nullable to support guest captures. Relinkable via `relinkCaptures()` during guest-to-account upgrade.

### karaoke_catalog

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, auto-generated | Track identifier |
| song_title | VARCHAR | NOT NULL | Song name |
| artist | VARCHAR | NOT NULL | Artist name |
| youtube_video_id | VARCHAR | UNIQUE, NOT NULL | YouTube video ID |
| channel | VARCHAR | NULLABLE | YouTube channel name |
| is_classic | BOOLEAN | DEFAULT FALSE | Classic song flag |
| created_at | TIMESTAMP | DEFAULT NOW() | Import time |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update time |

**Indexes:** `idx_karaoke_catalog_youtube_video_id` on `youtube_video_id`

---

## JSONB Schemas

### dj_state (sessions.dj_state)

Serialized `DJContext` from the DJ engine:

```json
{
  "state": "song",
  "sessionId": "uuid",
  "participantCount": 5,
  "songCount": 3,
  "sessionStartedAt": 1711234567890,
  "currentPerformer": "Alice",
  "currentSongTitle": "Bohemian Rhapsody",
  "timerStartedAt": 1711234567890,
  "timerDurationMs": 180000,
  "timerRemainingMs": null,
  "isPaused": false,
  "pausedAt": null,
  "pausedFromState": null,
  "cycleHistory": ["songSelection", "partyCardDeal", "song"],
  "metadata": { "lastCeremonyType": "full", "ceremonyType": "quick" }
}
```

### event_stream (sessions.event_stream)

Append-only array of 60+ event types:

```json
[
  { "type": "party:joined", "timestamp": 1711234567890, "userId": "uuid", "data": { "displayName": "Alice" } },
  { "type": "dj:stateChanged", "timestamp": 1711234567891, "data": { "from": "lobby", "to": "icebreaker" } },
  { "type": "reaction:sent", "timestamp": 1711234567892, "userId": "uuid", "data": { "emoji": "🔥" } }
]
```

### summary (sessions.summary)

Finale session summary (added in migration 002):

```json
{
  "version": 1,
  "generatedAt": "2026-03-24T00:00:00Z",
  "stats": {
    "songCount": 8,
    "participantCount": 5,
    "sessionDurationMs": 3600000,
    "totalReactions": 342,
    "totalSoundboardPlays": 45,
    "totalCardsDealt": 12,
    "topReactor": { "displayName": "Bob", "count": 120 },
    "longestStreak": 15
  },
  "setlist": [
    { "position": 1, "title": "Don't Stop Believin'", "artist": "Journey", "performerName": "Alice", "awardTitle": "Mic Drop Master", "awardTone": "hype" }
  ],
  "awards": [
    { "userId": "uuid", "displayName": "Alice", "category": "performer", "title": "Vocal Powerhouse", "tone": "hype", "reason": "Highest reaction count" }
  ],
  "participants": [
    { "userId": "uuid", "displayName": "Alice", "participationScore": 45, "topAward": "Vocal Powerhouse" }
  ]
}
```

---

## Migration History

| Migration | Description | Tables Affected |
|-----------|-------------|-----------------|
| 001-initial-schema | Create 5 tables, 8 indexes, constraints | users, sessions, session_participants, media_captures, karaoke_catalog |
| 002-session-summary | Add summary JSONB column | sessions |

---

## In-Memory Data Stores

The server maintains 20+ module-level `Map` stores for real-time performance. These are NOT persisted to PostgreSQL — they are reconstructed from DB state on server restart via `recoverActiveSessions()`.

| Store | Key Format | Value | Lifecycle |
|-------|-----------|-------|-----------|
| `djContexts` | sessionId | DJContext | Created on session start, removed on end |
| `activeConnections` | sessionId → userId | TrackedConnection | Per socket connect/disconnect |
| `eventStreams` | sessionId | SessionEvent[] | Flushed to DB on session end |
| `songPools` | sessionId | SessionSongPool | Created on playlist import |
| `quickPickRounds` | sessionId | QuickPickRound | Per song selection round |
| `spinWheelRounds` | sessionId | SpinWheelRound | Per spin wheel round |
| `activityVoteRounds` | sessionId | ActivityVoteRound | Per interlude |
| `icebreakerRounds` | sessionId | IcebreakerRound | Per icebreaker |
| `reactionStreaks` | sessionId:userId | StreakState | Reset after 5s inactivity |
| `peakStates` | sessionId | SessionPeakState | 60s cooldown between peaks |
| `userRateLimits` | userId | number[] (timestamps) | 5s window |
| `dealtCards` | sessionId | Set\<string\> | Reset when pool exhausted |
| `timers` | sessionId | NodeJS.Timeout | Managed via timer-scheduler |
| `scoreCaches` | sessionId → userId | number | Avoids DB race conditions |
