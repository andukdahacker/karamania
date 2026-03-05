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
  - step-e-01-discovery
  - step-e-02-review
  - step-e-03-edit
lastEdited: '2026-03-05'
editHistory:
  - date: '2026-03-05'
    changes: 'Added Party Cards system (19 curated challenges), Lightstick Mode, Camera Flash Hype Signal, Prompted Media Capture (bubble UX, photo/video/audio with iOS graceful degradation). Promoted interludes/icebreaker/democratic voting from fast-follow to core MVP. Updated Executive Summary, Product Scope, User Journeys, Journey Requirements Summary, DJ Engine FRs, Audience Participation FRs, Success Criteria, Sprint Plan, v3 Vision.'
  - date: '2026-03-05'
    changes: 'Validation fixes: Reconciled FR38-39 with FR67-73 bubble capture system. Added media capture moments to Minh and Duc journeys. Fixed 9 SMART FRs with measurable thresholds (FR23, FR28a, FR29, FR33, FR47, FR49, FR52, FR53). Removed implementation leakage from FR69. Quantified 6 vague NFRs (NFR6, NFR9, NFR12, NFR16, NFR18, NFR23). Fixed subjective adjectives in FR8, FR12, FR18b, FR19, FR20, FR22, FR26.'
  - date: '2026-03-05'
    changes: 'Added Song Integration & Discovery system to MVP: YouTube Lounge API TV pairing (passive song detection + queue control), YouTube Music + Spotify playlist import, Karaoke Catalog Index, Intersection-Based Suggestion Engine, Quick Pick + Spin the Wheel song selection UX. Added new FR section (FR74-FR90), new NFRs (NFR29-NFR32), new user journey (Song Discovery), updated Executive Summary, Product Scope, Innovation, Risk Mitigation, and Sprint Plan. Based on brainstorming session 2026-03-05 findings.'
  - date: '2026-03-05'
    changes: 'Added Authentication & Persistence to MVP scope. Firebase Auth (Google/Facebook OAuth, optional — guest join preserved), Railway PostgreSQL for session summaries and user profiles, Firebase Storage for media captures linked to user accounts. Added FR96-FR105 (auth, identity, persistence, media ownership). Added NFR34-NFR37 (JWT validation, guest upgrade, DB writes, media access control). Updated Executive Summary, Product Scope, Sprint Plan, Journey Requirements Summary, and Risk Mitigation. Motivation: cross-session features and media ownership.'
  - date: '2026-03-05'
    changes: 'Added Vietnamese localization as fast-follow item. Added NFR38 requiring centralized string constants (not hardcoded in components) to enable i18n extraction, plus Vietnamese diacritics font support.'
  - date: '2026-03-05'
    changes: 'Major platform pivot: PWA → Flutter native app (iOS + Android). Hybrid join flow via lightweight web landing page that deep-links into the app or redirects to app store. Removed all browser-specific workarounds (iOS Safari AudioContext, Web Audio API, screen wake lock hacks, PWA limitations). Updated tech stack to Flutter + Dart. Replaced JS bundle targets with app size targets. Simplified media capture (uniform native access). Updated deployment model to include app store distribution. Adjusted sprint plan for Flutter development. Removed Web App Specific Requirements section, replaced with Mobile App Specific Requirements. Removed all performance voting/scoring from ceremonies — awards are now context-driven (reaction volume, party card completion, song position) not audience-rated. Three ceremony weights (Full/Quick/Skip) simplified to two ceremony types (Full/Quick) with host skip option. Removed FR18a crowd votes, FR19 thumbs up/down, score-categorized award templates. Updated all user journeys, FRs, NFRs accordingly.'
inputDocuments:
  - '_bmad-output/planning-artifacts/product-brief-karaoke-party-app-2026-03-04.md'
  - '_bmad-output/planning-artifacts/research/market-karaoke-party-companion-research-2026-03-03.md'
  - '_bmad-output/analysis/brainstorming-session-2026-03-03.md'
  - '_bmad-output/analysis/brainstorming-session-2026-03-05.md'
documentCounts:
  briefs: 1
  research: 1
  brainstorming: 2
  projectDocs: 0
classification:
  projectType: mobile_app
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

Karamania is a second-screen native mobile app (Flutter, iOS + Android) that transforms group karaoke nights from interactive party experiences into full entertainment sessions. Users join via QR code scan or party code — a lightweight web landing page deep-links into the installed app or redirects to the app store for first-time users. Optional accounts (Google/Facebook OAuth or guest with name-only). Phones become participation devices: reactions, soundboards, voting, party card challenges, lightstick mode, song discovery, and mini-games that keep the entire room engaged before, during, and between songs.

**Core Differentiator:** The only product that runs alongside existing karaoke systems rather than replacing them — AND connects directly to the YouTube TV karaoke session via the existing TV pairing code. Eliminates music licensing, works at any venue, and creates genuine white space in a $7.5B market. As a native app, Karamania delivers reliable background connectivity, seamless media capture on both platforms, push notifications, and consistent performance that a PWA cannot match. Party Cards, audience participation modes, and a song discovery engine that eliminates "what should we sing?" decision fatigue turn every karaoke night into a complete entertainment experience.

**Core Innovation:** Two interconnected systems. (1) A server-authoritative DJ engine — a real-time state machine that automatically orchestrates party flow (party card deal → song → ceremony → interlude → repeat), eliminating dead air and freeing the host from MC duties. (2) A Song Integration Engine that pairs with the YouTube TV via the Lounge API, passively detects every song played, imports friends' playlists (YouTube Music + Spotify), and surfaces personalized suggestions through Quick Pick voting and Spin the Wheel — songs the group collectively knows that have karaoke versions available.

**Target Users:** Vietnamese friend groups (ages 20-35) at commercial karaoke venues in HCMC and Hanoi. Four personas: the overwhelmed host (Linh), the non-singer (Minh), the shy joiner (Trang), and the performer seeking audience (Duc).

**Business Model:** Free MVP. Memory-as-marketing flywheel — shareable setlist posters and moment cards ARE the acquisition channel. Premium features identified through usage data post-validation.

**MVP Strategy:** Solo developer. Prove the core loop with one real friend group. Success = "Would use again" >80%.

**Platform Decision:** Flutter native (iOS + Android) with a lightweight web landing page for join flow. The web page handles QR code / party code entry, deep-links into the installed app, or redirects to the App Store / Google Play for first-time users. All party functionality lives in the native app — the web page is join-routing only.

## Success Criteria

### User Success

- **Linh (Host):** Party creation → first ceremony completes without host intervention. "The app ran my party for me."
- **Minh (Non-Singer):** Engages with 3+ feature categories per session. Weighted participation score reaches 70%+ of singer scores. Stays through finale.
- **Duc (Performer):** 80%+ songs trigger ceremony with award reveal. Moment cards shared outside app. Reactions from 60%+ of room during songs.
- **Trang (Shy Joiner):** Time-to-first-active-use <5 minutes for 80% of non-host users. Engagement ladder progression within first session (reactions → interludes → group moments). Zero forced-participation complaints.

### Business Success

- **North Star:** >80% "Would use again" post-session score
- **3-Month Targets:** 70%+ weighted participation rate, >20% host return (45-day window), >1 share intent per session, <2 dead air incidents per session, <60s time-to-first-hype, viral coefficient >0.3
- **12-Month Targets:** 50%+ organic acquisition via shared content, 3+ sessions per friend group average, 500+ parties/month in HCMC/Hanoi, viral coefficient >0.5, 2-3 identified premium features
- **Joiner-to-host conversion:** Tracked from month 1 as earliest viral signal — did the joiner create their own party within 30 days?

### Technical Success

| KPI | Target | Notes |
|-----|--------|-------|
| Time-to-interactive (cold) | <3s on 4G | App launch → party lobby rendered |
| Time-to-interactive (warm) | <1.5s | App already in memory |
| WebSocket uptime | >98% per session | |
| DJ state sync latency | <200ms across devices | Ceremony reveals and countdowns must feel simultaneous |
| Audio strategy | Host phone = primary audio for big moments | Design around distributed sync, don't solve it |
| Audio playback success | >99% | Native audio engine with pre-loaded assets |
| Reconnection rate | <1 disconnect per user per session | |
| Ceremony render (low-end Android) | >95% success | Vietnam market = budget Android devices |
| App install size | <50MB | Flutter app with audio assets |

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
- Passive (1 pt): emoji tap, reaction view, lightstick mode active
- Active (3 pts): soundboard use, vote cast, moment capture tap, hype signal activation, party card redraw
- Engaged (5 pts): interlude game completion, dare acceptance, party card challenge completion

**Party Card Metrics:**
- Party card acceptance rate tracked per session (target: >50% acceptance by song 5)
- Challenge completion rate tracked (accepted cards where singer followed through)
- Group involvement card participation rate (did picked participants engage)

**Song Integration Metrics:**
- Playlist import success rate >95% for YouTube Music, >85% for Spotify (public playlists)
- Lounge API song detection rate >90% (songs played that the app correctly identifies)
- Quick Pick average decision time <15 seconds (from suggestions shown to song selected)
- Suggestion relevance: >70% of Quick Pick suggestions recognized by 2+ group members (measured by vote participation)
- Queue push success rate >95% (selected songs that successfully appear on YouTube TV)
- TV pairing adoption: >60% of sessions use TV pairing (vs. suggestion-only mode)

