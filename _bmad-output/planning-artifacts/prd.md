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

Karamania is a second-screen PWA companion that transforms group karaoke nights from interactive party experiences into full entertainment sessions. Users join via QR code scan — zero downloads, zero accounts — and their phones become participation devices: reactions, soundboards, voting, party card challenges, lightstick mode, song discovery, and mini-games that keep the entire room engaged before, during, and between songs.

**Core Differentiator:** The only product that runs alongside existing karaoke systems rather than replacing them — AND connects directly to the YouTube TV karaoke session via the existing TV pairing code. Eliminates music licensing, works at any venue, and creates genuine white space in a $7.5B market. Party Cards, audience participation modes, and a song discovery engine that eliminates "what should we sing?" decision fatigue turn every karaoke night into a complete entertainment experience.

**Core Innovation:** Two interconnected systems. (1) A server-authoritative DJ engine — a real-time state machine that automatically orchestrates party flow (party card deal → song → ceremony → interlude → repeat), eliminating dead air and freeing the host from MC duties. (2) A Song Integration Engine that pairs with the YouTube TV via the Lounge API, passively detects every song played, imports friends' playlists (YouTube Music + Spotify), and surfaces personalized suggestions through Quick Pick voting and Spin the Wheel — songs the group collectively knows that have karaoke versions available.

**Target Users:** Vietnamese friend groups (ages 20-35) at commercial karaoke venues in HCMC and Hanoi. Four personas: the overwhelmed host (Linh), the non-singer (Minh), the shy joiner (Trang), and the performer seeking audience (Duc).

**Business Model:** Free MVP. Memory-as-marketing flywheel — shareable setlist posters and moment cards ARE the acquisition channel. Premium features identified through usage data post-validation.

**MVP Strategy:** Solo developer. Prove the core loop with one real friend group. Success = "Would use again" >80%.

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
- Passive (1 pt): emoji tap, reaction view, lightstick mode active
- Active (3 pts): soundboard use, vote cast, moment capture tap, hype signal activation, party card redraw
- Engaged (5 pts): interlude game completion, ceremony vote, dare acceptance, party card challenge completion

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

- **Zero-friction party launch:** QR code / 4-digit code, PWA, no accounts, no downloads. Branded loading state with party lobby pre-rendered ("3 friends are waiting for you")
- **Live audience reactions:** Emoji reactions during performances, basic soundboard (air horn, applause, sad trombone, "OHHHH!"), real-time feed on all phones. Host phone as primary audio source for big ceremony moments
- **Party Cards system:** 19 curated singer challenges across 3 types — vocal modifiers (Chipmunk Mode, Barry White, The Whisperer, Robot Mode, Opera Singer, Accent Roulette, Beatboxer), performance modifiers (Blind Karaoke, Method Actor, The Statue, Slow Motion, The Drunk Uncle, News Anchor, Interpretive Dance), and group involvement (Name That Tune, Backup Dancers, Crowd Conductor, Tag Team, Hype Squad). App auto-deals one card per singer during pre-song state. Singer can accept, dismiss, or use one free redraw. Host can override. Group involvement cards pick random participants — no consent flow, social dynamics handle opt-outs
- **Audience participation modes during songs:** Participants toggle between lean-in mode (lyrics/reactions) and lightstick mode (phone becomes a glowing visual prop). Camera flash/screen hype signal available as real-time performer encouragement
- **Post-song ceremony:** Host taps "Song Over!" → 15-second crowd vote → auto-generated funny award → shareable moment card. Kills awkward post-song silence
- **Dumb DJ engine:** Server-authoritative state machine cycling Party Card Deal → Song → Ceremony → Interlude → Volunteer/Vote → Repeat. Randomized, not adaptive. Log every state change for future Smart DJ training data
- **Host controls:** Subtle floating overlay (Next, Skip, Pause). One-thumb operation. Host stays a player, never becomes a manager
- **Immersive sound design:** Web Audio API with pre-loaded buffers. State transition sounds for every DJ state change. Collective audio from all phones creates shared atmosphere
- **Icebreaker:** First-60-seconds activity all participants complete with a single tap, results visible to the group
- **Democratic voting:** 2-3 options surfaced by DJ engine, everyone votes, majority wins
- **Interlude games:** Kings Cup (group rule card), Dare Pull (random dare assigned to random player), Quick Vote (binary opinion poll). Front-loaded universal interludes in first 30 minutes for maximum group inclusion
- **Prompted media capture:** Floating capture bubble at key moments (session start, reaction peaks, post-ceremony, session end). Any participant pops the bubble to capture photo/video (5s max)/audio. Inline on Android, graceful degradation on iOS (photo inline, video via native picker). Background upload, tagged for future highlight reel assembly
- **End-of-night ceremony + setlist poster**
- **Song Integration & Discovery:** YouTube TV pairing via Lounge API (passive song detection + queue control), YouTube Music + Spotify playlist import (paste share URL), Karaoke Catalog Index (pre-scraped from popular karaoke YouTube channels), Intersection-Based Suggestion Engine (songs group knows ∩ karaoke catalog, ranked by overlap count + genre momentum), Quick Pick (5 AI suggestions, group tap-to-vote) + Spin the Wheel (8 picks, animated random selection) dual-mode song selection UX. Host pairs app with TV code → friends join room and paste playlist URLs → app builds shared song pool → suggestions flow automatically
- **Fast-follow (1-2 weeks after core):** Group sing-along mode, additional interlude games, moment capture enhancements

