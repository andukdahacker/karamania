---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
lastStep: 14
lastEdited: '2026-03-05'
editHistory:
  - date: '2026-03-05'
    changes: 'PRD alignment update: Added Party Cards System UX (deal flow, card categories, screen layout, timing rules). Added Song State modes (Lightstick Mode full-screen glow with color picker, Camera Flash Hype Signal with cooldown). Added Prompted Media Capture UX (floating capture bubble, pop-to-capture flow, iOS graceful degradation, background upload). Added Interlude Games UX (Kings Cup, Dare Pull, Quick Vote with screen layouts and interaction patterns). Updated core loop to include party_card_deal phase. Updated DJ state machine with party_card_deal state. Updated screen inventory (9→13 screens). Updated component inventory (18→26 components + new stores). Updated project scaffold, bundle analysis, mermaid diagrams, state transitions, reduced motion table.'
  - date: '2026-03-05'
    changes: 'Song Integration & Discovery update: Added complete Song Integration & Discovery UX section (TV pairing flow, playlist import UX, Intersection-Based Suggestion Engine, Quick Pick mode, Spin the Wheel mode, suggestion-only fallback). Added Journey 6 (Song Discovery flow). Replaced genre-tag-only Song Awareness section with full song intelligence system. Updated screen inventory (13→18 screens). Updated component inventory (26→34 components + new stores). Updated DJ state machine with song_selection states. Updated core loop, bundle analysis, component roadmap, project scaffold, state transitions, and timing patterns.'
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/product-brief-karaoke-party-app-2026-03-04.md'
  - '_bmad-output/planning-artifacts/research/market-karaoke-party-companion-research-2026-03-03.md'
  - '_bmad-output/analysis/brainstorming-session-2026-03-03.md'
  - '_bmad-output/analysis/brainstorming-session-2026-03-05.md'
documentCounts:
  prd: 1
  briefs: 1
  research: 1
  brainstorming: 2
  projectDocs: 0
project_name: 'karaoke-party-app'
author: 'Ducdo'
date: '2026-03-04'
---

# UX Design Specification karaoke-party-app

**Author:** Ducdo
**Date:** 2026-03-04

---

<!-- UX design content will be appended sequentially through collaborative workflow steps -->

## Executive Summary

### Project Vision

Karamania is a second-screen PWA companion that transforms group karaoke nights from passive singing sessions into interactive party experiences. Users join via QR code — zero downloads, zero accounts — and their phones become participation devices: reactions, soundboards, voting, ceremonies, song discovery, and mini-games that keep the entire room engaged between songs.

The app occupies genuine white space: no competitor serves as a companion layer for in-room group karaoke. By not playing music, Karamania sidesteps music licensing entirely and works at any venue. Two interconnected engines power the experience: (1) a server-authoritative DJ engine that automatically orchestrates party flow, eliminating dead air and freeing the host from MC duties, and (2) a Song Integration Engine that pairs with the YouTube TV via the Lounge API, passively detects every song played, imports friends' playlists, and surfaces personalized suggestions — eliminating "what should we sing?" decision fatigue.

Target market: Vietnamese friend groups (ages 20-35) at commercial karaoke venues in HCMC and Hanoi. MVP built by solo developer in ~7 weeks. Success metric: >80% "Would use again" post-session score.

### Target Users

**Primary Personas (Priority Order):**

1. **Linh — "The Party Starter" (Host):** 25, marketing coordinator. Organizes karaoke nights but burns out managing everything. Needs the app to run the party so she can be a guest at her own event. She is the acquisition bottleneck — every other persona is downstream of her decision to use the app. Has a unique triple-attention problem: watching the karaoke screen, watching friends, AND monitoring her phone for the "Song Over!" trigger.

2. **Minh — "The Hype Friend" (Active Non-Singer):** 23, design student. Loves the energy, doesn't sing. Currently disengages after song three. Needs participation tools (soundboard, reactions, hype streaks, interludes) that are just as engaging as singing. Proof the app works.

3. **Duc — "The Performer" (Spotlight Seeker):** 27, sales rep. Wants his performances to be events with crowd reactions, ceremony awards, and shareable moment cards. Content generator for the viral flywheel.

4. **Trang — "The Reluctant Star" (Shy Joiner):** 22, accounting student. Goes because friends drag her. Design litmus test: if the app works for Trang, it works for everyone. Needs an engagement ladder (reactions → voting → interludes → group anthem) with zero forced participation.

**Secondary:** Late joiners (mid-session onboarding with audio unlock fallback), disconnected users (transparent reconnection), solo host testing (first-time exploration).

**Design Principles from User Research:**
- Design for 60-70% room adoption, not 100%
- Minimum viable party size: 2-3 people must still be fun
- Group size variation: 4 friends vs. 12 colleagues are different experiences
- Battery consciousness: 2-3 hour sessions with WebSocket + Web Audio + screen-on

### Key Design Challenges

1. **Dual-Attention Environment & The Passive/Active Mode Paradigm:** The karaoke TV is the primary screen; the phone is secondary. This creates two fundamentally different interaction modes that every feature must be designed for:
   - **Passive mode** (during songs): Phone is face-down or in a pocket. Audio cues are the ENTIRE interface. Sound design must communicate state changes, prompt attention, and create atmosphere without any visual engagement. Reactions and soundboard are optional — users tap when moved to, not when prompted.
   - **Active mode** (ceremony, voting, interludes): Screen is primary. Users are looking and tapping. Visual design must be glanceable — instant comprehension in a dim room at arm's length. This is where transition animations, countdown timers, and tap interactions live.
   - Every feature must be tagged as passive-mode or active-mode, because the interaction patterns are fundamentally different.

2. **The Host's "Song Over!" Trigger — A Unique Dual-Attention Problem:** Linh has a triple-attention burden: karaoke screen, friends, AND her phone. The "Song Over!" button is the single most critical host interaction — it bridges the physical karaoke performance to the digital ceremony. This trigger must be: (a) impossible to miss when needed, (b) impossible to accidentally trigger during normal participation, and (c) operable with zero visual search time. This is a specific interaction design problem that requires dedicated exploration.

3. **Zero-Onboarding Requirement:** No tutorials, no instruction screens. Users are socializing, tipsy, and distracted. Every interaction must be self-evident. The icebreaker IS the onboarding — "Tap your favorite decade" teaches the app through play.

4. **Drunk-User-Friendly Interaction Design:** By mid-session, fine motor control degrades. All primary interactions require a single tap on targets no smaller than 48x48px (prefer 56x56px+). No text input beyond initial name entry. No precision, no multi-step flows.

5. **Choreographed Reveals — State Synchronization as UX:** When a ceremony reveals an award, all 8 phones must show the reveal within a 100ms window of each other. If Duc sees "Vocal Assassin" while Minh's phone still shows the voting screen, the collective room reaction is destroyed. Ceremony reveals and major DJ transitions must use server-coordinated reveal timing (server sends future timestamp, clients schedule synchronized display). The room reaction IS the product — desynchronized reveals kill the magic.

6. **Physical-Digital Synchronization:** The DJ engine cycles automatically while real-world events happen asynchronously (mic handoffs, food breaks, bathroom runs). Bridge moment activities and pause states must feel natural, not robotic. The 90-second inactivity auto-pause prevents the app from talking to an empty room.

7. **First-Tap Audio Unlock & Fallback Paths:** iOS Safari requires a user gesture to unlock AudioContext. The icebreaker tap serves as the audio activation event. However, late joiners who bypass the icebreaker and users who refresh the page need a fallback "tap to unmute" interaction. This is a core design requirement, not an implementation detail — audio is the app's primary communication channel in passive mode.

### Design Opportunities

1. **Transition Design as Core Differentiator:** The 2-second animated transitions + sound cues between DJ states are where the magic lives. A hard screen cut feels broken; a dramatic fanfare → countdown → reveal feels like a show. Design transitions BEFORE screens. The in-between moments matter more than the features themselves. All major transitions must be choreographed reveals with server-coordinated timing.

2. **Collective Audio Atmosphere:** 8 phones in a room, each playing synchronized sound effects — air horns, fanfares, crowd roars. The room becomes the speaker system. Host phone serves as primary audio for big ceremony moments. No existing product creates this multi-device audio experience. Audio design is the primary UX in passive mode — it must carry the entire experience when screens are face-down.

3. **Share-First Artifact Design:** Every post-song ceremony generates a moment card; every end-of-night produces a setlist poster. These are the primary acquisition channel — the PRD targets >1 share intent per session as a go/no-go gate. Artifacts must be designed as Instagram Story dimensions (9:16), pre-styled with the Karamania brand subtle but visible, and one-tap to native share sheet. Don't make users screenshot and crop. The share flow must be 2 taps or fewer from artifact → shared. 47% of Gen Z create karaoke content; meet them where they are.

## Core User Experience

### Defining Experience

The core experience of Karamania is **synchronized collective moments** — every phone in the room doing the same thing at the same time, creating a shared experience that transcends individual screens. The product's value is proven in the 15-second post-song ceremony: a fanfare erupts from 8 phones, a voting screen appears simultaneously, a countdown builds tension, and an award reveals in perfect sync. That collective gasp IS the product.

**The Core Loop:**
Song Selection (Quick Pick / Spin the Wheel) → Party Card Deal → Song (passive/lean-in mode) → "Song Over!" trigger → Ceremony (active mode) → Interlude/Vote → Song Selection → Party Card Deal → Song

Song Selection replaces the "what should we sing?" negotiation. The Suggestion Engine surfaces songs the group collectively knows that have karaoke versions — Quick Pick (5 cards, group votes, 15s auto-advance) or Spin the Wheel (8 picks, animated selection, one veto). Selected songs auto-queue on the YouTube TV via the Lounge API. No one types anything into the karaoke machine.

The Party Card Deal is a pre-song micro-moment: the DJ auto-deals a challenge card to the next singer. Accept, dismiss, or one free redraw — then walk to the mic. It adds unpredictability to every performance and gives the audience something to watch for ("Will they do the dare?").

The Song → Ceremony transition is the highest-priority interaction in the entire app. It's where dead air dies, content is born, and the room becomes connected. Every other feature exists to create the conditions for this moment to land repeatedly without losing its magic.

**The Invisible Engine:**
Beneath the loud moments, the DJ engine's quiet orchestration is what brings hosts back. Linh's "I haven't managed anything for 45 minutes" is the retention moment. The bridge activities during physical transitions (mic handoffs, song selection), the natural-feeling pauses, the auto-cycling that just keeps things moving — this invisible layer is the foundation. If the orchestration feels robotic, hosts reach for manual controls and become the MC again. Design quiet transitions with the same obsession as loud reveals.

### Platform Strategy

**Platform:** Mobile-only PWA, portrait orientation exclusively
**Viewport:** 320px (iPhone SE) to 428px (iPhone 14 Pro Max)
**Primary browsers:** Chrome Android (60-70% expected), iOS Safari (20-30%)
**Input:** Touch-only, single-tap interactions (except host "Song Over!" which uses long-press), no keyboard beyond name entry
**Connectivity:** Persistent WebSocket, aggressive reconnection, no offline mode (real-time multiplayer requires connection)
**Audio:** Web Audio API with pre-loaded buffers — audio is the mode-transition trigger, not a nice-to-have
**Install:** No app store, no download. QR scan → browser → playing. PWA "Add to Home Screen" optional, never required

**Platform Constraints Driving Design:**
- No push notifications (PWA limitation on iOS) — all engagement happens in-session
- No background audio (iOS kills it) — audio only while tab is active
- Screen Wake Lock varies by browser — Chrome API + iOS video hack during active states only
- 4G network in karaoke room basements — optimize for intermittent connectivity
- Budget Android devices dominant in Vietnam market — test on 3-year-old hardware. Share-worthy artifacts (moment cards, setlist posters) need defensive design: text truncation, dynamic font scaling, overflow handling for long display names. Test on worst device in the room, not the best

**Join Flow Timing Budget (target: under 30 seconds perceived):**
- QR scan → browser opens: 1-2s
- DNS + TLS + first byte: 1-2s on 4G
- HTML parse + JS load: 2-3s (<100KB gzipped)
- WebSocket connect: 0.5s
- Name entry: 5-10s (user time)
- Icebreaker render: immediate

The "3 friends are waiting for you" loading state is load-time camouflage — pre-render the lobby server-side so the first paint shows social proof before JS executes. Perceived speed matters more than actual speed.

### Effortless Interactions

**Join (must feel instant):**
QR scan → enter name → in the party. Two taps. Under 30 seconds perceived. The loading state shows "3 friends are waiting for you" — server-side pre-rendered social proof while assets load. The icebreaker fires immediately, teaching the app through play. No tutorial, no walkthrough, no "allow notifications" prompt.

**React (must feel instinctive):**
Single tap to send an emoji reaction. No selection menu for the primary reaction — tap the big button, emoji flies. Soundboard is 4-6 large buttons, always visible during song state. The phone is a game controller, not an app. Reaction UI designed for peripheral vision and quick glances — big, colorful, high-contrast, readable in a dim room at arm's length.

**Vote (must feel urgent):**
Ceremony voting appears with a countdown. One tap to rate. The countdown creates urgency; the stagger model ("Waiting for 2 more...") creates social pressure. No decision paralysis — options are simple (thumbs up/down for Quick, 1-5 scale for Full).

**Host "Song Over!" trigger (must be deliberate but fast):**
500ms long-press with a satisfying fill animation + haptic feedback. Deliberate enough to prevent accidental triggers during frantic reaction tapping, but faster than a confirmation dialog. The fill animation gives Linh visual confirmation she's triggering it — finger down, circle fills, release at full, ceremony fires. No undo needed because the gesture itself prevents accidents. This replaces a single tap to solve the accidental-trigger problem without adding friction.

**Host controls (must feel invisible):**
Other host controls (skip, pause, next) are a minimal expandable overlay. One-thumb operation. The host's screen looks like every other player's screen plus a subtle control layer. Host stays a player, never becomes a manager.

**Share (must feel immediate):**
Moment card appears → one tap → native share sheet. No cropping, no editing, no save-then-share. The artifact is pre-designed at 9:16 Instagram Story dimensions with the Karamania brand visible but not dominant. Two taps maximum from artifact to shared. Artifacts use defensive rendering: text truncation for long names, dynamic font scaling, overflow protection — ensuring share-worthiness across all device sizes and display name lengths.

### Critical Success Moments

