# Sprint Change Proposal — Lyrics Sync Pivot

**Author:** John (PM Agent) with Ducdo
**Date:** 2026-04-02
**Scope Classification:** Major
**Status:** Approved

---

## Section 1: Issue Summary

### Problem Statement

The original Karamania MVP was built around a party game engine (DJ state machine, party cards, ceremonies, interludes) without music awareness. Research and brainstorming conducted on 2026-04-01 and 2026-04-02 revealed that **real-time song detection + synced lyrics** is the actual core differentiator — "the only karaoke companion that knows what song is playing and reacts to it in real-time."

### Discovery Context

- **Technical research (2026-04-01):** Confirmed ACRCloud/ShazamKit can detect songs in real-time, LRCLIB/Musixmatch provide synced lyrics (LRC format), flutter_lyric handles display. Periodic recognition (5-10s burst every 30s) balances accuracy with battery life.
- **Brainstorming session (2026-04-02):** Generated 44 concepts across 13 domains, filtered to 21, prioritized 4 core V1 features: Synced Lyrics + Chant Words, Reactive Phone Light Show, Guess The Next Line, Duet Colors.
- **PRD updated (2026-04-02):** Added FR116-FR140 (25 new FRs), NFR40-NFR47 (8 new NFRs), three design principles (no competition, progressive unlock, active-first), lyrics sync Go/No-Go gate, and restructured sprint plan.

### Evidence

- PRD now lists ACRCloud audio fingerprinting as **primary** song detection (was YouTube Lounge API)
- 4 entirely new feature systems: Lyrics Sync Engine, Reactive Light Show, Guess The Next Line, Duet Colors
- Lightstick Mode (FR63-64) replaced by Reactive Phone Light Show (FR136-139)
- Progressive Feature Unlock (FR140) fundamentally changes feature reveal timing
- "No competition" principle codified — no scoring, leaderboards, or points
- New Go/No-Go gate: ACRCloud must achieve >60% recognition in real karaoke rooms before committing

---

## Section 2: Impact Analysis

### Epic Impact

| Epic | Impact Level | Summary |
|------|-------------|---------|
| Epic 1: Party Foundation | Low | Add progressive unlock tracking per user |
| Epic 2: Core DJ Engine | Medium | Add song-detection awareness, layer-check guards on card/interlude transitions |
| Epic 3: Ceremonies & Awards | Low | No scoring aligns with existing no-voting design |
| Epic 4: Audience Participation | **High** | Lightstick mode REMOVED, replaced by light show. Party cards gated to Social Layer |
| Epic 5: Song Integration | Medium | ACRCloud becomes primary detection, Lounge API demoted to optional |
| Epic 6: Media Capture | Low | Minimal impact |
| Epic 7: Interlude Games | Low-Medium | Interludes gated to Social Layer (except Quick Vote) |
| Epic 8: Finale & Persistence | Low | Minimal impact |
| Epic 9: Session Timeline | Low | Minimal impact |
| Epic 10: UX Redesign | **High** | During-song screen completely redesigned around lyrics display |
| **NEW Epic 11** | **New** | Lyrics Sync Engine — ACRCloud, LRCLIB, chant detection, light show |
| **NEW Epic 12** | **New** | Interactive Lyrics Games — Guess The Next Line, Duet Colors |
| **NEW Epic 13** | **New** | Progressive Feature Unlock — per-user gating, late-joiner ramp-up |

**Summary:** 3 new epics needed (~20 new stories). 2 epics need major rework (Epic 4, Epic 10). 3 epics need moderate updates (Epic 2, Epic 5, Epic 7). 5 epics largely intact.

### Story Impact

- **New stories:** ~20 across Epics 11, 12, 13
- **Modified stories:** ~8 across Epics 2, 4, 5, 7, 10
- **Removed stories:** Lightstick mode stories from Epic 4 (FR63, FR64)
- **Unaffected stories:** ~45 of original 57 remain valid as-is

### Artifact Conflicts

| Artifact | Status | Update Needed |
|----------|--------|--------------|
| PRD | ✅ Updated | FR63-64 revised to reference lyrics sync, FR116-FR140 added |
| Architecture | ✅ Updated | Audio Intelligence layer, ACRCloud, LRCLIB, integration seams added |
| UX Design Spec | ✅ Updated | Lyrics-first song screen, light show, duet colors, progressive unlock added |
| Epics & Stories | ✅ Updated | 3 new epics (11-13), modified epics 2, 4, 5, 10 with pivot stories |
| Sprint Status | ✅ Updated (2026-04-02) | Reset to 13 epics/87 stories, new stories backlog, 4.7 needs-update |
| Project Context | ❌ Not updated | Update with lyrics sync patterns, ACRCloud rules, progressive unlock logic |

