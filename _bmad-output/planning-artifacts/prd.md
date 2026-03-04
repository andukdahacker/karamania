---
stepsCompleted:
  - step-01-init
  - step-02-discovery
  - step-03-success
  - step-04-journeys
  - step-05-domain-skipped
  - step-06-innovation
  - step-07-project-type
  - step-08-scoping
  - step-09-functional
  - step-10-nonfunctional
  - step-11-polish
  - step-12-complete
inputDocuments:
  - '_bmad-output/planning-artifacts/product-brief-karaoke-party-app-2026-03-04.md'
  - '_bmad-output/planning-artifacts/research/market-karaoke-party-companion-research-2026-03-03.md'
  - '_bmad-output/analysis/brainstorming-session-2026-03-03.md'
documentCounts:
  briefs: 1
  research: 1
  brainstorming: 1
  projectDocs: 0
classification:
  projectType: web_app
  domain: social_entertainment
  complexity: low-medium
  projectContext: greenfield
workflowType: 'prd'
project_name: 'karaoke-party-app'
author: 'Ducdo'
date: '2026-03-04'
---

# Product Requirements Document - karaoke-party-app

**Author:** Ducdo
**Date:** 2026-03-04

## Executive Summary

Karamania is a second-screen PWA companion that transforms group karaoke nights from passive singing sessions into interactive party experiences. Users join via QR code scan — zero downloads, zero accounts — and their phones become participation devices: reactions, soundboards, voting, and mini-games that keep the entire room engaged between songs.

**Core Differentiator:** The only product that runs alongside existing karaoke systems rather than replacing them. Eliminates music licensing, works at any venue, and creates genuine white space in a $7.5B market.

**Core Innovation:** A server-authoritative DJ engine — a real-time state machine that automatically orchestrates party flow (song → ceremony → interlude → repeat), eliminating dead air and freeing the host from MC duties.

**Target Users:** Vietnamese friend groups (ages 20-35) at commercial karaoke venues in HCMC and Hanoi. Four personas: the overwhelmed host (Linh), the non-singer (Minh), the shy joiner (Trang), and the performer seeking audience (Duc).

**Business Model:** Free MVP. Memory-as-marketing flywheel — shareable setlist posters and moment cards ARE the acquisition channel. Premium features identified through usage data post-validation.

**MVP Strategy:** Solo developer, 5.5 weeks. Prove the core loop with one real friend group. Success = "Would use again" >80%.

## Success Criteria

### User Success

- **Linh (Host):** Party creation → first ceremony completes without host intervention. "The app ran my party for me."
- **Minh (Non-Singer):** Engages with 3+ feature categories per session. Weighted participation score reaches 70%+ of singer scores. Stays through finale.
- **Duc (Performer):** 80%+ songs trigger ceremony with crowd participation. Moment cards shared outside app. Reactions from 60%+ of room during songs.
- **Trang (Shy Joiner):** Time-to-first-active-use <5 minutes for 80% of non-host users. Engagement ladder progression within first session (reactions → interludes → group moments). Zero forced-participation complaints.

### Business Success

- **North Star:** >80% "Would use again" post-session score
- **3-Month Targets:** 70%+ weighted participation rate, >20% host return (45-day window), >1 share intent per session, <2 dead air incidents per session, <60s time-to-first-hype, viral coefficient >0.3
- **12-Month Targets:** 50%+ organic acquisition via shared content, 3+ sessions per friend group average, 500+ parties/month in HCMC/Hanoi, viral coefficient >0.5, 2-3 identified premium features
- **Joiner-to-host conversion:** Tracked from month 1 as earliest viral signal — did the joiner create their own party within 30 days?

### Technical Success

| KPI | Target | Notes |
|-----|--------|-------|
| Time-to-interactive (cold) | <4s on 4G | Branded loading with party lobby pre-rendered server-side |
| Time-to-interactive (warm) | <2s | Cached PWA assets |
| WebSocket uptime | >98% per session | |
| DJ state sync latency | <200ms across devices | Ceremony reveals and countdowns must feel simultaneous |
| Audio strategy | Host phone = primary audio for big moments | Design around distributed sync, don't solve it |
| Audio playback success | >99% | Web Audio API with pre-loaded buffers |
| Reconnection rate | <1 disconnect per user per session | |
| Ceremony render (low-end Android) | >95% success | Vietnam market = budget Android devices |

### Measurable Outcomes

| Metric | Definition | Target |
|--------|-----------|--------|
| Weighted participation | 15+ weighted points per session | >75% of joined users |
| Participation breadth | 3+ distinct feature categories used | >60% of users |
| Session completion | Present at finale (WS connected OR interaction within last 5 min) | >60% |
| Host return | Creates another party within 45 days | >20% |
| Group return | 3+ same members in a session within 60 days | >25% |
| Time-to-first-active-use | First non-icebreaker interaction (non-host users) | <5 min for 80% |
| Viral coefficient (3-month) | New hosts from shared content / total hosts | >0.3 |
| Viral coefficient (12-month) | New hosts from shared content / total hosts | >0.5 |

**Participation Weighting:**
- Passive (1 pt): emoji tap, reaction view
- Active (3 pts): soundboard use, vote cast, moment capture tap
- Engaged (5 pts): interlude game completion, ceremony vote, dare acceptance

