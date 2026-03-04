---
stepsCompleted: [1, 2, 3, 4, 5, 6]
workflow_completed: true
inputDocuments:
  - '_bmad-output/analysis/brainstorming-session-2026-03-03.md'
  - '_bmad-output/planning-artifacts/research/market-karaoke-party-companion-research-2026-03-03.md'
date: 2026-03-04
author: Ducdo
---

# Product Brief: karaoke-party-app

## Executive Summary

Karamania is a second-screen party companion app that transforms group karaoke sessions into interactive, gamified social events. Friends join instantly via QR code or party code in the browser — no downloads, no accounts. While the karaoke machine handles songs and lyrics, Karamania runs the party on everyone's phones: orchestrating live reactions, voting, mini-games, challenges, and ceremonies with rich sound design that turns the whole room into an immersive experience.

An invisible DJ engine keeps the energy flowing so no one has to play organizer. A Moment Economy rewards all participation equally — non-singers can out-earn singers. And an automatic memory machine captures every peak moment, assembling a shareable scrapbook that drops in the group chat the next morning.

The app occupies genuine white space: no competitor serves as a companion layer for in-room group karaoke. By not playing music, Karamania sidesteps music licensing entirely and works at any venue on Earth. The long-term vision extends beyond karaoke — the core social game engine is designed to evolve into a platform for any in-person group gathering, with karaoke as the breakout entry point.

**Target Market:** Vietnam first (karaoke as cultural institution, 126% mobile penetration, no local competitor), expanding to broader Southeast Asia and global markets.

**Technology:** PWA for zero-friction join and cross-platform reach, with a Flutter native migration path for advanced capabilities (rich capture, haptics, push notifications) as the product matures.

**Business Model:** Free PWA at launch to prove engagement, evolving to freemium with premium features, venue partnerships, and platform monetization.

---

## Core Vision

### Problem Statement

Group karaoke nights suffer from a hidden failure mode. Between songs, there's dead air — no coordination, no structure, nothing to do. Non-singers sit idle with no way to participate. One person carries the entire social labor of keeping energy alive. And when the night ends, all the hilarious moments vanish — everyone had fun, but there's nothing to show for it.

### Problem Impact

- **The organizer** burns out managing song queues, keeping energy up, and deciding "what's next" — turning fun into work
- **Non-singers** (often 30-50% of any group) are passive spectators with no meaningful role
- **The whole group** loses shared memories — moments that felt legendary in the room are forgotten by morning
- **The karaoke industry** ($7.5B app market, 10.19% CAGR) remains stuck in a "take turns singing" paradigm despite customers craving richer social experiences

### Why Existing Solutions Fall Short

| Category | Players | Gap |
|----------|---------|-----|
| Social karaoke apps | Smule, WeSing, StarMaker | Built for remote/solo singing. No in-room group features |
| Venue software | KaraFun, Singa, ICOOL | Manage songs and rooms. No social layer, no audience engagement |
| Party game platforms | Jackbox, Kahoot | Proven phone-as-controller model but not karaoke-aware |

Every karaoke app tries to *be* the karaoke system. No one is building the party layer that runs *alongside* it.

### Proposed Solution

A second-screen PWA companion that turns every phone in the room into a game controller for the night. The karaoke box remains the stage — Karamania becomes the invisible MC:

- **Zero-friction join** — QR code / party code, browser-based PWA, no accounts, no downloads. Host taps "Start Party," friends scan and they're playing in seconds
- **Live audience participation** — emoji reactions, soundboards, voting, and hype combos during every performance, with punchy sound effects that cut through the room
- **Structured flow** — a DJ engine fills gaps with mini-games, challenges, dares, and ceremonies so there's never dead air
- **Moment Economy** — a unified participation currency rewarding reacting, playing, and singing equally. Non-singers are first-class citizens
- **Automatic memory capture** — peak moments, bloopers, and highlights assembled into a morning-after scrapbook
- **Three-Act night arc** — warm-up → peak chaos → grand finale, giving every night a narrative with a beginning, middle, and end
- **Immersive sound design** — collective audio from all phones creates a shared atmosphere: fanfares, countdowns, crowd roars that make the room feel like a stadium