**Go/No-Go Gates (3 months):** If 5/6 core gates pass → proceed to v2. If 3-4 → iterate MVP. If <3 → reassess assumptions.

## Product Scope

### MVP - Minimum Viable Product

"The Party Companion" — prove the core loop works with one real friend group.

- **Party launch via native app:** QR code / 4-digit code entry through a lightweight web landing page that deep-links into the installed Flutter app (or redirects to App Store / Google Play for first-time users). Optional social login (Google/Facebook) or guest join (name-only, upgradeable). Branded loading state with party lobby ("3 friends are waiting for you")
- **Live audience reactions:** Emoji reactions during performances, basic soundboard (air horn, applause, sad trombone, "OHHHH!"), real-time feed on all phones. Host phone as primary audio source for big ceremony moments. Native audio playback — no browser AudioContext restrictions
- **Party Cards system:** 19 curated singer challenges across 3 types — vocal modifiers (Chipmunk Mode, Barry White, The Whisperer, Robot Mode, Opera Singer, Accent Roulette, Beatboxer), performance modifiers (Blind Karaoke, Method Actor, The Statue, Slow Motion, The Drunk Uncle, News Anchor, Interpretive Dance), and group involvement (Name That Tune, Backup Dancers, Crowd Conductor, Tag Team, Hype Squad). App auto-deals one card per singer during pre-song state. Singer can accept, dismiss, or use one free redraw. Host can override. Group involvement cards pick random participants — no consent flow, social dynamics handle opt-outs
- **Audience participation modes during songs:** Participants toggle between lean-in mode (lyrics/reactions) and lightstick mode (phone becomes a glowing visual prop). Camera flash/screen hype signal available as real-time performer encouragement (native flashlight API — uniform across iOS and Android)
- **Post-song ceremony:** Host taps "Song Over!" → auto-generated funny award based on session context (party card completed, reaction count, song position) → shareable moment card. Kills awkward post-song silence. No performance rating or voting — pure celebration
- **Dumb DJ engine:** Server-authoritative state machine cycling Party Card Deal → Song → Ceremony → Interlude → Volunteer/Vote → Repeat. Randomized, not adaptive. Log every state change for future Smart DJ training data
- **Host controls:** Subtle floating overlay (Next, Skip, Pause). One-thumb operation. Host stays a player, never becomes a manager
- **Immersive sound design:** Native audio engine with pre-loaded assets. State transition sounds for every DJ state change. Collective audio from all phones creates shared atmosphere
- **Icebreaker:** First-60-seconds activity all participants complete with a single tap, results visible to the group
- **Democratic voting:** 2-3 options surfaced by DJ engine, everyone votes, majority wins
- **Interlude games:** Kings Cup (group rule card), Dare Pull (random dare assigned to random player), Quick Vote (binary opinion poll). Front-loaded universal interludes in first 30 minutes for maximum group inclusion
- **Prompted media capture:** Floating capture bubble at key moments (session start, reaction peaks, post-ceremony, session end). Any participant pops the bubble to capture photo/video (5s max)/audio. Uniform native camera/microphone access on both iOS and Android — no browser capability differences. Background upload, tagged for future highlight reel assembly
- **End-of-night ceremony + setlist poster**
- **Song Integration & Discovery:** YouTube TV pairing via Lounge API (passive song detection + queue control), YouTube Music + Spotify playlist import (paste share URL), Karaoke Catalog Index (pre-scraped from popular karaoke YouTube channels), Intersection-Based Suggestion Engine (songs group knows ∩ karaoke catalog, ranked by overlap count + genre momentum), Quick Pick (5 AI suggestions, group tap-to-vote) + Spin the Wheel (8 picks, animated random selection) dual-mode song selection UX. Host pairs app with TV code → friends join room and paste playlist URLs → app builds shared song pool → suggestions flow automatically
- **Fast-follow (1-2 weeks after core):** Vietnamese language localization (i18n), group sing-along mode, additional interlude games, moment capture enhancements, push notifications for party invites and morning-after highlights

### Growth Features (Post-MVP)

v2 — "The Smart Party" (target: 6 months post-MVP)

- Adaptive DJ engine: energy signal reading, decision tree, three-act arc, DJ personality
- Moment Economy: unified earn/spend currency connecting all participation
- Hype combo system + power cards (Uno Reverse)
- Song Intelligence evolution: Snowball Effect (cross-session learning — each session makes suggestions smarter for the group), genre-based game triggers (song genre drives which challenges appear), session history influence on suggestions
- Smart interlude engine: 10+ games, contextual selection
- Engagement ladder + fair play balancer
- Apple Music playlist import support

### Persistence & Identity Architecture (MVP Scope)

**MVP (v1): Firebase Auth + Railway PostgreSQL + Firebase Storage**
- User authentication via Firebase Auth (social OAuth — Google, Facebook). Optional — guest join remains the default frictionless path (name-only, upgradeable to full account at any time without data loss)
- PostgreSQL (Railway-managed) for user profiles, party history, session summaries, and highlight reel metadata. Co-located with Node.js server on Railway for low-latency writes
- Firebase Storage for media captures (photos, 5s video clips, audio snippets) linked to authenticated user profiles and party sessions. Guest captures linked to session ID only. 5GB free tier, $0.026/GB beyond
- Event stream (FR40-44) logs all actions in-memory during active party, then writes session summary to PostgreSQL at party end
- All real-time game state (DJ engine, Socket.io, reconnection buffers) remains in-memory on the custom Node.js server — Firebase handles identity and storage, Railway PostgreSQL handles persistence
- Authenticated users gain: party history, personal stats, media gallery, and future cross-session features. Guests get full in-session experience but no persistence beyond the active party
- Estimated MVP cost: ~$5-10/month (Railway Hobby $5 + PG usage + Firebase free tiers)

**Post-MVP (v2+): Persistence Expansion**
- Personalized suggestions powered by cross-session user preference data
- "Karaoke Wrapped" stats derived from party history
- Morning-after highlight reel assembled from stored media + session moments
- Crowdsource song intelligence from anonymized cross-session data

**Architectural implication:** Three complementary services — custom Node.js server on Railway (real-time game engine via Socket.io), Railway PostgreSQL (persistence), and Firebase (auth + storage). The Flutter client communicates with: Socket.io (via socket_io_client package) for live party interaction, Firebase Flutter SDK for auth and media upload/browse, and indirectly with PostgreSQL via the server API. Socket.io handshake validates Firebase JWT for authenticated sessions. A lightweight web landing page (static HTML/JS hosted on the same domain) handles QR code / party code join routing — deep-linking into the app or redirecting to app stores.

### Vision (Future)

v3 — "The Memory Machine" (target: 12 months)
- Automatic Memory Machine with smart triggers + quality filters (builds on V1 prompted media capture pipeline — raw content already collected)
- Multi-phone sync capture, blooper reel, sound bite generator
- Morning-after highlight reel push notification (assembled from V1 captured media: photos, 5s video clips, audio snippets, tagged by session moment)
- Scrapbook assembly (cover, timeline, media, awards, stats, encore closing)
- Karaoke Wrapped + Festival Wristband + Chronicle identity system
- Audio fingerprinting party trick (ACRCloud integration — phone mic identifies songs as a "magic" secondary detection method)
- Crowdsource song intelligence: anonymized data across all Karamania sessions builds a "songs people actually sing at karaoke" database, improving suggestions for all users

v4 — "The Platform" (target: 18-24 months)
- Hangout Mode: same engine for house parties, road trips, game nights
- Venue partnership dashboard (B2B revenue)
- Theme Engine, Crowd Conductor, Distributed Sing-Along
- Party planning tools, evolution rounds
- Adaptive Group Scaler (2 intimate → 12+ festival mode)

## User Journeys

### Journey 1: Linh — "The Night She Stopped Working"

Linh books Room 7 at ICOOL Thảo Điền for Saturday. Eight friends confirmed. She's already dreading the usual: managing the song queue, filling dead air with forced enthusiasm, being the MC nobody asked her to be.

Saturday, 8:15 PM. Everyone's arriving. Linh opens Karamania on her phone. Taps "Start Party." A QR code fills her screen with a 4-digit code: **VIBE**. She holds it up: "Scan this."

Six friends scan within 40 seconds — the QR opens a web page that deep-links straight into the app. Two more trickle in. Each enters a name — guest join, no account required. The party lobby shows names populating in real-time.

She taps "Let's Go." Every phone hits the icebreaker: "Tap your favorite music decade." The room erupts — "Wait, THREE of you picked the 80s?!" Then the DJ surfaces a **First Song Prompt**: "Who's singing first? Volunteer or spin the wheel!" — bridging the gap while someone physically walks to the karaoke machine and picks a song.

Duc grabs the mic. On Linh's phone, a subtle floating button appears: **"Song Over!"** — her only job. She taps it when Duc finishes. Every phone explodes into a ceremony: dramatic reveal, Duc is crowned "Vocal Menace." A moment card generates.

The Dumb DJ takes over. Cycles through activities automatically. Linh realizes 45 minutes have passed. She hasn't managed anything. She used the host override exactly once — to skip a dare that was too spicy. One tap. Back to playing.