**Go/No-Go Gates (3 months):** If 5/6 core gates pass → proceed to v2. If 3-4 → iterate MVP. If <3 → reassess assumptions.

## Product Scope

### MVP - Minimum Viable Product

"The Party Companion" — prove the core loop works with one real friend group.

- **Zero-friction party launch:** QR code / 4-digit code, PWA, no accounts, no downloads. Branded loading state with party lobby pre-rendered ("3 friends are waiting for you")
- **Live audience reactions:** Emoji reactions during performances, basic soundboard (air horn, applause, sad trombone, "OHHHH!"), real-time feed on all phones. Host phone as primary audio source for big ceremony moments
- **Post-song ceremony:** Host taps "Song Over!" → 15-second crowd vote → auto-generated funny award → shareable moment card. Kills awkward post-song silence
- **Dumb DJ engine:** Server-authoritative state machine cycling Song → Ceremony → Interlude → Volunteer/Vote → Repeat. Randomized, not adaptive. Log every state change for future Smart DJ training data
- **Host controls:** Subtle floating overlay (Next, Skip, Pause). One-thumb operation. Host stays a player, never becomes a manager
- **Immersive sound design:** Web Audio API with pre-loaded buffers. State transition sounds for every DJ state change. Collective audio from all phones creates shared atmosphere
- **Fast-follow (1-2 weeks after core):** First-60-seconds icebreaker, democratic voting (2-3 options), 3 interludes (Kings Cup, Dare Pull, Quick Vote), basic moment capture (prompted screenshots + manual "capture this!" button), end-of-night ceremony + setlist poster

### Growth Features (Post-MVP)

v2 — "The Smart Party" (target: 6 months post-MVP)

- Adaptive DJ engine: energy signal reading, decision tree, three-act arc, DJ personality
- Moment Economy: unified earn/spend currency connecting all participation
- Hype combo system + power cards (Uno Reverse)
- Spotify integration: Song Match, Destiny Song reveal
- Smart interlude engine: 10+ games, contextual selection
- Engagement ladder + fair play balancer

### Vision (Future)

v3 — "The Memory Machine" (target: 12 months)
- Automatic Memory Machine with smart triggers + quality filters
- Multi-phone sync capture, blooper reel, sound bite generator
- Morning-after highlight reel push notification
- Scrapbook assembly (cover, timeline, media, awards, stats, encore closing)
- Karaoke Wrapped + Festival Wristband + Chronicle identity system
- Flutter native migration for advanced capture capabilities

v4 — "The Platform" (target: 18-24 months)
- Hangout Mode: same engine for house parties, road trips, game nights
- Venue partnership dashboard (B2B revenue)
- Theme Engine, Crowd Conductor, Distributed Sing-Along
- Party planning tools, evolution rounds
- Adaptive Group Scaler (2 intimate → 12+ festival mode)

## User Journeys

### Journey 1: Linh — "The Night She Stopped Working"

Linh books Room 7 at ICOOL Thảo Điền for Saturday. Eight friends confirmed. She's already dreading the usual: managing the song queue, filling dead air with forced enthusiasm, being the MC nobody asked her to be.

Saturday, 8:15 PM. Everyone's arriving. Linh opens Karamania. Taps "Start Party." A QR code fills her screen with a 4-digit code: **VIBE**. She holds it up: "Scan this."

Six friends scan within 40 seconds. Two more trickle in. Each enters a name — no sign-up, no download, just a browser tab. The party lobby shows names populating in real-time.

She taps "Let's Go." Every phone hits the icebreaker: "Tap your favorite music decade." The room erupts — "Wait, THREE of you picked the 80s?!" Then the DJ surfaces a **First Song Prompt**: "Who's singing first? Volunteer or spin the wheel!" — bridging the gap while someone physically walks to the karaoke machine and picks a song.

Duc grabs the mic. On Linh's phone, a subtle floating button appears: **"Song Over!"** — her only job. She taps it when Duc finishes. Every phone explodes into a 15-second ceremony: crowd vote, dramatic reveal, Duc is crowned "Vocal Menace." A moment card generates.

The Dumb DJ takes over. Cycles through activities automatically. Linh realizes 45 minutes have passed. She hasn't managed anything. She used the host override exactly once — to skip a dare that was too spicy. One tap. Back to playing.

End-of-night ceremony: awards scroll, setlist poster reveals — every song, every performer, the date, the venue. Linh screenshots it. It's in the group chat before she stands up.

Walking to the parking lot, her friend Hà says: "Send me that app link. I'm doing this for my birthday next week."

Linh smiles. She had fun at her own party.

### Journey 2: Minh — "The Loudest Person Who Never Sang"

Minh doesn't sing. Everyone knows this. At regular karaoke nights, he's scrolling TikTok by song three.

Tonight he scans the QR. Duc starts singing. Minh's phone shows a reaction bar. He hits the fire emoji. Again. "3x HYPE!" flashes. He discovers the soundboard: air horn at the chorus drop. The sound cuts through the room. Everyone laughs.

Song ends. Ceremony pops. Minh votes, sees the award: "The Warm-Up Act." Screenshots the moment card, sends it to the group chat.