### Growth Features (Post-MVP)

v2 — "The Smart Party" (target: 6 months post-MVP)

- Adaptive DJ engine: energy signal reading, decision tree, three-act arc, DJ personality
- Moment Economy: unified earn/spend currency connecting all participation
- Hype combo system + power cards (Uno Reverse)
- Song Intelligence evolution: Snowball Effect (cross-session learning — each session makes suggestions smarter for the group), genre-based game triggers (song genre drives which challenges appear), session history influence on suggestions
- Smart interlude engine: 10+ games, contextual selection
- Engagement ladder + fair play balancer
- Apple Music playlist import support

### Vision (Future)

v3 — "The Memory Machine" (target: 12 months)
- Automatic Memory Machine with smart triggers + quality filters (builds on V1 prompted media capture pipeline — raw content already collected)
- Multi-phone sync capture, blooper reel, sound bite generator
- Morning-after highlight reel push notification (assembled from V1 captured media: photos, 5s video clips, audio snippets, tagged by session moment)
- Flutter native migration unlocks seamless video/audio capture on iOS (removes V1 graceful degradation constraints)
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

Tonight he scans the QR. Duc starts singing. Minh's phone shows a reaction bar — but he toggles to lightstick mode. His screen glows neon blue, swaying with his hand. Two others switch too. Three phones waving in a dark karaoke room. He switches back to reactions. Hits the fire emoji. Again. "3x HYPE!" flashes. He discovers the soundboard: air horn at the chorus drop. The sound cuts through the room. Everyone laughs. Then he hits the camera flash hype — his phone flashlight pulses. The room flickers.

Song ends. Ceremony pops. Minh votes, sees the award: "The Warm-Up Act." A capture bubble pops — reaction peak detected. Minh taps it, films a 5-second clip of Duc taking a bow. One tap, auto-uploads. Screenshots the moment card, sends it to the group chat.

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

Two songs later, the app deals a party card to the next singer: "Backup Dancers — pick 2 people!" The singer points at Trang and someone else. She doesn't have to sing. She just has to stand behind and move. Low stakes. She's laughing before the chorus starts.

Three songs later, Kings Cup: "Everyone who's been to Đà Lạt this year, sing the next chorus together." She looks around. Four hands up. The chorus hits. She mouths along. Not loud. But she's doing it.

An hour in. Group sing-along: a 2000s hit everyone knows. The whole room is singing. Trang is singing. She didn't volunteer. The room pulled her in. No name on screen. Just "everyone join in."