**1. The First Ceremony (The Aha Moment)**
When the first song ends and every phone erupts simultaneously — this is when the room understands what Karamania is. Design the first ceremony of each session with an extra beat of suspense and a slightly longer reveal. However, the first ceremony tone must be **celebratory-neutral** — "THE FIRST SONG IS IN THE BOOKS!" rather than performance-quality-dependent praise. The first song might be terrible (someone picks a song they can't sing, bails halfway), and a grand "YOU WERE AMAZING" ceremony on a cringe performance creates embarrassment, not delight. Celebrate the milestone, not the quality. If the first ceremony doesn't make Trang look up from Instagram, the app has failed.

**2. Linh's 45-Minute Realization (The Retention Moment)**
The moment Linh realizes she hasn't managed anything for 45 minutes. This isn't a visible UI event — it's the absence of friction. The DJ engine cycled through activities, bridge moments filled physical transitions, and Linh just... played. This invisible success determines whether she creates a second party. Design the DJ flow so smooth that host intervention feels optional, not required.

**3. Minh's Hype Streak (The Engagement Proof)**
Minh hits a reaction streak, "MINH IS ON FIRE" flashes on his screen, and he leans in harder. This moment proves non-singers are first-class citizens. The participation weighting must be tuned so Minh's 200+ reactions and 30 soundboard hits earn comparable recognition to Duc's 3 songs. When the end-of-night awards crown Minh "Hype Lord," the app has delivered on its core promise.

**4. Trang's First Tap (The Engagement Ladder Working)**
Trang taps her first emoji reaction — one small heart during Duc's chorus. Nobody notices. Nobody calls it out. But the app tracks the *sequence of first actions*: first reaction timestamp, first vote timestamp, first interlude participation, first group moment. This progression data is essential — without event stream tracking of first-action sequences from day one, we'll never know if the engagement ladder works or if Trang just tapped a few things randomly. The ladder succeeds when Trang progresses from reaction → voting → interlude participation → group anthem without ever feeling pushed. Design for invisible progression, but instrument every rung.

**5. The Finale Crescendo (The Memory Moment)**
A three-beat ending: **(a)** Awards parade — each award slides in with a sound cue, 2-3 seconds each, building tempo; **(b)** Setlist poster reveal — dramatic pause, then the poster assembles on screen piece by piece (songs, names, date, venue); **(c)** The share moment + "Would you use Karamania next time?" — the emotional high point meets the business metric. This 60-second sequence is where memories crystallize. The finale must feel like concert closing credits — earned, emotional, and screenshot-worthy.

### Experience Principles

1. **The Room Is The Product, Not The Screen.** Every design decision optimizes for the collective room experience, not the individual phone experience. A feature that looks beautiful on one screen but doesn't create a shared moment has failed. Synchronized reveals, collective audio, room-wide reactions — the phone is a participation device, not a consumption device.

2. **Three Modes of Attention — Audio Bridges Them.** The app operates across three distinct attention modes, and audio is the trigger that transitions between them:
   - **Passive mode** (phone down, not engaged): Between-tap moments during songs. Audio cues are the only interface — they signal "something is about to happen, pick up your phone."
   - **Lean-in mode** (phone in hand, casually engaged): During songs. Users glance at reactions, tap emojis, hit soundboard buttons. Visual UI must be designed for peripheral vision — big, colorful, high-contrast, readable in a dim room at arm's length. Not sustained attention, quick glances.
   - **Active mode** (phone is primary focus): Ceremonies, voting, interludes. Full visual engagement with countdown timers, animations, and tap interactions.
   Audio triggers mode transitions (fanfare = "pick up your phone"). Visual is the engagement surface within each mode. The principle is not audio-over-visual — it's **audio to summon attention, visual to hold it.**

3. **Invisible When Working, Obvious When Needed.** The DJ engine should be felt, not seen. Host controls should disappear until the moment they're needed, then be instantly reachable. The app's greatest success state is when nobody is thinking about the app — they're thinking about the party.

4. **One Tap, Every Time (Except When Deliberateness Matters).** Every primary interaction resolves in a single tap. No multi-step flows, no confirmation dialogs, no dropdown menus. The one exception: the host's "Song Over!" trigger uses a 500ms long-press to prevent accidental activation during frantic reaction tapping. The phone is a game controller with big buttons. If a drunk person with one hand occupied can't use it, redesign it.

5. **Every Output Is Marketing — Defensively Designed.** Moment cards, setlist posters, award screens — every artifact the app generates must be share-worthy by default. No cropping, no editing, no "make it look good" step. But share-worthy also means *reliably rendered*: text truncation for long names, dynamic font scaling, overflow protection on budget Android viewports. The worst device in the room must produce the same quality artifact as the best. Design artifacts as content first, UI second.

6. **Anticipation Absorbs Imperfection.** Before every synchronized reveal, a brief anticipation phase (drumroll, screen dim, countdown pulse) serves dual purpose: it builds emotional tension AND absorbs technical timing differences between devices. If one phone's clock drifts 200ms, the anticipation phase masks the gap. The UX solution to a technical problem — design the drumroll before designing the reveal.

## Desired Emotional Response

### Primary Emotional Goals

**The Adaptive Emotional Core:**
Karamania's emotional tone is a chameleon — it flexes with the room rather than imposing a fixed personality. A kpop night feels ELECTRIC. A Vietnamese ballad session feels WARM. A dare-heavy comedy night feels ABSURD. The app's emotional output (award titles, sound cues, ceremony energy) spans this range by design. For MVP, variety is the adaptation — a pool of awards from hype to heartfelt, sound cues that lean energetic by default without clashing with mellow moments. The Smart DJ in v2 will tune adaptively; the Dumb DJ achieves range through randomized variety.

**Vietnamese Cultural Emotional Foundations:**
The emotional design is grounded in three Vietnamese social-emotional patterns specific to our primary market:

1. **Giữ thể diện (Face-Saving):** Vietnamese social culture is deeply face-conscious. Being publicly bad at something causes genuine social discomfort, not just mild embarrassment. Awards for non-volunteers and low-scoring performances must celebrate *character traits* ("Most Mysterious Energy," "The Cool Observer") rather than performance behaviors. The difference between "The Whisperer" (references the bad performance) and "Enigmatic Presence" (celebrates the person) is the difference between Trang laughing and Trang shutting down for the rest of the night.

2. **Không khí (Atmosphere/Vibe):** Vietnamese people explicitly talk about and manage the collective energy of a room — "Không khí hôm nay vui quá!" ("The vibe tonight is so fun!"). The app can tap into this cultural concept directly, making the room's energy a visible, nameable thing. "KHÔNG KHÍ IS RISING 🔥" isn't localization — it's validating what the room already feels using language they already use.

3. **Có qua có lại (Social Reciprocity):** In Vietnamese culture, giving someone else the spotlight is itself an emotionally positive act. When Minh hypes Duc's performance, the app should validate Minh's *supporter role* — not just as a non-singer finding something to do, but as someone contributing to the group's energy. The "Hype Lord" award should feel like recognition of generosity, not a consolation prize.

**Five Core Emotions (in priority order):**

| Priority | Emotion | Description | Proxy Metric | Target |
|---|---|---|---|---|
| 1 | **"We're all in this together"** (Belonging) | Synchronized ceremonies, collective audio, every phone erupting at once. The foundational emotional promise | Ceremony participation rate — % of connected users who vote | >70% per ceremony |
| 2 | **"I can't believe that just happened"** (Delight) | Surprise award reveals, unexpected dares, chaos of everyone tapping at once. Alive and unpredictable | Reaction velocity spikes — moments where >60% of room reacts within 3 seconds | Track frequency per session |
| 3 | **"I was PART of that"** (Recognition) | Minh crowned Hype Lord. Trang awarded Silent Storm. Every person's contribution mattered | Non-singer inclusion — post-session "Did you feel included?" for users who never sang | Binary, track % positive |
| 4 | **"I can just... enjoy this"** (Liberation) | Linh's relief. The DJ removes the burden of managing the night | Host override frequency — times host uses skip/pause/next per session | <3 overrides = liberation working |
| 5 | **"We have to do this again"** (Return intent) | The setlist poster in the group chat. Nostalgia driving return behavior | North Star metric — "Would you use again?" | >80% "Yes" |

### Emotional Journey Mapping

| Journey Phase | Primary Emotion | Design Driver | Measurement Signal |
|---|---|---|---|
| **Discovery** (friend shows QR) | Curiosity + low-stakes intrigue | "Scan this, trust me" — zero commitment, zero friction | Join conversion rate (QR views → joined) |
| **Join** (scan → name → in) | Instant belonging | "3 friends are waiting for you" — social proof before interaction | Time-to-join (<30s target) |
| **Icebreaker** ("Tap your decade") | Playful surprise | "Wait, THREE of you picked the 80s?!" — connection through discovery | Icebreaker completion rate (>90% target) |
| **First Song** (passive/lean-in mode) | Casual engagement | Reaction tapping feels optional, not obligatory. Low pressure | First-reaction timestamp per user |
| **First Ceremony** (the aha moment) | Collective astonishment | Every phone erupts simultaneously. "Wait, EVERYONE'S phone did that?!" | First ceremony vote participation rate |
| **Mid-Session Flow** (DJ cycling) | Sustained energy + variety | No two transitions feel the same. Surprises keep coming. No dead air | Dead air incidents (<2 per session) |
| **Peak Moment** (hype streak, dare, group anthem) | Electric connection | The room is alive. Every phone is an instrument. Collective energy peaks | Reaction velocity spike frequency |
| **Failure/Glitch** (disconnect, awkward pause) | Self-aware humor | "WELL THAT HAPPENED." The app laughs with you, never at you | Reconnection success rate + session continuation |
| **Finale** (awards + setlist poster) | Earned catharsis | Concert closing credits. Emotional crescendo. "That was the best night ever" | Finale completion rate (users present at end) |
| **Morning After** (group chat) | FOMO + nostalgia + pride | The poster makes outsiders jealous, insiders nostalgic, and the group proud | Share intent taps + share destination (group chat = nostalgia, public social = FOMO) |

### Micro-Emotions

**Emotions to Cultivate:**

| Micro-Emotion | Where It Lives | Design Mechanism |
|---|---|---|
| **Confidence** | Every tap | Immediate visual + audio feedback. No ambiguity about what happened |
| **Anticipation** | Pre-ceremony drumroll, countdown | The 2-3 seconds before a reveal. Suspense is an emotion we design |
| **Surprise** | Award reveals, dare assignments | Never predictable. 20+ award templates. Random dare targeting |
| **Validation** | Hype streaks, end-of-night awards | "MINH IS ON FIRE" — the app sees your contribution and says so |
| **Momentum** | DJ auto-cycling, bridge moments | Something is always about to happen. Forward motion never stops |
| **Warmth** | Group anthems, milestone celebrations | "THE FIRST SONG IS IN THE BOOKS!" — celebrating together, not competing |
| **Supporter pride** | Hype reactions during others' performances | Validating that hyping someone else is a generous, valued act (có qua có lại) |

**Emotions to Prevent:**

| Negative Emotion | Risk Scenario | Prevention Design |
|---|---|---|
| **Loss of face** | Trang gets a performance-referencing award she didn't ask for | Awards for non-volunteers use character-trait framing ("Enigmatic Presence"), never performance-behavior framing ("Bad Singer"). Score-categorized: high scores get impressive titles, low scores get personality celebrations |
| **Pressure** | Trang feels forced to sing or participate | Opt-in everything. Engagement ladder is invisible. No public "[Name] hasn't participated!" callouts. Front-loaded universal activities (Quick Vote, icebreaker) require only a tap, not a spotlight |
| **Embarrassment** | Bad performance gets harsh ceremony | Celebratory-neutral first ceremony. Face-saving award design. "The Whisperer" only for someone who CHOSE the whisper dare — never auto-assigned to a bad performance |
| **Burden** | Linh managing instead of playing | Host controls are overlay, not mode. DJ runs automatically. "Song Over!" is her only required action |
| **Confusion** | User doesn't know what to do or what's happening | Self-evident UI. Audio cues signal every state change. One action per screen. No menus, no navigation |
| **Exclusion** | Non-singer feels like the app isn't for them | Weighted participation rewards all actions equally. Non-singing awards ("Hype Lord") are as prestigious as singing awards. Supporter role explicitly validated |
| **Staleness** | 5th ceremony feels identical to 1st | Three ceremony weights. 20+ award templates. DJ varies activities. No two nights play the same |

### Design Implications

**Emotion → Design Mapping:**

| Desired Emotion | UX Design Approach |
|---|---|
| Belonging | Synchronized reveals across all devices. Collective audio from multiple phones. Shared visual states — everyone sees the same thing at the same moment. "Không khí" as a visible, nameable concept in the app's voice |
| Unpredictable delight | Randomized award selection within score categories. DJ cycling with variety. Three ceremony weights prevent pattern recognition |
| Recognition | Hype streak notifications ("MINH IS ON FIRE"). End-of-night awards for non-singing behaviors. Supporter-role awards validate generosity. Participation weighting visible in awards, not in a scoreboard |
| Liberation | Host controls as minimal overlay. Auto-cycling DJ with no host input required. Bridge moments fill physical transitions without prompting |
| Nostalgia/FOMO | Setlist poster designed as concert memorabilia. 9:16 Instagram Story format. Karamania brand subtle but visible. Track share destination — group chat (nostalgia) vs. public social (FOMO) — to measure which morning-after emotion is firing |
| Self-aware humor on failure | Reconnection toast: "You blinked. We kept going." Empty vote: "The crowd has spoken... by saying nothing." Glitch recovery: playful acknowledgment, never error messages |
| Face preservation | Award templates reviewed for face-safety. Score-categorized pools: high = impressive, low = character-celebrating. Zero templates that reference failure, skill level, or negative comparisons |

### Emotional Design Principles

1. **Celebrate Everything, Mock Nothing — With Face-Saving Awareness.**
   Awards are funny, never cruel. "Enigmatic Presence" celebrates the person — it doesn't reference the performance. Every ceremony output should make the recipient want to screenshot it, not hide from it. In Vietnamese face-conscious culture, the line between "funny" and "humiliating" is thinner than in Western contexts — err on the side of celebrating character over commenting on behavior.
   *Implementation checkpoint: Every award template in the pool has been reviewed for tone — zero templates that reference performance failure, skill level, or negative comparisons. Award assignment is score-categorized (high → impressive, low → character-based), never score-shaming. First ceremony uses milestone framing ("FIRST SONG IN THE BOOKS"), not performance framing.*

2. **Chaos Is a Feature.**
   When things go sideways — disconnections, awkward pauses, nobody voting, a dare that bombs — the app leans in with self-aware humor. "WELL THAT HAPPENED" is the emotional recovery pattern. Technical failures become shared memories. The app has no failure state; even the worst night produces content worth sharing.
   *Implementation checkpoint: Reconnection toast displays a playful message from approved copy pool, never a technical error string. Empty vote state triggers humorous fallback, not error/timeout. Every DJ error state has a defined recovery path with personality-appropriate copy.*

3. **Surprise Prevents Staleness.**
   The 10th ceremony must feel as fresh as the 1st. Randomized award pools, varied ceremony weights, unpredictable DJ sequencing, and progressive interlude variety all serve this principle. The moment the app feels predictable, the emotional magic dies. Design for variety at every layer.
   *Implementation checkpoint: No two consecutive ceremonies use the same weight (Full/Full forbidden). Award pool has 20+ unique templates across 3+ score categories. DJ never repeats the same interlude type back-to-back.*

4. **FOMO Is The Viral Emotion.**
   Every shareable artifact (moment card, setlist poster, award screen) should trigger jealousy in people who weren't there. Design these artifacts as proof of an experience that can't be replicated — specific names, specific songs, specific awards, a specific date. Generic = ignorable. Specific = "I want that." Track share destination to measure whether FOMO (public shares) or nostalgia (private group shares) is driving the flywheel.
   *Implementation checkpoint: Setlist poster includes: all performer names, all song titles, date, session-specific awards. Zero generic/placeholder content. Share intent taps log destination context when available.*

5. **The App Has a Voice — Playful, Warm, Never Corporate.**
   DJ prompts, ceremony reveals, reconnection toasts, error states — every text string is a chance to express personality. The tone is: a friend who's really good at running karaoke nights. Self-aware, enthusiastic, a little cheeky. Never robotic, never formal, never a loading spinner that says "Please wait." Vietnamese cultural references (không khí, familiar humor patterns) are embedded naturally, not as forced localization.
   *Implementation checkpoint: A copy style guide exists before Sprint 2, defining tone, vocabulary, and 10+ example strings per DJ state. Zero UI strings use generic framework defaults ("Loading...", "Error", "Please wait"). All ceremony text, DJ prompts, and system messages sourced from a single copy constants file for tone consistency.*

## UX Pattern Analysis & Inspiration

### Inspiring Products Analysis

**1. Locket Widget — Ambient Intimacy**

Locket's core innovation is **push over pull** — content appears on your home screen without opening the app. The sending flow is 3 seconds (tap widget → camera → photo auto-sends), with no editing tools, no like counts, no review screen. This deliberate removal of polish creates authenticity.

Key UX insights for Karamania:
- **Designed rawness as anti-performance signal.** Reactions should feel spontaneous, not curated. Emoji rain on a ceremony reveal should scatter with pre-rendered chaos patterns (CSS keyframe sprite sheets, randomly selected per burst), not clean grid animations. The visual mess signals authenticity while keeping performance cost near zero on budget Android
- **Ambient push, not pull.** Between ceremonies, don't make party guests manually check for state changes. The DJ engine should push state transitions as visual/haptic alerts to idle phones. The party finds the guest, not the reverse. **Platform caveat:** Vibration API works on Chrome Android but is NOT supported on iOS Safari — haptic push is Chrome-only, with audio-only fallback for iOS
- **Locket's Rollcall feature** — a timed, group-simultaneous interaction where everyone contributes to a shared artifact at the same time — directly maps to Karamania's ceremony voting model

Anti-patterns: Locket's feature discovery is poor (minimalist UI hides depth). Karamania must surface available actions clearly during each DJ state.

**2. Duolingo — Gamification That Doesn't Punish**

Duolingo's gamification architecture runs deeper than streaks:

- **Correct answer flow:** 80ms delay → green highlight → XP counter floats up → progress bar advances with elastic spring animation (overshoots slightly, settles)
- **Wrong answer flow:** Red highlight + correct answer shown simultaneously. Duo looks mildly sad, not angry. "Let's keep going" framing, never "you failed." The emotional valence is forward momentum
- **Graduated celebration intensity:** 7-day streak gets a pulse. 100-day streak gets confetti. 365-day streak gets an orchestral flourish. Not every moment deserves the same treatment
- **Streak Freeze as anxiety reducer:** The *availability* of insurance changes behavior even for people who never use it

Key UX insights for Karamania:
- **Ceremony completion screen = Duolingo's lesson complete screen.** Single dominant animation (award card flying in), one piece of social proof (who voted), one CTA ("Share" or "Next"). No secondary navigation. Every ceremony is a micro-celebration
- **Sound confirms, never shames.** Ascending two-note chime for positive feedback. Lower-energy thud for negative — not harsh, not embarrassing. Karamania's reaction sounds should confirm participation, not critique it
- **Graduated celebration intensity across the session.** Mid-session Quick ceremonies get standard treatment. The finale ceremony gets the full Duolingo 365-day-streak treatment — confetti, orchestral flourish, the works

Anti-patterns: Duolingo's guilt-based push notifications ("You're breaking Duo's heart") crossed into anxiety. Karamania's DJ engine must never guilt-trip during a live session. Leaderboards discourage bottom-ranked users — never show ranked participation during the session.

**3. Kahoot — Synchronized Room Energy**

Kahoot's energy is engineered through five specific mechanisms:

- **The PIN is visible on a shared screen**, making joining a social, room-level activity. Names appearing on the host screen IS the onboarding moment
- **Player phones show only colored shapes during questions** — no text. This forces all eyes to the shared screen, synchronizing the room around a focal point
- **The countdown shifts audio at 5 seconds** (higher register, faster tempo) before the visual urgency pulse at 3 seconds. Players *feel* time running out before seeing it
- **"Locked in!" confirmation** after answer submission, then a waiting state. The engineered pause creates anticipation
- **Host manually advances between questions** — giving time for social commentary. The pause between reveal and next question IS the social moment

Key UX insights for Karamania:
- **The silence-before-reveal.** When the ceremony countdown ends, cut ALL audio for 1 second. Then drop the award reveal with full sound and animation. The silence is the mechanism; the reveal is the payoff. Both Kahoot and Among Us use this — it's the single highest-ROI audio design pattern
- **Split host/player screen design.** The host screen shows aggregate/global state; player phones show personal/private state. Voting happens privately, results appear publicly. This maintains surprise for everyone

Anti-patterns: Speed-to-answer penalizes slow readers — Karamania's participation should never reward speed. No reconnection on drop (Kahoot creates new nickname on rejoin) — unacceptable for a 3-hour party. Host must manually advance every question — Karamania's DJ must be genuinely autonomous.

**4. Gather.town — Presence Through Proximity**

Gather's core UX thesis: **physical metaphor for social behavior.** You walk somewhere, and that walk communicates intent.

- **Proximity-triggered connections:** Walk within range → conversation starts automatically. Walk away → conversation ends. No "join/leave" buttons
- **Spatial audio volume falloff:** Full volume at 1-2 tiles, fading at 3-5 tiles. A large group creates audible "crowd noise" — you hear conversations you're not in, just like a real party
- **Bubble feature for semi-private conversations:** Two people can go semi-private while others see a conversation is happening but can't hear it. Mirrors physical whispering

Key UX insights for Karamania:
- **Passive presence signals.** A row of participant avatars with pulse animations when active (just reacted, just voted) vs. greyed-out when idle. Creates a real-time "where is everyone" read — Gather's avatar movement translated to a list view
- **Physical-room spatial audio through volume differentiation.** During a ceremony reveal, the host phone plays the primary fanfare at full volume while participant phones play a lighter version (crowd roar, cheering) at 60% volume. The host phone becomes the "stage," participant phones become the "audience." Multiple audio sources at different volumes in a physical room creates genuine spatial audio without any spatial audio API — just volume differentiation across devices. **This is a core differentiating experience no competitor has attempted**

Anti-patterns: Gather is completely broken on mobile — validates Karamania's mobile-first approach. Accidental conversation joining (40% of users) — Karamania's irreversible actions (like "Song Over!") need deliberate gestures (long-press).

**5. Among Us — Dramatic Reveals Through Information Asymmetry**

Among Us creates tension through **private input, public output** — everyone acts privately, results reveal publicly:

- **Voting is private:** Each player votes on their own phone. Votes reveal sequentially (one by one), not all at once. This converts a binary result into a narrative arc
- **The ejection reveal:** Near-silence → whoosh → result text on black. Minimal design, maximum impact
- **Emergency meeting siren:** Intentionally jarring, creates physiological arousal. Every phone freezes simultaneously — the game forcibly synchronizes attention
- **No background music during gameplay:** Every sound effect hits harder because there's no soundtrack to compete with

Key UX insights for Karamania:
- **Two-phase reveal for MVP ceremony awards.** Phase 1: aggregate bar chart fills in real time as votes arrive (cheap — just broadcast running total, creates visible tension as bars grow). Phase 2: 1-second silence → winner reveal with full sound and animation. This delivers 80% of Among Us's sequential tension at 20% of the implementation cost. Full individual-vote sequential reveals (each vote arriving one by one with 8 coordinated server pushes) deferred to v2 as a ceremony upgrade
- **Private input, public output for all voting.** Collect votes privately on individual phones. Reveal simultaneously on all screens. Prevents "I'll just vote what everyone voted" and keeps reveals genuinely surprising

Anti-patterns: Discussion phases favor fast typists — Karamania voting must be tap/button only, never free text. "Nobody talks" problem in voice rooms — Karamania should have explicit voting confirmation to prevent passive non-engagement.

### Transferable UX Patterns

**The Big Five — Highest Priority Patterns for Karamania:**

| # | Pattern | Source | Application | Defensibility |
|---|---|---|---|---|
| 1 | **Silence-Before-Reveal** | Kahoot + Among Us | Cut ALL audio for 1-2 seconds before every ceremony award reveal. Implementation: server sends `ceremony_silence` event, all clients mute simultaneously. 1 second later, `ceremony_reveal` event fires with timestamp for synchronized playback | Table stakes (easy to copy, but essential) |
| 2 | **Two-Phase Reveal** (MVP) | Among Us adapted | Phase 1: real-time aggregate bar chart filling as votes arrive. Phase 2: silence → winner reveal. Full sequential individual-vote reveals in v2 | Defensible through tuning (optimal pacing learned from session data) |
| 3 | **Private Input, Public Output** | Among Us + Kahoot | All voting happens privately on individual phones. Results reveal simultaneously on all screens. Maintains surprise, prevents social copying | Table stakes |
| 4 | **Ambient Push, Not Pull** | Locket + Duolingo | Push state transitions as visual/haptic alerts to idle phones. Chrome Android: Vibration API. iOS Safari: audio-only fallback (no vibration support) | Table stakes |
| 5 | **Graduated Celebration Intensity** | Duolingo | Three tiers: Quick ceremony = standard animation. Full ceremony = dramatic reveal. Finale = full fireworks (confetti, orchestral flourish, setlist poster assembly). DJ engine's ceremony weight selection at the right moment is the intelligence layer | Defensible (requires behavioral data to optimize weight selection) |

**Core Differentiating Experience — Multi-Phone Spatial Audio:**

| Pattern | Source | Application | Defensibility |
|---|---|---|---|
| **Physical-Room Spatial Audio** | Gather adapted | Host phone = primary fanfare at full volume (the "stage"). Participant phones = crowd sounds at 60% volume (the "audience"). Multiple audio sources at differentiated volumes in a physical room creates spatial audio without APIs — just volume levels across devices. The ceremony fanfare comes from ONE direction (host) while crowd roar surrounds from everywhere | **Moat-building** — no competitor has attempted coordinated multi-device audio in a physical space. Cannot be replicated in remote-only apps |

**Additional Patterns:**

| Pattern | Source | Application | Defensibility |
|---|---|---|---|
| **Designed rawness** | Locket | Reactions use pre-rendered sprite sheet scatter patterns (5-6 CSS keyframe animations, randomly selected). Looks chaotic, costs nearly zero performance. Save real physics for finale confetti only | Table stakes |
| **Sound confirms, never shames** | Duolingo | Ascending chime for positive, lower energy for negative. Never a harsh buzzer | Table stakes |
| **Split host/player information** | Kahoot | Host sees aggregate state, players see personal state. Different views of the same moment | Table stakes |
| **Passive presence signals** | Gather | Participant avatars pulse when active, grey when idle. Real-time room read | Table stakes |
| **Song state as dramatic contrast** | Among Us | During song state: near-silent app (no ambient music, no loops). Only user-triggered soundboard + tiny reaction blips. Web Audio graph nearly dormant, RAF loop dormant = lowest power consumption. When ceremony fires: wake everything — audio graph, RAF, full animation pipeline. The contrast between silence and eruption IS the dramatic effect | Defensible (requires intentional restraint competitors won't have) |
| **Preloaded state transitions** | Kahoot inferred | Every DJ state change has next-state assets (animation frames, audio buffers, UI components) preloaded BEFORE the transition fires. Ceremony reveal component is part of core bundle, not lazy-loaded. When countdown hits zero, the reveal is already in memory | Table stakes (but critical for perceived performance) |

### Anti-Patterns to Avoid

| Anti-Pattern | Source | Why It's Dangerous for Karamania |
|---|---|---|
| **Speed-rewards in voting** | Kahoot | Penalizes slow readers and motor-impaired users. Ceremony voting is binary (did you vote?), never speed-ranked |
| **Guilt-based notifications** | Duolingo | "People are waiting for you!" during a live session would create anxiety, not engagement. The DJ engine never guilt-trips |
| **No reconnection preservation** | Kahoot | Kahoot creates new nickname on rejoin. For a 3-hour party, identity and score must persist through disconnects |
| **Hidden feature discovery** | Locket | Minimalist UI that hides available actions. Every DJ state must clearly surface what the user can do NOW |
| **Free-text discussion during voting** | Among Us | Favors dominant voices, excludes shy users. All participation in Karamania is tap-based, never text-based (beyond name entry) |
| **Ranked participation during session** | Duolingo | Bottom-ranked users disengage. Participation scores appear only in end-of-night awards, never as live leaderboards |
| **Manual host advancement required** | Kahoot | Fine for 10-question quiz, exhausting for 3-hour party. DJ engine must be genuinely autonomous |
| **Accidental action triggers** | Gather | 40% of Gather users accidentally join conversations. Irreversible actions (Song Over!) use deliberate gestures (long-press) |
| **Real-time physics on budget Android** | General | Animating 50+ emoji particles at 60fps while running WebSocket + Web Audio tanks performance. Use pre-rendered sprite sheet animations for reactions. Reserve real physics for one-time finale confetti only |

### Design Inspiration Strategy

**Adopt Directly:**
- Silence-before-reveal audio pattern (Kahoot + Among Us) — apply to every ceremony reveal via two-event WebSocket pattern (`silence` → `reveal`)
- Private input, public output voting model (Among Us) — all ceremony votes collected privately
- Ambient push for state transitions (Locket) — haptic (Chrome) / audio (iOS) alerts to idle phones
- Song state as near-silent lowest-power state (Among Us) — let real karaoke be the soundtrack, making ceremony eruptions dramatically louder by contrast

**Adapt for Karamania:**
- Sequential vote reveal → **Two-phase reveal for MVP** (real-time bar chart → silence → winner). Full sequential reveals as v2 ceremony upgrade when server-side timing orchestration is optimized with session data
- Graduated celebration intensity (Duolingo) → Map to three ceremony weights (Full/Quick/Skip) and session position. First ceremony gets extra drama, mid-session is standard, finale gets everything
- Spatial audio proximity (Gather) → **Physical-room spatial audio via volume differentiation.** Host phone = full volume stage, participant phones = 60% volume crowd. Core differentiating experience
- Designed rawness (Locket) → Pre-rendered sprite sheet scatter animations for reactions (5-6 patterns, randomly selected). Chaotic appearance, minimal performance cost

**Explicitly Avoid:**
- Speed-based scoring (Kahoot) — participation is binary, never timed
- Manual host advancement (Kahoot) — DJ is autonomous
- Guilt-based engagement (Duolingo) — warmth, not obligation
- Free-text voting/discussion (Among Us) — tap only, Trang-friendly
- Live ranked leaderboards (Duolingo) — awards at end of night only
- Real-time physics for frequent animations (General) — sprite sheets for reactions, physics only for finale

## Design System Foundation

### Design System Choice

**Svelte + Tailwind CSS + Vite — Zero Component Library**

A custom-tuned minimal stack purpose-built for the Karamania experience. No off-the-shelf component library — every UI element is a thin Svelte component styled with Tailwind utility classes and orchestrated by CSS custom properties.

**Why this stack:**

| Factor | Decision | Rationale |
|---|---|---|
| **Framework** | Svelte (SvelteKit not needed) | Built-in `transition:` directives for ceremony choreography. Reactive stores for WebSocket state. ~2KB runtime vs ~16KB Preact. Compiled away — no virtual DOM diffing during ceremony reveals |
| **Styling** | Tailwind CSS (utility-first) | Eliminates naming decisions for solo dev. PurgeCSS strips unused utilities automatically. Pairs with CSS custom properties for theming |
| **Build** | Vite | Native Svelte plugin, sub-second HMR. Built-in code splitting for two-tier bundle strategy |
| **Component Library** | None | Component libraries add weight and fight the DJ engine's state-driven paradigm. 4 custom components in Sprint 1 is faster than configuring a library |

### Design Token System

**12 Core Tokens — Inlined in `<head>` for Zero-Flash Load**

```css
:root {
  /* Surfaces */
  --dj-bg: #0a0a0f;
  --dj-surface: #1a1a2e;
  --dj-surface-elevated: #252542;

  /* Text */
  --dj-text-primary: #f0f0f0;
  --dj-text-secondary: #8888aa;
  --dj-text-accent: #ffd700;

  /* Interactive */
  --dj-action-primary: #6c63ff;
  --dj-action-confirm: #4ade80;
  --dj-action-danger: #ef4444;

  /* Ceremony */
  --dj-ceremony-glow: #ffd700;
  --dj-ceremony-bg: #1a0a2e;

  /* Timing */
  --dj-transition-fast: 150ms;
}
```

Why 12, not 30: Every additional token is a decision point during implementation. 12 tokens cover all Sprint 0-1 screens. Expand only when a new screen genuinely can't be expressed with existing tokens.

### DJ State Integration

**Single Integration Point: `data-dj-state`**

The DJ engine's current state drives the entire visual system through one HTML attribute. This attribute also serves as the primary testing hook — `data-dj-state` is both design system integration AND test automation surface.

```svelte
<!-- App.svelte -->
<body data-dj-state={$djState}>
  <slot />
</body>

<script>
  import { djState } from './lib/stores/party.js';
</script>
```

```css
/* State-driven visual modes */
[data-dj-state="lobby"]           { --dj-bg: #0a0a1a; /* calm, inviting */ }
[data-dj-state="song_selection"]  { --dj-bg: #0f0a1e; /* energetic, anticipation — picking what's next */ }
[data-dj-state="party_card_deal"] { --dj-bg: #1a0a1a; /* anticipation, playful tension */ }
[data-dj-state="song"]            { --dj-bg: #0a0a0f; /* subdued, ambient — real karaoke is the show */ }
[data-dj-state="ceremony"]        { --dj-bg: var(--dj-ceremony-bg); /* dramatic, saturated */ }
[data-dj-state="interlude"]       { --dj-bg: #0f1a2e; /* playful, varied */ }
[data-dj-state="finale"]          { --dj-bg: #1a0a2e; /* maximum drama */ }
```

**Why this matters:** No component needs to import state or check conditions. CSS does the visual switching automatically. Components just render — the attribute handles the rest.

### Canonical Svelte Patterns

**Ceremony Reveal — Server-Coordinated Timing via Svelte Transitions**

```svelte
{#if showReveal}
  <div
    in:scale={{duration: 800, delay: revealDelay, easing: elasticOut}}
    data-testid="ceremony-reveal"
  >
    {award.title}
  </div>
{/if}

<script>
  import { elasticOut } from 'svelte/easing';
  import { scale } from 'svelte/transition';
  import { ceremonyData } from '../lib/stores/party.js';

  let showReveal = false;
  let revealDelay = 0;

  // Server sends silence event with future reveal timestamp
  // Anticipation phase absorbs clock drift between devices
  socket.on('ceremony_silence', (data) => {
    ceremonyData.set(data);
    revealDelay = data.revealAt - Date.now();
    setTimeout(() => showReveal = true, Math.max(0, revealDelay));
  });
</script>
```

The `delay` parameter in Svelte's transition directive is the key insight: server sends a future timestamp, client calculates the delay, and Svelte handles the choreographed entrance. No manual animation orchestration needed.

**Keyed `{#each}` Blocks for All Real-Time Lists**

```svelte
{#each $participants as participant (participant.id)}
  <div data-testid="participant-{participant.id}">
    {participant.name}
  </div>
{/each}
```

Every real-time list (participants, reactions, vote results) MUST use keyed `{#each}` blocks. Without keys, Svelte reuses DOM nodes by index — causing flickering, wrong animations, and ghost elements when the WebSocket pushes reordered data.

**Single Reactive Store File (Svelte 5 Runes)**

```typescript
// stores/djStore.svelte.ts — Svelte 5 runes pattern (per Architecture decision)

import type { DJState } from '@karamania/shared';

// Module-scoped $state — NOT exported directly
let currentState = $state<DJState>(initialState);
let currentPhase = $state<string | null>(null);

// Exported: read-only derived getters ONLY
export const djStore = {
  get current() { return currentState; },
  get phase() { return currentPhase; },
  get isCeremony() { return currentState.type.startsWith('CEREMONY'); },
};

// Mutations: named functions, called ONLY from Socket.io handler
export function _onStateChanged(state: DJState) { currentState = state; }
export function _onPhaseChanged(phase: string) { currentPhase = phase; }
```

```typescript
// socket/client.ts — Single WebSocket connection, dispatches to stores
import { io } from 'socket.io-client';
import { _onStateChanged } from '../stores/djStore.svelte';

const socket = io(SERVER_URL);
socket.on('dj:stateChanged', (s) => _onStateChanged(s));
socket.on('ceremony:phase', (p) => _onPhaseChanged(p));
// ... all other event handlers dispatch to store mutation functions
export { socket };
```

One file owns the WebSocket connection. Store files own reactive state via Svelte 5 `$state` runes. Components read stores via exported getters. No component ever creates its own socket listener or mutates store state directly.

### Testing Strategy

**DJ State Machine as Pure JS — 100% Test Coverage**

The DJ state machine lives in a plain `.js` file, NOT a Svelte component. This means it's testable with standard unit test runners (Vitest) without any Svelte compilation step. State transitions, ceremony weight selection, timing logic — all pure functions, all fully tested.

**Testing Surface Conventions:**

| Convention | Purpose |
|---|---|
| `data-dj-state` on `<body>` | Visual state verification + integration testing. Assert `document.body.dataset.djState === 'ceremony'` |
| `data-testid` on all interactive elements | E2E and integration test hooks. Every tappable element gets `data-testid="action-name"` |
| No visual component tests | Ceremony animations, transitions, and CSS-driven visuals are NOT unit tested. A dry-run ceremony flow in integration tests covers visual correctness. Testing CSS keyframe scatter patterns is wasted effort |

### Critical CSS Reset

**Applied Globally — Non-Negotiable for Touch PWA**

```css
/* Layer 0: PWA touch reset */
@layer reset {
  * { user-select: none; }
  input, textarea { user-select: text; }
  * { touch-action: manipulation; }     /* kills 300ms tap delay */
  * { -webkit-tap-highlight-color: transparent; }
  html { overscroll-behavior: none; }   /* kills pull-to-refresh */
  body { position: fixed; width: 100%; height: 100%; overflow: hidden; }
}
```

Why each rule: `user-select: none` prevents accidental text selection during frantic tapping. `touch-action: manipulation` eliminates the 300ms tap delay on all mobile browsers. `overscroll-behavior: none` prevents pull-to-refresh killing the WebSocket connection. `position: fixed` on body prevents iOS Safari rubber-banding.

### Bundle Strategy

**Two-Tier Loading — Core < 80KB, Deferred < 20KB**

| Tier | Contents | Budget | Loads |
|---|---|---|---|
| **Core** | Svelte runtime, `stores/party.js`, lobby + song UI, CSS reset + tokens, Web Audio engine (context creation only) | < 80KB gzipped | On page load |
| **Deferred** | Ceremony reveal component, reaction sprite sheets, finale confetti, soundboard extended sounds | < 20KB gzipped | Lazy after first ceremony |

The ceremony reveal component is preloaded during the first song state (while users are watching karaoke, the app quietly fetches ceremony assets). By the time the first ceremony fires, everything is already in memory.

### Project Scaffold — Sprint 0 Day 1

```
karamania/
├── src/
│   ├── lib/
│   │   ├── stores/party.js         ← WebSocket + all reactive stores including song integration
│   │   ├── stores/capture.js       ← Media capture state + upload queue
│   │   ├── audio/engine.js         ← Web Audio context + sound buffer preloading
│   │   └── constants/copy.js       ← All DJ prompts, award names, party card text, system messages
│   ├── components/
│   │   ├── Lobby.svelte            ← Join flow + icebreaker + playlist import card
│   │   ├── TVPairingOverlay.svelte ← Host: YouTube TV code entry (Sprint 1/3)
│   │   ├── PlaylistImportCard.svelte ← URL paste + import status (Sprint 3)
│   │   ├── QuickPickScreen.svelte  ← 5 song cards, group vote (Sprint 3)
│   │   ├── SpinWheelScreen.svelte  ← 8-song wheel, spin animation (Sprint 3)
│   │   ├── Song.svelte             ← Song state (reactions + soundboard + lightstick toggle + hype)
│   │   ├── PartyCardDeal.svelte    ← Card deal/accept/dismiss/redraw flow
│   │   ├── Ceremony.svelte         ← Award reveal choreography
│   │   ├── Interlude*.svelte       ← Kings Cup, Dare Pull, Quick Vote screens
│   │   ├── CaptureBubble.svelte    ← Floating capture prompt + capture overlay
│   │   └── Finale.svelte           ← End-of-night sequence (deferred bundle)
│   ├── App.svelte                  ← data-dj-state binding + route switching
│   └── main.js                     ← Entry point
├── public/
│   └── sounds/                     ← 10 core audio assets (<500KB total, +card-flip, +hype-signal, +song-pick-chime, +wheel-spin)
├── index.html                      ← Design tokens inlined in <head>
├── tailwind.config.js
├── vite.config.js
├── postcss.config.js
└── package.json                    ← browserslist: "Chrome >= 90, iOS >= 15.4"
```

**Three Foundational Files (build these first):**
1. `stores/party.js` — WebSocket connection + reactive stores. Everything else subscribes to this
2. `audio/engine.js` — AudioContext creation, buffer preloading, the unlock-on-first-tap pattern
3. `constants/copy.js` — Every string the DJ engine can display. Centralizing copy means localization is a file swap, not a codebase hunt

**Browserslist: `Chrome >= 90, iOS >= 15.4`**
- Chrome 90+: Covers 95%+ of Vietnamese Android users. Enables all required Web APIs
- iOS 15.4+: Minimum for Web Audio API reliability in Safari. Below this, AudioContext behavior is unpredictable

## Defining Core Experience

### The One-Sentence Experience

**"Your phone becomes part of the party."**

From the moment you scan the QR code and tap the icebreaker, your phone stops being an escape hatch and starts being a participation device. Reactions during songs, votes during ceremonies, soundboard taps that the whole room hears — the phone is no longer where you go when you're bored. It's how you're *in* the party.

**The proof point: "The song ends and every phone in the room explodes with who won."**

The ceremony reveal is the peak moment that makes users *believe* the paradigm. But the defining experience is broader than any single moment — it's the continuous shift from "phone as distraction" to "phone as participation." The ceremony is the exclamation mark on a sentence that starts with the icebreaker tap.

**Why this distinction matters for design:** If we frame the defining experience as ONLY the ceremony, we risk under-investing in song state — where users spend 60-70% of their time. Song state must feel like being in the audience at a live show: you're part of it even when you're not on stage. The ceremony proves the paradigm; the song state *is* the paradigm.

### User Mental Model

**The Problem We Replace: Dead Air Between Songs**

Current Vietnamese KTV experience after a song ends:

| Time | What Happens Now | What Karamania Replaces It With |
|---|---|---|
| 0-5s | Polite clapping, energy drops | **Song Over! long-press** → host confirmation flash (1s) + simultaneous `song_ending` to all participants |
| 5-15s | The "ai hát tiếp?" negotiation — a face-saving politeness dance where nobody wants to seem too eager | **Anticipation phase** — drumroll, phones dim, 4s voting with visual countdown. DJ decides what's next so nobody loses face |
| 15-30s | Introverts check phones (not boredom — social anxiety). Extroverts fill gap or start drinking games | **Ceremony reveal** — phones erupt, winner announced. Introverts participate by voting; extroverts react out loud. Both are "in" the moment |
| 30-60s | Drinking game ("loser drinks!") creates brief energy spike, then fades | **Interlude** — mini-game or next-song voting. Same friendly-accusation energy as drinking games, without requiring alcohol |
| 60-90s | Next song finally starts, energy slowly rebuilds | **Song state** — phones quiet down, become ambient participation devices. Real karaoke resumes |

**Three Vietnamese KTV Mental Models Karamania Replaces:**

1. **"Ai hát tiếp?" (Who sings next?) face-saving ritual** — Currently a politeness negotiation where nobody wants to seem too eager. Karamania removes this social friction entirely: the DJ engine decides what happens between songs, so nobody volunteers, nobody hesitates, nobody loses face.

2. **Phone-checking as social anxiety shield** — In a group of 10, 3-4 extroverts fill silence naturally. The other 6-7 reach for phones because they don't know what to do when music stops. Karamania gives introverts a defined role: voting, reacting, participating *through* the phone they're already holding. Trang doesn't need to be loud to be part of the party.

3. **Drinking games as ceremony substitute** — The closest existing analog to Karamania's ceremonies is "loser drinks!" between songs. Same friendly-accusation energy, same room-wide engagement spike. Karamania's ceremonies must create this same social electricity — without requiring alcohol. If the ceremony doesn't generate at least the energy of "loser drinks!", it hasn't hit the bar.

**Key mental model expectations users bring:**
- **Instant gratification** — Ceremony results should feel immediate. The anticipation phase creates perceived speed (tension makes 3 seconds feel like 10, so the reveal feels instantaneous)
- **Fairness through opacity** — Users accept vote results they can't fully audit as long as the reveal feels dramatic and legitimate. The real-time bar chart provides just enough transparency
- **Effortless participation** — Any interaction more complex than a single tap will be ignored. One thumb, one tap
- **Social permission through device** — Introverts don't need to be loud to participate. The phone provides a socially acceptable way to be part of the moment without drawing attention

### Success Criteria

**Instrumentable Metrics (the app tracks these):**

| Criteria | Exact Metric | Target | Failure Threshold |
|---|---|---|---|
| **Room attention snaps** | % of connected devices on ceremony screen within 2s of `ceremony_reveal` | >80% | <60% |
| **Introvert participation** | % of connected devices casting a vote within 4s window (Full ceremonies only) | >90% | <70% |
| **Post-ceremony engagement** | Time between ceremony celebration end and next user action (reaction tap, soundboard, etc.) | <5 seconds | >15 seconds |
| **Share impulse** | Share button taps within 60s of ceremony reveal | >1 per ceremony | 0 for 3+ consecutive ceremonies |
| **Ceremony health** | % of ceremonies completing full beat-by-beat without error (no WebSocket drops, no timeout fallbacks) | >95% | <85% |
| **Engagement decay** | Vote participation rate trend across ceremonies 1→2→3→...N in a session | <15% drop per ceremony | >25% drop (novelty wearing off) |

Engagement decay is the defining health metric. If ceremony 1 gets 95% participation and ceremony 5 gets 40%, the experience isn't sustainable — variety, pacing, or category selection needs adjustment.

**Observational Design Intent (post-session survey / in-room observation):**
- Physical reaction: laughter, cheering, friendly arguing within 3 seconds of reveal
- Winner acknowledgment: mock bow, victory pose, verbal response
- Losers engage not disengage: "Rigged!" complaints = success, shrugging = failure
- Drinking-game energy parity: ceremony creates equivalent social electricity without alcohol
- Invisible orchestration: users credit "good night" not "good app"

These are design intent, not dev acceptance criteria. They validate the experience in user testing, not in code.

### Novel vs. Established Patterns

| Pattern | Classification | Rationale |
|---|---|---|
| Voting/polling | **Established** (Kahoot, Slido) | Users understand tap-to-vote. Zero education needed |
| Award categories | **Established** (Oscars, Spotify Wrapped) | "Best Performance" is immediately understood |
| Synchronized reveal | **Novel combination** | Familiar elements (countdown → reveal), but synchronized across all phones in a physical room is new. The synchronization IS the surprise |
| Phone-as-participation-device | **Novel paradigm** | The defining experience. No existing mental model. First ceremony teaches it — when phones erupt simultaneously, users immediately understand. Introverts discover they have a role without anyone telling them |
| Spatial audio via volume differentiation | **Novel** | Host phone louder than participant phones creates directional sound. Users feel the room has a "stage" without consciously noticing the technique |
| Automatic party orchestration | **Novel framing** | Auto-DJ for party *activities* doesn't exist. Removes "ai hát tiếp?" negotiation. First 2-3 automatic transitions teach users the app runs the show |
| Introvert-first participation | **Novel** | Existing group apps reward loudness. Karamania gives equal weight to every phone. Quiet participation is first-class |

**Education Strategy:** Zero explicit tutorials. The first ceremony IS the tutorial. Users who miss it learn from the social reaction around them — excited friends explaining is better education than any onboarding screen.

### Ceremony Types

**Three ceremony weights — how they feel different to users:**

| Type | When DJ Picks It | Duration | User Experience |
|---|---|---|---|
| **Full Ceremony** | After high-energy songs, first ceremony of night, every 3rd+ ceremony | ~15s | Complete beat-by-beat: voting (4s with visual countdown) → silence (1.5s) → dramatic reveal with spatial audio fanfare → celebration (5-8s) with confetti + reactions. The game show |
| **Quick Ceremony** | After mellow songs, as second in a back-to-back pair, mid-session pacing | ~6s | No voting. DJ auto-selects winner from participation data (reaction counts, soundboard taps). Brief anticipation (2s) → quick reveal with single chime + winner name. No bar chart. The shoutout |
| **Skip** | Low energy detected, too many recent ceremonies, very short song | 0s | No ceremony. Straight to interlude or next song. Users never know a ceremony was considered and skipped. Invisible |

**Back-to-back limit: maximum 2 ceremonies per song, then mandatory interlude.** If the DJ engine queues multiple ceremonies, the rule is: first = Full, second = Quick, any additional redistributed to later in the session. Never two Full ceremonies in a row — 30 seconds of ceremony creates fatigue faster than dead air.

### Voting Mechanics

**Everyone votes for anyone except themselves.**

The DJ engine selects a category from its rotation. All connected participants are nominees. Each person sees the participant list (minus their own name) and taps one. Winner = most votes. Ties broken invisibly by the DJ engine (random selection).

**Why everyone-as-nominee, not singer-only:** In a group of 10, only 1-2 sing each song. Singer-only nominees means 8 people choose between 2 options — boring. When everyone is a nominee, "Best Air Guitar" might go to someone who wasn't even singing but was shredding in the back. That's funnier. That's the drinking-game energy.

**Category rotation (DJ engine selects):**

| Category Type | Examples |
|---|---|
| **Performance** | Best Vocalist, Most Dramatic, Best Duet Chemistry |
| **Vibe** | Best Hype Person, Room MVP, Best Air Guitar |
| **Social** | Most Likely To Encore, Best Backup Dancer, Biggest Fan |

Categories rotate — the DJ engine avoids repeating the same category type consecutively.

### Experience Mechanics — Beat by Beat

**Full Ceremony Sequence:**

**1. Initiation: Song Over! (Host Action)**

- Host long-presses (500ms) the "Song Over!" button with fill animation + haptic
- **Simultaneously:** "Song Over!" confirmation flash on host phone (1s visual feedback) AND `song_ending` event dispatched to all participants
- Participant phones immediately transition from song state to soft anticipation overlay
- Audio: subtle "attention" chime on all devices

**2. Anticipation Phase (T+0 to T+4s)**

- At T+0: server sends `ceremony_silence` event with `revealAt = now + 6000ms` (4s voting + 2s silence on one clock)
- All phones show voting category + nominee list (all participants minus self)
- **Visual countdown:** circular timer or filling bar shows 4 seconds draining. Creates game-show urgency — "vote NOW"
- Background: drumroll audio builds across all devices
- Visual: screen dims progressively, nominee cards glow on tap
- Users tap their pick (single tap, one choice). Tapping is the only action
- **Server closes voting at T+4s.** No extensions, no waiting for stragglers. Rhythm over completeness

**3. The Silence (T+4s to T+6s)**

- ALL audio cuts simultaneously — drumroll stops, chime stops
- Screens show only category name on dark background
- **Sync tolerance: ±200ms** (imperceptible within Svelte's 800ms elastic animation)
- **Fallback: if clock skew >500ms** (detected via WebSocket ping), server-push-triggered reveal replaces timestamp-based
- Room physically quiets — humans mirror device behavior

**4. The Reveal (T+6s, synchronized)**

- `ceremony_reveal` event fires at `revealAt` timestamp
- Host phone: full-volume fanfare (the "stage")
- Participant phones: 60%-volume crowd roar (the "audience")
- Winner's phone: unique winner sound + extra haptic (Chrome only)
- Visual: winner name + award title scales in with `elasticOut` (800ms)
- Vote bar chart appears below (shows margin of victory)
- Confetti sprite sheet scatter animation

**5. Celebration Window (T+6s to T+14s)**

- Room reacts (laughter, pointing, friendly arguing)
- Phones show winner card + reaction buttons
- Reactions appear on all screens as scattered emoji bursts
- Winner's phone shows share-ready 9:16 card
- Introverts participate through reaction taps — visible without being loud
- **Auto-advance** at 5-8 seconds → DJ engine transitions

**6. Transition Out**

- If second ceremony queued: brief 2s transition → Quick ceremony (no voting, ~6s)
- If no more ceremonies: interlude mini-game or next-song voting
- If finale: extended celebration → finale sequence
- **Never drops to zero** — always a next thing on screen

## Song State Modes — Audience Participation During Songs

### Overview

Song state is where users spend 60-70% of their time. The PRD defines three audience participation modes during songs, all freely switchable. The phone transforms from a passive screen into an active participation device — users choose how to engage moment-to-moment.

### Three Modes (Toggle Freely)

**1. Lean-In Mode (default)**
- Standard view: emoji reaction buttons (5 emoji) + soundboard (6 sounds, 3×2 grid)
- Active challenge badge visible if singer accepted a Party Card
- This is the "game controller" mode — tap reactions, hit soundboard, watch the feed
- Reaction streaks tracked: milestones at 5, 10, 20, 50 consecutive reactions (FR23)

**2. Lightstick Mode (FR63-64)**
- Full-screen animated glow effect — the phone becomes a concert lightstick
- User taps a "lightstick" toggle at bottom of Song State to enter
- Screen fills with a pulsing, breathing glow in the current accent color
- **Color picker:** Small color dots (5 options matching vibe palette) along the bottom edge. Tap to change glow color. Free-form — no synchronization between devices
- Phone held up and swayed — creates a physical-room concert atmosphere in a dark KTV room
- Reactions and soundboard are NOT available in lightstick mode (full-screen glow replaces them)
- Tap anywhere or swipe down to exit back to lean-in mode
- `prefers-reduced-motion`: static color fill, no pulse animation

**3. Hype Signal (FR65)**
- Available as a button in BOTH lean-in and lightstick modes
- Tap the flash/hype button → phone screen pulses bright white (3 rapid flashes) + optional device flashlight activation (Chrome Android `torch` via ImageCapture API; not available on iOS Safari)
- Creates a camera-flash strobe effect visible to the singer across the room
- Cooldown: 5-second minimum between hype signals per user (prevents seizure risk from continuous strobing)
- Visual feedback: button dims during cooldown with circular refill indicator

### Song State Screen Layout

```
┌─────────────────────┐
│  TopBar: 🎤 DUC      │
│  🎭 Method Actor      │  ← Challenge badge (if active)
│                       │
│  ┌───────────────┐   │
│  │ Reaction Feed  │   │  ← Floating emoji from all users
│  │   🔥 🔥 ❤️     │   │
│  └───────────────┘   │
│                       │
│  ┌──┐ ┌──┐ ┌──┐     │
│  │🎺│ │👏│ │📯│     │  ← Soundboard (3×2)
│  ├──┤ ├──┤ ├──┤     │
│  │😢│ │🔥│ │💥│     │
│  └──┘ └──┘ └──┘     │
│                       │
│ 🔥 ❤️ 😂 👏 💀       │  ← Reaction buttons
│                       │
│ [💡Lightstick] [⚡Hype]│  ← Mode toggles
│ [📸 Capture]          │  ← Persistent capture icon (FR39)
│                       │
│ ═══ SONG OVER! ═══   │  ← Host only (500ms long-press)
└─────────────────────┘
```

**Lightstick Mode View:**

```
┌─────────────────────┐
│                      │
│                      │
│    ╔══════════╗      │
│    ║          ║      │
│    ║  GLOW    ║      │  ← Full-screen pulsing glow
│    ║  EFFECT  ║      │     in selected color
│    ║          ║      │
│    ╚══════════╝      │
│                      │
│  🔴 🔵 🟢 🟡 🟣     │  ← Color picker dots
│                      │
│ [⚡Hype] [✕ Exit]    │  ← Hype still available
└─────────────────────┘
```

### Mode Toggle Design Rules

- Default mode on song entry: lean-in (reactions + soundboard)
- Lightstick toggle is a single tap — instant full-screen transition
- Hype signal available in ALL modes (it's a momentary action, not a mode)
- Mode selection is private — no broadcast of which mode a user is in
- Song Over button (host) remains visible in ALL modes (absolute positioned, always accessible)
- Lightstick mode uses CSS `will-change: opacity` for GPU-accelerated glow animation
- Lightstick participation counts as passive (1pt) while active — lightstick mode active time is tracked

## Prompted Media Capture UX

### Overview

Prompted media capture builds the raw content pipeline for future highlight reels (v3 Memory Machine). A floating capture bubble appears at key moments; any participant pops it to capture a photo, short video (5s max), or audio snippet. The bubble is non-intrusive — ignore it and it fades. Capture never blocks the party experience.

### Capture Bubble — Trigger Points (FR67, FR73)

| Trigger | When It Appears | Why |
|---|---|---|
| Session start | 10s after icebreaker completes | Group is together, energy high, good "before" shot |
| Reaction peak | Server detects sustained spike above baseline | Room is going wild — capture the chaos |
| Post-ceremony | 3s after ceremony reveal | Winner celebrating, reactions flowing — peak content moment |
| Session end | During finale stats display | Group photo opportunity, emotional high |

Peak detection is **server-side** (FR73): server monitors reaction rate across all participants, triggers `capture_bubble` event when rate exceeds 2× baseline for 3+ consecutive seconds. Consistent triggering — all phones get the bubble simultaneously.

### Bubble Appearance & Interaction

**Visual Design:**
- Small floating circle (48×48px) with camera icon, positioned bottom-left (opposite to host controls)
- Subtle pulse animation to draw attention without interrupting
- Semi-transparent background, accent color border
- Auto-dismisses after 15s if not tapped
- Dismissable by ignoring — no close button needed

**Pop-to-Capture Flow (FR68):**
1. Participant taps bubble → bubble expands into capture mode selector (200ms animation)
2. Three options appear: 📷 Photo · 📹 Video · 🎤 Audio
3. Tap to select → capture starts immediately (one tap to pop, one tap to capture = 2 taps total)

**Photo capture:**
- Inline camera viewfinder via `getUserMedia` (front-facing default)
- Single tap to snap
- Auto-closes after capture

**Video capture (5s max):**
- Inline viewfinder, tap to start recording, auto-stops at 5s
- Visual countdown ring shows remaining time
- Tap again to stop early

**Audio capture:**
- No viewfinder — just a pulsing waveform visualization
- Tap to start, auto-stops at 10s or tap to stop
- Perfect for capturing the room singing

### iOS Graceful Degradation (FR69)

| Capture Type | Chrome Android | iOS Safari |
|---|---|---|
| Photo | Inline via `getUserMedia` | Inline via `getUserMedia` |
| Video | Inline via `MediaRecorder` API | Falls back to `<input type="file" accept="video/*" capture>` (native picker). Returns to app after capture |
| Audio | Inline via `MediaRecorder` API | Falls back to `<input type="file" accept="audio/*" capture>` (native picker). Returns to app after capture |

The native picker fallback on iOS navigates briefly to the camera/voice recorder app, then returns. The capture still completes without the user losing their place in the party — WebSocket stays connected, DJ state syncs on return.

### Background Upload (FR71)

- Captured media is queued immediately, uploaded in background
- Small upload indicator (subtle progress ring on capture icon in toolbar) — never blocks interaction
- Failed uploads retry automatically on next stable connection
- All media tagged: `{sessionId, userId, timestamp, triggerType, djState}` (FR70)

### Persistent Manual Capture (FR39)

Separate from the prompted bubble: a small camera icon lives in the Song State toolbar at all times. Any participant can tap it to manually initiate a capture at any moment — independent of the bubble system. Same photo/video/audio flow.

### Design Rules

- Bubble never appears during voting (4s window is sacred — no distractions)
- Bubble never appears during silence phase (tension moment — don't break it)
- Maximum 1 bubble per 60 seconds (prevent bubble fatigue)
- Capture UI is always an overlay — never navigates away from current screen (except iOS native picker fallback)
- No preview/edit step — capture → auto-upload → done. Designed rawness (Locket pattern)
- All captured media accessible post-session to all participants (FR72)

## Party Cards System UX

### Overview

Party Cards are Karamania's second core differentiator — they transform every performance from "person sings song" into "person sings song *while doing something ridiculous*." The DJ auto-deals one card per singer during pre-song state. 19 curated cards across 3 types: vocal modifiers (7), performance modifiers (7), and group involvement (5).

### Card Deal Flow — Beat by Beat

**1. Card Appears (singer's phone, T+0)**
- DJ engine selects card from pool (weighted random, no immediate repeats by type)
- Singer's phone: card slides up from bottom with flip animation + card-flip sound effect
- Everyone else: "🃏 CHALLENGE INCOMING..." with singer's name — builds anticipation
- Card shows: title, emoji icon, one-sentence description, card type badge (VOCAL / PERFORMANCE / GROUP)

**2. Singer Decides (T+0 to T+8s, soft deadline)**
- Three action buttons at bottom of card:
  - **ACCEPT** (green, 56×56px) — challenge is on. Card title broadcasts to all phones
  - **DISMISS** (grey, 48×48px) — no challenge this song. Card slides away quietly
  - **REDRAW** (accent color, 48×48px, shows "1 FREE" badge) — new card dealt with shuffle animation. After redraw, button disappears (one free per turn)
- If singer doesn't act within 8s, card auto-dismisses (no penalty, no shame)
- Host can override: force-dismiss or force-deal a specific card from host controls

**3. Card Broadcast (after accept)**
- All phones flash the accepted card: "🎭 DUC ACCEPTED: METHOD ACTOR — Full Broadway Drama!"
- 3-second display, then transition to Song State
- Group involvement cards trigger additional step (see below)

**4. Group Involvement Cards — Participant Selection**
- When a group card is accepted (Backup Dancers, Hype Squad, Tag Team, Crowd Conductor, Name That Tune):
  - App selects random participants and announces on ALL phones
  - "🎤 TAG TEAM: MINH takes over at the chorus!"
  - "💃 BACKUP DANCERS: TRANG and LINH — get behind the singer!"
  - Selected participants' phones pulse with accent glow for 3 seconds
  - **No consent flow** — social dynamics handle opt-outs (per PRD FR60). If someone doesn't want to, they just don't stand up. The app doesn't enforce
  - Tag Team: during chorus, the tagged person's phone shows "YOUR TURN!" flash

**5. Challenge Completion Tracking**
- After ceremony, if card was accepted: singer gets +5 engagement points (Engaged tier)
- Ceremony awards reference the challenge: "Vocal Assassin — Method Actor Edition"
- Card acceptance rate and completion tracked per session (PRD FR61)

### Card Categories — UX Differentiation

| Type | Visual Treatment | Singer Experience | Audience Experience |
|---|---|---|---|
| **Vocal Modifier** (Chipmunk, Barry White, Whisperer, Robot, Opera, Accent, Beatbox) | Blue card border | "Change HOW you sing" — focused on voice | Watch and laugh. No audience action required |
| **Performance Modifier** (Blind, Method Actor, Statue, Slow-Mo, Drunk Uncle, News Anchor, Dance) | Purple card border | "Change HOW you perform" — focused on body | Watch, react, hype. No audience action required |
| **Group Involvement** (Name That Tune, Backup Dancers, Crowd Conductor, Tag Team, Hype Squad) | Gold card border + participant names | "Pull others in" — the singer is now a director | Selected participants get a specific role for the song |

### Party Card Deal Screen Layout

```
┌─────────────────────┐
│   TopBar: PARTY CARD │
│                      │
│    ┌──────────────┐  │
│    │  🎭          │  │
│    │  METHOD ACTOR │  │
│    │              │  │
│    │  Perform like│  │
│    │  it's        │  │
│    │  Broadway    │  │
│    │              │  │
│    │ PERFORMANCE  │  │
│    └──────────────┘  │
│                      │
│  ┌────┐ ┌────┐ ┌──┐ │
│  │ ✓  │ │ ✕  │ │🔄│ │
│  │ACC │ │DIS │ │RE│ │
│  └────┘ └────┘ └──┘ │
└─────────────────────┘
```

### Party Card Timing in DJ Cycle

```
Interlude (vote next singer) → Genre Pick → PARTY CARD DEAL (8s max) → Song State
                                                                         ↳ challenge active badge visible
```

The party card deal happens AFTER genre pick and BEFORE song state. It's a 3-8 second micro-moment that adds anticipation without blocking the flow. If the singer is already at the mic and the card times out, it auto-dismisses — the party card never delays the music.

### Design Rules

- Cards never repeat within a session until all 19 have been dealt (or pool exhausted for type)
- Group involvement cards are suppressed when participant count < 3 (per NFR12)
- First song of the night: card deal is optional — DJ may skip to reduce first-song friction
- Challenge completion is self-reported by social dynamics, not app-enforced. The app tracks acceptance, not performance
- Card acceptance rate target: >50% by song 5 (PRD metric)

## Interlude Games UX

### Overview

Interludes fill the gaps between songs with mini-games that keep energy high and pull in non-singers. Three core games for MVP (FR28a-b), selected by the DJ engine via weighted random with no immediate repeats. Front-loaded in the first 30 minutes for maximum group inclusion (FR15, Trang's engagement ladder).

### Game 1: Kings Cup (Group Rule Card)

**Concept:** A rule card is drawn. Everyone it applies to must do something together.
**Attention mode:** Active (everyone reads, group reacts)

**Flow:**
1. Card slides in with flip animation: "Everyone who has been to Đà Lạt this year..." + action
2. Action examples: "...sing the next chorus together," "...take a selfie together," "...do a shot" (configurable, host can pre-filter spice level)
3. No individual targeting — group-based selection by shared experience
4. Self-selecting: participants decide for themselves if the rule applies. No enforcement
5. 10-second display, then auto-advance to next DJ state

**Screen layout:**
```
┌─────────────────────┐
│  TopBar: KINGS CUP   │
│                       │
│    ┌──────────────┐  │
│    │  👑           │  │
│    │               │  │
│    │  Everyone who │  │
│    │  has been to  │  │
│    │  Đà Lạt this  │  │
│    │  year...      │  │
│    │               │  │
│    │  SING THE NEXT│  │
│    │  CHORUS       │  │
│    │  TOGETHER!    │  │
│    └──────────────┘  │
│                       │
└─────────────────────┘
```

**Why it works for Trang:** Group-based, not individual. She decides privately if it applies to her. No name on screen. Low pressure, high inclusion.

### Game 2: Dare Pull (Random Dare → Random Player)

**Concept:** A dare is assigned to a random participant. Social dynamics handle opt-outs.
**Attention mode:** Active (named person, room watches)

**Flow:**
1. "DARE PULL" title with slot-machine animation cycling through participant names
2. Name lands: "MINH!" — with dramatic pause + reveal sound
3. Dare appears below: "Do your best impression of the last singer"
4. 15-second timer for the dare to happen (in real life, not in-app)
5. Auto-advance after timer — no "did they do it?" enforcement

**Screen layout:**
```
┌─────────────────────┐
│  TopBar: DARE PULL   │
│                       │
│    ┌──────────────┐  │
│    │  🎲           │  │
│    │               │  │
│    │    MINH!      │  │  ← Name reveal with scale animation
│    │               │  │
│    │  Do your best │  │
│    │  impression   │  │
│    │  of the last  │  │
│    │  singer       │  │
│    │               │  │
│    │   ⏱️ 15s      │  │  ← Countdown
│    └──────────────┘  │
│                       │
└─────────────────────┘
```

**Design rule:** Dare Pull is NEVER front-loaded in the first 30 minutes. Individual dares require earned trust. Kings Cup and Quick Vote come first.

### Game 3: Quick Vote (Binary Opinion Poll)

**Concept:** A binary opinion question. Everyone votes. Results reveal.
**Attention mode:** Active (everyone participates)

**Flow:**
1. Question appears: "Is Bohemian Rhapsody overrated?"
2. Two large buttons: YES / NO (or custom options)
3. 6-second hard voting window with countdown
4. Results reveal: bar chart showing split + count ("5 YES — 3 NO")
5. No winner/loser — just the room discovering where they stand
6. Auto-advance after 5s reveal

**Screen layout:**
```
┌─────────────────────┐
│  TopBar: QUICK VOTE  │
│                       │
│  Is Bohemian Rhapsody │
│     overrated?        │
│                       │
│  ┌─────────────────┐ │
│  │      YES        │ │  ← 56×56px tall button
│  └─────────────────┘ │
│                       │
│  ┌─────────────────┐ │
│  │       NO        │ │
│  └─────────────────┘ │
│                       │
│      ⏱️ 6s           │
└─────────────────────┘
```

**Why it works for Trang:** Everyone has opinions. Binary choice — zero decision paralysis. Anonymous voting, public results. She can be opinionated without being loud.

### Interlude Selection Rules

| Rule | Rationale |
|---|---|
| Weighted random, no immediate repeats (FR28a) | Kings Cup twice in a row feels broken |
| Front-load Kings Cup + Quick Vote in first 30 min (FR15) | Universal, low-pressure — earn trust before Dare Pull |
| Dare Pull only after minute 30 | Individual spotlight requires earned group comfort |
| Skip group interludes when < 3 participants (NFR12) | Games need a group |
| Host can skip any interlude (1 tap from host controls) | Safety valve for the room's energy |

### Interlude Participation Scoring

| Game | Action | Points | Tier |
|---|---|---|---|
| Kings Cup | Group rule card shown (participation assumed) | 5 | Engaged |
| Dare Pull | Dare completed (social observation, not app-enforced) | 5 | Engaged |
| Quick Vote | Vote cast within window | 3 | Active |

## Visual Design Foundation

### Color System — Vibe-Adaptive

**Architecture: Dark constants + shifting accents per party vibe.**

The host picks a vibe with one emoji tap at party creation. That sets `data-dj-vibe` on `<body>` for the entire session. Dark surfaces stay constant (readability in KTV rooms is non-negotiable). Only 4 accent tokens shift per vibe. General is the `:root` default — if `data-dj-vibe` is never set (WebSocket drops, late join), the app still looks correct.

```svelte
<body data-dj-state={$djState} data-dj-vibe={$partyVibe}>
```

**Complete Token File — Inlined in `<head>`:**

```css
/* tokens.css — inlined in <head> as <style> block */
:root {
  /* === CONSTANTS (never change per vibe) === */

  /* Surfaces */
  --dj-bg: #0a0a0f;
  --dj-surface: #1a1a2e;
  --dj-surface-elevated: #252542;

  /* Text */
  --dj-text-primary: #f0f0f0;
  --dj-text-secondary: #8888aa;

  /* Universal Actions */
  --dj-action-confirm: #4ade80;
  --dj-action-danger: #ef4444;

  /* Timing */
  --dj-transition-fast: 150ms;

  /* Spacing (8px base unit) */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;

  /* === VIBE DEFAULTS (General — overridden per vibe) === */
  --dj-accent: #ffd700;
  --dj-ceremony-glow: #ffd700;
  --dj-ceremony-bg: #1a0a2e;
  --dj-action-primary: #6c63ff;
}

/* === VIBE OVERRIDES === */
[data-dj-vibe="kpop"] {
  --dj-accent: #ff0080;
  --dj-ceremony-glow: #ff69b4;
  --dj-ceremony-bg: #1a0a20;
  --dj-action-primary: #cc00ff;
}
[data-dj-vibe="rock"] {
  --dj-accent: #ff4444;
  --dj-ceremony-glow: #ff6600;
  --dj-ceremony-bg: #1a0a0a;
  --dj-action-primary: #cc4422;
}
[data-dj-vibe="ballad"] {
  --dj-accent: #ff9966;
  --dj-ceremony-glow: #ffcc88;
  --dj-ceremony-bg: #1a1210;
  --dj-action-primary: #cc8866;
}
[data-dj-vibe="edm"] {
  --dj-accent: #00ffc8;
  --dj-ceremony-glow: #00c8ff;
  --dj-ceremony-bg: #0a1a1a;
  --dj-action-primary: #00c8ff;
}
```

General vibe needs no `[data-dj-vibe="general"]` rule — it's the `:root` default. Defensive CSS: the app works even if `data-dj-vibe` is never set.

**Tailwind Config Bridge:**

```js
// tailwind.config.js — connects Tailwind classes to CSS custom properties
module.exports = {
  theme: {
    extend: {
      colors: {
        dj: {
          bg: 'var(--dj-bg)',
          surface: 'var(--dj-surface)',
          'surface-elevated': 'var(--dj-surface-elevated)',
          accent: 'var(--dj-accent)',
          'ceremony-glow': 'var(--dj-ceremony-glow)',
          'ceremony-bg': 'var(--dj-ceremony-bg)',
        },
        text: {
          primary: 'var(--dj-text-primary)',
          secondary: 'var(--dj-text-secondary)',
        },
        action: {
          primary: 'var(--dj-action-primary)',
          confirm: 'var(--dj-action-confirm)',
          danger: 'var(--dj-action-danger)',
        },
      },
      fontFamily: {
        display: ['Space Grotesk', 'system-ui', 'sans-serif'],
      },
      spacing: {
        xs: 'var(--space-xs)',
        sm: 'var(--space-sm)',
        md: 'var(--space-md)',
        lg: 'var(--space-lg)',
        xl: 'var(--space-xl)',
      },
    },
  },
}
```

Svelte templates use `bg-dj-surface text-text-primary border-action-primary` and vibe changes cascade automatically through CSS custom properties. No conditional class logic needed.

**Vibe-Specific Flavor Layer:**

| Element | How It Adapts Per Vibe | Scope |
|---|---|---|
| Confetti emoji pool | General: 🎉✨🌟🎊 / K-pop: 💖💜✨ / Rock: 🔥⚡ / Ballad: ✨🌟 / EDM: 💎✨ | Full + Quick ceremonies |
| Reaction button set | General: 🔥👏😂💀 / K-pop: 🔥👏😍💀 / Rock: 🔥🤘😂💀 / Ballad: ❤️😭👏🥹 / EDM: 🔥👏🎧💀 | All states |
| Award copy flavor | General: "Absolute showstopper" / K-pop: "Main vocal energy" / Rock: "Shredded the vocals" / Ballad: "Hit us right in the feels" / EDM: "Dropped the vocals hard" | **Full ceremonies only.** Quick ceremonies use generic copy across all vibes — they're 6-second shoutouts, nobody reads the subtitle |

All stored in `constants/copy.js` as vibe-keyed objects. One file, five flavor sets.

**Vibe Selection UX:**

Single screen during party creation. Five emoji buttons: 🎤 💖 🎸 🎵 🎧. General (🎤) pre-selected as default.

**Micro-preview on tap:** Host taps 🎸 → the picker screen background shifts to Rock accent colors for 2 seconds, then resets to current selection. Same `data-dj-vibe` CSS switching applied to the picker screen temporarily via a Svelte `on:click` that sets a preview state. Zero new components. Solves the "what does EDM even mean?" problem — hosts don't need to know genre names, they tap and SEE the color.

**Post-MVP: Vibe Monetization Surface**

Base 5 vibes are free forever. Two expansion paths:
- **Achievement vibes:** "Host 3 parties → unlock Retro 80s." Drives repeat hosting behavior
- **Premium seasonal vibes:** Tết (red + gold), Birthday, Halloween. Paid, time-limited. Vietnamese micro-transaction culture supports this

The CSS architecture supports unlimited vibes — each is just another `[data-dj-vibe]` rule block.

### Typography System

**Space Grotesk — Bold, geometric, built for dark rooms and glancing eyes.**

| Role | Size | Weight | Usage |
|---|---|---|---|
| **Display** | 32px / 2rem | 700 | Winner name on ceremony reveal. THE biggest text |
| **Title** | 24px / 1.5rem | 700 | Award category names, screen headers |
| **Subtitle** | 16px / 1rem | 600 | Award descriptions, participant names in voting |
| **Body** | 14px / 0.875rem | 400 | Secondary information, vote percentages |
| **Caption** | 12px / 0.75rem | 400 | Status labels, timestamps, "CEREMONY" badge |
| **Button** | 14px / 0.875rem | 700 | All interactive buttons, uppercase for primary actions |

**Why Space Grotesk:**
- Geometric sans-serif with distinctly wide characters — readable at arm's length in dim lighting
- Variable font (one file, all weights) — plays well with two-tier bundle strategy
- Free (Google Fonts) — no licensing for MVP
- Distinct enough to feel branded, neutral enough to work across all 5 vibes

**Font Loading Strategy:**
- **Self-hosted subsetted woff2 file.** Use `glyphhanger` or `fonttools` to subset to Latin + Vietnamese characters. Vietnamese diacritics (ă, ơ, ư, đ, etc.) are required for participant names. Without explicit Vietnamese subsetting, diacritics render in fallback system font while Latin renders in Space Grotesk — looks broken
- Target: **<25KB** for the subsetted variable font file (within core bundle budget)
- `@font-face` declaration inlined in `<head>` alongside design tokens
- `font-display: swap` — show system font immediately, swap when loaded
- Fallback stack: `'Space Grotesk', system-ui, sans-serif`

**Type Rules:**
- Award titles and winner names: UPPERCASE. Ceremonies are announcements, not sentences
- Body text and descriptions: Sentence case. Conversational, not formal
- Buttons: UPPERCASE for primary actions (VOTE NOW), Sentence case for secondary
- No italics anywhere — italics are hard to read on small screens in poor lighting
- Minimum tap-target text: 14px. Nothing interactive below this size

### Spacing & Layout System

**8px Base Unit — Everything Is a Multiple of 8**

All spacing tokens inlined in `<head>` alongside color tokens (one `<style>` block, all tokens).

| Token | Value | Usage |
|---|---|---|
| `--space-xs` | 4px | Tight gaps (between icon and label) |
| `--space-sm` | 8px | Default gap between inline elements |
| `--space-md` | 16px | Section padding, card padding |
| `--space-lg` | 24px | Between major sections |
| `--space-xl` | 32px | Screen-level padding, ceremony reveal spacing |

**Layout Principles:**

1. **Single column, full width.** No side-by-side layouts on phone screens. Every screen is a vertical stack
2. **Tap targets: minimum 44x44px.** Apple HIG minimum. Everything tappable meets this
3. **Safe area awareness.** Respect iPhone notch and home indicator. Bottom action buttons have 16px minimum padding from bottom edge
4. **Content hugs bottom.** Primary actions live at thumb reach (bottom third). Information at top. Ceremony reveals center vertically for maximum drama
5. **No scroll during ceremonies.** Ceremony reveal, voting, and celebration all fit in viewport. If content exceeds viewport, reduce animation area — never add scroll

**Grid System:**

- Soundboard: 3-column CSS Grid (medium density), equal-width cells, 8px gap
- Reaction bar: Flexbox, center-justified, 10px gap
- Participant list: Single column, full width, 44px minimum row height
- Vote bars: Flexbox row (name | bar | percentage), 6px gap
- No 12-column grid system. Overkill for a single-column phone app

### Accessibility Considerations

**Contrast Ratios (WCAG AA minimum):**

| Combination | Ratio | Passes? |
|---|---|---|
| `--dj-text-primary` (#f0f0f0) on `--dj-bg` (#0a0a0f) | 18.3:1 | AA + AAA |
| `--dj-text-secondary` (#8888aa) on `--dj-bg` (#0a0a0f) | 5.8:1 | AA |
| `--dj-accent` (#ffd700) on `--dj-ceremony-bg` (#1a0a2e) | 8.9:1 | AA + AAA |
| `--dj-action-danger` (#ef4444) on `--dj-bg` (#0a0a0f) | 5.2:1 | AA |
| All vibe accents on their respective `--dj-ceremony-bg` | >4.5:1 | AA (verified per vibe) |

**Touch Accessibility:**
- All tap targets ≥ 44x44px (Apple HIG)
- 8px minimum gap between adjacent tap targets (prevents fat-finger errors)
- Song Over requires 500ms long-press (prevents accidental triggers)
- No double-tap or swipe gestures anywhere — single tap only (Trang-friendly)

**Motion Accessibility (`prefers-reduced-motion`):**
- Ceremony reveals use instant show/hide instead of `elasticOut` transitions
- No auto-playing looping animations (confetti is event-triggered, not ambient)
- Drumroll and anticipation phase visual dimming become instant state changes
- **Spatial audio volume split suppressed:** all devices play at equal volume (no host-loud/participant-quiet differentiation). Users who set reduced-motion often have vestibular sensitivities — sudden volume changes from multiple devices can trigger discomfort. The ceremony still works; it loses the directional audio effect only

**Color Accessibility:**
- Vote bar charts use position + percentage text in addition to color fill — color-blind users can read results
- Winner indication uses size (2x) + position (top) + text label in addition to accent color
- No information conveyed by color alone

## Design Direction Decision

### Design Directions Explored

We explored a **full DJ state walkthrough** — 9 sequential screens showing every state a user experiences from joining through end-of-night. Instead of generic mockup variations, we designed the complete screen inventory with real content, real Vietnamese names, and the vibe-adaptive color system applied across all screens. Interactive HTML mockup at `_bmad-output/planning-artifacts/ux-design-directions.html` with sticky vibe switcher (5 palettes recolor all screens in real-time).

### Complete Screen Inventory

| # | Screen | DJ State | Attention Mode | Sprint |
|---|--------|----------|----------------|--------|
| 1 | Join & Name Entry | `lobby` | Active | 1 |
| 2 | Icebreaker Tap | `icebreaker` | Active | 1 |
| 3 | Party Card Deal | `party_card_deal` | Active | 2 |
| 4 | Song State (with Lightstick + Hype modes) | `song` | Lean-in | 1 (base), 2 (modes) |
| 5 | Voting Phase | `ceremony.voting` | Active | 1 |
| 6 | The Silence | `ceremony.silence` | Active | 1 |
| 7 | The Reveal | `ceremony.reveal` | Active | 1 |
| 8 | Quick Ceremony | `ceremony.quick_reveal` | Active | 1 |
| 9 | Interlude Games (Kings Cup / Dare Pull / Quick Vote) | `interlude` | Active | 3 |
| 10 | Next Singer Vote | `interlude.vote` | Active | 1 |
| 11 | Capture Bubble (overlay) | any active state | Lean-in | 2 |
| 12 | Finale Recap | `finale` | Active | 1 |

### Song Integration & Discovery System

The brainstorming session (2026-03-05) resolved the "how to know what song is playing" challenge. The YouTube Lounge API — the same pairing mechanism users already use to control their YouTube TV from their phone — enables passive song detection AND queue control from Karamania. Combined with playlist import and an intersection-based suggestion engine, the app eliminates the core "what should we sing?" decision fatigue that plagues every karaoke night.

**Two-Mode Architecture:**
1. **Passive Lounge API (always-on core):** Pairs with YouTube TV via the TV code, passively detects every song via `nowPlaying` events, pushes selected songs to queue via `addVideo`. The app knows what's playing without anyone typing anything.
2. **Playlist Import (cold-start assist):** Friends paste YouTube Music or Spotify playlist URLs when they join. The app reads all songs, cross-references against the Karaoke Catalog, and builds a shared song pool in real-time.

**What Song Data Unlocks (beyond genre tags):**
- **Song-aware ceremonies:** "Best Rendition of Bohemian Rhapsody" instead of generic "Best Vocalist"
- **Song-level setlist poster:** Full track-by-track finale with song titles, artists, performers
- **Genre momentum in suggestions:** After 3 ballads → suggestions shift to upbeat tracks
- **Cross-session learning (v2):** Snowball Effect — each session makes suggestions smarter for the group

#### TV Pairing Flow (FR74-FR79)

**The Aha Moment: TV code = room code.** The Jackbox Games pattern — host enters the code already on the TV screen, and the app connects instantly.

**Beat-by-beat:**
1. Host creates party → sees "Pair with YouTube TV" prompt with input field
2. Host looks at YouTube TV → enters the 12-digit pairing code displayed on screen
3. App pairs via Lounge API within 2-3 seconds → "Connected to TV!" confirmation
4. From this point: every song played on YouTube TV is automatically detected by the app
5. Songs selected via Quick Pick / Spin the Wheel are auto-queued on the TV

**Screen layout — TV Pairing (host only, during party creation):**
```
┌─────────────────────┐
│  TopBar: SETUP       │
│                      │
│   📺 Connect to TV   │
│                      │
│   Enter the code     │
│   shown on your      │
│   YouTube TV:        │
│                      │
│  ┌────────────────┐  │
│  │  _ _ _ _ _ _ _ │  │  ← Number input (12 digits)
│  └────────────────┘  │
│                      │
│  ┌────────────────┐  │
│  │   CONNECT      │  │
│  └────────────────┘  │
│                      │
│  [Skip — no TV]      │  ← Enters suggestion-only mode (FR92)
│                      │
└─────────────────────┘
```

**Pairing states:**
- `pairing` → input visible, host entering code
- `connecting` → spinner, "Connecting to TV..." (2-3s)
- `paired` → "Connected! Songs will auto-queue on your TV" with checkmark
- `failed` → "Couldn't connect. Check the code and try again" with retry
- `skipped` → Suggestion-only mode, host can pair later (FR95)

**Connection resilience (FR79):** If the Lounge API connection drops mid-session, the system attempts automatic reconnection for up to 60 seconds. If reconnection fails, a single non-blocking notification appears to the host: "TV connection lost. Songs won't auto-queue until reconnected." The party continues normally — DJ engine, ceremonies, interludes all work without TV connection. Host can re-enter code from host controls at any time.

#### Playlist Import Flow (FR80-FR84)

**When it happens:** After joining the party, every participant sees a prompt: "Share your playlist so we can find songs you all know!" This appears as a card in the lobby, persistent but dismissable.

**Beat-by-beat:**
1. Participant opens their music app (YouTube Music or Spotify)
2. Copies a playlist share URL
3. Pastes into the Karamania input field
4. App auto-detects the platform from the URL domain (FR80)
5. App reads the playlist via the appropriate API (1-5 seconds)
6. "Found 47 songs!" confirmation with song count
7. Songs are cross-referenced against Karaoke Catalog in real-time

**Screen layout — Playlist Import (all participants, lobby + persistent):**
```
┌─────────────────────┐
│  TopBar: PARTY LOBBY │
│                      │
│  🎵 Share Your Music │
│                      │
│  Paste a playlist    │
│  link from YouTube   │
│  Music or Spotify:   │
│                      │
│  ┌────────────────┐  │
│  │ Paste URL here │  │  ← Text input (only playlist URL input in app)
│  └────────────────┘  │
│                      │
│  ┌────────────────┐  │
│  │   IMPORT       │  │
│  └────────────────┘  │
│                      │
│  ✅ Minh: 47 songs   │  ← Already imported
│  ✅ Duc: 83 songs    │  ← Already imported
│  ⏳ Trang: importing │  ← In progress
│                      │
│  [Skip for now]      │
└─────────────────────┘
```

**Spotify Private Playlist Guidance (FR83):**
When a Spotify playlist is private and can't be read, the app shows a 3-step visual guide:
1. "Open your Spotify app"
2. "Tap ••• on your playlist → Make Public"
3. "Come back and paste the link again"

Clean, visual, no jargon. The guide is inline — no modal, no navigation away. Takes 10 seconds.

**Import states per participant:**
- `none` → No playlist imported, prompt visible
- `importing` → Spinner with "Reading your playlist..."
- `imported` → "Found {n} songs!" with checkmark
- `error_private` → Spotify private playlist guidance (FR83)
- `error_invalid` → "That doesn't look like a playlist URL. Try again?"
- `skipped` → Dismissed, can import later from participant menu

**Song normalization (FR84):** Songs are matched across platforms by title + artist name. Duplicates merge with overlap count tracking — "4/5 friends know this song" is the signal that powers suggestion ranking.

#### Suggestion Engine UX (FR85-FR87)

**The algorithm visualized:**
```
Friends' playlists     Songs sung tonight     Karaoke Catalog
  (YouTube Music,    ∪  (detected via        ∩  (10K+ tracks from
   Spotify)              Lounge API)             karaoke YouTube channels)
        │                      │                        │
        └──────────┬───────────┘                        │
                   │                                    │
         Songs the group knows  ──── intersection ─── Songs with karaoke versions
                                                            │
                                                    Suggestion Pool
                                                            │
                                              Ranked by:
                                              1. Group overlap count (more friends = higher)
                                              2. Genre momentum (avoid repetition)
                                              3. Not-yet-sung (unplayed songs prioritized)
```

**Cold start fallback (FR91):** When no playlists have been imported and no songs have been sung, the engine falls back to "Karaoke Classics" — a pre-curated subset of the top 200 universally known karaoke songs. The app works out of the box before anyone imports anything.

#### Quick Pick Mode (FR88) — Default Song Selection

**Concept:** 5 AI-suggested songs displayed as cards. Everyone votes. Majority wins. Fast, democratic, data-driven.

**Beat-by-beat:**
1. DJ engine enters `song_selection` state → all phones show Quick Pick
2. 5 song cards appear: title, artist, thumbnail, group overlap badge ("4/5 know this")
3. Each participant taps 👍 or ➡️ (skip) on each card
4. Real-time vote counts visible on cards as they fill
5. First song to reach majority approval → auto-selected
6. If no majority within 15 seconds → highest-voted song wins
7. Selected song auto-queues on YouTube TV via Lounge API (FR78)
8. Transition to Party Card Deal for the next singer

**Screen layout — Quick Pick:**
```
┌─────────────────────┐
│  TopBar: PICK A SONG │
│                      │
│  ┌────────────────┐  │
│  │ 🎵 Bohemian    │  │
│  │    Rhapsody    │  │
│  │    Queen       │  │
│  │  [5/5 know]    │  │  ← Overlap badge
│  │  👍 3  ➡️ 1    │  │  ← Real-time votes
│  └────────────────┘  │
│                      │
│  ┌────────────────┐  │
│  │ 🎵 Cơn Mưa    │  │
│  │    Ngang Qua   │  │
│  │    Sơn Tùng    │  │
│  │  [4/5 know]    │  │
│  │  👍 2  ➡️ 0    │  │
│  └────────────────┘  │
│                      │
│  ... (3 more cards)  │
│                      │
│  ⏱️ 12s             │  ← 15s auto-advance countdown
│                      │
│  [🎡 Spin Instead]  │  ← Mode switch (FR90)
└─────────────────────┘
```

**Quick Pick design rules:**
- Cards are vertically scrollable (5 cards won't fit on small screens)
- Vote counts update in real-time via WebSocket broadcast
- Overlap badge uses accent color for high overlap (4-5), secondary for low (1-2)
- 15-second hard deadline is server-authoritative (consistent with ceremony timing pattern)
- Song thumbnails are YouTube video thumbnails (free via YouTube Data API)
- Tapping 👍 or ➡️ is a single-tap social action (Tier 2 tap)

#### Spin the Wheel Mode (FR89) — Party Energy Selection

**Concept:** 8 songs on an animated wheel. Someone spins. Dramatic reveal. One veto allowed.

**Beat-by-beat:**
1. Mode toggled via switch from Quick Pick
2. 8 AI-suggested songs loaded onto wheel segments (title + artist visible on segments)
3. Any participant taps SPIN → wheel animates with deceleration easing
4. Wheel lands on a song → dramatic pause → song title enlarges with reveal sound
5. Group gets one veto per round: "Not that one!" button appears for 5 seconds
6. If vetoed → wheel re-spins automatically with the vetoed song removed
7. If accepted (5s pass without veto) → song auto-queues on TV
8. Transition to Party Card Deal

**Screen layout — Spin the Wheel:**
```
┌─────────────────────┐
│  TopBar: SPIN IT!    │
│                      │
│       ┌─────┐       │
│     ╱    ▼    ╲     │  ← Pointer at top
│    │  Song 1   │    │
│   │   Song 8    │   │
│   │             │   │  ← Animated wheel
│   │   Song 2    │   │     with 8 segments
│    │  Song 7   │    │
│     ╲         ╱     │
│       └─────┘       │
│                      │
│  ┌────────────────┐  │
│  │     SPIN!      │  │  ← Big button, anyone can tap
│  └────────────────┘  │
│                      │
│  [🗳️ Quick Pick]    │  ← Mode switch (FR90)
└─────────────────────┘
```

**Post-spin reveal:**
```
┌─────────────────────┐
│  TopBar: THE PICK!   │
│                      │
│                      │
│   🎵 Cơn Mưa        │
│      Ngang Qua       │  ← Song title scales in (elasticOut)
│      Sơn Tùng       │
│                      │
│   [4/5 know this]    │
│                      │
│  ┌────────────────┐  │
│  │  NOT THAT ONE! │  │  ← Veto button (5s window)
│  └────────────────┘  │
│       ⏱️ 5s          │
│                      │
└─────────────────────┘
```

**Spin the Wheel design rules:**
- Wheel animation uses CSS `transform: rotate()` with custom deceleration easing (not linear)
- Wheel segments show truncated song titles (max ~15 chars visible per segment)
- SPIN button is 64×64px (Consequential tier — it selects a song for the group)
- Veto button is a 5-second window, single-use per round (any participant can veto)
- Reveal uses the same silence-before-reveal pattern as ceremonies (1s pause → reveal sound)
- Reduced motion: wheel appears landed instantly, no spin animation

#### Mode Toggle (FR90)

Quick Pick is the default mode. A small toggle at the bottom of either mode allows switching:
- From Quick Pick: "[🎡 Spin Instead]" text link
- From Spin the Wheel: "[🗳️ Quick Pick]" text link
- Toggle is per-session preference — remembered for the session, not persisted
- Mode switch is instant — no loading, no state reset
- The mode switch is a Private tier tap (no haptic, no broadcast)

#### Suggestion-Only Fallback (FR92-FR95)

**When the venue doesn't use YouTube for karaoke:** Host skips TV pairing at party creation → app enters suggestion-only mode. Everything works normally EXCEPT:
- Songs are NOT auto-queued on the TV
- Passive song detection is disabled (no `nowPlaying` events)
- When a song is selected via Quick Pick / Spin the Wheel, the app displays the song title and artist prominently so the group can manually enter it into whatever karaoke system the venue uses

**Manual "now playing" marking (FR94):** In suggestion-only mode, after the group selects a song, the host can tap "Now Playing" to feed the song data into the game engine — enabling genre-based mechanics and song-aware ceremonies even without Lounge API detection.

**Screen layout — Suggestion-Only Song Selected:**
```
┌─────────────────────┐
│  TopBar: NEXT SONG   │
│                      │
│                      │
│   🎵 Bohemian        │
│      Rhapsody        │  ← Large, prominent display
│      Queen           │
│                      │
│   Enter this song    │
│   on your karaoke    │
│   machine!           │
│                      │
│  ┌────────────────┐  │
│  │  NOW PLAYING   │  │  ← Host only (FR94)
│  └────────────────┘  │
│                      │
└─────────────────────┘
```

**TV pairing is optional at any time (FR95):** Host can start without pairing and connect later from host controls. The system transitions from suggestion-only mode to full TV-paired mode seamlessly.

### Chosen Direction

**Full DJ state walkthrough with song intelligence** — a single visual direction showing every screen in sequence, with the vibe-adaptive color system applied throughout, the Song Integration Engine powering suggestions and auto-queuing, and genre/song data driving contextual ceremonies and challenges.

Key design decisions locked in:
- **Vote for singer, not song**: Vietnamese cultural respect (giữ thể diện — face-saving). Voting for a person is encouragement; voting against a song is personal
- **Song data flows passively**: Lounge API detects what's playing — no user input required for song-level intelligence
- **Quick Pick is the default**: Fast, democratic, data-driven. Spin the Wheel is the party-energy alternative
- **Auto-queue eliminates friction**: Selected songs go directly to the TV — nobody types into the karaoke machine
- **Playlist import is cold-start onboarding**: Lounge API passive detection is the core. Playlists seed the suggestion engine with "songs the group knows"
- **Suggestion-only mode as graceful fallback**: App works at any venue, with or without YouTube TV

### Screen-by-Screen Design Decisions

| Screen | Host View Difference | Key Interaction |
|--------|---------------------|----------------|
| Lobby + TV Pairing | "Start Party" button + TV pairing input | Name entry → JOIN (AudioContext unlock). Host: enter TV code |
| Playlist Import | Same | Paste playlist URL → auto-import |
| Icebreaker | Same | Tap answer → synchronized reveal |
| Quick Pick | Same | Tap 👍 or ➡️ on song cards, 15s auto-advance |
| Spin the Wheel | Same | Tap SPIN, watch animation, optional veto |
| Party Card Deal | Same | Singer: accept/dismiss/redraw. Others: "challenge incoming" |
| Song State | "Song Over!" long-press (500ms fill) | Soundboard taps (6 sounds), emoji reactions (5 emoji) |
| Voting | Same | Single tap on one nominee, 4s hard window, circular countdown |
| Silence | Same | None — 1.5-2s tension moment, all audio cuts, near-black |
| Reveal | Same | Post-reveal reaction taps, vote bar chart visible |
| Quick Ceremony | Same | None — DJ auto-selects from participation data, ~6s |
| Interlude | Same | Mini-game (Kings Cup, Dare Pull, Quick Vote) |
| Suggestion-Only Display | "Now Playing" button | Song title displayed for manual karaoke machine entry |
| Finale | Same | Share button → native share sheet (screenshot-prompt MVP) |

**Host vs. Participant divergence (5 differences):**
1. Host sees "Song Over!" button during song state (500ms long-press with fill animation)
2. Host sees "Start Party" in lobby
3. Host sees TV pairing input during party creation (FR74)
4. Host sees "Now Playing" button in suggestion-only mode (FR94)
5. Everything else identical — same ceremony, same reveal, same Quick Pick, same timing

### Ceremony Component Architecture

Single `Ceremony.svelte` with `$ceremonyPhase` derived store:
- `voting` → 4s hard window, circular countdown, drumroll building
- `silence` → 1.5-2s, all audio cuts, near-black, category name pulsing (opacity 0.3→1.0)
- `reveal` → scale + elasticOut (800ms), spatial audio fanfare, confetti scatter, vote bar chart
- `celebration` → post-reveal reaction window
- `quick_reveal` → no voting, DJ auto-selects, single chime, simpler visual

Phase transitions driven by WebSocket events (`ceremony_silence`, `ceremony_reveal`), not client timers. Server sends `revealAt` timestamp at vote close (T+0), clients schedule synchronized display.

**Ceremony type rules:**
- Full ceremony (~15s): voting → silence → reveal → celebration (the "game show")
- Quick ceremony (~6s): anticipation → quick reveal (the "shoutout")
- Max 2 back-to-back: 1 Full + 1 Quick, then mandatory interlude
- Skip: DJ silently records data, no visible ceremony (invisible to users)

### Design Rationale

1. **Passive song detection eliminates double-entry**: The Lounge API knows what's playing — no user input required for song-level intelligence. Genre tags remain as a lightweight fallback in suggestion-only mode
2. **Face-saving song selection**: Quick Pick and Spin the Wheel let the GROUP decide what to sing — no individual puts themselves on the line by suggesting a song that gets rejected. The algorithm suggests, the group approves
3. **The app doesn't replace the karaoke machine — it enhances the pipeline**: From "what should we sing?" through "who's singing?" to "how did they do?" — Karamania owns the before and after, the TV owns the during
4. **Playlist import is cold-start onboarding, not core**: The Lounge API passive detection is the always-on core. Playlists seed the suggestion engine with "songs the group knows" — valuable but not required
5. **Full state walkthrough over generic mockups**: Seeing every screen in sequence reveals flow problems that isolated mockups hide — transition energy curves, information density shifts, attention mode switches

### Implementation Approach

**Sprint 1 — Core loop skeleton:**
- Lobby → Icebreaker → Song → Ceremony → Interlude → Finale
- Hardcoded party creation (no Create Party screen)
- YouTube TV pairing via Lounge API (host enters TV code)
- `nowPlaying` event listener + video_id → metadata pipeline
- Suggestion-only mode fallback (app works without TV)
- Single-column nominees (scroll OK for 10+)
- One confetti emoji set (no vibe-specific)
- No spatial audio volume split (all devices same volume)
- No reconnection screen (refresh = rejoin)
- Screenshot-prompting for share (no Canvas rendering)

**Sprint 2 additions:**
- Party Cards, Lightstick Mode, Hype Signal, Media Capture
- Two-column nominee grid for 10+ participants
- Vibe-specific confetti sets
- Spatial audio (host 100%, participants 60%)
- Share card Canvas rendering

**Sprint 3 — Song Discovery + Polish:**
- Playlist URL import (YouTube Music + Spotify public)
- Spotify "Make Public" guidance UI
- Intersection-Based Suggestion Engine (overlap ∩ karaoke catalog)
- Quick Pick mode (5 suggestions, group vote, 15s auto-advance)
- Spin the Wheel mode (8 picks, animated wheel, veto)
- Lounge API queue push (selected songs auto-queue on TV)
- Genre momentum ranking
- Karaoke Classics fallback (cold start, no playlists)

**Post-MVP:**
- Snowball Effect (cross-session learning)
- Genre-based game triggers (song genre drives which challenges appear)
- Audio fingerprinting as "magic" secondary detection method
- Apple Music playlist import

## User Journey Flows

### Journey 1: Host Flow — Create → Start → Manage → End

Linh's complete night. The only flow with unique screens and interactions.

**Sprint 1 vs Sprint 2 split:**
- **Sprint 1:** Linh opens a party URL that auto-assigns her as host. No Create Party screen — party is hardcoded.
- **Sprint 2:** Full Create Party screen (name party, pick vibe, generate QR code).

```mermaid
flowchart TD
    A["Open party URL (Sprint 1: hardcoded)"] --> B[Lobby Screen — auto-assigned as host]
    B --> C[Enter name + tap CREATE PARTY]
    C --> D["QR code + 4-digit code displayed"]
    D --> E{Participants joining?}
    E -->|Watch dots fill| E
    E -->|"3+ joined"| F["START PARTY button activates"]
    F --> G["Tap START PARTY"]
    G --> H[Icebreaker fires on all phones]
    H --> I[Linh answers icebreaker too]
    I --> J["Synchronized reveal → room reacts"]

    J --> K["Quick Pick: 5 suggested songs appear on all phones"]
    K --> L{Group votes on songs}
    L --> M["Winner song auto-queues on YouTube TV"]
    M --> N["Party Card Deal → singer walks to mic"]
    N --> O["Song State — lean-in mode"]

    O --> P["Linh sees floating SONG OVER! button"]
    P --> Q{Song finished?}
    Q -->|Not yet| R[Optional: tap reactions/soundboard]
    R --> Q
    Q -->|Yes| S["Long-press SONG OVER! — 500ms fill"]
    S --> T["ceremony_silence event fires"]

    T --> U[Ceremony plays on all phones]
    U --> V["Interlude → Song Selection (Quick Pick / Spin)"]
    V --> W{More songs tonight?}
    W -->|Yes| M
    W -->|"Host taps End Party"| X[Finale ceremony triggers]
    X --> Y[Stats recap + share card]
    Y --> Z[Share → group chat]
```

**Host-Unique Interactions (beat by beat):**

| Moment | What Linh Does | What Everyone Else Sees |
|--------|---------------|----------------------|
| Party creation | Sprint 1: opens URL (auto-host). Sprint 2: CREATE PARTY screen | N/A — they haven't joined |
| TV pairing | Enters YouTube TV code → app connects via Lounge API | N/A — host-only during setup |
| QR display | Holds phone up, says "scan this" | Scan → lobby |
| Start party | Taps START PARTY (appears at 3+ joined) | Waiting... → icebreaker fires |
| Song selection | Same Quick Pick / Spin the Wheel as everyone | Same — group votes together |
| During song | Watches karaoke TV + friends. Phone at side. | Same lean-in mode |
| Song ends | **Long-press SONG OVER!** (500ms fill + haptic) | They don't have this button |
| Host override | Tap skip on a dare that's too spicy (1 tap) | Activity skips, next one loads |
| End of night | Taps END PARTY in host controls | Finale ceremony triggers |

**The "Song Over!" button is the ONLY recurring host duty.** TV pairing is one-time setup. Song selection is group-driven. Everything else is automated. Linh's cognitive load = "watch the song, press when it ends."

**Error Recovery:**
- Accidental Song Over: 500ms long-press prevents misfires. If it happens, ceremony still runs — worst case, a short ceremony for a short song
- Host phone dies: Any participant can be promoted to host (server keeps party state)
- Solo host (1 person): Lobby shows "Works best with 3+ friends!" — all features work, just less social

### Journey 2: Core Party Loop — Join → Song Selection → Song → Ceremony → Interlude

The repeating engine. Every participant experiences this 5-15 times per night.

```mermaid
flowchart TD
    A[Scan QR / enter code] --> B[Lobby: enter name + paste playlist URL]
    B --> C["Tap JOIN PARTY → AudioContext unlocks"]
    C --> D[Wait for host to start]
    D --> E[Icebreaker: tap answer]
    E --> F[Synchronized reveal]

    F --> SS["SONG SELECTION — Quick Pick or Spin the Wheel"]
    SS --> SSQ{Selection mode?}
    SSQ -->|Quick Pick| QP["5 songs, group votes, majority wins"]
    SSQ -->|Spin the Wheel| SW["8 songs on wheel, tap SPIN"]
    QP --> SQ["Song auto-queues on YouTube TV"]
    SW --> SQ
    SQ --> PC["PARTY CARD DEAL — singer's phone shows card"]

    PC --> PCA{Singer's choice}
    PCA -->|Accept| K["Song State with active challenge"]
    PCA -->|Dismiss| K2["Song State without challenge"]
    PCA -->|Redraw| PCR["New card dealt (1 free redraw)"]
    PCR --> PCA2{Accept or dismiss?}
    PCA2 -->|Accept| K
    PCA2 -->|Dismiss| K2

    K --> L["SONG STATE (lean-in / lightstick / hype modes)"]
    K2 --> L
    L --> M{What do you do?}
    M -->|Engaged| N["Tap reactions / soundboard / hype signal"]
    M -->|Lightstick| N2["Toggle lightstick mode — phone glows"]
    M -->|Passive| O["Phone down — listen to music"]
    M -->|Singing| P["Watch karaoke TV — ignore phone"]
    M -->|Capture| CB["Pop capture bubble → photo/video/audio"]

    N --> Q{Host presses Song Over?}
    N2 --> Q
    O --> Q
    P --> Q
    CB --> Q

    Q -->|Yes| R["TRANSITION — fanfare on all phones"]
    R --> S["VOTING (4s hard window)"]
    S --> T[Tap one nominee]
    T --> U["SILENCE (1.5-2s — all audio cuts)"]
    U --> V["REVEAL — winner on all phones"]
    V --> W["Post-reveal reactions + share overlay (winner only)"]

    W --> X{Second ceremony queued?}
    X -->|Yes| Y["QUICK CEREMONY (~6s shoutout)"]
    Y --> Z[INTERLUDE]
    X -->|No| Z

    Z --> ZG{Interlude type?}
    ZG -->|Game| ZGM["Kings Cup / Dare Pull / Quick Vote"]
    ZG -->|Song Selection| SS
    ZGM --> SS
```

**Updated Screen Inventory (includes Song Integration & Discovery):**

| # | Screen | DJ State | Who Sees It | Sprint |
|---|--------|----------|------------|--------|
| 1 | Lobby + Join | `lobby` | Everyone | 1 |
| 2 | TV Pairing (overlay) | `lobby.pairing` | **Host only** | 1 |
| 3 | Playlist Import (card in lobby) | `lobby` | Everyone | 3 |
| 4 | Icebreaker | `icebreaker` | Everyone | 1 |
| 5 | Quick Pick | `song_selection.quick_pick` | Everyone | 3 |
| 6 | Spin the Wheel | `song_selection.spin` | Everyone | 3 |
| 7 | Suggestion-Only Display | `song_selection.display` | Everyone (host has "Now Playing") | 3 |
| 8 | Party Card Deal | `party_card_deal` | **Singer sees card** / Everyone sees "challenge incoming" | 2 |
| 9 | Song State (Lean-in / Lightstick / Hype modes) | `song` | Everyone | 1 (base), 2 (modes) |
| 10 | Voting | `ceremony.voting` | Everyone | 1 |
| 11 | Silence | `ceremony.silence` | Everyone | 1 |
| 12 | Reveal | `ceremony.reveal` | Everyone | 1 |
| 13 | Quick Ceremony | `ceremony.quick_reveal` | Everyone | 1 |
| 14 | Interlude Game (Kings Cup / Dare Pull / Quick Vote) | `interlude.game` | Everyone | 4 |
| 15 | Capture Bubble | overlay on any state | Everyone (dismissable) | 2 |
| 16 | Finale | `finale` | Everyone | 4 |

**Pre-Sprint 3 song selection:** Before Song Integration is built, the DJ engine uses the genre-tag fallback — singer taps a genre before walking to the mic. Sprint 3 replaces this with the full Quick Pick / Spin the Wheel flow.

**Song selection states are the new divergent entry point:** In TV-paired mode, `nowPlaying` events from the Lounge API feed song metadata to the game engine automatically. In suggestion-only mode, the host manually marks "Now Playing" (FR94).

**Per-Loop Timing Budget:**

| Phase | Duration | Attention Mode |
|-------|----------|---------------|
| Song Selection (Quick Pick / Spin) | 15-25s | Active — group deciding |
| Party Card Deal | 3-8s | Active — singer decides |
| Song | 3-5 min (real karaoke song) | Lean-in / Passive |
| Transition fanfare | ~1s | Snap to Active |
| Voting | 4s (hard) | Active |
| Silence | 1.5-2s | Active (tension) |
| Reveal + celebration | 5-8s | Active (peak) |
| Quick ceremony (if queued) | ~6s | Active |
| Interlude (mini-game) | 15-20s | Active → settling |
| **Total between-song overhead** | **~50-70s per song** | |

**Post-Reveal Share Overlay (winner's phone only):**
After the reveal, the winner sees a share card overlay on top of the celebration screen — one tap to share, auto-dismiss after 10s if ignored. Sprint 1: screenshot-prompt fallback. Sprint 2: Canvas-rendered 9:16 card.

**Critical Sync Points (all server-coordinated):**
1. `song_over` → all phones transition simultaneously (±200ms)
2. Vote window close → `ceremony_silence` at T+4s with `revealAt = now + 2000ms`
3. `ceremony_reveal` → all phones display winner simultaneously (±200ms)

### Journey 3: Engagement Ladder — Trang's Passive → Active Progression

The design litmus test. If the app works for Trang, it works for everyone.

```mermaid
flowchart TD
    A["Joins because friends insist"] --> B["LEVEL 0: Observer (0-5 min)"]
    B --> C["Icebreaker: taps answer — low stakes"]
    C --> D[Small smile at synchronized reveal]

    D --> E["LEVEL 1: Reactor (5-15 min)"]
    E --> F[Watches others tapping reactions]
    F --> G["20 seconds later: taps ❤️ once"]
    G --> H["Sees her reaction appear — no judgment"]

    H --> I["LEVEL 2: Voter (15-20 min, first ceremony)"]
    I --> J[Ceremony fires — voting screen appears]
    J --> K["One tap to vote — same as reactions"]
    K --> L[Laughs at reveal with everyone]

    L --> M["LEVEL 3: Opinioned (20-30 min)"]
    M --> N["Quick Vote: Pineapple on pizza?"]
    N --> O["Strong opinion → taps NEVER → says See?!"]

    O --> P["LEVEL 4: Participant (30-45 min)"]
    P --> Q["Challenge: Everyone who has been to Đà Lạt..."]
    Q --> R[Mouths along during group chorus]

    R --> S["LEVEL 5: Contributor (45+ min)"]
    S --> T["Group sing-along — everyone singing"]
    T --> U[Trang is singing — room pulled her in]

    U --> V["FINALE: The Silent Storm"]
    V --> W["Posts: apparently I am a karaoke person now???"]
```

**DJ Engine Clock-Based Curriculum (first 45 minutes):**

| Time | Level Target | DJ Engine Action | Example |
|------|-------------|-----------------|---------|
| 0-5 min | Level 0 → 1 | Icebreaker only. Zero pressure. | "Tap your favorite decade" |
| 5-15 min | Level 1 → 2 | Show reaction counts as social proof | "🔥 12 reactions this song" |
| 15-20 min | Level 2 | First ceremony fires automatically. Same tap mechanic. | Voting = just another tap |
| 20-30 min | Level 3 | Front-load Quick Votes — universal, no wrong answer | "Pineapple on pizza?" |
| 30-45 min | Level 4 | Introduce group challenges with inclusive framing | "Everyone who..." not "Who can..." |
| 45+ min | Level 5 | Group sing-along prompts for universally known songs | No individual names on screen |

The DJ engine has a **time-based onboarding curriculum** that doesn't look like onboarding. The first 45 minutes are carefully sequenced to earn trust progressively.

**Anti-Patterns (things that would break Trang's ladder):**
- "You haven't reacted yet!" nudges — shame kills participation
- Putting her name on screen before she's ready — spotlight anxiety
- Requiring text input at any point — she'll close the tab
- Making reactions feel performative — they should feel private-to-public
- Individual dares in the first 30 minutes — too early, trust not earned
- Performance-based challenges early — intimidating

### Journey 4: Late Join & Reconnection

Two edge cases that must feel invisible.

```mermaid
flowchart TD
    subgraph "Late Join"
        A["9:30 PM — walks into room"] --> B["Scan QR — Linh holds it up"]
        B --> C["Lobby with party in progress"]
        C --> D["Enter name → tap JOIN"]
        D --> E["Loading skeleton (200-500ms)"]
        E --> F["Catch-up card (3 seconds)"]
        F --> G["8 friends here · 5 songs · Leader: Minh"]
        G --> H[Lands in current DJ state immediately]
    end

    subgraph "Reconnection"
        I["Phone dies at 8%"] --> J[WebSocket disconnect detected]
        J --> K["Name grays out: Minh offline"]
        K --> L["Pending votes not counted — no delay"]
        L --> M["Phone boots → browser tab still there"]
        M --> N["Socket.io auto-reconnects"]
        N --> O["Server sends state_snapshot"]
        O --> P["Phone renders current screen"]
        P --> Q["History intact, streak reset"]
    end
```

**Late Join — Design Rules:**

| Rule | Rationale |
|------|-----------|
| Loading skeleton before catch-up card | 200-500ms gap between connect and first state — pulsing Karamania logo, not blank screen |
| Catch-up card = 3 seconds max | They walked into a party, not a tutorial |
| No replay of missed ceremonies | You weren't there. That's fine. |
| Name in nominee pool immediately | Next ceremony, they're a full participant |
| No "late joiner" badge or marker | The app doesn't differentiate. They were there. |
| AudioContext unlock on JOIN tap | Same as everyone else — first tap = audio |

**Reconnection Acceptance Criteria:**

| Reconnect During | Expected Behavior |
|-----------------|-------------------|
| Song selection (Quick Pick) | See current suggestions + vote counts. Can vote — timer shows remaining time |
| Song selection (Spin) | If spinning → see result when lands. If veto window → can veto |
| Song state | Phone renders song state, reactions work immediately |
| Voting (still open) | Can vote — timer shows remaining time |
| Voting (past window) | See current ceremony phase (silence/reveal) |
| Interlude | Can participate in current game immediately |
| Finale | See finale screen with full stats |

Socket.io handles reconnection natively — `reconnection: true, reconnectionDelay: 1000, reconnectionDelayMax: 5000`. Server sends `state_snapshot` on reconnect with current DJ state, ceremony phase, participants, and user stats. Client renders whatever screen that state maps to.

### Duc's Content Journey (Sprint 2 Additions)

**Pre-Song Hype Card:** When Duc wins "who sings next?", all phones briefly show "DUC IS UP NEXT" with countdown — bridging the physical moment of walking to the mic. Sprint 2 addition to `waiting` state.

**Performance Rating Ceremony:** A different ceremony variant — star/score vote ("Rate Duc's performance: 1-5") instead of nominee selection. Generates score-based moment card ("4.7/5 — Vocal Assassin"). Sprint 2 ceremony type.

**Auto-Share Overlay:** After a reveal where Duc wins, his phone shows floating share card overlay — one tap to share, auto-dismiss after 10s. Sprint 1: screenshot-prompt. Sprint 2: Canvas-rendered 9:16 card.

### Journey 6: Song Discovery — "How They Stopped Arguing About What to Sing" (Sprint 3)

The flow that eliminates "what should we sing?" — the single most common friction point at every karaoke night.

```mermaid
flowchart TD
    A["Host creates party + enters YouTube TV code"] --> B["TV pairs via Lounge API"]
    B --> C["Friends join room on their phones"]
    C --> D["Prompt: Share your playlist!"]
    D --> E["Each friend pastes YouTube Music / Spotify URL"]
    E --> F{Platform detected?}
    F -->|YouTube Music| G["API reads playlist (1-5s)"]
    F -->|Spotify public| H["Client Credentials reads tracks"]
    F -->|Spotify private| I["Make Public 3-step guide"]
    I --> H
    G --> J["Found N songs!"]
    H --> J
    J --> K["App cross-references against Karaoke Catalog"]
    K --> L["Found 34 songs your group knows that you can sing tonight!"]

    L --> M["Party starts → icebreaker → first song selection"]
    M --> QP{Selection mode?}
    QP -->|Quick Pick| N["5 cards appear on all phones"]
    N --> O["Everyone taps 👍 or ➡️"]
    O --> P{Majority in 15s?}
    P -->|Yes| Q["Winner auto-queues on YouTube TV"]
    P -->|No majority| R["Highest-voted wins"]
    R --> Q
    QP -->|Spin the Wheel| S["8 songs on animated wheel"]
    S --> T["Someone taps SPIN"]
    T --> U["Wheel lands → dramatic reveal"]
    U --> V{Veto?}
    V -->|"Not that one!" (5s)| W["Re-spin without vetoed song"]
    W --> U
    V -->|Accepted (5s pass)| Q

    Q --> X["Party Card Deal → Song State"]
    X --> Y["Lounge API detects song via nowPlaying"]
    Y --> Z["Game engine receives {song, artist, genre}"]
    Z --> AA["Song-aware ceremonies + genre momentum in next suggestions"]
    AA --> QP
```

**Song Discovery Design Rules:**

| Rule | Rationale |
|------|-----------|
| Playlist import happens IN the lobby, not before | User corrected this during brainstorming — people paste links when they arrive, not when they RSVP |
| Quick Pick is default, Spin the Wheel is opt-in | Quick Pick is faster (15s). Spin is party-energy alternative |
| 15s hard deadline on Quick Pick | Consistent with ceremony timing pattern — urgency prevents decision paralysis |
| Auto-queue on TV = zero manual entry | The highest-impact UX improvement — nobody types into the karaoke machine |
| Genre momentum in suggestions | After 3 ballads → suggestions shift to upbeat. Prevents repetitive nights |
| Karaoke Classics fallback exists from minute zero | App works before anyone imports anything |
| Suggestion-only mode is seamless | Non-YouTube venues get the same suggestion UX, just no auto-queue |
| Song data feeds game engine passively | Lounge API `nowPlaying` → metadata → genre-aware challenges, song-aware ceremonies |

**Timing Budget — Song Selection Phase:**

| Phase | Duration | Attention Mode |
|-------|----------|---------------|
| Quick Pick voting | 15s (hard) | Active — everyone voting |
| Spin the Wheel animation | 3-5s | Active — watching |
| Spin veto window | 5s | Active — deciding |
| Song queued confirmation | 2s | Transitional |
| → Party Card Deal | 3-8s | Active |
| **Total song selection overhead** | **~20-30s** | |

### Journey Patterns

**1. Single-Tap Interaction Pattern**
Every user action is a single tap on a target ≥48px. No swipes, no long-press (except host Song Over), no text input after name entry. Learn once, use everywhere.

**2. Server-Push State Pattern**
Users never navigate between screens. The DJ engine pushes state → all phones render the same screen simultaneously. No "back" button, no navigation menu. The app is a window into a shared state.

**3. Synchronized Reveal Pattern**
Private input → collective output. Icebreaker answers, ceremony votes, quick vote opinions — all follow: tap privately → see result together. This is the core UX mechanic.

**4. Progressive Trust Pattern (Trang's Ladder)**
The DJ engine has a 45-minute clock-based curriculum: icebreaker → reactions → voting → opinions → challenges → group performance. It earns the right to ask for more participation over time.

**5. Graceful Degradation Pattern**
Missing data never blocks the flow. No genre tag? DJ uses default categories. No votes? DJ picks. Phone disconnected? Skip their vote. Late joiner? Drop into current state. Every "missing" scenario has a silent fallback.

**6. Group Decision Pattern (Song Selection)**
Quick Pick and Spin the Wheel are group decisions — everyone participates, the collective output drives what happens next. This is the song-selection analog to ceremony voting: private input (individual votes) → collective output (song auto-queued). The pattern kills "what should we sing?" negotiation.

**7. Divergent State Pattern**
Two moments where phones show different screens: (a) party card deal shows card to singer vs. "challenge incoming" to everyone else, (b) share overlay on winner's phone vs. celebration on everyone else. In suggestion-only mode, host sees "Now Playing" button that others don't. Implemented via targeted Socket.io emits.

### Flow Optimization Principles

**1. Zero Navigation, Pure Reactivity**
No menus, no tabs, no hamburger icons. The DJ engine drives all screen changes. Users react to what appears — they never browse or search.

**2. 3-Second Orientation Rule**
Any screen must communicate its purpose within 3 seconds. Song State: "someone's singing, here are taps." Voting: "pick a person, clock is ticking." Reveal: "this person won."

**3. Audio-First State Communication**
Screen transitions are HEARD before they're SEEN (phones may be face-down). Fanfare = ceremony. Drumroll = voting. Silence = tension. Chime = quick reveal.

**4. No Punishment for Inaction**
Miss a vote? Ceremony continues. Don't react? Nobody knows. Phone down for 3 songs? Pick it up and you're right where the group is. The app never scolds, nudges, or guilt-trips.

**5. The Host's Attention Budget**
Linh has ONE recurring interaction: Song Over. Everything else is automated or optional. The DJ engine's job is to make the host forget they're the host.

**6. Loading Skeleton Before State**
Between WebSocket connect and first state push (200-500ms), show a pulsing Karamania logo placeholder — not a spinner, not a blank screen. Affects late joiners and reconnecting users most.

## Component Strategy

### Design System Components (Tailwind + Token Foundation)

No pre-built component library. All components are fully custom Svelte, styled with Tailwind utilities mapped to CSS custom property tokens via the Tailwind config bridge.

**Token Layer (from Step 8):**
- 12 constant tokens (`--dj-bg`, `--dj-surface`, `--dj-text-primary`, etc.)
- 4 vibe-shifting tokens (`--dj-accent`, `--dj-ceremony-glow`, `--dj-ceremony-bg`, `--dj-action-primary`)
- 5 spacing tokens (`--space-xs` through `--space-xl`)

**State theming — centralized on body:**
`data-dj-state` lives on `<body>`, not individual components. Screen backgrounds handled at app level:

```svelte
<!-- App.svelte -->
$: document.body.setAttribute('data-dj-state', $djState);
```

```css
body[data-dj-state="song_selection"] { background: #0f0a1e; }
body[data-dj-state="party_card_deal"] { background: #1a0a1a; }
body[data-dj-state="ceremony"] { background: var(--dj-ceremony-bg); }
body[data-dj-state="song"] { background: var(--dj-bg); }
body[data-dj-state="interlude"] { background: var(--dj-bg); }
body[data-dj-state="finale"] { background: var(--dj-ceremony-bg); }
```

### Custom Components (34 Components + 1 Action)

#### File Structure (flat, no nesting)

```
src/
├── components/
│   ├── TopBar.svelte
│   ├── ParticipantDot.svelte
│   ├── CountdownTimer.svelte
│   ├── SongOverButton.svelte
│   ├── ConfettiLayer.svelte
│   ├── GlowEffect.svelte
│   ├── LoadingSkeleton.svelte
│   ├── LobbyScreen.svelte
│   ├── TVPairingOverlay.svelte          ← NEW: TV code input for host
│   ├── PlaylistImportCard.svelte        ← NEW: URL paste + import status
│   ├── SpotifyGuide.svelte              ← NEW: "Make Public" 3-step guide
│   ├── IcebreakerScreen.svelte
│   ├── QuickPickScreen.svelte           ← NEW: 5 song cards + group voting
│   ├── SpinWheelScreen.svelte           ← NEW: animated wheel + spin
│   ├── SuggestionOnlyDisplay.svelte     ← NEW: song title for manual entry
│   ├── SongScreen.svelte
│   ├── LightstickMode.svelte
│   ├── HypeSignalButton.svelte
│   ├── PartyCardDeal.svelte
│   ├── CaptureBubble.svelte
│   ├── CaptureOverlay.svelte
│   ├── Ceremony.svelte
│   ├── CeremonyVoting.svelte
│   ├── CeremonySilence.svelte
│   ├── CeremonyReveal.svelte
│   ├── CeremonyQuick.svelte
│   ├── InterludeScreen.svelte
│   ├── InterludeKingsCup.svelte
│   ├── InterludeDarePull.svelte
│   ├── InterludeQuickVote.svelte
│   ├── GenrePickerScreen.svelte         ← Retained as fallback before Sprint 3
│   ├── WaitingScreen.svelte
│   ├── SongModeToggle.svelte            ← NEW: Quick Pick ↔ Spin the Wheel toggle
│   ├── SongCard.svelte                  ← NEW: reusable song card (title, artist, overlap badge)
│   └── FinaleScreen.svelte
├── lib/
│   ├── actions/
│   │   └── tap.js
│   ├── stores/
│   │   ├── party.js                     ← Updated with song integration stores
│   │   ├── capture.js
│   │   └── a11y.js
│   ├── audio/
│   │   └── engine.js
│   └── constants/
│       └── copy.js
├── App.svelte
└── main.js
```

#### The `tap` Action (replaces TapTarget component)

Svelte action giving every tappable element consistent press feedback + haptic:

```javascript
// src/lib/actions/tap.js
export function tap(node, { onTap, haptic = true, disabled = false }) {
  // Touch start → scale(0.95) visual feedback
  // Touch held → haptic feedback (if supported)
  // Touch end → fire onTap callback
  // Debounce: ignore taps within 200ms of previous
  // Disabled check: no-op if disabled=true
}
```

Usage — any element becomes tappable:
```svelte
<button use:tap={{ onTap: handleVote }} class="nominee-card">
  <ParticipantDot name="Duc" />
  <span>Duc</span>
</button>
```

The action handles everything — `onTap` replaces `on:click`. Haptic fires BEFORE the handler. Debounce in one place.

#### Tier 1: Primitives (used across multiple screens)

**TopBar.svelte** — Consistent header on every screen. Props: `state`, `partyName`, `count`. Colors shift per DJ state. `role="banner"`, `aria-live="polite"`.

**ParticipantDot.svelte** — Avatar circle with initial + status. Props: `name`, `status`. States: `empty`, `filled`, `active`, `offline`, `singing`. Reduced motion: no glow pulse.

**CountdownTimer.svelte** — Circular conic-gradient countdown. Props: `duration`, `onExpire`. `role="timer"`, `aria-live="assertive"` at 1s. Reduced motion: instant fill steps, number only.

**SongOverButton.svelte** — Host-only 500ms long-press. Props: `onSongOver`, `disabled`. Touch start → fill animation (CSS transition 500ms). Touch held 500ms → callback + haptic burst. Released early → reset. Reduced motion: no fill animation, instant at 500ms.

**LoadingSkeleton.svelte** — Pulsing Karamania logo for 200-500ms connect gap. Rendered when `$djState === null`. Reduced motion: static logo.

#### Tier 2: Screen Compositions

**Data flow rule:** Screen components read from Svelte stores directly. Sub-components receive props only. Clean test boundary — mock store at screen level, test sub-components with pure props.

**LobbyScreen.svelte** — Join entry. Reads: `$partyName`, `$participants`, `$isHost`. States: `pre-join`, `joined`, `host-ready`. Only screen with text `<input>`. Host sees "START PARTY".

**IcebreakerScreen.svelte** — Synchronized tap-and-reveal. Reads: `$icebreaker`. States: `choosing`, `chosen`, `revealing`.

**SongScreen.svelte** — Manages all three song modes. Reads: `$currentSinger`, `$currentGenre`, `$participants`, `$isHost`, `$songMode`, `$partyCard`. Default: lean-in mode with 6 soundboard buttons (3×2), 5 reaction buttons, challenge badge (if party card accepted). Toggle buttons for lightstick mode and hype signal. SongOverButton visible only when `$isHost`. Capture icon persistent in toolbar (FR39).

**LightstickMode.svelte** — Full-screen glow sub-component within SongScreen. Props: `color`, `active`. Renders full-viewport animated gradient glow using `--dj-accent` or user-selected color. Color picker (5 dots) along bottom. Hype button remains accessible. Tap anywhere to exit. `prefers-reduced-motion`: static color fill, no animation.

**HypeSignalButton.svelte** — Momentary flash trigger. Props: `onHype`, `cooldown`. On tap: screen flashes white (3 pulses via CSS animation) + attempts `torch` activation via ImageCapture API (Chrome only, silent no-op on iOS). 5-second cooldown with circular refill indicator. Available in both lean-in and lightstick modes.

**PartyCardDeal.svelte** — Card deal screen. Reads: `$partyCard`, `$isCurrentSinger`. Singer view: card with title, emoji, description, type badge + Accept/Dismiss/Redraw buttons. Audience view: "🃏 CHALLENGE INCOMING..." with singer name. Soft 8s auto-dismiss timer. Card slides in from bottom with flip animation + card-flip sound.

**Ceremony.svelte** — Thin router (~10 lines). Reads: `$ceremonyPhase`, `$ceremonyData`, `$isWinner`. Routes to phase sub-components:

```svelte
{#if $ceremonyPhase === 'voting'}
  <CeremonyVoting {ceremonyData} />
{:else if $ceremonyPhase === 'silence'}
  <CeremonySilence category={ceremonyData.category} />
{:else if $ceremonyPhase === 'reveal'}
  <CeremonyReveal {ceremonyData} {isWinner} />
{:else if $ceremonyPhase === 'quick_reveal'}
  <CeremonyQuick {ceremonyData} />
{/if}
```

**CeremonyVoting.svelte** — Props: `ceremonyData`. Category title, CountdownTimer (4s), nominee list with `use:tap`.

**CeremonySilence.svelte** — Props: `category`. Near-black, pulsing text (0.3→1.0). Reduced motion: static at 1.0.

**CeremonyReveal.svelte** — Props: `ceremonyData`, `isWinner`. GlowEffect, ConfettiLayer, winner name (scale+elasticOut 800ms), vote bars, reactions. Winner's phone: share overlay (1-tap, auto-dismiss 10s). Reduced motion: instant appear, no confetti, static glow.

**CeremonyQuick.svelte** — Props: `ceremonyData`. "SHOUTOUT" label, category, winner, reason. Reduced motion: instant appear.

**CaptureBubble.svelte** — Floating capture prompt overlay. Reads: `$captureBubble`. Renders a 48×48px floating circle (bottom-left) with camera icon and pulse animation. Auto-dismisses after 15s. On tap: expands to capture mode selector (📷📹🎤). Capture flow inline on supported browsers, native picker fallback on iOS for video/audio.

**CaptureOverlay.svelte** — Active capture UI. Props: `mode` ('photo'|'video'|'audio'), `onComplete`. Photo: viewfinder + tap-to-snap. Video: viewfinder + recording indicator + 5s countdown. Audio: waveform visualization + recording indicator. Auto-uploads on complete via `capture.js` store.

**InterludeScreen.svelte** — Router for interlude types. Reads: `$interludeData`. Routes to sub-components based on `interludeData.type`:

```svelte
{#if $interludeData.type === 'kings_cup'}
  <InterludeKingsCup data={$interludeData} />
{:else if $interludeData.type === 'dare_pull'}
  <InterludeDarePull data={$interludeData} />
{:else if $interludeData.type === 'quick_vote'}
  <InterludeQuickVote data={$interludeData} />
{:else}
  <!-- Fallback: vote for next singer -->
{/if}
```

**InterludeKingsCup.svelte** — Group rule card display. Props: `data`. Card with crown icon, group-based rule text, action. 10s auto-advance. No individual targeting.

**InterludeDarePull.svelte** — Random dare assignment. Props: `data`. Slot-machine name animation → reveal + dare text. 15s countdown timer. Auto-advance after timer.

**InterludeQuickVote.svelte** — Binary opinion poll. Props: `data`. Question text + two large buttons. 6s hard voting window with countdown. Results reveal as bar chart with vote split. 5s reveal display then auto-advance.

#### Song Integration Components (Sprint 3)

**TVPairingOverlay.svelte** — Host-only overlay during party creation. Reads: `$tvPairing`. Number input for 12-digit TV code. States: `pairing`, `connecting`, `paired`, `failed`, `skipped`. "Skip" option enters suggestion-only mode (FR92). Connection status indicator. Can be re-opened from host controls at any time (FR95). `role="dialog"`, `aria-label="Pair with YouTube TV"`.

**PlaylistImportCard.svelte** — Inline card in lobby. Reads: `$playlists`. Text input for playlist URL paste (the only URL input in the app — distinct from the name entry input in Lobby). Auto-detects platform from URL domain (FR80). Shows import status per participant (checkmark + song count). "Skip for now" dismisses the card. Reduced motion: no status animations.

**SpotifyGuide.svelte** — Inline 3-step guide for private Spotify playlists (FR83). Props: `onRetry`. Three numbered visual steps. No modal, no navigation away. Retry button re-attempts import. Appears only when Spotify private playlist is detected.

**QuickPickScreen.svelte** — Default song selection mode. Reads: `$songSelection`, `$suggestions`. Displays 5 song cards (SongCard components) in a vertically scrollable list. Each card shows 👍/➡️ buttons with real-time vote counts. CountdownTimer (15s). Mode toggle link to Spin the Wheel at bottom. Server closes voting at 15s — majority wins, or highest-voted on timeout (FR88). `role="group"`, `aria-label="Pick a song"`.

**SpinWheelScreen.svelte** — Party-energy song selection mode. Reads: `$songSelection`, `$suggestions`. 8 song segments on animated wheel. SPIN button (64×64px, Consequential tier — single-tap, selects for group). Post-spin: reveal with silence-before-reveal pattern (1s pause → song title scales in). 5s veto window ("Not that one!" button). If vetoed → auto re-spin with vetoed song removed (FR89). Wheel animation: CSS `transform: rotate()` with custom deceleration easing. Reduced motion: wheel appears landed instantly, no spin animation. `aria-label="Spin the wheel to pick a song"`.

**SuggestionOnlyDisplay.svelte** — Shown in suggestion-only mode when a song is selected. Reads: `$songSelection`, `$isHost`. Large song title + artist display. "Enter this song on your karaoke machine!" instruction text. Host sees "Now Playing" button (FR94) to feed song data to game engine. Clean, prominent, designed for reading across a room.

**SongCard.svelte** — Reusable song card primitive. Props: `song`, `artist`, `thumbnail`, `overlapCount`, `totalParticipants`, `votes`, `onVote`. Displays: YouTube thumbnail (lazy-loaded), song title (truncated at ~30 chars), artist, overlap badge ("4/5 know this" in accent color for high overlap, secondary for low). Vote buttons (👍/➡️) with real-time count. Social tier tap for voting. `data-testid="song-card-{index}"`.

**SongModeToggle.svelte** — Simple text link toggle. Props: `currentMode`, `onToggle`. From Quick Pick: "[🎡 Spin Instead]". From Spin: "[🗳️ Quick Pick]". Private tier tap (no haptic). Mode is per-session, not persisted.

**GenrePickerScreen.svelte** — Retained as pre-Sprint-3 fallback. Winner-only. 5 genre buttons: 🎤 Pop · 🎸 Rock · 🎵 Ballad · 💃 Dance · 🎧 K-pop. Fires event on tap, no store reads. After Sprint 3, genre data comes from Lounge API metadata instead.

**WaitingScreen.svelte** — Everyone else during song selection (pre-Sprint 3 only). Reads: `$waitingSinger`. "[Name] is picking a song..." Sprint 2: evolves into pre-song hype card. Post-Sprint 3: replaced by QuickPickScreen/SpinWheelScreen where everyone participates.

**FinaleScreen.svelte** — End-of-night recap. Reads: `$finaleData`. ConfettiLayer, party name, performance list, stats row, share button.

#### Tier 3: Effect Components

**ConfettiLayer.svelte** — Props: `active`, `emoji`. CSS `@keyframes` scatter, no JS runtime. `aria-hidden="true"`. Reduced motion: not rendered.

**GlowEffect.svelte** — Props: `active`, `intensity`. Radial gradient using `--dj-ceremony-glow`. `aria-hidden="true"`. Reduced motion: static.

### Reduced Motion Store

```javascript
// src/lib/stores/a11y.js
export const reducedMotion = readable(false, (set) => {
  const mql = matchMedia('(prefers-reduced-motion: reduce)');
  set(mql.matches);
  mql.addEventListener('change', (e) => set(e.matches));
});
```

| Component | Reduced Motion Behavior |
|-----------|------------------------|
| ConfettiLayer | Not rendered |
| GlowEffect | Static, no pulse |
| CountdownTimer | Instant fill steps, number only |
| CeremonyReveal | Instant appear, no scale+elasticOut |
| CeremonySilence | Static text, opacity 1.0 |
| SongOverButton | No fill animation, instant at 500ms |
| LoadingSkeleton | Static logo, no pulse |
| WaitingScreen | Static text |
| LightstickMode | Static color fill, no glow pulse animation |
| HypeSignalButton | Single screen flash (no strobe), no flashlight activation |
| PartyCardDeal | Card appears instantly, no flip/slide animation |
| CaptureBubble | Static circle, no pulse. Expand/collapse instant |
| InterludeDarePull | Name appears instantly, no slot-machine animation |
| SpinWheelScreen | Wheel appears landed, no spin animation. Reveal instant |
| QuickPickScreen | Cards appear instantly, no slide-in. Vote counts update without animation |
| PlaylistImportCard | Status updates instant, no progress animations |

### Bundle Analysis

| Layer | Estimated Size |
|-------|---------------|
| 34 Svelte components (compiled) | ~45-60KB |
| Tailwind CSS (purged) | ~8-12KB |
| Socket.io client | ~15KB |
| Web Audio setup | ~5KB |
| `tap` action + stores (party + capture + a11y) | ~4KB |
| **Total** | **~77-96KB** |

Slightly over 80KB core budget with all components eager-loaded. **Three-tier loading strategy:**

| Tier | Contents | Budget | Loads |
|---|---|---|---|
| **Core (Sprint 1)** | Svelte runtime, stores/party.js, lobby + song + ceremony UI, CSS reset + tokens, Web Audio engine | <80KB gzipped | On page load |
| **Deferred-Sprint 2** | PartyCardDeal, LightstickMode, CaptureBubble, CaptureOverlay, Interlude games | <15KB gzipped | Lazy after first ceremony |
| **Deferred-Sprint 3** | QuickPickScreen, SpinWheelScreen, PlaylistImportCard, TVPairingOverlay, SongCard, SpotifyGuide, SuggestionOnlyDisplay | <12KB gzipped | Lazy on first `song_selection` state |

Sprint 3 song integration components are deferred-loaded on first `song_selection` DJ state. Before Sprint 3, the genre picker fallback (already in core bundle) handles song transitions. CaptureOverlay is always deferred (lazy on first bubble tap).

### Component Implementation Roadmap

**Sprint 1 — Core 18 components + action (build order follows Core Party Loop):**

| Order | Component | Why |
|-------|-----------|-----|
| 1 | `tap` action | Every interaction needs this first |
| 2 | TopBar | Every screen needs this |
| 3 | ParticipantDot | Lobby + Song State |
| 4 | LoadingSkeleton | First thing user sees |
| 5 | LobbyScreen | Party entry |
| 6 | IcebreakerScreen | First interaction |
| 7 | CountdownTimer | Needed by ceremony + interlude + party cards |
| 8 | SongScreen + SongOverButton | Core loop |
| 9 | Ceremony + 4 phases | Defining experience |
| 10 | ConfettiLayer + GlowEffect | Reveal polish |
| 11 | InterludeScreen (vote only) | Singer voting |
| 12 | GenrePickerScreen + WaitingScreen | Pre-Sprint 3 song tagging fallback |
| 13 | FinaleScreen | End of night |

**Sprint 2 additions (Party Cards + Song Modes + Media Capture):**
- PartyCardDeal.svelte (card deal/accept/dismiss/redraw)
- LightstickMode.svelte (full-screen glow with color picker)
- HypeSignalButton.svelte (flash/strobe trigger)
- CaptureBubble.svelte + CaptureOverlay.svelte (prompted media capture)
- ShareOverlay.svelte (Canvas-rendered 9:16 card)
- HypeCard.svelte (pre-song "DUC IS UP NEXT")
- PerformanceRating.svelte (star/score ceremony variant)

**Sprint 3 additions (Song Discovery + Interlude Games):**
- TVPairingOverlay.svelte (host enters TV code, Lounge API pairing)
- PlaylistImportCard.svelte (URL paste, auto-detect platform, import status)
- SpotifyGuide.svelte ("Make Public" 3-step guide)
- QuickPickScreen.svelte (5 songs, group voting, 15s auto-advance)
- SpinWheelScreen.svelte (8 songs, animated wheel, veto)
- SuggestionOnlyDisplay.svelte (manual entry fallback)
- SongCard.svelte (reusable song card primitive)
- SongModeToggle.svelte (Quick Pick ↔ Spin the Wheel)

**Sprint 4 additions (Interlude Games + Polish):**
- InterludeKingsCup.svelte
- InterludeDarePull.svelte
- InterludeQuickVote.svelte
- Two-column NomineeGrid variant for 10+ participants

## UX Consistency Patterns

### Tap Interaction Hierarchy

Three tiers govern every tappable element. Behavior is centralized in a single config — no scattered magic numbers across components:

```javascript
// src/lib/constants/tap-tiers.js
export const TAP_TIERS = {
  consequential: { debounce: 500, haptic: 'heavy', scale: 0.92, confirm: true },
  social:        { debounce: 200, haptic: 'light', scale: 0.95, confirm: false },
  private:       { debounce: 200, haptic: false,   scale: 0.97, confirm: false },
};
```

**Tier 1 — Consequential (irreversible actions):**
- Song Over (host), Start Party (host)
- 500ms long-press required. Release early → reset without action
- Heavy haptic on confirm. Visual: scale(0.92) during hold, fill animation
- **AC:** Given a consequential tap, WHEN user holds for 500ms, THEN action fires with heavy haptic. WHEN released early, THEN no action fires and visual resets.

**Tier 2 — Social (visible to others):**
- Ceremony votes, reactions, soundboard, singer nomination
- Immediate fire on tap with 200ms debounce
- Light haptic on touch-start. Visual: scale(0.95) press feedback
- **AC:** Given a social tap, WHEN user taps, THEN action fires immediately with 200ms debounce preventing double-fire, AND haptic fires on touch-start before handler.

**Tier 3 — Private (personal, low-stakes):**
- Genre pick, icebreaker choice, share dismiss
- Immediate fire, 200ms debounce, no haptic
- Visual: subtle scale(0.97)
- **AC:** Given a private tap, WHEN user taps, THEN action fires immediately with no haptic feedback.

**Usage:** `use:tap={{ tier: 'social', onTap: handleVote }}` — tier param maps to config. One source of truth.

### State Transition Patterns

**Canonical State Machine:**

```
lobby → icebreaker → song_selection → party_card_deal → song → ceremony → interlude → song_selection → party_card_deal → song (loop) → finale
                        ↳ quick_pick / spin_the_wheel
                                          ↳ singer: accept/dismiss/redraw → song
```

Valid transitions are server-authoritative. Client never self-transitions — every state change arrives via WebSocket emit. If the client receives an unexpected state, it accepts it (server wins).

**Audio-First Transition Protocol:**

State transitions play an audio cue before visual change. Race condition protection: visual transition fires after `Math.min(audioDuration, 300ms)` — never block visuals on audio failure. Audio is enhancement, not gate.

| Transition | Audio Cue | Visual | Duration |
|---|---|---|---|
| → song_selection | Upbeat prompt chime | Cards slide in / wheel assembles | 400ms |
| → party_card_deal | Card-flip sound effect | Card slides in from bottom, playful bounce | 400ms |
| → ceremony | Rising chime | Bg fade to `--dj-ceremony-bg` | 300ms |
| → silence | All audio cuts to 0 | Screen fades to near-black | 200ms |
| → reveal | Burst + confetti | Glow + scale-in winner | 500ms |
| → interlude | Playful loop start | Bg shift to `--dj-interlude-bg` | 300ms |
| → song | Fade to ambient | Bg dims to `--dj-song-bg` | 400ms |
| → finale | Dramatic swell | Max glow + confetti | 800ms |

**`data-dj-state` drives all transitions.** CSS handles visual shifts via attribute selectors. Audio engine listens to the same store. No component-level transition logic.

### Feedback & Confirmation Patterns

**Immediate Feedback (< 100ms):**
- Tap visual (scale transform) — CSS only, no JS delay
- Haptic (where supported) — fires on touch-start, before handler
- Reaction emoji scatter — CSS keyframe, fire-and-forget

**Deferred Feedback (server-confirmed):**
- Vote count updates — optimistic UI, reconcile on server ack
- Participant join — dot appears immediately, server confirms via broadcast
- Song Over — fill animation is local, actual state change waits for server

**No-Feedback Principle (inaction is invisible):**
- Didn't vote in 4s? Ceremony advances. No "you missed it" message. No shame
- Didn't react during song? No engagement metric shown. No guilt
- Didn't pick a singer? Random selection, presented as "DJ's choice"
- **Code pattern:** `CountdownTimer.onExpire` fires the same handler as a tap — `{ voted: false }`. Server treats missing votes as abstentions. Store update path is identical for voted and didn't-vote. No branching logic.
- **AC:** Given a user who does not vote within the deadline, WHEN the timer expires, THEN the ceremony advances with no error message, no visual indicator of missed vote, and the abstention is counted server-side.

### Timing Patterns

Three timing categories with clear authority rules:

**Hard Deadlines (server-authoritative, client countdown is cosmetic):**

| Action | Duration | What Happens at Expiry |
|---|---|---|
| Ceremony vote | 4s | Abstention counted, advance to silence |
| Icebreaker choice | 6s | Random assigned, advance to reveal |
| Quick Pick vote | 15s | Highest-voted song wins, advance to queue |
| Spin the Wheel veto | 5s | Song accepted, advance to queue |

Client countdown is **advisory** — if the server sends `next_state` at 3.8s or 4.2s, the client obeys regardless of its own timer. The visual countdown creates urgency; the server enforces truth.

**AC:** Given a hard deadline, WHEN the server emits the next state before or after the client timer expires, THEN the client immediately transitions to the server's state.

**Soft Auto-Advance (server-controlled, client shows progress):**

| Screen | Duration | Override |
|---|---|---|
| Quick Pick voting | 15s | Auto-selects highest-voted on expiry |
| Spin the Wheel veto | 5s | Auto-accepts on expiry |
| Interlude | 15-20s | Host can skip, server auto-advances |
| Ceremony reveal | 8-10s | Auto-advances to next ceremony or interlude |
| Quick reveal | 4s | No override, auto-advances |

**No-Limit (server advances on external trigger):**

| Screen | Trigger | Notes |
|---|---|---|
| Song state | Host taps Song Over | Duration = real song length, completely variable |
| Lobby | Host taps Start Party | Wait for minimum players (3) |
| Finale | No auto-advance | Session ends when host closes or inactivity timeout (30min) |

**AC:** Given a no-limit screen, THEN no countdown timer component is rendered. Negative test: assert `CountdownTimer` is NOT in the DOM during song state.

### Error & Edge Case Patterns

**Philosophy: Errors are invisible. The app absorbs problems silently.**

No error toasts. No "something went wrong." No retry buttons. The app either handles it or gracefully degrades. Vietnamese social context: showing errors on someone's phone during a party is embarrassing.

**Error Taxonomy:**

| Error Category | Example | Expected Behavior | Test Method |
|---|---|---|---|
| WebSocket disconnect | Network drop mid-ceremony | Silent reconnect via Socket.io, restore latest state from server | Disconnect mock socket, assert reconnect + state restore |
| Audio context blocked | iOS autoplay policy | Skip audio, visual-only transitions | Stub `AudioContext` to throw, assert transitions still fire |
| Vote timeout | User distracted | Abstention counted, no UI indicator | Fake timer + assert no error element rendered |
| Late state arrival | Server push delayed 2s | Show LoadingSkeleton, not blank screen | Delay mock socket emit, assert skeleton visible |
| Stale state | Reconnect to wrong ceremony phase | Accept server state, discard local | Emit conflicting state sequence, assert final state matches server |
| Haptic unavailable | Device doesn't support vibration | Skip silently, no fallback UI | Stub `navigator.vibrate` as undefined |
| TV pairing fails | Wrong code or Lounge API unavailable | "Couldn't connect" + retry option. Falls back to suggestion-only mode | Mock Lounge API to return error, assert fallback mode |
| Lounge API drops mid-session | Unofficial API breaks or network issue | Non-blocking toast to host, switch to suggestion-only mode (NFR31) | Disconnect mock Lounge socket, assert party continues |
| Playlist import fails | Invalid URL, private Spotify, API timeout | Platform-specific guidance (SpotifyGuide for private) or "Try again?" | Mock API errors per platform, assert guidance shown |
| No playlists imported | Cold start, nobody imports | Karaoke Classics fallback suggestions (FR91) | Assert fallback pool when `$playlists` is empty |
| YouTube Data API quota exceeded | >10K units/day | Suggestions based on previously cached data only. No new metadata lookups | Mock 403 response, assert cached data used |

**Empty States:**
- 0 reactions during song → No "be the first to react!" prompt. Just empty. Fine.
- 0 votes in ceremony → DJ picks randomly, labeled "DJ's choice"
- 0 votes in Quick Pick (15s timeout) → Highest-voted wins. If 0 total votes → DJ picks randomly from suggestions
- 0 playlists imported → Karaoke Classics fallback. App works out of the box
- TV not paired → Suggestion-only mode. Full song selection UX, just no auto-queue
- 1 participant → App works. Ceremonies skip (need 2+ nominees). Song state + finale still function.

**AC:** Given any error in the taxonomy, WHEN the error occurs, THEN no error message, toast, or modal is shown to the user, AND the app continues functioning with graceful degradation.

### Audio Patterns

**Three Volume Levels:**

| Level | Volume | When | Purpose |
|---|---|---|---|
| Ambient | 40% | Song state, lobby | Background texture, real karaoke is louder |
| Transitional | 70% | State transitions, countdown warnings | Attention shift |
| Ceremonial | 100% | Reveal burst, finale swell | Maximum drama, earned by contrast |

**Concurrent Audio Budget: Maximum 2 simultaneous sources.** New source preempts oldest. Budget Android devices choke above 3 concurrent `AudioBufferSourceNode`s.

**AC:** Given 2 audio sources playing, WHEN a 3rd source is triggered, THEN the oldest source is stopped before the new source plays. At no point do more than 2 sources play simultaneously.

**Spatial Audio Rule:**
- Host phone: 100% volume (stage)
- Participant phones: 60% volume (crowd)
- Creates physical-room spatial effect without actual spatial audio API

**Sound Buffer Strategy:**

| Phase | Buffers Loaded | Trigger |
|---|---|---|
| App boot (Sprint 0 prep) | Lobby ambient only (~15KB) | Eager load on connect |
| First ceremony entry | Ceremony set: chime, silence, reveal burst, confetti (~40KB) | Lazy load on first `ceremony` state |
| Song selection entry | Song pick chime, wheel spin/decelerate, song-queued confirmation (~15KB) | Lazy load on first `song_selection` state |
| Interlude entry | Interlude loop (~10KB) | Lazy load on first `interlude` state |
| Finale | Finale swell + extended confetti (~20KB) | Lazy load on `finale` state |

**Sprint 0 task:** Record/source all audio files, compress to opus/webm format. Runtime loading is Sprint 1.

**Audio Error Handling:** If `decodeAudioData` fails or `AudioContext` is blocked, all audio silently disabled for the session. Visual transitions continue unaffected. No "enable sound" banner.

## Responsive Design & Accessibility

### Responsive Strategy

**Mobile-Only Viewport — No Breakpoints**

Karamania has one layout: a phone held in one hand in a dark karaoke room. No desktop. No tablet. No responsive breakpoints. The entire responsive challenge is handling phone diversity within a ~50px width range.

**Target Viewport Range:**

| Device | Width | Notes |
|---|---|---|
| iPhone SE / 13 mini | 375px | Smallest mainstream target |
| Samsung Galaxy A series | 360-384px | Vietnamese market dominant |
| Z Flip (folded) | 360px | Edge case, must not break |
| iPhone 14/15 | 390px | Common reference |
| Galaxy S series | 412px | Largest common width |

**Layout Strategy: Fluid, Not Adaptive**

No media queries. No breakpoints. All layouts use:
- `width: 100%` with `max-width: 420px` + `margin: 0 auto` (centers on large phones)
- `padding` in `rem` units (scales with user font size preference)
- `gap` in `rem` for consistent spacing
- `dvh` with `vh` fallback (Safari 15.3 and earlier doesn't support `dvh`)

```css
/* Base layout — every screen */
.screen {
  width: 100%;
  max-width: 420px;
  margin: 0 auto;
  min-height: 100vh; /* fallback */
  min-height: 100dvh; /* modern */
  padding: 0 1rem;
  display: flex;
  flex-direction: column;
}
```

**Safe Area Handling (notch, gesture bar, dynamic island):**

```css
:root {
  --dj-safe-top: env(safe-area-inset-top, 0px);
  --dj-safe-bottom: env(safe-area-inset-bottom, 0px);
}

.screen {
  padding-top: calc(var(--dj-safe-top) + 0.5rem);
  padding-bottom: calc(var(--dj-safe-bottom) + 1rem);
}
```

TopBar uses `--dj-safe-top`. SongOverButton and bottom actions use `--dj-safe-bottom`. No content hidden behind notch, dynamic island, or gesture bar on any device.

**Orientation: Portrait-Only, No Overlay**

Karamania is portrait-only. Landscape doesn't break the layout (column flex with horizontal whitespace) but isn't designed for it. No landscape overlay — blocking taps during a 4s ceremony vote when someone accidentally rotates is worse than extra whitespace.

```json
{ "orientation": "portrait" }
```

### Touch Target Strategy

**Dark Room, One-Handed, Alcohol-Impaired — Bigger Than Standard**

WCAG minimum is 44×44px. That's for sober users in well-lit offices. Karamania's situational context demands larger targets.

**Karamania Touch Target Minimums:**

| Tier | Minimum Size | Elements | Rationale |
|---|---|---|---|
| Consequential | 64×64px | Song Over, Start Party | Irreversible — must be deliberate in dark/drunk conditions |
| Social | 56×56px | Vote cards, reactions, soundboard, singer cards | Frequent taps in low-attention state |
| Private | 48×48px | Genre pick, icebreaker, share dismiss | Lower stakes, still needs dark-room tolerance |

**Spacing Between Targets:**

Minimum 12px gap between adjacent tappable elements. Prevents mis-taps when the room is shaking from bass. Soundboard grid (3×2) uses 16px gap for extra safety.

**Thumb Zone Optimization:**

Primary actions placed in bottom 60% of screen (natural thumb reach for one-handed hold). TopBar is display-only — no tappable elements in the top 15% except host-only controls.

```
┌─────────────────────┐
│   TopBar (display)   │  ← No tap targets
│                      │
│                      │
│   Content / Info     │  ← Read-only zone
│                      │
│                      │
│  ┌────┐  ┌────┐     │
│  │ Tap│  │ Tap│     │  ← Primary action zone
│  └────┘  └────┘     │     (bottom 60%)
│  ┌─────────────┐    │
│  │  Main CTA   │    │
│  └─────────────┘    │
└─────────────────────┘
```

**Fat Finger Protection:**
- Tap debounce (200ms social, 500ms consequential) prevents double-fire
- `use:tap` action includes touch area expansion: the hit area extends 8px beyond visible bounds via padding
- Destructive action (Song Over) requires 500ms hold — accidental brush won't trigger

### WCAG AA Compliance

**Target: WCAG 2.1 Level AA**

Full AAA is unnecessary for a party app. Level AA covers the meaningful accessibility surface while keeping the implementation lean.

**Compliance Matrix by Component:**

| Requirement | WCAG Criterion | Karamania Implementation | Status |
|---|---|---|---|
| Color contrast (text) | 1.4.3 — 4.5:1 minimum | All text tokens validated below | Designed |
| Color contrast (large text) | 1.4.3 — 3:1 minimum | Headings and ceremony text | Designed |
| Touch target size | 2.5.8 — 24×24px minimum | 48-64px per tier (exceeds AA) | Exceeds |
| Focus visible | 2.4.7 | `outline: 2px solid var(--dj-action-primary)` on `:focus-visible` | Designed |
| Reflow | 1.4.10 — 320px minimum | Fluid layout, no horizontal scroll | Designed |
| Text spacing | 1.4.12 | All text in `rem`, respects user font settings | Designed |
| Motion | 2.3.3 — No auto-play animation >5s | `reducedMotion` store disables all animation | Designed |
| Status messages | 4.1.3 | `aria-live` on TopBar, CountdownTimer | Designed |
| Name/role/value | 4.1.2 | Semantic HTML + ARIA labels per component spec | Designed |

**Non-Applicable Criteria (and why):**
- **1.1.1 Non-text content:** No images. Emoji are text. Confetti is `aria-hidden`
- **1.2.x Time-based media:** No audio/video content — app is UI only
- **2.1.1 Keyboard:** PWA on phones — no physical keyboard. Focus management still implemented for assistive tech
- **2.4.1 Skip links:** Single-screen app with no scrollable navigation to skip

### Contrast Ratio Validation

**Dark Theme Token Audit:**

| Token Pair | Colors | Ratio | WCAG AA | Result |
|---|---|---|---|---|
| `--dj-text-primary` on `--dj-bg` | #f0f0f0 on #0a0a0f | 17.4:1 | 4.5:1 | Pass |
| `--dj-text-secondary` on `--dj-bg` | #8888aa on #0a0a0f | 5.8:1 | 4.5:1 | Pass |
| `--dj-text-accent` on `--dj-bg` | #ffd700 on #0a0a0f | 11.3:1 | 4.5:1 | Pass |
| `--dj-text-primary` on `--dj-surface` | #f0f0f0 on #1a1a2e | 12.1:1 | 4.5:1 | Pass |
| `--dj-text-secondary` on `--dj-surface` | #9494b0 on #1a1a2e | ~4.7:1 | 4.5:1 | Pass |
| `--dj-action-primary` on `--dj-bg` | #6c63ff on #0a0a0f | 4.9:1 | 3:1 (large) | Pass |
| `--dj-action-confirm` on `--dj-bg` | #4ade80 on #0a0a0f | 9.8:1 | 4.5:1 | Pass |
| `--dj-action-danger` on `--dj-bg` | #ef4444 on #0a0a0f | 5.2:1 | 4.5:1 | Pass |

**Fix applied:** `--dj-text-secondary` adjusted from `#8888aa` to `#9494b0` to pass 4.5:1 on `--dj-surface`. Verify in HTML prototype that visual hierarchy between primary (#f0f0f0) and secondary (#9494b0) still reads as distinct — if secondary feels too prominent, `#9999bb` is the alternative at ~5.0:1.

**Automated Contrast Enforcement:**

```javascript
// contrast.test.js
import { tokens } from './lib/constants/tokens.js';
import { getContrastRatio } from './lib/utils/color.js';

test.each([
  ['text-primary', 'bg', 4.5],
  ['text-secondary', 'bg', 4.5],
  ['text-accent', 'bg', 4.5],
  ['text-primary', 'surface', 4.5],
  ['text-secondary', 'surface', 4.5],
])('%s on %s meets %s:1', (fg, bg, min) => {
  expect(getContrastRatio(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(min);
});
```

Runs in CI. Catches regressions when tokens change.

**Vibe-Adaptive Palette Constraint:**
All 5 `data-dj-vibe` palettes only modify `--dj-ceremony-glow` and `--dj-ceremony-bg` — text tokens stay fixed. Ceremony text always renders in `--dj-text-primary` (#f0f0f0), which passes 4.5:1 against any ceremony background darker than #3a3a3a.

### Screen Reader Strategy

**The Honest Question: Will a visually impaired user attend a karaoke party?**

Yes — social gatherings are for everyone. Karamania must not *break* for screen reader users, even if the visual ceremony drama is lost. The app is **functional, not theatrical** for assistive tech.

**Screen Reader Approach: Announce Actions, Skip Spectacle**

| Screen | Screen Reader Experience | ARIA Strategy |
|---|---|---|
| Lobby | "Karamania party. 6 of 8 joined. You are participant." | `aria-live="polite"` on participant count |
| Icebreaker | "Choose one: Option A, Option B. 6 seconds remaining." | `role="radiogroup"`, `aria-live="assertive"` on timer |
| Quick Pick | "Pick a song. 5 options. Bohemian Rhapsody by Queen, 5 of 5 know this. 12 seconds." | `role="group"`, `aria-live="polite"` on vote counts |
| Spin the Wheel | "Spin the wheel. 8 songs loaded. Tap spin." → "Selected: Bohemian Rhapsody. Veto in 5 seconds." | `aria-live="assertive"` on result |
| Song State | "Linh is singing. Ballad. Tap for reactions." | `aria-live="polite"`, soundboard buttons labeled |
| Ceremony Vote | "Vote: Best Hype. 4 seconds. Duc. Minh. Trang." | `role="radiogroup"`, `aria-live="assertive"` on timer |
| Ceremony Silence | "Revealing winner..." | `aria-live="polite"`, skip visual drama |
| Ceremony Reveal | "Winner: Duc! Best Hype." | `aria-live="assertive"`, announce immediately |
| Interlude | "Who sings next? Vote: Linh, Duc, Minh." | `role="radiogroup"` on singer cards |
| Genre Picker | "Pick genre: Pop, Rock, Ballad, Dance, K-pop." | `role="radiogroup"` |
| Finale | "Party over. 12 songs. Most awarded: Duc." | Static content, full readout |

**What Gets `aria-hidden="true"`:**
- ConfettiLayer (decorative)
- GlowEffect (decorative)
- Emoji scatter reactions (visual flair only)
- Countdown circular visual (number announced via `aria-live` instead)

**Reduced Motion + Screen Reader Overlap:**
Users with `prefers-reduced-motion: reduce` AND screen readers get the leanest experience: no animation, no decorative layers, pure announcements. Graceful degradation to a functional social tool.

**Automated ARIA Testing:**

| Method | What It Catches | When |
|---|---|---|
| `axe-core` in Vitest | Missing ARIA roles, label mismatches, contrast | Every PR (automated) |
| Manual VoiceOver walkthrough | Flow coherence, announcement timing, focus order | Once per sprint (manual) |
| `aria-live` region assertion | Correct announcements fire on state change | Unit test per screen component |

**`aria-live` assertion example:**

```javascript
// SongScreen.test.js
test('announces current singer', async () => {
  currentSinger.set('Linh');
  currentGenre.set('Ballad');
  const live = screen.getByRole('status');
  expect(live).toHaveTextContent('Linh is singing');
});
```

### Performance as Accessibility

**Budget Android Is an Accessibility Concern**

A Samsung Galaxy A13 with 3GB RAM on congested karaoke-venue WiFi is a real user. Performance barriers ARE accessibility barriers.

**Performance Accessibility Targets:**

| Metric | Target | Enforcement |
|---|---|---|
| First Contentful Paint | < 2s on 3G | Lighthouse CI ≥ 80 |
| Time to Interactive | < 3s on 3G | Lighthouse CI ≥ 80 |
| JS bundle (gzipped) | < 30KB | CI assertion on `vite build` output |
| Total transfer | < 80KB initial | Lighthouse CI |
| Accessibility score | ≥ 90 | Lighthouse CI gate |
| Frame rate during ceremony | 30fps minimum | Manual check during ceremony dev |
| WebSocket reconnect | < 2s | Socket.io tuned config |

**CI Enforcement Gates:**
- **Lighthouse CI** in GitHub Actions: Performance ≥ 80, Accessibility ≥ 90
- **Bundle size check**: assert gzipped JS < 30KB in CI pipeline
- **Contrast ratio tests**: automated token pair validation (see Contrast section)
- Frame rate is manual-only — too flaky for CI

**Budget Device Safeguards:**

| Concern | Safeguard |
|---|---|
| CSS animations on underpowered GPU | All animations use `transform` and `opacity` only — composited, GPU-friendly. No `height`, `width`, `margin` animations |
| Confetti particle count | Cap at 30 particles always. Visual difference between 30 and 50 is negligible in a dark room. One code path, no device detection |
| Web Audio decode time | Lazy-load audio buffers. If decode takes > 500ms, skip audio for session |
| Memory leaks from WebSocket | Single socket instance, explicit cleanup on `beforeunload` |
| Font rendering | System font stack: `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif`. Roboto pre-installed on all Android since 4.0, full Vietnamese diacritics (ă, ơ, ư, đ) support. Zero font downloads |

**Network Resilience:**

Karaoke venue WiFi is unreliable. Tuned Socket.io config for fast reconnection:

```javascript
const socket = io(SERVER_URL, {
  reconnectionDelay: 500,      // Start retry at 500ms (default 1000)
  reconnectionDelayMax: 3000,  // Cap at 3s (default 5000)
  reconnectionAttempts: 20,    // Cap at 20 (default Infinity — battery drain)
  timeout: 5000,               // Connection timeout 5s (default 20000 — too long)
});
```

**Resilience behavior:**
- **Offline song state:** If WebSocket drops during a song, the UI stays on Song Screen (no-limit state). Reconnect restores latest state. No blank screen.
- **Slow reconnect:** LoadingSkeleton shows after 200ms disconnect. No spinner — the logo pulses.
- **Missing audio buffers:** If lazy-load fails, that audio category is silently disabled. Visual transitions continue.

**AC:** Given a network drop during any state, WHEN the socket reconnects, THEN the client receives and renders the current server state with no user action required. Given any device, WHEN confetti is triggered, THEN particle count is capped at 30.