DJ fires a Dare Pull. Minh gets: "Do your best impression of the last singer." He stands up, dramatically mumbles into an invisible mic. The room loses it.

Quick Vote: "Is Bohemian Rhapsody overrated?" Minh smashes "YES" before anyone. 5-3 split. Arguments erupt. The DJ has already queued the next activity.

End of night: 200+ reactions, 30+ soundboard hits, 4 interludes completed, every ceremony voted. More weighted participation points than two of the singers. Crowned "Hype Lord."

Never sang a note. Best time in the room.

### Journey 3: Trang — "How She Ended Up Holding the Mic"

Trang is here because her friends wouldn't stop asking. She's sitting in the corner, prepared to scroll Instagram for two hours.

She scans the QR because everyone's scanning. The icebreaker hits: "Tap your favorite decade." Low stakes. She taps 2000s. Three others did too. Small smile.

Duc sings. Trang watches others tapping reactions. After 20 seconds, she taps the heart. Once. Then the laughing face when Duc points dramatically during the chorus. She doesn't touch the soundboard. Nobody notices.

Ceremony pops. She votes — one tap. Laughs at the award reveal with everyone.

The DJ front-loads universal interludes in the first 30 minutes — activities every person participates in regardless. Quick Vote: "Pineapple on pizza?" She has a strong opinion. Taps "NEVER." She's in the majority. Says out loud: "See?!" First words she's spoken about the app.

Three songs later, Kings Cup: "Everyone who's been to Đà Lạt this year, sing the next chorus together." She looks around. Four hands up. The chorus hits. She mouths along. Not loud. But she's doing it.

An hour in. Group sing-along: a 2000s hit everyone knows. The whole room is singing. Trang is singing. She didn't volunteer. The room pulled her in. No name on screen. Just "everyone join in."

End of night: "The Silent Storm" — most consistent reactor who never took a solo spotlight. She posts it to Instagram: "apparently I'm a karaoke person now???"

### Journey 4: Duc — "The Night His Performance Became Content"

Three songs in, it's Duc's turn. His signature song. He tells Linh to hit play.

Every phone displays: "🎤 DUC IS UP NEXT" — a pre-song hype card bridging the physical moment of him walking to the mic. Countdown sound from the host's phone. The room quiets.

He sings. Reactions pour in — fire emojis, hearts, the occasional laugh when he oversells a note. Minh hits the air horn twice at the chorus. Duc can't see reactions (he's watching lyrics) but he can hear the soundboard cutting through from phones around the room.

He finishes. Ceremony: "RATE DUC'S PERFORMANCE." Votes in. Reveal: 4.7/5. Award: "Vocal Assassin." Moment card generates — song title, name, award, score, styled like a concert poster. Duc taps share. It's in the group chat before he sits down.

Two songs later, someone dares him: "Sing the next one in a whisper voice." Terrible. Hilarious. "The Whisperer" award. That card gets more shares than his good performance.

End of night: "Performance of the Night." Setlist poster shows his name next to three songs. Posts to Instagram. Friend from another group DMs: "What app is that?"

### Journey 5: The Late Joiner — "Arriving to a Party Already in Progress"

9:30 PM. Party started at 8. Thảo walks in. Everyone's mid-song, phones out, laughing.

"Scan this!" Linh holds up her phone — QR accessible from host controls at any time, not just at party start.

Thảo scans. Enters name. The loading state: "Joining the party... 8 friends are already here." She lands mid-session and sees a catch-up card with current stats: "8 friends here, 5 songs so far, current award leader: Minh." Three seconds of context. She's oriented.

Current song ends. Ceremony fires. Thảo votes — full participant immediately. Next interlude, her name is in the pool. She gets a dare within 5 minutes.

End of night: her name appears on the setlist poster. The app doesn't differentiate early and late joiners. She was there. That's enough.

### Edge Case: The Disconnected User

Minh's phone hits 8% during song 6. Screen dims. It dies. The DJ engine detects his WebSocket disconnect. Name grays out on participant lists. His pending ceremony vote simply isn't counted — no error, no delay.

Twenty minutes later, phone boots. Browser tab still there. WebSocket reconnects automatically. Server sends current state. His phone renders whatever's happening now. Participation history intact. Hype streak reset, but total points preserved.

The app treats it like he blinked.

### Edge Case: The Solo Host Testing

Wednesday night. Linh opens Karamania to see what it does before Saturday.

Taps "Start Party." QR and code appear. Lobby: "1 player — works best with 3+ friends!" with a share button for the party code. She gets the idea in seconds. Closes the tab. Saturday, she knows exactly how to start.

### Journey Requirements Summary