End of night: "The Silent Storm" — most consistent reactor who never took a solo spotlight. She posts it to Instagram: "apparently I'm a karaoke person now???"

### Journey 4: Duc — "The Night His Performance Became Content"

Three songs in, it's Duc's turn. His signature song. He tells Linh to hit play.

Every phone displays: "🎤 DUC IS UP NEXT" — a pre-song hype card bridging the physical moment of him walking to the mic. Then the party card deals: "Method Actor — perform like it's Broadway." Duc grins. Accepts. Countdown sound from the host's phone. The room quiets.

He sings — full theatrical gestures, dropping to one knee at the bridge, pointing at the audience during the chorus. Reactions pour in — fire emojis, hearts, the occasional laugh when he oversells a note. Minh hits the air horn twice at the chorus. Half the room is in lightstick mode, phones swaying. Duc can't see reactions (he's watching lyrics) but he can hear the soundboard cutting through and see the glow from the corner of his eye.

He finishes. Ceremony: "RATE DUC'S PERFORMANCE." Votes in. Reveal: 4.7/5. Award: "Vocal Assassin." A capture bubble floats in — post-ceremony trigger. Duc pops it, takes a selfie with the award still on screen. Moment card generates — song title, name, award, score, party card challenge completed, styled like a concert poster. Duc taps share. It's in the group chat before he sits down.

Two songs later, the app deals him "The Whisperer — sing the whole song as a dramatic whisper." Terrible. Hilarious. "The Whisperer" award. That card gets more shares than his good performance.

Next round: "Tag Team" card. Mid-chorus, Minh's name flashes on every phone — "TAG IN!" Minh jumps up, grabs the invisible mic, belts out three words, and sits back down. The room erupts.

End of night: "Performance of the Night." Setlist poster shows his name next to three songs. Posts to Instagram. Friend from another group DMs: "What app is that?"

### Journey 5: The Late Joiner — "Arriving to a Party Already in Progress"

9:30 PM. Party started at 8. Thảo walks in. Everyone's mid-song, phones out, laughing.

"Scan this!" Linh holds up her phone — QR accessible from host controls at any time, not just at party start.

Thảo scans. Enters name. The loading state: "Joining the party... 8 friends are already here." She lands mid-session and sees a catch-up card with current stats: "8 friends here, 5 songs so far, current award leader: Minh." Three seconds of context. She's oriented.

Current song ends. Ceremony fires. Thảo votes — full participant immediately. Next interlude, her name is in the pool. She gets a dare within 5 minutes.

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
| Icebreaker (first-60-seconds) | Trang, Linh | Core |
| Real-time emoji reactions + streaks | Minh, Trang, Duc | Core |
| Soundboard with room audio | Minh, Duc | Core |
| Sound design (state transition audio cues) | All journeys | Core |
| Party Cards system (19 curated challenges) | Duc, Trang, Minh | Core |
| Lightstick mode (phone-as-prop during songs) | Minh, Duc | Core |
| Camera flash/screen hype signal | Minh | Core |
| Post-song ceremony (vote + award + card) | All personas | Core |
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

**MVP Approach:** Experience MVP — prove the core loop (join → react → ceremony → interlude → repeat) AND the song discovery loop (paste playlists → suggestions → Quick Pick / Spin the Wheel → auto-queue on TV) create a compelling party experience with one real friend group. One night, one karaoke room, one group that says "we're doing this again."

**Resource Requirements:** Solo developer, ~7 weeks (Sprint 0-5). No designer on staff — invest design time in setlist poster and ceremony flow mockups before dev.

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

**Sprint 0 — Foundation + Design (5 days):**