End-of-night ceremony: awards scroll, setlist poster reveals — every song, every performer, the date, the venue. Linh screenshots it. It's in the group chat before she stands up.

Walking to the parking lot, her friend Hà says: "Send me that app link. I'm doing this for my birthday next week."

Linh smiles. She had fun at her own party.

### Journey 2: Minh — "The Loudest Person Who Never Sang"

Minh doesn't sing. Everyone knows this. At regular karaoke nights, he's scrolling TikTok by song three.

Tonight he scans the QR — the app opens instantly. Duc starts singing. Minh's phone shows a reaction bar — but he toggles to lightstick mode. His screen glows neon blue, swaying with his hand. Two others switch too. Three phones waving in a dark karaoke room. He switches back to reactions. Hits the fire emoji. Again. "3x HYPE!" flashes. He discovers the soundboard: air horn at the chorus drop. The sound cuts through the room. Everyone laughs. Then he hits the camera flash hype — his phone flashlight pulses. The room flickers.

Song ends. Ceremony pops. The award: "The Warm-Up Act." A capture bubble pops — reaction peak detected. Minh taps it, films a 5-second clip of Duc taking a bow. One tap, auto-uploads. Screenshots the moment card, sends it to the group chat.

DJ fires a Dare Pull. Minh gets: "Do your best impression of the last singer." He stands up, dramatically mumbles into an invisible mic. The room loses it.

Quick Vote: "Is Bohemian Rhapsody overrated?" Minh smashes "YES" before anyone. 5-3 split. Arguments erupt. The DJ has already queued the next activity.

End of night: 200+ reactions, 30+ soundboard hits, 4 interludes completed. More weighted participation points than two of the singers. Crowned "Hype Lord."

Never sang a note. Best time in the room.

### Journey 3: Trang — "How She Ended Up Holding the Mic"

Trang is here because her friends wouldn't stop asking. She's sitting in the corner, prepared to scroll Instagram for two hours.

She scans the QR because everyone's scanning — the app was already on her phone from last time someone shared the link. The icebreaker hits: "Tap your favorite decade." Low stakes. She taps 2000s. Three others did too. Small smile.

Duc sings. Trang watches others tapping reactions. After 20 seconds, she taps the heart. Once. Then the laughing face when Duc points dramatically during the chorus. She doesn't touch the soundboard. Nobody notices.

Ceremony pops. She laughs at the award reveal with everyone.

The DJ front-loads universal interludes in the first 30 minutes — activities every person participates in regardless. Quick Vote: "Pineapple on pizza?" She has a strong opinion. Taps "NEVER." She's in the majority. Says out loud: "See?!" First words she's spoken about the app.

Two songs later, the app deals a party card to the next singer: "Backup Dancers — pick 2 people!" The singer points at Trang and someone else. She doesn't have to sing. She just has to stand behind and move. Low stakes. She's laughing before the chorus starts.

Three songs later, Kings Cup: "Everyone who's been to Đà Lạt this year, sing the next chorus together." She looks around. Four hands up. The chorus hits. She mouths along. Not loud. But she's doing it.

An hour in. Group sing-along: a 2000s hit everyone knows. The whole room is singing. Trang is singing. She didn't volunteer. The room pulled her in. No name on screen. Just "everyone join in."

End of night: "The Silent Storm" — most consistent reactor who never took a solo spotlight. She posts it to Instagram: "apparently I'm a karaoke person now???"

### Journey 4: Duc — "The Night His Performance Became Content"

Three songs in, it's Duc's turn. His signature song. He tells Linh to hit play.

Every phone displays: "🎤 DUC IS UP NEXT" — a pre-song hype card bridging the physical moment of him walking to the mic. Then the party card deals: "Method Actor — perform like it's Broadway." Duc grins. Accepts. Countdown sound from the host's phone. The room quiets.

He sings — full theatrical gestures, dropping to one knee at the bridge, pointing at the audience during the chorus. Reactions pour in — fire emojis, hearts, the occasional laugh when he oversells a note. Minh hits the air horn twice at the chorus. Half the room is in lightstick mode, phones swaying. Duc can't see reactions (he's watching lyrics) but he can hear the soundboard cutting through and see the glow from the corner of his eye.

He finishes. Ceremony fires: Award reveal — "Vocal Assassin." The app picked it based on the reaction storm during his performance and the party card completion. A capture bubble floats in — post-ceremony trigger. Duc pops it, takes a selfie with the award still on screen. Moment card generates — song title, name, award, party card challenge completed, styled like a concert poster. Duc taps share. It's in the group chat before he sits down.

Two songs later, the app deals him "The Whisperer — sing the whole song as a dramatic whisper." Terrible. Hilarious. "The Whisperer" award. That card gets more shares than his good performance.

Next round: "Tag Team" card. Mid-chorus, Minh's name flashes on every phone — "TAG IN!" Minh jumps up, grabs the invisible mic, belts out three words, and sits back down. The room erupts.

End of night: "Performance of the Night." Setlist poster shows his name next to three songs. Posts to Instagram. Friend from another group DMs: "What app is that?"

### Journey 5: The Late Joiner — "Arriving to a Party Already in Progress"

9:30 PM. Party started at 8. Thảo walks in. Everyone's mid-song, phones out, laughing.

"Scan this!" Linh holds up her phone — QR accessible from host controls at any time, not just at party start.

Thảo scans. The app opens, she enters her name. The loading state: "Joining the party... 8 friends are already here." She lands mid-session and sees a catch-up card with current stats: "8 friends here, 5 songs so far, current award leader: Minh." Three seconds of context. She's oriented.

Current song ends. Ceremony fires — award reveal. Full participant immediately. Next interlude, her name is in the pool. She gets a dare within 5 minutes.

End of night: her name appears on the setlist poster. The app doesn't differentiate early and late joiners. She was there. That's enough.

### Journey 6: The Group — "How They Stopped Arguing About What to Sing"

8:20 PM. Linh's party is starting. She opens Karamania, taps "Start Party." The QR code appears with the TV code: **VIBE**. She enters the same code into the app that's already on the YouTube TV — the app pairs with the karaoke session instantly.

"Share your playlist so we can find songs you all know!" pops on everyone's phone as they join. Minh opens YouTube Music, copies his playlist link, pastes it. Three seconds later: "Found 47 songs!" Duc pastes his Spotify link. The app detects it's private — a quick 3-step guide appears: "Tap ••• → Make Public → paste again." Ten seconds. "Found 83 songs!" Trang pastes her YouTube Music link. Two others follow.

The app cross-references everyone's music against the Karaoke Catalog — songs that actually have karaoke versions on YouTube. Within seconds: "Found 34 songs your group knows that you can sing tonight!"

Quick Pick fires: five cards appear on everyone's phone. "Bohemian Rhapsody — 5 of 5 know this." "Cơn Mưa Ngang Qua — 4 of 5." Everyone taps thumbs up or skip. Bohemian Rhapsody wins in 8 seconds. The app auto-queues it on the TV via the Lounge API. No one typed anything into the karaoke machine.

Three songs later, energy is high. Someone shouts "SPIN IT!" The app switches to Spin the Wheel — eight songs loaded. Minh taps SPIN. The wheel animates, lands on a deep cut from Duc's playlist. Nobody expected it. Duc jumps up. The room cheers.

Between songs, the app already knows what just played (the Lounge API detected it). The game engine pulls the genre: "That was a ballad — time for something upbeat!" Next Quick Pick suggestions shift to high-energy tracks.

By song 10, nobody has opened YouTube to browse. Nobody has argued about what to sing next. The app knows what they like, and the group decides in seconds.

### Edge Case: The Disconnected User

Minh's phone hits 8% during song 6. Screen dims. It dies. The DJ engine detects his WebSocket disconnect. Name grays out on participant lists. No error, no delay — the ceremony doesn't depend on audience votes.

Twenty minutes later, phone boots. He taps the app. WebSocket reconnects automatically. Server sends current state. His phone renders whatever's happening now. Participation history intact. Hype streak reset, but total points preserved.

The app treats it like he blinked.

### Edge Case: The Solo Host Testing

Wednesday night. Linh opens Karamania to see what it does before Saturday.

Taps "Start Party." QR and code appear. Lobby: "1 player — works best with 3+ friends!" with a share button for the party code. She gets the idea in seconds. Closes the app. Saturday, she knows exactly how to start.

### Journey Requirements Summary