| Capability | Revealed By | MVP Priority |
|-----------|------------|-------------|
| Party creation + QR/code join | Linh, Late Joiner, Solo Host | Core |
| Party lobby with live player count | Linh, Late Joiner | Core |
| Host "Song Over!" trigger | Linh, Duc | Core |
| Host override controls (skip/next) | Linh | Core |
| Host QR re-display mid-session | Late Joiner | Core |
| DJ state machine (auto-cycling) | Linh, Minh, Trang | Core |
| DJ bridge moments (first song prompt, song selection, mic handoff) | Linh, Duc | Core |
| Icebreaker (first-60-seconds) | Trang, Linh | Fast-follow |
| Real-time emoji reactions + streaks | Minh, Trang, Duc | Core |
| Soundboard with room audio | Minh, Duc | Core |
| Sound design (state transition audio cues) | All journeys | Core |
| Post-song ceremony (vote + award + card) | All personas | Core |
| Moment card with share intent | Duc, Minh | Core |
| Interlude games (Kings Cup, Dare, Quick Vote) | Minh, Trang | Fast-follow |
| Front-loaded universal interludes (first 30 min) | Trang | Fast-follow |
| Pre-song hype card (bridge moment) | Duc | Core |
| Democratic voting ("What's next?") | Linh, Minh | Fast-follow |
| Group sing-along mode | Trang | Fast-follow |
| End-of-night ceremony + setlist poster | All personas | Core |
| Late-join catch-up (current stats only) | Late Joiner | Core |
| WebSocket reconnection + state sync | Disconnected User | Core |
| Solo/empty party state (copy + share, no demo) | Solo Host | Core (minimal) |
| Weighted participation tracking | Minh, Trang | Core (backend) |
| Awards algorithm (non-singing recognition) | Minh, Trang | Core |

## Innovation & Novel Patterns

### Detected Innovation Areas

**1. Second-Screen Companion Positioning** (Strategic Design Decision)
Every karaoke app tries to BE the karaoke system. Karamania is the only product building a party layer that runs alongside it. This eliminates music licensing, enables venue-agnostic deployment, and creates genuine white space validated by market research. Not an innovation to test — a strategic constraint that unlocks structural advantages.

**2. The Invisible MC / DJ Engine** (Core Technical Innovation — THE bet)
A real-time party flow engine for in-person social events. No existing product continuously orchestrates a multi-hour social experience with automatic gap-filling, activity cycling, and dead air prevention. This is the one genuine technical innovation in the MVP and the single biggest risk.

**3. Memory-as-Marketing Flywheel** (Architectural Design Decision)
The product's shareable output IS the acquisition channel. Every setlist poster and moment card shared is organic marketing. Not separate infrastructure — architecturally embedded in features already being built. Track share destination (private group chat = memory, public social = marketing) to validate the flywheel.

**4. Participation-Over-Talent Design** (Product Design Philosophy)
Non-singers are first-class citizens. Weighted participation, soundboard-as-gameplay, and reaction streaks flip the karaoke paradigm. Validated by whether non-singers match 70%+ of singer engagement and stay through the finale.

### Validation Approach

| Innovation | Validation Method | Target | Fallback |
|-----------|------------------|--------|----------|
| DJ Engine (core bet) | Dead air incidents + qualitative flow metric | <2 dead air/session, >70% "felt continuous" | Increase host override prominence — let humans MC |
| Memory-as-marketing | Share intents per session + share destination tracking | >1 share/session, public shares growing MoM | Invest in setlist poster design before assuming concept is wrong |
| Participation-over-talent | Non-singer engagement + session completion | 70%+ of singer weighted score, stay through finale | Add interlude variety, lower engagement ladder first rung |

**Qualitative flow metric:** Post-session — "Did tonight feel like one continuous experience or separate activities?" Binary. Target: >70% continuous.

### Risk Mitigation

**Innovation stacking reframed:** Only the DJ engine is a genuine technical innovation. The other three are design decisions executed well or poorly. One bet, not four.

**DJ Engine specific risks:**

1. **Combinatorial explosion** — 12+ states, 30+ transitions, guard conditions on each. Mitigation: formal state diagram with every transition, guard, and timeout BEFORE writing code. Unit test every transition. 100% coverage justified here.
2. **Physical-digital mismatch** — DJ cycles while group takes food breaks, steps outside, or sings back-to-back songs. Mitigation: pause meta-state (host-triggered + auto-pause at 90s inactivity) with clear resume-vs-advance logic decided in state diagram.
3. **Correctness ≠ flow** — State machine can be bug-free but feel robotic. Mitigation: sound design and transition animations turn correct state changes into perceived flow. Test state machine for correctness AND experience for continuity.

**Pre-development requirements:** See Pre-Development Gates in Project Scoping for the full non-negotiable checklist. Key items driven by innovation risk: formal DJ state diagram, pause/resume logic, setlist poster design, and 6 core test scenarios (happy path, host override in every state, disconnect/reconnect in every state, minimum players, rapid transitions, timeout cascade).

## Web App Specific Requirements

### Browser Support Matrix

| Browser | Priority | Min Version | Notes |
|---------|----------|-------------|-------|
| Chrome Android | Primary (60-70%) | Last 3 major versions | Dominant in Vietnam, best Web Audio API support |
| iOS Safari | Primary (20-30%) | iOS 15.4+ | Web Audio requires user gesture to unlock AudioContext |

**Not targeted for MVP:** Samsung Internet, Firefox, UC Browser, Opera Mini.

**Critical iOS Safari considerations:**
- Web Audio API requires user tap to unlock — create AND resume AudioContext inside the same tap handler (icebreaker tap). Test on real iPhone hardware, not devtools
- WebSocket behavior on screen lock — iOS aggressively suspends background tabs. Three-tier reconnection logic required
- PWA limitations — no push notifications, no Screen Wake Lock API. Use hidden video element hack for screen sleep prevention (iOS 15+). Accept remaining constraints; Flutter native migration addresses them in v3+