| Day | Focus |
|-----|-------|
| 1 | DJ state diagram: every state, transition, guard, timeout. Three ceremony weights (Full/Quick/Skip). Pause/resume logic. Bridge moments. Song Integration state additions (Quick Pick, Spin the Wheel, song-queued states) |
| 2 | Server scaffolding, WebSocket infra, session management |
| 3 | Setlist poster design mockup, ceremony flow mockup (all three weights) |
| 4 | Sound asset selection + testing (6 core sounds). Lounge API spike: pair with real YouTube TV, read nowPlaying, push a video to queue |
| 5 | Award template pool (20+ titles, score-categorized). Karaoke Catalog: scrape top 3 karaoke YouTube channels, parse titles, build initial index |

**Sprint 1 — The Skeleton (1 week):**

Build order enforced — each depends on the previous:

| Order | Feature | Depends On | Why Non-Negotiable |
|-------|---------|------------|-------------------|
| 1 | DJ state machine with ALL states (including bridge moments, ceremony sub-states, pause, song selection states) + unit tests | Sprint 0 state diagram | THE core bet. Everything downstream depends on this |
| 2 | Party launch — create/join via QR/code (PWA, no accounts) | WebSocket infra | No join = no product |
| 3 | Host "Song Over!" trigger | DJ state machine | DJ can't know when physical songs end |
| 4 | Host controls overlay (next, skip, pause) | DJ state machine | Host must be able to override DJ |
| 5 | YouTube TV pairing via Lounge API (host enters TV code) + nowPlaying event listener + video_id → metadata pipeline | Server infra | Song Integration core — everything else in this feature depends on it |
| 6 | Suggestion-only mode fallback (FR92-FR95) | DJ state machine | App must work even without YouTube TV |

**Dry-testable at Sprint 1 end:** Can create party, join, pair with TV, detect songs playing, trigger state transitions, host can control flow.

**Sprint 2 — The Experience (1 week):**

| Feature | Why Non-Negotiable |
|---------|-------------------|
| Post-song ceremony with three weights (Full/Quick/Skip) + stagger model | Core value moment. Variety prevents staleness |
| Live emoji reactions + streaks | Minimum audience participation |
| Soundboard (4-6 sounds, host = primary audio for big moments) | Room audio is the atmosphere |
| Sound design (state transition audio cues) | How the room knows something changed |
| Pre-song hype card (bridge moment) | Duc's core value + physical-digital bridge |
| Party Cards system (19 cards, deal/accept/dismiss/redraw) | Core differentiator — transforms every performance |
| Lightstick mode + camera flash hype signal | Audience participation during songs beyond reactions |
| Icebreaker (first-60-seconds) | Sets the tone, unlocks AudioContext |
| Prompted media capture (bubble UX, background upload) | Raw content pipeline for highlight reel. Graceful degradation on iOS |
| Moment card with share intent | Only viral artifact in core launch |
| Screen Wake Lock (Chrome API + iOS video hack) | Without this, half the room misses ceremonies |
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

**Sprint 5 — Real World Test + Polish (5 days):**
- Real karaoke night with friends. Screen record on 2-3 phones
- Test Song Integration end-to-end: TV pairing → playlist import → Quick Pick → auto-queue → song plays → game engine receives metadata
- Test suggestion-only mode at a non-YouTube venue (if available)
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
| YouTube Lounge API is unofficial — could break | High | Abstract behind interface so detection method is swappable. Suggestion-only mode (FR92) as graceful fallback. Monitor open-source libraries (pyytlounge, youtube-remote) for breaking changes. Audio fingerprinting as future backup |
| Karaoke video title parsing varies by channel | Medium | Fuzzy-match against karaoke catalog index. Cross-reference with MusicBrainz for validation. Build parser test suite against top 3 karaoke channels |
| Spotify Dev Mode 5-user OAuth limit | Low | Avoided entirely — use Client Credentials flow for public playlists only. "Make Public" guide for private playlists. No user OAuth needed |
| Venue does not use YouTube for karaoke | Medium | Suggestion-only mode (FR92-FR95). App still provides full playlist import, suggestions, Quick Pick, Spin the Wheel — just no auto-queue or passive detection |

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
1. Formal DJ state diagram with every state, transition, guard, timeout — including three ceremony weights, pause/resume logic, and song selection states (Quick Pick, Spin the Wheel, song-queued)
2. Setlist poster design mockup (screenshot-worthy, Instagram Story-ready)
3. Ceremony flow mockup for all three weights (Full/Quick/Skip)
4. 6 core sound assets curated and tested
5. Award template pool: 20+ titles, categorized by score range
6. Pause/resume logic decided (resume interrupted state vs advance to next)
7. YouTube Lounge API spike: successful pairing with real YouTube TV, confirmed nowPlaying event reception, confirmed addVideo queue push. Document the exact API flow and library choice
8. Karaoke Catalog Index: initial scrape of top 3 karaoke YouTube channels, title parsing validated against 100+ sample titles, stored and queryable

