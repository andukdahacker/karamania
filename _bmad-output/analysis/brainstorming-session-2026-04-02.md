---
stepsCompleted: [1, 2]
inputDocuments: []
session_topic: 'Redesigning Karamania as a music-reactive, lyrics-synced karaoke companion experience'
session_goals: 'New vision for what Karamania becomes; Concrete feature ideas for next version; Specific game mechanics tied to live music detection and lyrics'
selected_approach: 'progressive-flow'
techniques_used: []
ideas_generated: []
context_file: ''
---

# Brainstorming Session Results

**Facilitator:** Ducdo
**Date:** 2026-04-02

## Session Overview

**Topic:** Redesigning Karamania as a music-reactive, lyrics-synced karaoke companion experience - replacing static party games with live, song-integrated moments
**Goals:**
1. New vision for what Karamania becomes with lyrics-sync technology
2. Concrete feature ideas for the next version
3. Specific game mechanics tied to live music detection and lyrics

### Context Guidance

_Technical research confirmed: ACRCloud/ShazamKit can detect songs in real-time, LRCLIB/Musixmatch provide synced lyrics (LRC format), flutter_lyric handles display. The Apple Music lyrics animation pattern is achievable. Periodic recognition (5-10s burst every 30s) balances accuracy with battery life. Karaoke backing track recognition is the biggest risk._

### Session Setup

_Progressive Technique Flow selected - systematic development from broad vision exploration through to specific game mechanics and action planning._

## Technique Selection

**Approach:** Progressive Technique Flow
**Journey Design:** Systematic development from exploration to action

**Progressive Techniques:**

- **Phase 1 - Exploration:** Cross-Pollination for maximum idea generation across domains
- **Phase 2 - Pattern Recognition:** Morphological Analysis for organizing into product dimensions
- **Phase 3 - Development:** Role Playing to stress-test through different user personas
- **Phase 4 - Action Planning:** Resource Constraints for ruthless prioritization

## Phase 1: Cross-Pollination Results

**Domains Raided:** Rhythm Games, Jackbox Party Games, TikTok/Reels, Sports Stadiums, Drinking/Party Games, Concert/Festival Apps, Escape Rooms, Arcade/Carnival, Music Education, Fitness Apps, Live Streaming, Board Games, Theme Parks

**44 concepts generated, 21 survived user filtering:**

### Surviving Ideas

**#3 - Group Chant Words**: Certain iconic lyrics highlight on everyone's screen as "EVERYONE" moments. The chorus hook, the big line. Screen flashes, lyrics enlarge, whole room belts it out. Energy meter spikes when detected via mic amplitude.

**#4 - Chant Crescendo**: Chant words start small and GROW as the moment approaches. Visual countdown builds anticipation. "Don't stop..." grows bigger... "BELIEVIN'" explodes across every screen.

**#5 - Peak Energy / Golden Moments**: When crowd energy meter fills to max, the screen transforms - colors explode, phone vibrates. The moment gets recorded as a highlight. Session ends with a "Best Moments" reel. Shareable memories.

**#6r - Roast Awards**: After a performance, everyone votes on humorous, genre-aware categories. Ballad gets "Most Tears Shed," rap gets "Lost The Beat At The Second Verse." Categories tailored to what just happened.

**#7r - Fill-in-the-Blank (Multiple Choice)**: Occasionally a lyric word blanks out, 3-4 tap options appear. One tap, back to vibing. Optional - only people who want to play engage.

**#8 - Active/Passive Mode**: Each phone can be in Vibe Mode (beautiful lyrics flow) or Play Mode (interactive elements layered on). Single swipe toggle. Active-first design, passive as cool fallback.

**#9r - Duet Mode (Color-Coded)**: Duet songs split lyrics into two colors. Blue = your turn, gold = theirs. Chorus = both colors = sing together. Scales to 3+ people. The color system IS the casting mechanic.