| Capability | Revealed By | MVP Priority |
|-----------|------------|-------------|
| Party creation + QR/code join (via web landing page → deep link into native app) | Linh, Late Joiner, Solo Host | Core |
| Party lobby with live player count | Linh, Late Joiner | Core |
| Host "Song Over!" trigger | Linh, Duc | Core |
| Host override controls (skip/next) | Linh | Core |
| Host QR re-display mid-session | Late Joiner | Core |
| DJ state machine (auto-cycling) | Linh, Minh, Trang | Core |
| DJ bridge moments (first song prompt, song selection, mic handoff) | Linh, Duc | Core |
| Icebreaker (first-60-seconds) | Trang, Linh | Core |
| Real-time emoji reactions + streaks | Minh, Trang, Duc | Core |
| Soundboard with room audio | Minh, Duc | Core |
| Sound design (state transition audio cues) | All journeys | Core |
| Party Cards system (19 curated challenges) | Duc, Trang, Minh | Core |
| Lightstick mode (phone-as-prop during songs) | Minh, Duc | Core |
| Camera flash/screen hype signal | Minh | Core |
| Post-song ceremony (award reveal + moment card, no voting) | All personas | Core |
| Prompted media capture (photo/video/audio bubbles) | All personas | Core |
| Moment card with share intent | Duc, Minh | Core |
| Interlude games (Kings Cup, Dare, Quick Vote) | Minh, Trang | Core |
| Front-loaded universal interludes (first 30 min) | Trang | Core |
| Pre-song hype card (bridge moment) | Duc | Core |
| Democratic voting ("What's next?") | Linh, Minh | Core |
| Group sing-along mode | Trang | Fast-follow |
| End-of-night ceremony + setlist poster | All personas | Core |
| Late-join catch-up (current stats only) | Late Joiner | Core |
| WebSocket reconnection + state sync | Disconnected User | Core |
| Solo/empty party state (copy + share, no demo) | Solo Host | Core (minimal) |
| Weighted participation tracking | Minh, Trang | Core (backend) |
| Awards algorithm (non-singing recognition) | Minh, Trang | Core |
| YouTube TV pairing via Lounge API (TV code = room code) | Song Discovery, Linh | Core |
| Passive song detection (nowPlaying events → metadata) | Song Discovery | Core |
| Queue control (push songs to TV via Lounge API) | Song Discovery | Core |
| YouTube Music playlist import (URL paste → API read) | Song Discovery, Minh, Duc, Trang | Core |
| Spotify public playlist import (URL paste → Client Credentials) | Song Discovery, Duc | Core |
| Spotify "Make Public" guidance for private playlists | Song Discovery | Core |
| Karaoke Catalog Index (pre-scraped karaoke YouTube channels) | Song Discovery | Core |
| Intersection-Based Suggestion Engine (group overlap ∩ karaoke catalog) | Song Discovery | Core |
| Quick Pick (5 suggestions, group tap-to-vote) | Song Discovery | Core |
| Spin the Wheel (8 picks, animated random selection) | Song Discovery | Core |
| Genre momentum in suggestions (avoid repetition) | Song Discovery | Core |
| Optional auth (Google/Facebook OAuth via Firebase) | All personas | Core |
| Guest join preserved as default (name-only, upgradeable) | All personas | Core |
| Session summary persistence (PostgreSQL at party end) | All personas | Core |
| Party history for authenticated users | Linh (host return), Duc (content) | Core |
| Media ownership (captures linked to user profile) | Duc, Minh | Core |
| Guest media expiry (7-day access via session link) | All personas | Core |

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

**5. YouTube Lounge API Integration** (Core Technical Innovation — discovered via brainstorming)
The YouTube TV pairing code (which users already enter to control the queue from their YouTube app) can be used by third-party apps via the reverse-engineered YouTube Lounge API. This enables: passive song detection (nowPlaying events return video_id), queue control (addVideo/insertVideo push songs to TV), and session binding — all without the user doing anything beyond entering the code they already know. Multiple open-source libraries exist (Node.js: youtube-remote, yt-cast-receiver; Python: pyytlounge; Go: ytcast). Risk: unofficial API, could break.

**6. Intersection-Based Suggestion Engine** (Product Innovation)
Song suggestions are not random or popularity-based. The engine computes: (songs the group listens to ∪ songs the group has sung) ∩ songs with karaoke versions on YouTube. Ranked by group overlap count (how many friends know the song), genre momentum (avoid repetition), and session history (unsung songs prioritized). This solves the core "what should we sing?" decision fatigue that plagues every karaoke night. The app doesn't ask "think of a song" — it says "here are songs you all know."

### Validation Approach

| Innovation | Validation Method | Target | Fallback |
|-----------|------------------|--------|----------|
| DJ Engine (core bet) | Dead air incidents + qualitative flow metric | <2 dead air/session, >70% "felt continuous" | Increase host override prominence — let humans MC |
| Memory-as-marketing | Share intents per session + share destination tracking | >1 share/session, public shares growing MoM | Invest in setlist poster design before assuming concept is wrong |
| Participation-over-talent | Non-singer engagement + session completion | 70%+ of singer weighted score, stay through finale | Add interlude variety, lower engagement ladder first rung |
| Lounge API integration | Song detection accuracy + queue push success | >90% songs detected, >95% queue pushes succeed | Manual song entry fallback, karaoke catalog search |
| Suggestion engine | Group recognition of suggested songs | >70% of Quick Pick suggestions recognized by 2+ members | Broaden karaoke catalog, fall back to Karaoke Classics |

**Qualitative flow metric:** Post-session — "Did tonight feel like one continuous experience or separate activities?" Binary. Target: >70% continuous.

### Risk Mitigation

**Innovation stacking reframed:** Only the DJ engine is a genuine technical innovation. The other three are design decisions executed well or poorly. One bet, not four.

**DJ Engine specific risks:**

1. **Combinatorial explosion** — 12+ states, 30+ transitions, guard conditions on each. Mitigation: formal state diagram with every transition, guard, and timeout BEFORE writing code. Unit test every transition. 100% coverage justified here.
2. **Physical-digital mismatch** — DJ cycles while group takes food breaks, steps outside, or sings back-to-back songs. Mitigation: pause meta-state (host-triggered + auto-pause at 90s inactivity) with clear resume-vs-advance logic decided in state diagram.
3. **Correctness ≠ flow** — State machine can be bug-free but feel robotic. Mitigation: sound design and transition animations turn correct state changes into perceived flow. Test state machine for correctness AND experience for continuity.

**Pre-development requirements:** See Pre-Development Gates in Project Scoping for the full non-negotiable checklist. Key items driven by innovation risk: formal DJ state diagram, pause/resume logic, setlist poster design, and 6 core test scenarios (happy path, host override in every state, disconnect/reconnect in every state, minimum players, rapid transitions, timeout cascade).

## Mobile App Specific Requirements

### Platform Support

| Platform | Priority | Min Version | Notes |
|----------|----------|-------------|-------|
| Android | Primary (60-70%) | Android 8.0 (API 26) | Dominant in Vietnam market |
| iOS | Primary (20-30%) | iOS 15.0+ | Covers 95%+ of active iPhones |

**Framework:** Flutter (Dart) — single codebase for both platforms.

**Web Landing Page:** Lightweight static page (HTML/JS) hosted alongside the server. Handles QR code scan / party code entry, detects platform, deep-links into the installed app via Universal Links (iOS) / App Links (Android), or redirects to App Store / Google Play if the app is not installed.

### Technical Architecture Considerations

**Server-Authoritative Model**
- DJ engine state machine lives on server — all phones are thin clients
- WebSocket connections (via socket_io_client Flutter package) with adaptive heartbeat: 5s during active states, 15s during song state (battery optimization)
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
- Ceremony reveal: server triggers award generation and pushes reveal to all devices simultaneously
- All timing server-controlled — no client clock dependency

**Deployment Model**
- Server: Single VPS or Railway/Fly.io — single process Node.js with WebSockets
- Client: Flutter app distributed via App Store and Google Play. TestFlight / internal testing track for MVP friend group testing before public release
- Web landing page: Static files served from same Railway deployment or CDN
- Ceiling: ~10,000-50,000 concurrent connections = 1,250-6,250 concurrent parties at 8 phones/party
- MVP expectation: 5-10 concurrent parties. Document the wall, don't architect past it

**Audio Architecture**
- Native audio playback via Flutter audio packages (e.g., just_audio or audioplayers)
- No browser AudioContext restrictions — audio plays immediately on any user interaction
- Host phone designated as primary audio source for ceremony fanfares and big moments
- Other phones play reaction sounds at lower volume or visual-only for big sync moments
- 6-10 core sound assets bundled with the app

**Screen Wake Lock Strategy**
- Native wake lock via wakelock_plus Flutter package — uniform across iOS and Android
- During song state: release wake lock, LET screen lock — user is watching karaoke screen
- Ceremony reveal is instant — no voting window needed

**Media Capture Architecture**
- Native camera/microphone access via Flutter camera and record packages — uniform behavior on both iOS and Android
- No browser capability differences — photo, video (5s max), and audio capture all work inline on both platforms
- Background upload via Flutter background task handling

### Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| App Launch (cold) | <3s | App icon tap → party lobby rendered |
| App Launch (warm) | <1.5s | App already in memory |
| App Install Size | <50MB | Including audio assets |
| WebSocket Connect Time | <500ms | After app launch |
| Audio Asset Load | Instant | Bundled with app, no network fetch |
| Memory Usage | <80MB | 2-hour session, no memory leak |
| Battery Impact | <12%/hr | Adaptive heartbeat + wake lock release during song state |

**Battery optimization strategy:** Flutter renders only during active states (ceremony animations, reaction rendering), idle during song state. Adaptive WebSocket heartbeat (5s active → 15s song). Wake lock release during song state.

### Layout & Touch Design