## Functional Requirements

### 1. Party Management

- **FR1:** Host can create a new party session and receive a unique QR code and 4-digit party code
- **FR2:** Guest can join an active party by scanning a QR code or entering a party code in their browser
- **FR3:** Guest can enter a display name to identify themselves in the party (no account required)
- **FR4:** All participants can see a live party lobby showing who has joined and the current player count
- **FR5:** Host can start the party when ready, transitioning all connected phones to the first activity
- **FR6:** Guest can join a party mid-session and receive a catch-up summary of current party stats
- **FR7:** Host can re-display the QR code and party code at any point during an active session
- **FR8:** System displays a waiting state when fewer than 3 players are present, showing current player count, a QR code, and a share prompt to invite more participants
- **FR53:** System provides visual feedback within 200ms during the join process showing party status and player count before the WebSocket connection is fully established

### 2. DJ Engine & Party Flow

- **FR9:** System automatically cycles through activity states (party card deal → song → ceremony → interlude → volunteer/vote → repeat) without manual intervention, governed by a formal state diagram with defined transitions, guards, and timeouts
- **FR10:** System provides bridge moment activities during physical-world transitions (first song prompt, song selection, mic handoff)
- **FR54:** System deals a random party card to the next singer during the pre-song state, selected from the curated pool of 19 cards. App auto-deals by default; host can override card selection or disable dealing for a turn
- **FR11:** System can enter a pause state, triggered by host action or by detecting 90+ seconds of inactivity across all users
- **FR12:** System resumes from pause to the next state in the DJ cycle (if mid-song → song, if mid-ceremony → ceremony, if mid-interlude → interlude) when host un-pauses or activity resumes
- **FR13:** System presents democratic voting with 2-3 options for the group to decide what happens next
- **FR14:** System selects ceremony weight following defined rules: Full for first song and post-interlude songs, never two consecutive Full ceremonies, default to Quick after song 5, Skip available via host override
- **FR15:** System front-loads universal participation activities in the first 30 minutes of a session
- **FR51:** System can run a first-session icebreaker activity that all participants complete with a single tap, with results visible to the group

### 3. Performance & Spotlight

- **FR16:** Host can signal that a song has ended via a persistent, always-visible trigger during song state
- **FR17:** System displays a pre-song hype announcement on all phones showing the next performer's name
- **FR18a:** System collects crowd votes during a Full ceremony with a 15-second window, accepting votes as participants pick up their phones (staggered participation)
- **FR18b:** System auto-generates a ceremony award title from a categorized template pool: scores 1-2 map to comedic/ironic titles, 3 to neutral titles, 4-5 to praise titles
- **FR18c:** System generates a moment card combining performer details, award, and crowd score at the end of a Full ceremony
- **FR19:** System conducts a Quick ceremony: 10-second thumbs up/down poll with a one-liner reaction auto-generated from the vote split
- **FR20:** System generates award titles from a pool of 20+ templates, categorized by score range: 1-2 (comedic/ironic), 3 (neutral), 4-5 (praise) — random selection within the matched category
- **FR21:** System supports group sing-along activities where all participants are included without individual spotlight

### 4. Audience Participation