### Technical Architecture Considerations

**Server-Authoritative Model**
- DJ engine state machine lives on server — all phones are thin clients
- WebSocket connections with adaptive heartbeat: 5s during active states, 15s during song state (battery optimization)
- Server pushes state changes; clients render. No client-side state machine logic
- If any phone dies (including host), the party continues
- Per-client event buffer on server for transparent reconnection replay

**Three-Tier Reconnection Model**

| Tier | Duration | Server Behavior | Client Behavior |
|------|----------|----------------|-----------------|
| Brief | <5s | Replay buffered events | Transparent reconnect, no UI change |
| Medium | 5-60s | Send current state snapshot | Reconnect, sync state, subtle "reconnected" toast |
| Long | >60s | Send current state snapshot only | Full state sync, show current state immediately |

Buffer size and timeout thresholds defined in architecture doc before coding.

**Real-Time Requirements**
- DJ state sync: <200ms across all connected devices
- Reaction broadcast: <100ms from tap to visibility on other phones
- Ceremony vote collection: 15-second window, server-authoritative timer
- Ceremony stagger model: `voting_open` → `waiting_for_stragglers` ("Waiting for 2 more...") → `revealing` (auto-resolve at 15s or when all voted, whichever first)
- All timing server-controlled — no client clock dependency

**Deployment Model**
- Single VPS or Railway/Fly.io — single process Node.js with WebSockets
- Ceiling: ~10,000-50,000 concurrent connections = 1,250-6,250 concurrent parties at 8 phones/party
- MVP expectation: 5-10 concurrent parties. Document the wall, don't architect past it

**Audio Architecture**
- Web Audio API with pre-loaded audio buffers
- AudioContext: create AND resume inside first user tap handler (icebreaker). Store globally. All subsequent sounds play through this context
- Host phone designated as primary audio source for ceremony fanfares and big moments
- Other phones play reaction sounds at lower volume or visual-only for big sync moments
- 6-10 core sound assets, total <500KB, loaded on join

**Screen Wake Lock Strategy**
- Chrome Android: `navigator.wakeLock.request('screen')` during active states (ceremony, interlude, reactions)
- iOS Safari: hidden video element hack for screen sleep prevention (iOS 15+)
- During song state: release wake lock, LET screen lock — user is watching karaoke screen. Ceremony sounds from other phones serve as wake-up signal
- Ceremony voting window (15s) accommodates staggered phone pickup

### Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| First Contentful Paint (cold) | <2s | Lighthouse on 4G throttle |
| Time-to-Interactive (cold) | <4s | QR scan → can tap reactions |
| Time-to-Interactive (warm) | <2s | Cached PWA revisit |
| JS Bundle Size | <100KB gzipped | Core app without audio assets |
| WebSocket Connect Time | <500ms | After page load |
| Audio Asset Preload | <2s | All sounds cached and ready |
| Memory Usage | <50MB | 2-hour session, no memory leak |
| Battery Impact | <15%/hr | RAF dormancy + adaptive heartbeat + wake lock release |

**Battery optimization strategy:** `requestAnimationFrame` loop only during active render states (ceremony animations, reaction rendering), dormant during song state. Adaptive WebSocket heartbeat (5s active → 15s song). Wake lock release during song state.

### Responsive Design

- **Single target: mobile portrait.** No desktop, no tablet, no landscape
- Minimum viewport: 320px (iPhone SE) — Maximum: 428px (iPhone 14 Pro Max)
- Touch targets: minimum 48x48px, prefer 56x56px+ (drunk-user-friendly)
- Font sizes: minimum 16px body (prevents iOS Safari zoom on input focus)
- Disable pinch-to-zoom to prevent accidental zoom during frantic tapping

### Implementation Considerations

**Out of scope:** Native app features, CLI tooling, desktop layout, SEO beyond landing page meta tags.

**Critical dev-time investments:**
1. **WebSocket reconnection** — three-tier model, tested on both browsers with airplane mode toggle, screen lock/unlock, tab switch and return
2. **iOS Safari AudioContext** — create AND resume in same tap handler. Test on real iPhone hardware
3. **Ceremony stagger sub-states** — add to DJ state diagram: `voting_open` → `waiting_for_stragglers` → `revealing`
4. **Battery optimization** — RAF dormancy, adaptive heartbeat, wake lock management. Test 2-hour sessions on 3-year-old Android
5. **Screen Wake Lock** — Chrome API + iOS video hack. Only during active states

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Experience MVP — prove the core loop (join → react → ceremony → interlude → repeat) creates a compelling party experience with one real friend group. One night, one karaoke room, one group that says "we're doing this again."

**Resource Requirements:** Solo developer, ~5.5 weeks (Sprint 0-4). No designer on staff — invest design time in setlist poster and ceremony flow mockups before dev.

### MVP Build Plan

The sprint plan below maps features from Product Scope into a build-order sequence. Features are ordered by dependency and testability gates.