**#12r - Reactive Phone Light Show**: Phone screens pulse color synced to song energy. Mellow verse = soft glow. Chorus = bright fast pulses. Golden Moments = all phones sync and strobe. The room's atmosphere changes with every song section.

**#15 - Lyric Roulette**: Between songs, app spins through random lyrics from the next song. Lands on a line. Person must act it out, explain it, or make up an alternate lyric. Fills dead air with music-tied content.

**#16r - Song Dares (Drink-Optional)**: Lyrics-aware dare triggers during songs. Host toggles "party mode" (drink dares) or "chill mode" (no drinks). "Air guitar solo," "sing with an accent," "swap seats." Genre-aware dare generation.

**#17 - Musical Hot Potato**: One phone shows a glowing potato during a song. Randomly jumps to another phone at random lyric lines. Whoever holds it when chorus hits = dare/drink/solo. Song structure IS the timer.

**#20 - Blind Request**: Anonymously submit a song tagged with someone's name as a challenge. Shows on their phone. Accept or pass. Creates "WHO requested this for me?!" moments.

**#21 - Setlist Momentum / Crowd Queue**: Live shifting song queue. Audience votes to shuffle order. "Push [song] up" or "We want [person] next!" Host has veto. Democratic, social song management.

**#25 - Song Chain**: Each next song must connect to previous (same artist, word in title, genre, decade). App validates automatically. Streak counter on everyone's screen. Turns selection into group puzzle.

**#26 - Spin The Wheel**: Between songs, wheel spins with performance modifiers. "Sing in slow motion," "Eyes closed for chorus," "Everyone joins on bridge." One re-spin allowed.

**#27 - Claw Machine Song Pick**: Songs float around screen, tap to grab. They drift away. Themed rounds: "Only 90s," "Only power ballads." Playful replacement for boring catalog browsing.

**#29 - Did You Know?**: Music trivia about the current song during instrumental breaks. "Originally written for another artist," "Guitar riff recorded in one take." Quick, interesting, conversation-starting.

**#30 - Guess The Next Line**: Lyrics display normally then next line blanks completely. 3 seconds to shout what comes next. No phone interaction - pure room call-and-response. Zero friction.

**#34 - Group Session Summary**: Collective stats card for the whole room. "22 songs, 3 hours, 14 Golden Moments, most-sung artist: ABBA, loudest moment: Sweet Caroline chorus #3." Shared memory artifact.

**#35 - Personal Hype Track**: 3-second custom hype intro plays on everyone's phone when it's your turn. Like a wrestler's entrance. Builds anticipation for the next performer.

**#42 - The Queue Is The Show**: While waiting to sing, phone runs mini-games, song previews, lyric practice, audience activities. Zero dead time. Waiting IS content.

## Phase 2: Morphological Analysis / Pattern Recognition

### Core Architecture: The Layer Cake

**Layer 1 - BASE (Always On):** Synced lyrics display + reactive phone light show + chant word highlights + crescendo builds. This IS the app. Everyone gets this. Zero interaction required.

**Layer 2 - INTERACTION (Active Mode):** Fill-in-the-blank, Guess The Next Line, Hot Potato, Song Dares. Layered on top of the base lyrics screen. Swipe to toggle.

**Layer 3 - SOCIAL (Between Songs):** Roast Awards, Lyric Roulette, Spin The Wheel, Crowd Queue, Song Chain, Blind Requests, Hype Track intros. Connective tissue between performances.

**Layer 4 - MEMORY (Session-Spanning):** Golden Moments capture, Group Session Summary. Long-term value and shareability.

### Timeline Map

| Moment | Features |
|--------|----------|
| During Song (Audience) | Chant, Crescendo, Golden Moments, Fill-in-Blank, Light Show, Song Dares, Hot Potato, Did You Know, Guess Next Line |
| During Song (Performer) | Duet Colors, Hype Track intro |
| After Song | Golden Moments capture, Roast Awards |
| Between Songs | Lyric Roulette, Spin The Wheel, Hype Track |
| Song Selection | Blind Request, Crowd Queue, Song Chain, Claw Machine |
| Waiting/Idle | Queue Is The Show, Active/Passive Mode |
| Session Level | Session Summary, Active/Passive Mode |