### Technical Impact

- **New dependencies:** ACRCloud SDK (flutter_acrcloud), LRCLIB API, flutter_lyric package, SQLite/Hive for lyrics cache
- **New permissions:** Microphone (RECORD_AUDIO) for audio fingerprinting
- **New client components:** LyricsSyncService, LyricsDisplayWidget, LightShowEngine, ChantDetector, ProgressiveUnlockManager, DuetManager
- **Code removal:** Lightstick mode UI components and toggle logic
- **Battery considerations:** <12%/hr target with periodic audio capture

---

## Section 3: Recommended Approach

### Selected Path: Direct Adjustment

**Rationale:**

1. The existing foundation (party creation, DJ engine, ceremonies, media capture, persistence, session timeline) is **solid and reusable** — 45 of 57 completed stories remain valid
2. The pivot **adds** a new layer (audio intelligence + lyrics display) rather than replacing the core
3. Only lightstick mode needs actual replacement (by reactive light show)
4. Progressive Feature Unlock is a UX pattern layered on top of existing features — it gates when they appear, not whether they exist
5. The new Go/No-Go gate (ACRCloud PoC) provides a natural checkpoint before committing to full implementation

**Alternatives Considered:**

- **Rollback:** Not viable — almost all existing work remains valid. Only lightstick mode code needs removal.
- **MVP Scope Reduction:** Viable but not recommended — shipping lyrics sync in phases delays the core differentiator. The whole point of the pivot is that lyrics sync IS the product.

### Effort Estimate

- **New implementation:** ~3-4 weeks (Epic 11: 1.5 weeks, Epic 12: 0.5 weeks, Epic 13: 0.5 weeks, modifications to existing epics: 0.5-1 week)
- **Artifact updates:** Architecture (~1 day), UX Design (~2-3 days), Epics document (~1 day), Sprint Status (~0.5 day)
- **Total additional effort:** ~4-5 weeks including artifact updates

### Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| ACRCloud recognition fails in noisy karaoke rooms | High | Mandatory PoC gate (Sprint 0). Manual search fallback |
| Karaoke backing tracks not recognized | Medium | Cover-song identification mode. Curated catalog backup |
| LRCLIB lyrics coverage gaps | Medium | Graceful "no lyrics" state. Musixmatch commercial upgrade path |
| Battery drain from periodic audio capture | Medium | 5-10s burst every 30s (not continuous). <12%/hr target |
| Scope creep from brainstorm backlog (15 V2 features) | Low | Strict V1 = 4 features only. V2 backlog documented but deferred |

### Timeline Impact

- Original sprint plan: 7 sprints (Sprint 0-6)
- Updated sprint plan: 10-11 sprints — Sprint 0 gains ACRCloud PoC day, Sprint 1 gains lyrics pipeline, Sprint 2 gains interactive features, new Sprint for progressive unlock integration
- **Net addition: ~3-4 sprints**

---

## Section 4: Detailed Change Proposals

### 4.1 Remove Lightstick Mode (Epic 4)

- **Remove:** FR63 (lightstick toggle), FR64 (lightstick glow), FR66 (lightstick alongside hype)
- **Replace with:** FR136-139 (Reactive Phone Light Show) — automatic, music-synced, zero interaction
- **Revise FR66:** "Hype signal available alongside reactions and the reactive light show"
- **Delete:** Lightstick mode UI components and toggle logic

### 4.2 New Epic 11: Lyrics Sync Engine (9 stories)

| Story | Covers | Priority |
|-------|--------|----------|
| 11.1 ACRCloud Audio Fingerprint Pipeline | FR116, FR119 | Critical |
| 11.2 Periodic Re-Recognition & Song Change | FR117, FR118 | Critical |
| 11.3 Detection Fallback — Manual Search | FR120 | Critical |
| 11.4 Detection Status Indicator | FR122 | High |
| 11.5 LRCLIB Lyrics Fetch & Display | FR123, FR124 | Critical |
| 11.6 Local Lyrics Cache | FR125 | High |
| 11.7 Graceful "No Lyrics" State | FR126 | High |
| 11.8 Chant Detection & Crescendo Animation | FR127-130 | High |
| 11.9 Reactive Phone Light Show | FR136-139 | High |

### 4.3 New Epic 12: Interactive Lyrics Games (3 stories)