**Core User Journeys Supported:**
- Linh (Host) — full happy path from party creation through finale
- Minh (Non-Singer) — reactions, soundboard, ceremony voting, interludes
- Duc (Performer) — pre-song hype, ceremony, moment cards
- Trang (Shy Joiner) — low-pressure entry through reactions and universal interludes
- Late Joiner — mid-session join with stats catch-up
- Disconnected User — basic reconnection with state sync

**Sprint 0 — Foundation + Design (5 days):**

| Day | Focus |
|-----|-------|
| 1 | DJ state diagram: every state, transition, guard, timeout. Three ceremony weights (Full/Quick/Skip). Pause/resume logic. Bridge moments |
| 2 | Server scaffolding, WebSocket infra, session management |
| 3 | Setlist poster design mockup, ceremony flow mockup (all three weights) |
| 4 | Sound asset selection + testing (6 core sounds) |
| 5 | Award template pool (20+ titles, score-categorized), buffer day for state diagram refinement |

**Sprint 1 — The Skeleton (1 week):**

Build order enforced — each depends on the previous:

| Order | Feature | Depends On | Why Non-Negotiable |
|-------|---------|------------|-------------------|
| 1 | DJ state machine with ALL states (including bridge moments, ceremony sub-states, pause) + unit tests | Sprint 0 state diagram | THE core bet. Everything downstream depends on this |
| 2 | Party launch — create/join via QR/code (PWA, no accounts) | WebSocket infra | No join = no product |
| 3 | Host "Song Over!" trigger | DJ state machine | DJ can't know when physical songs end |
| 4 | Host controls overlay (next, skip, pause) | DJ state machine | Host must be able to override DJ |

**Dry-testable at Sprint 1 end:** Can create party, join, trigger state transitions, host can control flow.

**Sprint 2 — The Experience (1 week):**

| Feature | Why Non-Negotiable |
|---------|-------------------|
| Post-song ceremony with three weights (Full/Quick/Skip) + stagger model | Core value moment. Variety prevents staleness |
| Live emoji reactions + streaks | Minimum audience participation |
| Soundboard (4-6 sounds, host = primary audio for big moments) | Room audio is the atmosphere |
| Sound design (state transition audio cues) | How the room knows something changed |
| Pre-song hype card (bridge moment) | Duc's core value + physical-digital bridge |
| Moment card with share intent | Only viral artifact in core launch |
| Screen Wake Lock (Chrome API + iOS video hack) | Without this, half the room misses ceremonies |
| Solo/empty party state ("works best with 3+ friends") | First-time host experience |
| Weighted participation tracking (backend only) | Foundation for awards and metrics |

**Dry-run test at Sprint 2 end** with 2-3 friends.

**Sprint 3 — Pre-Real-Session Polish (1 week):**

| Feature | Why After Dry Run |
|---------|------------------|
| Three-tier reconnection model (brief/medium/long) | Basic reconnect sufficient for dry run on wifi |
| Adaptive heartbeat (5s active / 15s song) | Battery optimization not critical for 1-hour test |
| Late-join catch-up card (current stats) | Dry run starts with everyone present |
| Icebreaker (first-60-seconds) | Can test core loop without it |
| Democratic voting ("What's next?") | DJ random selection works for dry run |
| 3 interludes (Kings Cup, Dare Pull, Quick Vote) | Core loop works with just ceremony + reactions |
| Front-loaded universal interludes (first 30 min) | Requires interludes to exist first |
| Basic moment capture (prompted screenshots) | Nice-to-have for first test |
| End-of-night ceremony + setlist poster | Critical for real session |
| Awards algorithm (non-singing recognition) | Needs real session data to tune |

**Sprint 4 — Real World Test + Polish (5 days):**
- Real karaoke night with friends. Screen record on 2-3 phones
- Bug fixes from dry run + real session
- Host QR re-display mid-session (for late joiners)
- Group sing-along mode
- North Star prompt ("Would you use Karamania next time?")
- Event stream instrumentation for all KPIs

### Three Ceremony Weights

The DJ varies ceremony format to prevent staleness across 10+ songs per night:

| Weight | Duration | Flow | When DJ Uses It |
|--------|----------|------|----------------|
| **Full** | 15s | Vote → waiting for stragglers → award reveal → moment card | First 2-3 songs, standout performances, post-challenge |
| **Quick** | 5s | Thumbs up/down → one-liner reaction | Mid-session songs, back-to-back performances |
| **Skip** | 0s | Host override, move to next activity | When energy is high and group wants to keep momentum |

DJ weight selection logic: never two Full ceremonies in a row. Default to Quick after song 5. Full triggered by: first song, song after interlude, challenge completion.

### Risk Mitigation Strategy

**Technical Risks:**

| Risk | Severity | Mitigation |
|------|----------|------------|
| DJ state machine complexity (12+ states, 30+ transitions) | High | Formal state diagram before coding. 100% unit test coverage. Build skeleton Sprint 1 — test before layering experience |
| iOS Safari WebSocket suspension | High | Three-tier reconnection (Sprint 3). Test on real iPhone with screen lock cycles |
| iOS AudioContext silent failure | Medium | Create AND resume in same tap handler. Test on real hardware |
| Physical-digital mismatch (DJ cycles during breaks) | Medium | Pause meta-state + 90s inactivity auto-pause |
| Budget Android performance | Medium | RAF dormancy, adaptive heartbeat, test on 3-year-old devices |