### Key Insight

9 of 21 features target "During Song (Audience)" - confirming the core gap. The audience experience during a performance is where the app must come alive.

## Phase 3: Role Playing / Persona Stress Testing

### Personas Tested

1. **The Shy One** - Base Layer + Passive Mode + group chants work perfectly. No need to protect them from social features - group dynamics self-regulate.
2. **The Host/DJ** - Too many features at once = tutorial hell. Needs progressive feature unlock so the app teaches itself through use.
3. **The Competitive One** - Revealed a core design principle: **NO scoring, NO winning/losing.** The app creates collective energy, not competition.
4. **The Late Arrival** - Progressive unlock must be PER USER from their join time, not session start. Quick splash to orient, then gentle ramp-up.

### Design Principles Confirmed

- **No competition.** No scores, leaderboards, or points. Collective energy only.
- **Progressive Feature Unlock.** Songs 1-2: Base Layer. Songs 3-4: Interaction Layer. Songs 5+: Social Layer. Memory Layer captures throughout.
- **Active-first, passive as fallback.** Don't ask permission to engage - make engagement the default, with easy opt-out.
- **Self-explanatory features.** If it needs explaining, it's too complex for a karaoke room.
- **Late joiners get personal ramp-up** from their own join time.

## Phase 4: Resource Constraints / Prioritization

### Impact vs Effort Analysis

All 21 features mapped. Top picks selected through ruthless filtering.

### First Release: Core 4 Features

**1. Synced Lyrics + Chant Words + Crescendo (#3 + #4)**
- Song detection via ACRCloud/ShazamKit → lyrics from LRCLIB/Musixmatch → flutter_lyric display
- Auto-detect chorus/repeated lyrics as chant moments
- Visual crescendo animation building to chant moments
- This IS the app. Proves the core tech pipeline.

**2. Reactive Phone Light Show (#12r)**
- Phone screen colors pulse synced to song energy
- Verse = soft glow, chorus = bright pulses, Golden Moments = sync strobe
- The "wow" differentiator. Screenshot/shareability moment.

**3. Guess The Next Line (#30)**
- Blank next lyric line for 3 seconds, room shouts the answer
- Zero phone interaction needed, pure call-and-response
- Lowest effort, highest fun ratio. Instantly understood.

**4. Duet Colors (#9r)**
- Duet songs split lyrics into two colors across two phones
- Blue = your turn, gold = theirs, both colors = sing together
- Scales to 3+ people. Transforms solo karaoke into collaborative performance.

### The Pitch

"Your phone knows what song is playing. It shows you the lyrics. It glows with the music. It turns the whole room into a sing-along. And it casts you and your friends in duet roles."

### V2 Feature Backlog (Priority Order)

1. Golden Moments capture + Session Summary (#5, #34)
2. Roast Awards (#6r)
3. Crowd Queue with voting (#21)
4. Fill-in-the-Blank multiple choice (#7r)
5. Active/Passive Mode toggle (#8)
6. Spin The Wheel modifiers (#26)
7. Song Dares drink-optional (#16r)
8. Musical Hot Potato (#17)
9. Lyric Roulette (#15)
10. Blind Request (#20)
11. Song Chain (#25)
12. Hype Track intro (#35)
13. Claw Machine song pick (#27)
14. Did You Know trivia (#29)
15. Queue Is The Show (#42)

### Progressive Unlock Roadmap (Post V2)

- **Songs 1-2**: Base Layer (Synced lyrics, light show, chant highlights, duet colors)
- **Songs 3-4**: Interaction Layer (Guess Next Line, Fill-in-Blank)
- **Songs 5+**: Social Layer (Roast Awards, Spin The Wheel, Song Dares, Crowd Queue)
- **Throughout**: Memory Layer (Golden Moments → Session Summary at end)