**Long-term evolution:** The core social game engine is designed to transcend karaoke. The same join-play-capture loop can power house parties, road trips, game nights, and any in-person group gathering — making Karamania a friend group game platform with karaoke as its breakout entry point. The architecture abstracts core concepts (spotlights, sessions, interludes) to enable this evolution without a rewrite. Flutter native migration planned for advanced capture and platform features.

### Key Differentiators

1. **No music licensing required** — companion-only positioning eliminates the #1 cost and legal barrier in karaoke
2. **Venue-agnostic** — works alongside any karaoke setup on Earth
3. **Participation over talent** — non-singers are first-class citizens who can out-earn singers in the Moment Economy
4. **Memory-as-marketing flywheel** — every shared scrapbook and blooper reel is organic user acquisition
5. **Genuine white space** — no direct competitor in the second-screen karaoke companion category (validated by market research)
6. **Zero-friction PWA join** — proven by Kahoot ($140M revenue) and Jackbox ($7.8M annual) at scale
7. **Platform potential** — the game engine evolves beyond karaoke into a broader social gathering platform, with Flutter native path for advanced capabilities

---

## Target Users

### Primary Users (Priority Order)

**1. Linh — "The Party Starter" (Host)** — *Acquisition & retention bottleneck*
- 25, marketing coordinator in HCMC. Organizes karaoke nights — books rooms, creates group chats, herds friends
- **Pain:** Does ALL social labor — picking songs during silence, nudging shy friends, keeping energy up. Exhausted from managing instead of enjoying
- **Need:** An invisible MC that runs the night so she can be a guest at her own party
- **Aha moment:** Post-song ceremony triggers automatically and her group erupts — without her lifting a finger
- **Why #1 priority:** She decides to use the app. She shares the QR code. She comes back next week. Every other persona is downstream of her decision

**2. Minh — "The Hype Friend" (Active Non-Singer)** — *Proof the app works*
- 23, graphic design student. Loves karaoke vibes, doesn't sing. Currently scrolls TikTok between songs
- **Pain:** Loudest cheerleader but has no tools. Energy has nowhere to go
- **Need:** Participation that's just as engaging as singing — soundboard, reactions, hype combos, games
- **Aha moment:** Hits a 10x hype streak and "MINH IS ON FIRE" flashes on every phone

**3. Duc — "The Performer" (Spotlight Seeker)** — *Content generator*
- 27, sales rep. Lives for karaoke. Has a signature song. Wants recognition
- **Pain:** Great performances end with polite applause and nothing else. No ceremony, no proof
- **Need:** Performances become events — pre-song hype, crowd reactions, post-song ceremony, shareable moment cards
- **Aha moment:** Crowned "Vocal Assassin of the Night" and the moment card hits the group chat before he sits down

**4. Trang — "The Reluctant Star" (Shy Joiner)** — *Emotional story that spreads word-of-mouth*
- 22, accounting student. Goes because friends drag her. Says "I don't sing." Secretly knows every lyric
- **Pain:** Pressure to sing causes anxiety. Feels left out but doesn't want spotlight
- **Need:** Opt-in participation that gently escalates — voting → trivia → soundboard → group sing-along
- **Aha moment:** Joins a group anthem and is holding the mic without remembering how she got there
- **Design principle:** If the app works for Trang, it works for everyone. Design the engagement ladder with her as the test case

### Secondary Users

**Venue Managers (Future — v3+)**
- ICOOL, Kingdom, zSpace operators seeking happier customers, longer stays, and engagement data. Not MVP scope, but venue-agnostic design keeps the partnership door open.