- **Single target: mobile portrait.** No desktop, no tablet, no landscape
- Design for screen widths 320px (iPhone SE) to 428px (iPhone 14 Pro Max)
- Touch targets: minimum 48x48px, prefer 56x56px+ (drunk-user-friendly)
- Font sizes: minimum 16px body text

### Implementation Considerations

**Out of scope:** Desktop app, web app (beyond the join landing page), tablet layout.

**Critical dev-time investments:**
1. **WebSocket reconnection** — three-tier model, tested on both platforms with airplane mode toggle, screen lock/unlock, app backgrounding/foregrounding
2. **Battery optimization** — adaptive heartbeat, wake lock management. Test 2-hour sessions on 3-year-old Android
4. **Deep linking** — Universal Links (iOS) + App Links (Android) for QR code join flow. Test on both platforms with app installed and not installed
5. **App store submission** — Apple review process can take days. Plan TestFlight distribution for MVP friend group testing

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Experience MVP — prove the core loop (join → react → ceremony → interlude → repeat) AND the song discovery loop (paste playlists → suggestions → Quick Pick / Spin the Wheel → auto-queue on TV) create a compelling party experience with one real friend group. One night, one karaoke room, one group that says "we're doing this again."

**Resource Requirements:** Solo developer, ~8 weeks (Sprint 0-6). No designer on staff — invest design time in setlist poster and ceremony flow mockups before dev. Additional time accounts for Flutter project setup, deep-link configuration, and app store submission pipeline.

### MVP Build Plan

The sprint plan below maps features from Product Scope into a build-order sequence. Features are ordered by dependency and testability gates.

**Core User Journeys Supported:**
- Linh (Host) — full happy path from party creation through finale
- Minh (Non-Singer) — reactions, soundboard, ceremony voting, interludes
- Duc (Performer) — pre-song hype, ceremony, moment cards
- Trang (Shy Joiner) — low-pressure entry through reactions and universal interludes
- The Group (Song Discovery) — TV pairing, playlist import, Quick Pick, Spin the Wheel, auto-queue
- Late Joiner — mid-session join with stats catch-up
- Disconnected User — basic reconnection with state sync

**Sprint 0 — Foundation + Design (6 days):**

| Day | Focus |
|-----|-------|
| 1 | DJ state diagram: every state, transition, guard, timeout. Two ceremony types (Full/Quick). Pause/resume logic. Bridge moments. Song Integration state additions (Quick Pick, Spin the Wheel, song-queued states) |
| 2 | Flutter project setup: monorepo structure, dependencies (socket_io_client, firebase_auth, firebase_storage, just_audio, camera, wakelock_plus), deep-link configuration (Universal Links + App Links), web landing page scaffold |
| 3 | Server scaffolding, WebSocket infra, session management. Firebase Auth setup (Google + Facebook OAuth providers), Railway PostgreSQL provisioning, DB schema design (users, sessions, session_participants, media_captures) |
| 4 | Setlist poster design mockup, ceremony flow mockup (all three weights) |
| 5 | Sound asset selection + testing (6 core sounds). Lounge API spike: pair with real YouTube TV, read nowPlaying, push a video to queue |
| 6 | Award template pool (20+ fun/random titles, context-driven: party card completion, reaction volume, song position). Karaoke Catalog: scrape top 3 karaoke YouTube channels, parse titles, build initial index |

**Sprint 1 — The Skeleton (1 week):**

Build order enforced — each depends on the previous:

| Order | Feature | Depends On | Why Non-Negotiable |
|-------|---------|------------|-------------------|
| 1 | DJ state machine with ALL states (including bridge moments, ceremony sub-states, pause, song selection states) + unit tests | Sprint 0 state diagram | THE core bet. Everything downstream depends on this |
| 2 | Party launch — create/join via QR/code (Flutter app + web landing page deep link, optional Firebase Auth or guest) | WebSocket infra + Firebase Auth | No join = no product |
| 3 | Host "Song Over!" trigger | DJ state machine | DJ can't know when physical songs end |
| 4 | Host controls overlay (next, skip, pause) | DJ state machine | Host must be able to override DJ |
| 5 | YouTube TV pairing via Lounge API (host enters TV code) + nowPlaying event listener + video_id → metadata pipeline | Server infra | Song Integration core — everything else in this feature depends on it |
| 6 | Suggestion-only mode fallback (FR92-FR95) | DJ state machine | App must work even without YouTube TV |

**Dry-testable at Sprint 1 end:** Can create party, join via deep link, pair with TV, detect songs playing, trigger state transitions, host can control flow.

**Sprint 2 — The Experience (1 week):**

| Feature | Why Non-Negotiable |
|---------|-------------------|
| Post-song ceremony with two types (Full/Quick) — award reveal, no voting | Core value moment. Variety prevents staleness |
| Live emoji reactions + streaks | Minimum audience participation |
| Soundboard (4-6 sounds, host = primary audio for big moments) | Room audio is the atmosphere. Native audio — no browser restrictions |
| Sound design (state transition audio cues) | How the room knows something changed |
| Pre-song hype card (bridge moment) | Duc's core value + physical-digital bridge |
| Party Cards system (19 cards, deal/accept/dismiss/redraw) | Core differentiator — transforms every performance |
| Lightstick mode + camera flash hype signal | Audience participation during songs beyond reactions |
| Icebreaker (first-60-seconds) | Sets the tone, gets everyone interacting |
| Prompted media capture (bubble UX, background upload) | Raw content pipeline for highlight reel. Uniform native capture on both platforms |
| Moment card with share intent | Only viral artifact in core launch |
| Screen Wake Lock (native API via wakelock_plus) | Without this, half the room misses ceremonies |
| Solo/empty party state ("works best with 3+ friends") | First-time host experience |
| Weighted participation tracking (backend only) | Foundation for awards and metrics |

**Dry-run test at Sprint 2 end** with 2-3 friends.

**Sprint 3 — Song Discovery + Polish (1 week):**

| Feature | Why This Sprint |
|---------|------------------|
| Playlist URL import (YouTube Music + Spotify public) | Cold start solution — seeds the suggestion engine |
| Spotify "Make Public" guidance UI | Required for Spotify private playlists |
| Intersection-Based Suggestion Engine (overlap ∩ karaoke catalog) | Core song discovery — "songs your group knows" |
| Quick Pick mode (5 suggestions, group vote, 15s auto-advance) | Primary song selection UX |
| Spin the Wheel mode (8 picks, animated wheel, veto) | Party-energy song selection UX |
| Lounge API queue push (selected songs auto-queue on TV) | Zero-friction from suggestion to TV screen |
| Genre momentum ranking | Prevents 5 ballads in a row |
| Karaoke Classics fallback (cold start, no playlists) | App works out of the box before anyone imports |

**Sprint 4 — Pre-Real-Session Polish (1 week):**

| Feature | Why After Dry Run |
|---------|------------------|
| Three-tier reconnection model (brief/medium/long) | Basic reconnect sufficient for dry run on wifi |
| Adaptive heartbeat (5s active / 15s song) | Battery optimization not critical for 1-hour test |
| Late-join catch-up card (current stats) | Dry run starts with everyone present |
| Democratic voting ("What's next?") | DJ random selection works for dry run |
| 3 interludes (Kings Cup, Dare Pull, Quick Vote) | Core engagement between songs |
| Front-loaded universal interludes (first 30 min) | Maximum group inclusion for shy joiners |
| Basic moment capture (prompted screenshots) | Nice-to-have for first test |
| End-of-night ceremony + setlist poster | Critical for real session |
| Awards algorithm (non-singing recognition, party card completion) | Needs real session data to tune |
| Session summary write to PostgreSQL at party end | Persistence pipeline — needs real session to validate |
| Guest-to-account upgrade flow | Must be seamless mid-session |
| Party history view for authenticated users | Cross-session value proposition |
| Media ownership linking (authenticated captures → user profile) | Media gallery depends on auth |
| Guest media 7-day expiry + signed URLs | Non-authenticated media access |

**Sprint 5 — App Distribution + Pre-Test Polish (5 days):**
- TestFlight (iOS) and internal testing track (Android) distribution to friend group
- Deep-link end-to-end testing: QR scan → web landing page → app opens with party code
- App store listing prep (screenshots, description, privacy policy)
- Bug fixes from dry run
- Host QR re-display mid-session (for late joiners)
- Group sing-along mode
- Event stream instrumentation for all KPIs

**Sprint 6 — Real World Test (5 days):**
- Real karaoke night with friends. Screen record on 2-3 phones
- Test Song Integration end-to-end: TV pairing → playlist import → Quick Pick → auto-queue → song plays → game engine receives metadata
- Test suggestion-only mode at a non-YouTube venue (if available)
- Bug fixes from real session
- North Star prompt ("Would you use Karamania next time?")
- Submit to App Store and Google Play if go/no-go passes

### Two Ceremony Types

The DJ varies ceremony format to prevent staleness across 10+ songs per night. Ceremonies are celebrations, not competitions — no performance voting or scoring.

| Type | Duration | Flow | When DJ Uses It |
|--------|----------|------|----------------|
| **Full** | 8-10s | Award reveal animation → moment card → share prompt | First 2-3 songs, post-challenge, song after interlude |
| **Quick** | 3-5s | One-liner award flash → brief animation | Mid-session songs, back-to-back performances |