- **FR22:** All participants can send emoji reactions during performances, visible within 100ms (per NFR2) on all connected phones
- **FR23:** System tracks reaction streaks and displays streak milestones at 5, 10, 20, and 50 consecutive reactions to the reacting user
- **FR24:** All participants can trigger soundboard effects (4-6 sounds) that play audibly through their phone speaker
- **FR25:** System plays the primary ceremony audio (fanfares, reveals) through the host's phone as the dominant audio source
- **FR26:** System plays a unique audio cue (minimum 4 distinct sounds: song start, ceremony start, interlude start, party card deal) for every DJ state transition, each at least 0.5s duration
- **FR27:** All participants can vote in ceremony scoring and democratic activity selection
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
- **FR65:** Audience participants can activate a camera flash/screen hype signal as real-time encouragement to the performer. Screen-based pulse effect with optional device flashlight activation
- **FR66:** Lightstick mode and hype signal are available alongside reactions — participants can switch between modes freely during a song

### 4d. Prompted Media Capture

- **FR67:** System displays a floating capture bubble at key moments: session start, reaction peaks (auto-detected spike in reaction rate), post-ceremony pause, and session end. Bubble is dismissable by ignoring it — no interruption to non-interested participants
- **FR68:** Any participant can pop the capture bubble to initiate a media capture: photo, video (5s max), or audio snippet. One-tap to pop, one-tap to start capture
- **FR69:** System captures photo, video, and audio inline on browsers that support media recording APIs. On browsers without inline video/audio support, photo capture remains inline and video/audio falls back to device-native capture picker. Capture completes without navigating away from the app in all cases
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

### 6. Host Controls

- **FR29:** Host has a persistent floating action button (bottom-right corner) that expands to a control overlay within 1 tap, providing party control without leaving the participant experience
- **FR30:** Host can skip the current activity and advance to the next DJ state
- **FR31:** Host can manually pause and resume the DJ engine
- **FR32:** Host can override the DJ's next activity selection
- **FR33:** Host can access skip, pause, queue management, kick player, and end party controls from the overlay (FR29) without navigating away from the participant view

### 7. Memory & Sharing

- **FR34:** System generates a shareable moment card for each Full ceremony containing performer name, song title, award, and crowd score
- **FR35:** Participant can share a moment card via native mobile share sheet
- **FR36:** System generates an end-of-night setlist poster showing all songs, performers, date, and awards
- **FR37:** Participant can share the setlist poster via native mobile share sheet
- **FR38:** System prompts participants to capture moments via the floating capture bubble (see FR67) at 4 defined trigger points: session start, reaction peaks (FR72 threshold), post-ceremony reveals, and session end
- **FR39:** Any participant can manually initiate a media capture at any time via a persistent capture icon in the participant toolbar — independent of the bubble prompt system
- **FR52:** System orchestrates an end-of-night finale sequence in 4 steps: (1) top 3 awards reveal with animation, (2) session stats summary (songs, reactions, participation), (3) setlist poster with share prompt, (4) one-tap post-session feedback ("Would you use again?" 1-5 scale) — total finale duration 60-90 seconds

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
- **FR50:** System prevents phone screen auto-lock during active participation states on supported browsers

## Non-Functional Requirements

### Performance

- **NFR1:** DJ state transitions must propagate to all connected devices within 200ms of server-side state change
- **NFR2:** Emoji reactions must appear on all phones within 100ms of the originating tap
- **NFR3:** Soundboard audio must begin playback within 50ms of tap on the originating device
- **NFR4:** Ceremony vote collection must complete within exactly 15 seconds of server-side timer, regardless of client clock variations
- **NFR5:** The app must maintain 60fps rendering and <100ms input response time with up to 12 simultaneously connected participants, each sending reactions at peak rate (2 taps/second)
- **NFR6:** Audio assets must be pre-loaded and playable within 50ms of trigger after initial session load — no network round-trip on playback
- **NFR7:** Total JS bundle size must remain under 100KB gzipped (excluding audio assets)
- **NFR26:** Event stream logging must be asynchronous and must not add more than 5ms latency to any user-facing operation
- **NFR27:** Ceremony reveal must appear on all connected devices within a 100ms window of each other, using server-coordinated reveal timing (server sends reveal timestamp, clients schedule synchronized display)