| Story | Covers | Priority |
|-------|--------|----------|
| 12.1 Guess The Next Line | FR131, FR132 | High |
| 12.2 Duet Mode Activation & Color Assignment | FR133 | High |
| 12.3 Duet Lyrics Display | FR134, FR135 | High |

### 4.4 New Epic 13: Progressive Feature Unlock (5 stories)

| Story | Covers | Priority |
|-------|--------|----------|
| 13.1 Per-User Song Counter & Layer State | FR140 | Critical |
| 13.2 Base Layer Gating (Songs 1-2) | FR140 | Critical |
| 13.3 Interaction Layer Activation (Songs 3-4) | FR132, FR140 | High |
| 13.4 Social Layer Activation (Songs 5+) | FR140 | High |
| 13.5 Late Joiner Ramp-Up | FR140 | High |

### 4.5 Epic 2 Modifications (DJ Engine)

- Add SONG_DETECTED sub-state to song state
- Add layer-check guards on card deal and interlude transitions
- New Story 2.10: Song Detection Integration with DJ Engine

### 4.6 Epic 5 Modifications (Song Integration)

- ACRCloud becomes primary detection, Lounge API demoted to optional
- New Story 5.10: Detection Source Abstraction (unified SongContext interface)

### 4.7 Epic 7 Modifications (Interlude Games)

- Interludes gated to Social Layer (songs 5+ per user)
- Quick Vote remains universal (single-tap, no spotlight)
- Icebreaker unchanged (pre-song activity)

### 4.8 Epic 10 Modifications (UX Redesign)

- Remove lightstick screens/wireframes
- New stories: 10.8 (Lyrics Display Screen), 10.9 (Duet Mode Visuals), 10.10 (Progressive Unlock Transitions), 10.11 (Detection & Fallback UX)
- Major rework of song state audience view — lyrics-first layout

### 4.9 Architecture Document Update

- Add Audio Intelligence architectural tier
- Add 4 new integration seams (fingerprint, lyrics fetch, light show sync, progressive unlock)
- Add new technical constraints (ACRCloud API, LRCLIB, microphone permissions, battery)
- Add 7 new client-side components
- Add new data models (lyrics_cache, detection_events, user_layer_state)
- Update FR/NFR counts (140 FRs, 47 NFRs)

### 4.10 Sprint Status & UX Spec Reset

- Sprint status: extend to 13 epics, new stories "todo", modified stories "needs-update", removed stories "removed"
- UX spec: remove lightstick, add lyrics display + light show + duet colors + progressive unlock + detection status

---

## Section 5: Implementation Handoff

### Scope Classification: Major

This is a fundamental product pivot requiring PM, Architect, and Dev coordination.

### Handoff Plan

| Role | Responsibility | Priority |
|------|---------------|----------|
| **Product Manager** | PRD cleanup (remove FR63-64, revise FR66). Validate updated PRD against brainstorm + research findings | Immediate |
| **Solution Architect** | Architecture document update — Audio Intelligence layer, integration seams, client components, data models | High — before dev starts |
| **UX Designer** | UX spec overhaul — lyrics display screen, light show visuals, duet colors, progressive unlock transitions, remove lightstick | High — before dev starts |
| **Product Manager / SM** | Epics & Stories document update — add Epics 11-13, modify Epics 2, 4, 5, 7, 10. Sprint status reset | High — before dev starts |
| **Development Team** | ACRCloud PoC (Sprint 0 gate) → lyrics pipeline → interactive features → progressive unlock → existing epic modifications | After artifacts updated |

### Execution Sequence

1. **Immediate:** PRD minor cleanup (FR63-64 removal)
2. **Week 1:** Architecture update + UX spec update (can be parallel)
3. **Week 1:** Epics & Stories document update + sprint status reset
4. **Week 2:** ACRCloud PoC (Go/No-Go gate)
5. **Week 2+:** Full implementation per updated sprint plan (if PoC passes)

### Success Criteria

- [ ] All 6 artifacts updated and consistent with each other
- [ ] ACRCloud PoC passes Go/No-Go gate (>60% recognition in real karaoke room)
- [ ] Lyrics display working end-to-end (detect → fetch → display → chant)
- [ ] Reactive light show rendering on both iOS and Android
- [ ] Progressive feature unlock gating all features correctly
- [ ] Lightstick mode fully removed from codebase
- [ ] Sprint status accurately reflects new scope

---

## Approval

**Approved by:** Ducdo (2026-04-02)
**Change scope:** Major
**Recommended routing:** PM + Architect + Dev coordination

✅ Sprint Change Proposal complete.