**The Morning-After Audience (Content Consumers)**
- Friends who weren't there, social media followers, the group chat. They experience the app's output — scrapbooks, bloopers, setlist posters — without ever opening it. Every content consumer is a potential future host. This is the viral loop.

### Design Considerations

**The Skeptic Factor**
- Not everyone in the room will participate. The app must deliver a great experience at 60-70% room adoption. Design for the party working with 4 out of 6, not requiring 100%.

**Social Dynamics**
- Personas don't exist in isolation. Couples want duets, friends have rivalries, groups form teams. The app should understand relationships, not just individuals.

**Group Size Variation**
- Linh hosting 4 friends is a different night than Linh hosting 12 colleagues. Persona behaviors shift with group size (intimate mode vs. party mode vs. festival mode).

**Minimum Viable Party Size**
- The app must still be fun with 2-3 people. Reactions, voting, and hype lose tension in tiny groups — design graceful small-group experiences.

**Battery Consciousness**
- 2-3 hour sessions with WebSocket + Web Audio + screen-on is significant battery drain. Design for power efficiency — idle states, screen dimming, minimal background processing.

**Drunk-User-Friendly UI**
- Karaoke nights involve alcohol. By Act 2, fine motor control is degrading. Big tap targets, forgiving gestures, no precision required. Dumber than a TV remote used with oven mitts.

**Intermittent Connectivity**
- Karaoke rooms are often in basements with poor signal. Aggressive reconnection logic, local state caching, graceful degradation when a phone drops for 30 seconds. Nobody loses their hype streak to a network blip.

### User Journey

```
DISCOVER → Friend shows QR code at karaoke ("scan this, trust me")
   ↓
JOIN → Scan, enter name, in. 2 taps. No download, no account
   ↓
FIRST MOMENT → Icebreaker: "Tap your fave decade." Instant participation
   ↓
PLAY → Reactions during songs, vote on next, play interludes, earn Moments
   ↓
AHA → Post-song ceremony erupts. "Wait, EVERYONE's phone did that?!"
   ↓
PEAK → Three-Act arc hits Act 2 chaos. Room is electric. Every phone is alive
   ↓
FINALE → Awards ceremony, encore, Grand Finale. Emotional high point
   ↓
AFTER → Scrapbook drops in group chat next morning. Screenshots shared
   ↓
LOOP → Content consumer becomes next party's host
```

Discovery is word-of-mouth by design. The app's output IS the marketing.

---

## Success Metrics

### North Star Metric

**"Would you use Karamania at your next karaoke night?"** — Post-session single-tap rating integrated into the finale ceremony. Target: **>80% "Yes"**. If this number is high, everything else follows. If it's low, nothing else matters.

### User Success Metrics

**Linh (Host) — "The app ran my party for me"**
- Party creation → first song ceremony completes without host intervention
- Host returns to create a second party within 30 days (target: >25%)
- Host shares QR code with 4+ people per session