Host can skip any ceremony to keep momentum. DJ type selection logic: never two Full ceremonies in a row. Default to Quick after song 5. Full triggered by: first song, song after interlude, party card challenge completion.

**Award generation logic:** Awards are driven by session context, not audience votes. Inputs: party card accepted/completed, reaction volume during song, song position in session, performer's cumulative stats. Output: fun/random award title from a pool of 20+ templates.

### Risk Mitigation Strategy

**Technical Risks:**

| Risk | Severity | Mitigation |
|------|----------|------------|
| DJ state machine complexity (12+ states, 30+ transitions) | High | Formal state diagram before coding. 100% unit test coverage. Build skeleton Sprint 1 — test before layering experience |
| App backgrounding kills WebSocket | Medium | Flutter background execution + three-tier reconnection. Test on both platforms with screen lock cycles |
| Physical-digital mismatch (DJ cycles during breaks) | Medium | Pause meta-state + 90s inactivity auto-pause |
| Budget Android performance | Medium | Flutter profile mode testing, adaptive heartbeat, test on 3-year-old devices |
| App store review delays | Medium | Use TestFlight / internal track for MVP friend group testing. Submit to stores early, iterate via updates. Plan 1-3 day review buffer for iOS |
| Deep-link reliability across OS versions | Medium | Test Universal Links (iOS) and App Links (Android) on min supported versions. Fallback: web landing page shows manual party code entry + "Open App" button |
| Requiring app download adds friction to join | Medium | Accepted tradeoff for native benefits. Mitigate with clean web landing page, fast app store redirect, and small app size (<50MB) |
| YouTube Lounge API is unofficial — could break | High | Abstract behind interface so detection method is swappable. Suggestion-only mode (FR92) as graceful fallback. Monitor open-source libraries (pyytlounge, youtube-remote) for breaking changes. Audio fingerprinting as future backup |
| Karaoke video title parsing varies by channel | Medium | Fuzzy-match against karaoke catalog index. Cross-reference with MusicBrainz for validation. Build parser test suite against top 3 karaoke channels |
| Spotify Dev Mode 5-user OAuth limit | Low | Avoided entirely — use Client Credentials flow for public playlists only. "Make Public" guide for private playlists. No user OAuth needed |
| Venue does not use YouTube for karaoke | Medium | Suggestion-only mode (FR92-FR95). App still provides full playlist import, suggestions, Quick Pick, Spin the Wheel — just no auto-queue or passive detection |
| Firebase Auth adds friction to join flow | Medium | Auth is optional — guest join remains default and primary path. Auth prompt is non-blocking, positioned as "save your stats" after first session. Never gate in-session features behind auth |
| Flutter ecosystem maturity for real-time apps | Low | Socket.io client, Firebase, and audio packages are well-maintained. Server remains Node.js — Flutter is client-only |
| PostgreSQL write failure at session end | Medium | 3 retries with exponential backoff. Fallback: log to server disk for manual recovery. Session data is never lost |
| Guest-to-account upgrade disrupts session | Low | WebSocket stays connected during native OAuth flow. Server links existing session token to new Firebase UID atomically |

**Market Risks:**