**Market Risks:**

| Risk | Severity | Mitigation |
|------|----------|------------|
| Low initial adoption (need a group) | High | Target friend group organizers. Frictionless host experience |
| Ceremony staleness after 3rd repetition | High | Three ceremony weights (Full/Quick/Skip). 20+ award templates score-categorized. DJ varies weight by night position |
| Nobody shares content (flywheel doesn't spin) | High | Invest design time in setlist poster. Track share intents from week 1 |
| Incumbent response (KaraFun/Smule) | Low-Medium | First-mover + deep gamification hard to bolt on |

**Resource Risks:**

| Risk | Severity | Mitigation |
|------|----------|------------|
| Solo developer bottleneck | Medium | Keep it boring — single server process, no microservices |
| Scope creep during development | Medium | Sprint plan is the contract. If behind, cut from Sprint 3, never Sprint 1-2 |
| Sprint 0 rushed (state diagram incomplete) | Medium | Protected 5-day Sprint 0. State diagram is non-negotiable gate |

**Pre-Development Gates (non-negotiable before coding):**
1. Formal DJ state diagram with every state, transition, guard, timeout — including three ceremony weights and pause/resume logic
2. Setlist poster design mockup (screenshot-worthy, Instagram Story-ready)
3. Ceremony flow mockup for all three weights (Full/Quick/Skip)
4. 6 core sound assets curated and tested
5. Award template pool: 20+ titles, categorized by score range
6. Pause/resume logic decided (resume interrupted state vs advance to next)

## Functional Requirements

### 1. Party Management

- **FR1:** Host can create a new party session and receive a unique QR code and 4-digit party code
- **FR2:** Guest can join an active party by scanning a QR code or entering a party code in their browser
- **FR3:** Guest can enter a display name to identify themselves in the party (no account required)
- **FR4:** All participants can see a live party lobby showing who has joined and the current player count
- **FR5:** Host can start the party when ready, transitioning all connected phones to the first activity
- **FR6:** Guest can join a party mid-session and receive a catch-up summary of current party stats
- **FR7:** Host can re-display the QR code and party code at any point during an active session
- **FR8:** System displays a graceful empty-party state when fewer than 3 players are present, with a share prompt
- **FR53:** System provides immediate visual feedback during the join process showing party status and player count before the connection is fully established

### 2. DJ Engine & Party Flow

- **FR9:** System automatically cycles through activity states (song → ceremony → interlude → volunteer/vote → repeat) without manual intervention, governed by a formal state diagram with defined transitions, guards, and timeouts
- **FR10:** System provides bridge moment activities during physical-world transitions (first song prompt, song selection, mic handoff)
- **FR11:** System can enter a pause state, triggered by host action or by detecting 90+ seconds of inactivity across all users
- **FR12:** System resumes from pause to the appropriate next state when host un-pauses or activity resumes
- **FR13:** System presents democratic voting with 2-3 options for the group to decide what happens next
- **FR14:** System selects ceremony weight following defined rules: Full for first song and post-interlude songs, never two consecutive Full ceremonies, default to Quick after song 5, Skip available via host override
- **FR15:** System front-loads universal participation activities in the first 30 minutes of a session
- **FR51:** System can run a first-session icebreaker activity that all participants complete with a single tap, with results visible to the group

### 3. Performance & Spotlight

- **FR16:** Host can signal that a song has ended via a persistent, always-visible trigger during song state
- **FR17:** System displays a pre-song hype announcement on all phones showing the next performer's name
- **FR18a:** System collects crowd votes during a Full ceremony with a 15-second window, accepting votes as participants pick up their phones (staggered participation)
- **FR18b:** System auto-generates a ceremony award title from a categorized template pool matched to the performance score
- **FR18c:** System generates a moment card combining performer details, award, and crowd score at the end of a Full ceremony
- **FR19:** System conducts a Quick ceremony: rapid thumbs up/down poll with a one-liner reaction
- **FR20:** System generates award titles from a pool of 20+ templates, categorized by score range to match performance quality
- **FR21:** System supports group sing-along activities where all participants are included without individual spotlight

### 4. Audience Participation

- **FR22:** All participants can send emoji reactions during performances, visible in real-time on all connected phones
- **FR23:** System tracks reaction streaks and displays streak milestones to the reacting user
- **FR24:** All participants can trigger soundboard effects (4-6 sounds) that play audibly through their phone speaker
- **FR25:** System plays the primary ceremony audio (fanfares, reveals) through the host's phone as the dominant audio source
- **FR26:** System plays distinct audio cues for every DJ state transition so the room perceives activity changes
- **FR27:** All participants can vote in ceremony scoring and democratic activity selection
- **FR28a:** System supports a library of interlude mini-games deployable by the DJ engine
- **FR28b:** MVP interlude library includes: Kings Cup (group rule card), Dare Pull (random dare assigned to random player), Quick Vote (binary opinion poll)

### 5. Host Controls

- **FR29:** Host has a persistent overlay providing party control without leaving the participant experience
- **FR30:** Host can skip the current activity and advance to the next DJ state
- **FR31:** Host can manually pause and resume the DJ engine
- **FR32:** Host can override the DJ's next activity selection
- **FR33:** Host can access all party controls without leaving the participant view

### 6. Memory & Sharing

- **FR34:** System generates a shareable moment card for each Full ceremony containing performer name, song title, award, and crowd score
- **FR35:** Participant can share a moment card via native mobile share sheet
- **FR36:** System generates an end-of-night setlist poster showing all songs, performers, date, and awards
- **FR37:** Participant can share the setlist poster via native mobile share sheet
- **FR38:** System prompts participants to capture moments at key points during the session (prompted screenshots)
- **FR39:** Any participant can manually flag a moment for capture via a "capture this!" action
- **FR52:** System orchestrates an end-of-night finale sequence presenting awards, session highlights, setlist poster, and post-session feedback in a structured ceremony flow

### 7. Session Intelligence & Analytics

- **FR40:** System tracks weighted participation scores for each user across three tiers (passive: 1pt, active: 3pts, engaged: 5pts)
- **FR41:** System generates end-of-night awards recognizing both singing and non-singing contributions
- **FR42:** System logs every state transition, user action, and DJ decision as a structured event stream with schema: `{sessionId, userId, eventType, timestamp, metadata}`
- **FR43:** System presents a post-session North Star prompt ("Would you use Karamania next time?") during the finale ceremony
- **FR44:** System tracks share intent taps as a viral signal metric

### 8. Connection & Resilience

- **FR45:** System maintains real-time WebSocket connections between all participant phones and the server
- **FR46:** System detects participant disconnection via heartbeat monitoring and updates participant lists accordingly
- **FR47:** System automatically reconnects a disconnected participant and syncs them to the current state without user action
- **FR48:** System preserves a participant's session history and participation scores through disconnection events
- **FR49:** System continues operating normally when any participant (including host) disconnects — no single point of failure
- **FR50:** System prevents phone screen auto-lock during active participation states on supported browsers

## Non-Functional Requirements

### Performance

- **NFR1:** DJ state transitions must propagate to all connected devices within 200ms of server-side state change
- **NFR2:** Emoji reactions must appear on all phones within 100ms of the originating tap
- **NFR3:** Soundboard audio must begin playback within 50ms of tap on the originating device
- **NFR4:** Ceremony vote collection must complete within exactly 15 seconds of server-side timer, regardless of client clock variations
- **NFR5:** The app must maintain 60fps rendering and <100ms input response time with up to 12 simultaneously connected participants, each sending reactions at peak rate (2 taps/second)
- **NFR6:** Audio assets must be pre-loaded and playable without network delay after initial session load
- **NFR7:** Total JS bundle size must remain under 100KB gzipped (excluding audio assets)
- **NFR26:** Event stream logging must be asynchronous and must not add more than 5ms latency to any user-facing operation
- **NFR27:** Ceremony reveal must appear on all connected devices within a 100ms window of each other, using server-coordinated reveal timing (server sends reveal timestamp, clients schedule synchronized display)

### Reliability

- **NFR8:** The DJ engine must continue operating if any participant (including host) disconnects — zero single points of failure
- **NFR9:** A participant's reconnection after a brief network interruption (<5s) must be transparent with no visible UI disruption
- **NFR10:** Session state must be fully recoverable from the server — no client-only state that would be lost on page refresh
- **NFR11:** The system must handle concurrent ceremony votes from all participants without race conditions or vote loss
- **NFR12:** The system must gracefully degrade when participant count drops below 3 (simplified activities, adjusted voting thresholds)
- **NFR13:** On server restart, active sessions are gracefully terminated with a "session ended unexpectedly" message to all connected clients. Full session persistence and recovery deferred to v2
- **NFR28:** Client memory usage must not grow by more than 10MB over a 3-hour session with typical interaction patterns. No memory leaks in reaction rendering, ceremony animations, or WebSocket message handling

### Usability

- **NFR14:** All primary interactions (reactions, voting, soundboard) must be completable with a single tap on a target no smaller than 48x48px
- **NFR15:** No interaction in the app requires text input beyond the initial name entry
- **NFR16:** All participant-facing screens must be comprehensible without reading instructions — the UI must be self-evident
- **NFR17:** All text and interactive elements must meet WCAG AA contrast ratio (4.5:1 for normal text, 3:1 for large text) against their backgrounds, verified in simulated low-light display conditions
- **NFR18:** State transitions must be perceivable through audio cues alone, not requiring visual attention — participants may be watching the karaoke screen, not their phone
- **NFR19:** Host controls must be accessible within 1 second from any participant screen state (no navigation required)
- **NFR20:** The app must not require any configuration, settings, or preferences from any participant — zero setup beyond name entry

### Security

- **NFR21:** Party codes must expire after session end and not be reusable
- **NFR22:** No personally identifiable information stored beyond display name and session participation data
- **NFR23:** Rate limiting on reaction and soundboard events to prevent spam (diminishing returns model — not hard block, soft degradation)
- **NFR24:** Session data must be isolated — no participant can access or affect another party's session
- **NFR25:** WebSocket connections must be authenticated to their session — a connection cannot inject events into a different party