**Minh (Non-Singer) — "I had as much fun as the singers"**
- Non-singing participants engage with 3+ features per session (reactions, soundboard, voting, games)
- Average Moment earnings for non-singers reach 70%+ of singer earnings
- Non-singers stay the full session (don't disengage after 30 minutes)

**Duc (Performer) — "My performance was an EVENT"**
- 80%+ of songs trigger post-song ceremony with crowd participation
- Moment cards shared outside the app (tracked via share intent taps) per session
- Performers receive crowd reactions from 60%+ of room during songs

**Trang (Shy Joiner) — "I participated without being forced"**
- Engagement ladder progression: users who start with reactions-only advance to interludes within first session
- Zero forced-participation complaints (opt-in design validated)
- Group sing-along participation rate (users who never solo but join group moments)

### Business Objectives

**3-Month Targets (MVP Validation)**

| Objective | Target | Why It Matters |
|-----------|--------|----------------|
| Prove session engagement | 70%+ of joined users actively participate throughout session | Core value prop works |
| Prove host retention | 25%+ of hosts create a second party within 30 days | Repeatable behavior exists |
| Prove viral potential | 1+ scrapbook/setlist poster shared per session | Content-as-marketing flywheel starts |
| Minimum viable party | Sessions with 3 people still rate as "fun" in post-session feedback | App works at small scale |
| North Star score | 80%+ "Would use again" | Product-market fit signal |

**12-Month Targets (Growth Validation)**

| Objective | Target | Why It Matters |
|-----------|--------|----------------|
| Organic acquisition | 50%+ of new hosts discovered Karamania through shared content | Viral loop is real |
| Group retention | Average friend group uses app 3+ times | It's becoming a habit |
| Market presence | 500+ parties created in HCMC/Hanoi per month | Product-market fit in Vietnam |
| Freemium readiness | Identified 2-3 features users would pay for based on usage data | Monetization path validated |
| Viral coefficient | >0.5 (organic sharing should outperform incentivized referrals) | Memory-as-marketing is working |

### Key Performance Indicators

**Session-Level KPIs (Per Party)**

| KPI | Measurement | Target |
|-----|-------------|--------|
| Join Rate | Joined users / QR code views | >70% |
| Time-to-First-Hype | Join → first interaction (reaction, vote, soundboard) | <60 seconds |
| Participation Rate | Users with 10+ interactions / total joined | >75% |
| Session Completion | Users present at finale / users who joined | >60% |
| Feature Breadth | Avg distinct features used per user per session | 3+ |
| Ceremony Engagement | % of post-song ceremonies with 50%+ room participation | >80% |
| Dead Air Incidents | Gaps >45 sec with zero interactions across all users | <2 per session |
| Content Generation | Shareable artifacts created per session | 3+ |
| Drop-off Timing | Engagement heat-map across session timeline | No consistent drop-off before Act 3 |

**Growth KPIs (Monthly)**

| KPI | Measurement | Target (Month 6) |
|-----|-------------|-------------------|
| Parties Created | New sessions started per month | 200+ (HCMC/Hanoi) |
| Viral Coefficient | New hosts attributed to shared content / total hosts | >0.5 |
| Host Return Rate | Hosts who create 2+ parties in 30 days | >25% |
| Group Return Rate | Same friend group (3+ overlapping members) using app again | >30% |

**Technical Health KPIs**

| KPI | Measurement | Target |
|-----|-------------|--------|
| Reconnection Rate | Disconnects per user per session | <1 |
| WebSocket Uptime | % of session time with active connection | >98% |
| Audio Playback Success | Sound effects that play without failure | >99% |

### Anti-Metrics (What We Deliberately Don't Optimize)

| Anti-Metric | Why We Ignore It |
|-------------|-----------------|
| Total downloads | PWA — no download needed. This metric is meaningless |
| Daily Active Users | This isn't a daily app. It's an event app. Weekly/monthly party frequency matters |
| Time in app outside sessions | We don't want engagement between parties (yet). No dark patterns |
| Individual performance scores | Participation > talent. We don't rank singers |

### Instrumentation Principle

Event stream first. Every user action becomes an event: `{userId, sessionId, eventType, timestamp, metadata}`. The game engine IS the analytics engine — state transitions, user actions, and ceremony completions are the same data viewed two ways. Store everything from day one. The cost of missing data is months of guessing.

---

## MVP Scope

### Core Features (v1 — "The Party Companion")

*Ship in two phases: Core Launch (Sprint 1-2), then Fast Follow (Sprint 3). Foundation sprint (Sprint 0) precedes all development.*

#### Phase A: Core Launch

*The absolute minimum to prove the loop works. Get this in front of one real friend group.*

**1. Zero-Friction Party Launch**
- Host taps "Start Party" → QR code + 4-digit party code generated
- Friends join via QR scan or code entry in browser (PWA)
- No accounts, no downloads, no sign-up. Name entry only
- Supports 2-12 players per session

**2. Live Audience Reactions**
- Emoji reactions during performances (tap to send, visible on all phones)
- Basic soundboard: air horn, applause, sad trombone, "OHHHH!" (4-6 sounds)
- Reactions visible as real-time feed on everyone's screens
- Sound effects play through phone speakers — collective room audio

**3. Post-Song Ceremony**
- Host signals "Song Over!" via always-visible button during song state (frictionless — one tap)
- 15-second crowd vote (rate the performance)
- Auto-generated funny award title from curated template pool (e.g., "Vocal Assassin," "The Whisperer," "Crowd Favorite")
- Shareable moment card: song title, performer name, award, crowd score
- Kills the awkward post-song silence every time

**4. Dumb DJ Engine** *(Build first, test hardest — formal state diagram required before coding)*
- Server-authoritative state machine — DJ engine lives on the server, not in host's browser. If any phone dies, the party continues
- All phones are thin clients rendering whatever state the server broadcasts
- Cycles: Song → Ceremony → Interlude → Volunteer/Vote → Repeat
- Randomized flow — not adaptive, not energy-reading. Just ensures something always happens next
- Pure state machine with explicit, testable transitions. Log every state change
- **This is the riskiest feature and the core of the experience**

**5. Host Controls**
- Subtle floating overlay on host's screen — NOT a separate panel. Linh stays a player
- Expands to: "Next," "Skip," "Pause" — one-thumb operation
- Host can override the DJ while still participating with the other hand
- The DJ is an MC, not a dictator — Linh always has control

**6. Immersive Sound Design**
- Punchy sound effects for all interactions: ceremony fanfare, countdown beeps, vote reveals, hype sounds
- Web Audio API with pre-loaded buffers — works on both iOS and Android browsers
- **State transition sounds are critical** — every DJ state change gets a distinct audio cue so the room knows something new is happening
- Collective audio from all phones creates shared atmosphere

#### Phase B: Fast Follow

*Ship 1-2 weeks after Core Launch based on real session learnings.*

**7. First-60-Seconds Icebreaker**
- Instant group activity on join: "Tap your favorite decade of music"
- Results shown to everyone — onboarding IS the game

**8. Democratic Voting**
- "What's next?" with 2-3 options surfaced by the DJ engine
- Everyone votes on phones. Majority wins

**9. Three Basic Interludes** (30-90 seconds each)
- Kings Cup card draw (party rule for the group)
- Dare Pull (random dare assigned to random player)
- Quick Vote ("Hot take: pineapple on pizza?")
- *Photo Booth and Jackbox-style prompts added in v1.5*

**10. Basic Moment Capture**
- Prompted "screenshot now!" notifications at key moments (ceremony reveals, standout performances)
- Manual "capture this!" button any player can tap to flag a moment
- No image upload, no shared album backend — photos stay on each phone. Shared album deferred to v1.5

**11. End-of-Night Ceremony + Package**
- NOT an abrupt summary dump — a 60-second mini-finale ceremony:
  - "Tonight's results are in..." → awards scroll → setlist poster reveals → "Share this night!"
- Setlist poster: every song, performer names, date — **invest design time, this is the only viral artifact in MVP. Must be screenshot-worthy. Design mockup before dev**
- Awards summary: all ceremony winners and their titles
- Basic stats: total songs, most active reactor, most awards won
- Styled HTML that users screenshot and share
- Includes North Star prompt: "Would you use Karamania next time?" (one-tap Yes/No)

### UX Design Principles for MVP

**Transition Design > Screen Design**
- Design the transitions between DJ states BEFORE the screens. A 2-second animated transition with a sound cue makes the app feel alive. A hard screen cut feels broken. The in-between moments matter more than the features themselves.

**Drunk-User-Friendly**
- Big tap targets, forgiving gestures, no precision. One action per screen. Dumber than a TV remote used with oven mitts.

**Host = Player First**
- Host controls are a subtle overlay, not a mode switch. Linh should never feel like she's "managing" instead of playing.

### Technical Architecture (MVP)

**Server-Authoritative Model**
- DJ engine state machine lives on server. All phones are thin clients
- If any phone (including host's) dies, the party continues
- Reconnecting phone receives current state and picks up seamlessly

**Tech Stack**

| Layer | Choice | Why |
|-------|--------|-----|
| Frontend | Vanilla JS or Preact (3KB) | Smallest bundle. Fast load on QR scan |
| Real-time | WebSockets (native or Socket.io) | Proven, low-latency, bidirectional |
| Backend | Node.js or Deno | JS everywhere, fast WebSocket support |
| State Machine | XState or custom FSM | Explicit, testable, visualizable transitions |
| Database | SQLite or Postgres | Event stream storage. Start simple |
| Hosting | Single VPS or Railway/Fly.io | Cheap, WebSocket-friendly. Avoid serverless for persistent connections |
| QR Generation | Client-side library (qrcode.js) | Zero backend dependency |
| Audio | Web Audio API with pre-loaded buffers | Low latency, cross-platform |

**Keep it boring.** No microservices, no message queues, no Redis. A single server process handling WebSocket connections and a state machine can handle hundreds of concurrent sessions.

**Event Stream Foundation**
- Every state transition, user action, and DJ decision logged as: `{sessionId, userId, event, timestamp, payload}`
- Costs nothing to implement. Gives you: analytics, debugging, replay, and Smart DJ training data for v2

### Pre-Launch Requirements

**1. DJ State Diagram** — formal state diagram with ALL states, transitions, timeouts, and edge cases. Draw before writing a line of code. Non-negotiable.

**2. Design Mockups** — setlist poster, ceremony flow, and moment card designs before development. Don't let developers decide what "screenshot-worthy" looks like.

**3. Sound Asset Selection** — 6 core sounds curated and tested before integration.

**4. Dry-Run Test (after Sprint 2)** — 2-3 friends, basic flow, catch fundamental issues early.

**5. Real Karaoke Session (after Sprint 3)** — full night, real friends, real drinks, real karaoke room. Screen record on 2-3 phones. The bugs found in a live session are fundamentally different from dev testing. Non-negotiable.

### Sprint Plan

| Sprint | Duration | Focus | Deliverable |
|--------|----------|-------|-------------|
| Sprint 0 | 3-4 days | Foundation + Design | Server scaffolding, WebSocket infra, session management, DJ state diagram, setlist poster mockup, ceremony flow mockup, sound asset selection |
| Sprint 1 | 1 week | Core Loop | DJ engine + unit tests, Party Launch (create/join), "Song Over" trigger + Ceremony, Host Controls |
| Sprint 2 | 1 week | Experience Layer | Reactions + Soundboard, Sound design integration, Awards + moment card, End-of-Night Package. **Dry-run test at end** |
| Sprint 3 | 1 week | Fast Follow | Icebreaker, Democratic Voting, 3 Interludes, Moment capture prompts, Bug fixes |
| Sprint 4 | 3-4 days | Real World Test | Live karaoke night, bug fixes + polish, launch prep |

**Total: ~5 weeks** for a focused solo developer

### Testing Priorities

1. **DJ state machine** — unit test every transition, every edge case. This is the safety net
2. **WebSocket sync** — simulate 6 clients, concurrent events, verify state consistency. Test with mixed wifi/4G
3. **Reconnection handling** — phone sleeps, loses signal, comes back. No state loss
4. **Dry-run test** — after Sprint 2 with 2-3 friends
5. **Real session test** — after Sprint 3, full karaoke night before any public launch

### Out of Scope for MVP

| Feature | Why Deferred | Target Version |
|---------|-------------|----------------|
| Smart/Adaptive DJ | Needs real usage data to train. Ship dumb, learn, then make smart | v2 |
| Moment Economy (earn/spend currency) | Adds complexity. Prove core loop first | v2 |
| Hype Combo System | Needs Moment Economy as foundation | v2 |
| Power Cards (Uno Reverse) | Needs Moment Economy as foundation | v2 |
| Spotify Integration | Additional API dependency and complexity | v2 |
| Engagement Ladder | Needs behavioral data to tune progression | v2 |
| Fair Play Balancer | Needs session data patterns | v2 |
| Photo Booth + Jackbox Interludes | Fast-follow after initial 3 interludes proven | v1.5 |
| Shared Album (image upload/storage) | Backend infrastructure rathole for MVP | v1.5 |
| Auto-capture (audio spike detection) | Technically complex, needs native APIs for best results | v3 |
| Multi-phone sync capture | Hard technical problem (clock sync across devices) | v3 |
| Blooper reel / sound bite generator | Requires audio recording + processing pipeline | v3 |
| Morning-after highlight reel | Requires full memory machine pipeline | v3 |
| Scrapbook assembly | Requires capture infrastructure | v3 |
| Karaoke Wrapped / Chronicle | Long-term identity system — needs session history | v3 |
| Venue partnerships / dashboard | B2B — after product-market fit proven | v4 |
| Hangout Mode (non-karaoke events) | Platform expansion — after karaoke nailed | v4 |
| Flutter native migration | When PWA limitations block key features | v3+ |
| Theme Engine (80s, 90s reskins) | Polish and differentiation — not core value | v4 |
| Distributed Sing-Along | Paradigm-shifting but complex — needs proven base | v4 |
| Crowd Conductor | Advanced gameplay — needs hype system first | v4 |

### MVP Success Criteria

**Go/No-Go Gates (at 3 months post-launch):**

| Gate | Metric | Threshold | Decision |
|------|--------|-----------|----------|
| Product-Market Fit | "Would use again?" score | >80% | GO if met |
| Session Engagement | Participation rate | >75% of joined users active | GO if met |
| Host Retention | Hosts creating 2+ parties in 30 days | >25% | GO if met |
| Viral Signal | Share intent taps (setlist poster) per session | >1 per session | GO if met |
| Core Loop Works | Dead air incidents per session | <2 | GO if met |
| Activation | Time-to-First-Hype | <60 seconds | GO if met |

**If 5/6 gates pass:** Proceed to v2 (Smart DJ + Moment Economy)
**If 3-4 gates pass:** Iterate on MVP, investigate failing gates
**If <3 gates pass:** Reassess product assumptions, consider pivot

### Future Vision

**v1.5 — "Quick Wins"** *(Target: 1-2 months post-MVP)*
- Photo Booth + Jackbox-style prompt interludes
- Shared album with image upload
- Additional interlude games based on session feedback
- UI/UX polish based on real session observations

**v2 — "The Smart Party"** *(Target: 6 months post-MVP)*
- Adaptive DJ engine: reads room energy, three-act arc, DJ personality
- Moment Economy: unified earn/spend currency connecting all participation
- Hype combo system + power cards
- Spotify integration: Song Match, Destiny Song reveal
- Smart interlude engine: 10+ games, contextual selection
- Engagement ladder + fair play balancer

**v3 — "The Memory Machine"** *(Target: 12 months)*
- Full automatic memory capture with smart triggers
- Multi-phone sync capture, blooper reel, sound bite generator
- Morning-after highlight reel push notification
- Scrapbook assembly with timeline, media, awards
- Karaoke Wrapped + Festival Wristband identity system
- Flutter native app for advanced capture capabilities

**v4 — "The Platform"** *(Target: 18-24 months)*
- Hangout Mode: same engine for house parties, road trips, game nights
- Venue partnership dashboard (B2B revenue)
- Theme Engine, Crowd Conductor, Distributed Sing-Along
- Party planning tools, evolution rounds
- Adaptive Group Scaler (2 intimate → 12+ festival mode)
- The app transcends karaoke and becomes the friend group game platform