| Risk | Severity | Mitigation |
|------|----------|------------|
| Low initial adoption (need a group) | High | Target friend group organizers. Frictionless host experience |
| Ceremony staleness after 3rd repetition | High | Two ceremony types (Full/Quick). 20+ award templates context-driven. DJ varies type by night position. Host can skip any ceremony |
| Nobody shares content (flywheel doesn't spin) | High | Invest design time in setlist poster. Track share intents from week 1 |
| Incumbent response (KaraFun/Smule) | Low-Medium | First-mover + deep gamification hard to bolt on |

**Resource Risks:**

| Risk | Severity | Mitigation |
|------|----------|------------|
| Solo developer bottleneck | Medium | Keep it boring — single server process, no microservices. Flutter single codebase for both platforms |
| Scope creep during development | Medium | Sprint plan is the contract. If behind, cut from Sprint 3, never Sprint 1-2 |
| Sprint 0 rushed (state diagram incomplete) | Medium | Protected 6-day Sprint 0. State diagram and Flutter scaffold are non-negotiable gates |

**Pre-Development Gates (non-negotiable before coding):**
1. Formal DJ state diagram with every state, transition, guard, timeout — including two ceremony types (Full/Quick), pause/resume logic, and song selection states (Quick Pick, Spin the Wheel, song-queued)
2. Setlist poster design mockup (screenshot-worthy, Instagram Story-ready)
3. Ceremony flow mockup for both types (Full/Quick) — award reveal animation, no voting UI
4. 6 core sound assets curated and tested
5. Award template pool: 20+ fun titles, context-driven (not score-based)
6. Pause/resume logic decided (resume interrupted state vs advance to next)
7. YouTube Lounge API spike: successful pairing with real YouTube TV, confirmed nowPlaying event reception, confirmed addVideo queue push. Document the exact API flow and library choice
8. Karaoke Catalog Index: initial scrape of top 3 karaoke YouTube channels, title parsing validated against 100+ sample titles, stored and queryable
9. Firebase project created with Google + Facebook OAuth providers configured and tested
10. Railway PostgreSQL provisioned with initial schema: users, sessions, session_participants, media_captures tables
11. Flutter project scaffold with deep-link configuration verified on both iOS and Android (Universal Links + App Links)
12. Web landing page deployed and tested: QR scan → detect platform → deep link into app OR redirect to app store

## Functional Requirements

### 1. Party Management

- **FR1:** Host can create a new party session and receive a unique QR code and 4-digit party code
- **FR2:** Guest can join an active party by scanning a QR code or entering a party code — QR codes open a web landing page that deep-links into the installed Flutter app or redirects to the app store for first-time users
- **FR3:** Guest can enter a display name to identify themselves in the party (no account required)
- **FR4:** All participants can see a live party lobby showing who has joined and the current player count
- **FR5:** Host can start the party when ready, transitioning all connected phones to the first activity
- **FR6:** Guest can join a party mid-session and receive a catch-up summary of current party stats
- **FR7:** Host can re-display the QR code and party code at any point during an active session
- **FR8:** System displays a waiting state when fewer than 3 players are present, showing current player count, a QR code, and a share prompt to invite more participants
- **FR53:** System provides visual feedback within 200ms during the join process showing party status and player count before the WebSocket connection is fully established
- **FR106:** Web landing page detects the user's platform (iOS/Android), checks if the app is installed via Universal Links / App Links, and either deep-links into the app with the party code pre-filled or redirects to the appropriate app store with a "Download to join the party" message
- **FR107:** Web landing page allows manual party code entry for users who type the URL directly (not via QR scan)

### 2. DJ Engine & Party Flow

- **FR9:** System automatically cycles through activity states (party card deal → song → ceremony → interlude → volunteer/vote → repeat) without manual intervention, governed by a formal state diagram with defined transitions, guards, and timeouts
- **FR10:** System provides bridge moment activities during physical-world transitions (first song prompt, song selection, mic handoff)
- **FR54:** System deals a random party card to the next singer during the pre-song state, selected from the curated pool of 19 cards. App auto-deals by default; host can override card selection or disable dealing for a turn
- **FR11:** System can enter a pause state, triggered by host action or by detecting 90+ seconds of inactivity across all users
- **FR12:** System resumes from pause to the next state in the DJ cycle (if mid-song → song, if mid-ceremony → ceremony, if mid-interlude → interlude) when host un-pauses or activity resumes
- **FR13:** System presents democratic voting with 2-3 options for the group to decide what happens next
- **FR14:** System selects ceremony type following defined rules: Full for first song and post-interlude songs, never two consecutive Full ceremonies, default to Quick after song 5. Host can skip any ceremony
- **FR15:** System front-loads universal participation activities in the first 30 minutes of a session
- **FR51:** System can run a first-session icebreaker activity that all participants complete with a single tap, with results visible to the group

### 3. Performance & Spotlight

- **FR16:** Host can signal that a song has ended via a persistent, always-visible trigger during song state
- **FR17:** System displays a pre-song hype announcement on all phones showing the next performer's name
- **FR18a:** System auto-generates a ceremony award title from a pool of 20+ templates, driven by session context: party card accepted/completed, reaction volume during song, song position in session, performer's cumulative stats. No audience voting or performance scoring
- **FR18b:** System generates a moment card combining performer name, song title, and award at the end of a Full ceremony
- **FR19:** System conducts a Quick ceremony: brief award flash with one-liner title and short animation
- **FR20:** Award templates cover a range of tones (comedic, hype, absurd, wholesome) selected contextually — not mapped to performance scores
- **FR21:** System supports group sing-along activities where all participants are included without individual spotlight

### 4. Audience Participation

- **FR22:** All participants can send emoji reactions during performances, visible within 100ms (per NFR2) on all connected phones
- **FR23:** System tracks reaction streaks and displays streak milestones at 5, 10, 20, and 50 consecutive reactions to the reacting user
- **FR24:** All participants can trigger soundboard effects (4-6 sounds) that play audibly through their phone speaker
- **FR25:** System plays the primary ceremony audio (fanfares, reveals) through the host's phone as the dominant audio source
- **FR26:** System plays a unique audio cue (minimum 4 distinct sounds: song start, ceremony start, interlude start, party card deal) for every DJ state transition, each at least 0.5s duration
- **FR27:** All participants can vote in democratic activity selection and song selection (Quick Pick, Spin the Wheel)
- **FR28a:** System supports a library of 3 interlude mini-games (Kings Cup, Dare Pull, Quick Vote) deployable by the DJ engine, selected via weighted random with no immediate repeats
- **FR28b:** MVP interlude library includes: Kings Cup (group rule card), Dare Pull (random dare assigned to random player), Quick Vote (binary opinion poll)

### 4b. Party Cards

- **FR55:** System maintains a curated pool of 19 party cards across three types: vocal modifiers (7 cards), performance modifiers (7 cards), and group involvement (5 cards)
- **FR56:** Vocal modifier cards: Chipmunk Mode (highest pitch possible), Barry White (deepest voice), The Whisperer (dramatic whisper), Robot Mode (monotone deadpan), Opera Singer (belt like La Scala), Accent Roulette (app assigns random accent), Beatboxer (add beatbox between lines)
- **FR57:** Performance modifier cards: Blind Karaoke (sing facing away from screen), Method Actor (full Broadway drama), The Statue (no body movement), Slow Motion (all movements slow-mo), The Drunk Uncle (wedding toast gone wrong), News Anchor (dead serious delivery), Interpretive Dance (every lyric gets a gesture)
- **FR58:** Group involvement cards: Name That Tune (group guesses song from intro), Backup Dancers (singer picks 2 people who must dance behind them), Crowd Conductor (singer directs who sings when during chorus), Tag Team (app picks random participant to take over at chorus), Hype Squad (app assigns 2 audience members who must stand and cheer the entire song)
- **FR59:** Singer can accept or dismiss a dealt party card with a single tap. Singer gets one free redraw per turn — after redraw, must accept or dismiss
- **FR60:** Group involvement cards (Tag Team, Backup Dancers, Hype Squad) select random participants and announce the selection on all phones. No consent flow — social dynamics handle opt-outs
- **FR61:** System tracks party card acceptance rate and challenge completion per session
- **FR62:** Completed party card challenges contribute to ceremony awards and weighted participation scoring (Engaged tier: 5 pts)

### 4c. Audience Participation Modes (During Song)

- **FR63:** During song state, audience participants can toggle between lean-in mode (reactions/soundboard) and lightstick mode (phone screen becomes a glowing visual prop)
- **FR64:** Lightstick mode renders a full-screen animated glow effect. User can change color. Free-form — no synchronization required between devices
- **FR65:** Audience participants can activate a camera flash/screen hype signal as real-time encouragement to the performer. Screen-based pulse effect with device flashlight activation (native API — works uniformly on both iOS and Android)
- **FR66:** Lightstick mode and hype signal are available alongside reactions — participants can switch between modes freely during a song

### 4d. Prompted Media Capture

- **FR67:** System displays a floating capture bubble at key moments: session start, reaction peaks (auto-detected spike in reaction rate), post-ceremony pause, and session end. Bubble is dismissable by ignoring it — no interruption to non-interested participants
- **FR68:** Any participant can pop the capture bubble to initiate a media capture: photo, video (5s max), or audio snippet. One-tap to pop, one-tap to start capture
- **FR69:** System captures photo, video, and audio inline using native device camera and microphone APIs — uniform behavior on both iOS and Android. Capture completes without navigating away from the app
- **FR70:** Captured media is tagged with session ID, timestamp, capture trigger type (peak/ceremony/manual), and current DJ state for future highlight reel assembly
- **FR71:** Media uploads are queued and sent in background — capture never blocks the party experience. Failed uploads retry automatically on next stable connection
- **FR72:** All captured media is stored server-side per session, accessible to all session participants post-session
- **FR73:** System auto-detects reaction peaks (sustained reaction rate spike above baseline threshold) and triggers a capture bubble on all phones. Peak detection logic is server-side to ensure consistent triggering

### 5. Song Integration & Discovery

#### 5a. TV Pairing & Song Detection

- **FR74:** Host can pair the app with a YouTube TV session by entering the TV pairing code displayed on the TV screen
- **FR75:** System connects to the YouTube TV session via the Lounge API and receives real-time nowPlaying events containing the current video_id
- **FR76:** System resolves each detected video_id to structured song metadata {title, artist, channel, thumbnail} via the YouTube Data API v3 within 5 seconds of song start
- **FR77:** System parses karaoke video titles (e.g., "Song Title - Artist (Karaoke Version)") into structured {song, artist} data using title parsing rules
- **FR78:** System can push songs to the YouTube TV queue via the Lounge API addVideo command — selected songs from Quick Pick or Spin the Wheel auto-queue on the TV without manual karaoke machine input
- **FR79:** System maintains the Lounge API session throughout the party. If the connection drops, the system attempts automatic reconnection for up to 60 seconds before prompting the host to re-enter the TV code

#### 5b. Playlist Import

- **FR80:** System detects the music platform from a pasted URL (music.youtube.com → YouTube Music, open.spotify.com → Spotify) and routes to the appropriate import handler
- **FR81:** System reads YouTube Music playlist contents via the YouTube Data API v3 using an API key (no user login required). Paginated retrieval for playlists with 50+ tracks
- **FR82:** System reads Spotify public playlist contents via the Spotify Web API Client Credentials flow (no user login required). App owner maintains a Spotify developer account
- **FR83:** When a Spotify playlist is private and cannot be read, the system displays a 3-step visual guide instructing the user to make their playlist public, then retry the paste
- **FR84:** System normalizes imported songs across platforms by matching on title + artist name. Duplicate songs from multiple friends' playlists are merged, with an overlap count tracking how many friends share each song

#### 5c. Karaoke Catalog & Suggestion Engine

- **FR85:** System maintains a pre-built Karaoke Catalog Index scraped from popular karaoke YouTube channels (minimum 10,000 tracks) containing {song, artist, youtube_video_id} for each entry
- **FR86:** System computes song suggestions as: (imported playlist songs ∪ previously sung songs) ∩ Karaoke Catalog Index — only songs with confirmed karaoke versions appear as suggestions
- **FR87:** System ranks suggestions by: (1) group overlap count — songs known by more friends rank higher, (2) genre momentum — if the last 3 songs were the same genre, bias toward a different genre, (3) not-yet-sung — songs not performed in the current session rank higher

#### 5d. Song Selection UX

- **FR88:** Quick Pick mode displays 5 AI-suggested songs as cards showing song title, artist, thumbnail, and group overlap badge (e.g., "4/5 know this"). All participants vote thumbs up or skip. First song to reach majority approval is selected. If no majority within 15 seconds, the highest-voted song wins
- **FR89:** Spin the Wheel mode loads 8 AI-suggested songs into an animated wheel. Any participant can tap SPIN. The wheel animates and lands on a song, which is auto-queued. Group gets one veto per round (re-spin)
- **FR90:** Participants can toggle between Quick Pick and Spin the Wheel modes at any time via a mode switch control. Quick Pick is the default mode
- **FR91:** When no playlists have been imported and no songs have been sung yet (cold start), the system falls back to suggesting songs from the Karaoke Classics subset of the catalog (top 200 universally known karaoke songs)

#### 5e. Non-YouTube Venue Fallback

- **FR92:** If the host skips TV pairing (venue does not use YouTube for karaoke), the app operates in suggestion-only mode: playlist import, suggestion engine, Quick Pick, and Spin the Wheel all function normally, but songs are not auto-queued on the TV and passive song detection is disabled
- **FR93:** In suggestion-only mode, when a song is selected via Quick Pick or Spin the Wheel, the app displays the song title and artist prominently so the group can manually enter it into whatever karaoke system the venue uses
- **FR94:** In suggestion-only mode, the host can manually mark a song as "now playing" from the suggestion list, enabling the game engine to receive song metadata for challenges and genre-based mechanics
- **FR95:** TV pairing is optional at party creation — the host can start a party without pairing and add the TV connection later if desired

### 5f. Authentication & Identity

- **FR96:** System offers optional sign-in via Google or Facebook OAuth (Firebase Auth) on the join screen. Users can also join as a guest with name-only entry — the default path
- **FR97:** Guest users can upgrade to a full account at any point during or after a session without losing any session data, participation scores, or captured media
- **FR98:** Authenticated users have a persistent profile storing display name, avatar (from OAuth provider), and account creation date
- **FR99:** On party end, the system writes a session summary to PostgreSQL containing: session ID, date, venue (if entered), participant list, song list, awards, participation scores, and party card stats
- **FR100:** Authenticated users can view their party history — a chronological list of past sessions with date, venue, participant count, personal awards, and personal stats (songs sung, participation score, top award)
- **FR101:** Media captures (photos, video clips, audio snippets) from authenticated users are linked to their user profile and accessible via a personal media gallery post-session. Guest captures are linked to session ID only and accessible to all session participants for 7 days
- **FR102:** All media is stored in Firebase Storage, organized by session ID and tagged with capturing user ID (if authenticated). Authenticated users retain access to their captures indefinitely; guest session media expires after 7 days
- **FR103:** System writes session summary to PostgreSQL within 30 seconds of party end. If the write fails, the system retries up to 3 times with exponential backoff. If all retries fail, session data is logged to server disk for manual recovery
- **FR104:** Authenticated host creating a party is recorded as the session owner. Session ownership enables future features (re-share setlist poster, view full session stats, manage session media)
- **FR105:** WebSocket handshake validates Firebase JWT for authenticated users. Guest users receive a server-issued session-scoped token. Both token types grant identical in-session permissions — auth status affects persistence only, never in-party capabilities

### 6. Host Controls

- **FR29:** Host has a persistent floating action button (bottom-right corner) that expands to a control overlay within 1 tap, providing party control without leaving the participant experience
- **FR30:** Host can skip the current activity and advance to the next DJ state
- **FR31:** Host can manually pause and resume the DJ engine
- **FR32:** Host can override the DJ's next activity selection
- **FR33:** Host can access skip, pause, queue management, kick player, and end party controls from the overlay (FR29) without navigating away from the participant view

### 7. Memory & Sharing

- **FR34:** System generates a shareable moment card for each Full ceremony containing performer name, song title, and award
- **FR35:** Participant can share a moment card via native mobile share sheet
- **FR36:** System generates an end-of-night setlist poster showing all songs, performers, date, and awards
- **FR37:** Participant can share the setlist poster via native mobile share sheet
- **FR38:** System prompts participants to capture moments via the floating capture bubble (see FR67) at 4 defined trigger points: session start, reaction peaks (FR72 threshold), post-ceremony reveals, and session end
- **FR39:** Any participant can manually initiate a media capture at any time via a persistent capture icon in the participant toolbar — independent of the bubble prompt system
- **FR52:** System orchestrates an end-of-night finale sequence in 4 steps: (1) highlight awards reveal with animation, (2) session stats summary (songs, reactions, participation), (3) setlist poster with share prompt, (4) one-tap post-session feedback ("Would you use again?" 1-5 scale) — total finale duration 60-90 seconds

### 8. Session Intelligence & Analytics

- **FR40:** System tracks weighted participation scores for each user across three tiers (passive: 1pt, active: 3pts, engaged: 5pts)
- **FR41:** System generates end-of-night awards recognizing both singing and non-singing contributions
- **FR42:** System logs every state transition, user action, and DJ decision as a structured event stream with schema: `{sessionId, userId, eventType, timestamp, metadata}`
- **FR43:** System presents a post-session North Star prompt ("Would you use Karamania next time?") during the finale ceremony
- **FR44:** System tracks share intent taps as a viral signal metric

### 9. Connection & Resilience

- **FR45:** System maintains real-time WebSocket connections between all participant phones and the server
- **FR46:** System detects participant disconnection via heartbeat monitoring and updates participant lists accordingly
- **FR47:** System automatically reconnects a disconnected participant within a 5-minute window and syncs them to the current DJ state within 2 seconds of reconnection without user action
- **FR48:** System preserves a participant's session history and participation scores through disconnection events
- **FR49:** System continues operating normally when any participant (including host) disconnects — DJ engine proceeds, votes count present participants only, host controls transfer to next-longest-connected participant after 60s host absence
- **FR50:** System prevents phone screen auto-lock during active participation states using native wake lock APIs

## Non-Functional Requirements

### Performance

- **NFR1:** DJ state transitions must propagate to all connected devices within 200ms of server-side state change
- **NFR2:** Emoji reactions must appear on all phones within 100ms of the originating tap
- **NFR3:** Soundboard audio must begin playback within 50ms of tap on the originating device
- **NFR4:** Ceremony award generation and reveal must complete within 3 seconds of the host triggering "Song Over!"
- **NFR5:** The app must maintain 60fps rendering and <100ms input response time with up to 12 simultaneously connected participants, each sending reactions at peak rate (2 taps/second)
- **NFR6:** Audio assets must be bundled with the app and playable within 50ms of trigger — no network round-trip on playback
- **NFR7:** App install size must remain under 50MB (including audio assets and Flutter runtime)
- **NFR26:** Event stream logging must be asynchronous and must not add more than 5ms latency to any user-facing operation
- **NFR27:** Ceremony award reveal must appear on all connected devices within a 200ms window of each other, using server-coordinated timing

### Reliability

- **NFR8:** The DJ engine must continue operating if any participant (including host) disconnects — zero single points of failure
- **NFR9:** A participant's reconnection after a brief network interruption (<5s) must complete without showing an error state or loading spinner — the participant's view resumes at the current DJ state
- **NFR10:** Session state must be fully recoverable from the server — no client-only state that would be lost on app restart
- **NFR11:** The system must handle concurrent democratic votes (activity selection, Quick Pick) from all participants without race conditions or vote loss
- **NFR12:** When participant count drops below 3, the system skips group interludes (Kings Cup, Dare Pull), disables party cards that require 3+ participants, defaults to Quick ceremony type, and continues DJ engine cycling with song → ceremony → song
- **NFR13:** On server restart, active sessions are gracefully terminated with a "session ended unexpectedly" message to all connected clients. Full session persistence and recovery deferred to v2
- **NFR28:** Client memory usage must not grow by more than 15MB over a 3-hour session with typical interaction patterns. No memory leaks in reaction rendering, ceremony animations, or WebSocket message handling

### Usability

- **NFR14:** All primary interactions (reactions, voting, soundboard) must be completable with a single tap on a target no smaller than 48x48px
- **NFR15:** No interaction in the app requires text input beyond the initial name entry
- **NFR16:** All participant-facing screens must be usable on first encounter without instructions — every interactive element uses standard mobile patterns (tap, swipe), icons include text labels, and new features show a single-sentence tooltip on first appearance only
- **NFR17:** All text and interactive elements must meet WCAG AA contrast ratio (4.5:1 for normal text, 3:1 for large text) against their backgrounds, verified in simulated low-light display conditions
- **NFR18:** State transitions must play a distinct audio cue (minimum 0.5s, unique per transition type: song start, ceremony start, interlude start, party card deal) audible at phone speaker volume — participants may be watching the karaoke screen, not their phone
- **NFR19:** Host controls must be accessible within 1 second from any participant screen state (no navigation required)
- **NFR20:** The app must not require any configuration, settings, or preferences from any participant — zero setup beyond name entry
- **NFR38:** All user-facing strings must be defined in a centralized string constants module (not hardcoded in widgets) to enable Vietnamese localization extraction in the fast-follow phase. Flutter's intl package structure recommended. Fonts must support Vietnamese diacritics (UTF-8)
- **NFR39:** Web landing page must load in <2s on 4G, be under 50KB total, and correctly handle deep-link routing on iOS 15+ and Android 8+. Graceful fallback to app store redirect when deep link fails

### Security

- **NFR21:** Party codes must expire after session end and not be reusable
- **NFR22:** For guest users, no personally identifiable information stored beyond display name and session participation data. For authenticated users, PII is limited to: display name, email, avatar URL (from OAuth provider), and session participation data. No additional PII collection beyond what the OAuth provider returns
- **NFR23:** Rate limiting on reaction and soundboard events: after 10 events in 5 seconds, each subsequent event earns 50% fewer participation points and visual feedback dims proportionally. No hard block — user can always tap, but reward and feedback diminish to near-zero after 20 events in 5 seconds. Resets after 5 seconds of inactivity
- **NFR24:** Session data must be isolated — no participant can access or affect another party's session
- **NFR25:** WebSocket connections must be authenticated to their session — a connection cannot inject events into a different party

### Authentication & Persistence

- **NFR34:** Firebase Auth JWT must be validated on WebSocket handshake for authenticated users. Guest users receive a server-issued session-scoped token with a TTL matching the maximum session duration (6 hours). Both paths must complete handshake within 500ms
- **NFR35:** Guest-to-account upgrade must complete without disconnecting the WebSocket, interrupting the current DJ state, or losing any accumulated session data. The upgrade flow must complete in under 5 seconds including native OAuth flow (Firebase Auth Flutter SDK)
- **NFR36:** PostgreSQL session summary writes at party end must not block the real-time party experience — writes are asynchronous and must complete within 5 seconds for sessions with up to 12 participants and 20+ songs
- **NFR37:** Media access control must enforce ownership: authenticated users can access only their own captures and captures from sessions they participated in. Guest session media is accessible to all session participants via a time-limited signed URL (7-day expiry)

### Song Integration

- **NFR29:** Playlist import must complete within 5 seconds for playlists of up to 200 tracks (including API call, parsing, and intersection matching against karaoke catalog)
- **NFR30:** YouTube Data API v3 usage must remain within the free tier quota of 10,000 units per day. Playlist reads (1 unit each) and video metadata lookups (1 unit each) must be batched efficiently — a typical party session must consume fewer than 500 quota units
- **NFR31:** If the YouTube Lounge API connection fails or becomes unavailable (unofficial API breakage), the system must degrade gracefully to suggestion-only mode (FR92) without crashing, losing session state, or interrupting the active party. Host sees a single non-blocking notification
- **NFR32:** Karaoke Catalog Index must be pre-built and stored server-side — catalog matching must not require live API calls during a party session. Catalog refresh happens offline on a weekly or configurable schedule
- **NFR33:** Spotify Client Credentials token must be managed server-side. Token refresh must happen automatically before expiry — no participant action required and no token exposure to the client