### Reliability

- **NFR8:** The DJ engine must continue operating if any participant (including host) disconnects — zero single points of failure
- **NFR9:** A participant's reconnection after a brief network interruption (<5s) must complete without showing an error state, loading spinner, or page reload — the participant's view resumes at the current DJ state
- **NFR10:** Session state must be fully recoverable from the server — no client-only state that would be lost on page refresh
- **NFR11:** The system must handle concurrent ceremony votes from all participants without race conditions or vote loss
- **NFR12:** When participant count drops below 3, the system skips group interludes (Kings Cup, Dare Pull), disables party cards that require 3+ participants, reduces ceremony voting to pass/fail (no score), and continues DJ engine cycling with song → simple ceremony → song
- **NFR13:** On server restart, active sessions are gracefully terminated with a "session ended unexpectedly" message to all connected clients. Full session persistence and recovery deferred to v2
- **NFR28:** Client memory usage must not grow by more than 10MB over a 3-hour session with typical interaction patterns. No memory leaks in reaction rendering, ceremony animations, or WebSocket message handling

### Usability

- **NFR14:** All primary interactions (reactions, voting, soundboard) must be completable with a single tap on a target no smaller than 48x48px
- **NFR15:** No interaction in the app requires text input beyond the initial name entry
- **NFR16:** All participant-facing screens must be usable on first encounter without instructions — every interactive element uses standard mobile patterns (tap, swipe), icons include text labels, and new features show a single-sentence tooltip on first appearance only
- **NFR17:** All text and interactive elements must meet WCAG AA contrast ratio (4.5:1 for normal text, 3:1 for large text) against their backgrounds, verified in simulated low-light display conditions
- **NFR18:** State transitions must play a distinct audio cue (minimum 0.5s, unique per transition type: song start, ceremony start, interlude start, party card deal) audible at phone speaker volume — participants may be watching the karaoke screen, not their phone
- **NFR19:** Host controls must be accessible within 1 second from any participant screen state (no navigation required)
- **NFR20:** The app must not require any configuration, settings, or preferences from any participant — zero setup beyond name entry

### Security

- **NFR21:** Party codes must expire after session end and not be reusable
- **NFR22:** No personally identifiable information stored beyond display name and session participation data
- **NFR23:** Rate limiting on reaction and soundboard events: after 10 events in 5 seconds, each subsequent event earns 50% fewer participation points and visual feedback dims proportionally. No hard block — user can always tap, but reward and feedback diminish to near-zero after 20 events in 5 seconds. Resets after 5 seconds of inactivity
- **NFR24:** Session data must be isolated — no participant can access or affect another party's session
- **NFR25:** WebSocket connections must be authenticated to their session — a connection cannot inject events into a different party

### Song Integration

- **NFR29:** Playlist import must complete within 5 seconds for playlists of up to 200 tracks (including API call, parsing, and intersection matching against karaoke catalog)
- **NFR30:** YouTube Data API v3 usage must remain within the free tier quota of 10,000 units per day. Playlist reads (1 unit each) and video metadata lookups (1 unit each) must be batched efficiently — a typical party session must consume fewer than 500 quota units
- **NFR31:** If the YouTube Lounge API connection fails or becomes unavailable (unofficial API breakage), the system must degrade gracefully to suggestion-only mode (FR92) without crashing, losing session state, or interrupting the active party. Host sees a single non-blocking notification
- **NFR32:** Karaoke Catalog Index must be pre-built and stored server-side — catalog matching must not require live API calls during a party session. Catalog refresh happens offline on a weekly or configurable schedule
- **NFR33:** Spotify Client Credentials token must be managed server-side. Token refresh must happen automatically before expiry — no participant action required and no token exposure to the client

