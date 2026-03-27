# Sprint Change Proposal — UX Redesign & Brand Identity

**Date:** 2026-03-27
**Author:** Sally (UX Designer Agent) + Ducdo
**Status:** Approved
**Scope Classification:** Minor — Direct implementation by dev team

---

## Section 1: Issue Summary

**Problem Statement:** The Karamania app is functionally complete (9 epics, ~68 stories implemented) but lacks visual brand identity and has accumulated UX debt. A systematic screenshot review of all 13 screen states revealed:

1. No brand identity — plain serif "KARAMANIA" text, no logo or mascot
2. Buttons lack visual affordance — text floating on dark backgrounds, not recognizable as tappable
3. Core party screen (the main experience) shows "Song" label with no song title or performer name
4. Ceremony screen (the emotional peak) is plain white text on white — no celebration energy
5. Color inconsistency — lobby is purple, party is white, ceremony is white, session detail is dark
6. Material Design default dialogs break the brand
7. Input text overflow/ellipsis on party codes and names
8. Guest lobby has no "waiting for host" indicator
9. Import playlist doesn't show imported songs for review/management

**Discovery Method:** Automated screenshot capture pipeline (13 integration tests via `flutter drive`) feeding into UX designer review.

**Evidence:**
- 13 screenshots in `docs/screenshots/`
- UX review findings documented in conversation
- Wireframes: `_bmad-output/excalidraw-diagrams/wireframe-ux-redesign.excalidraw`
- Brand brief: `_bmad-output/brand-brief.md`

---

## Section 2: Impact Analysis

### Epic Impact
- **Epics 1-9:** No modification needed. All existing stories remain done/valid.
- **New Epic 10:** "UX Redesign & Brand Identity" — 7 new stories added to backlog.

### Story Impact
- No existing stories need modification or rollback.
- 7 new stories cover all identified UX issues.
- Story 9.5 (Session Sharing) currently in review — should be completed before starting Epic 10.

### Artifact Conflicts
- **PRD:** No conflicts. UX changes implement existing requirements with better visual quality.
- **Architecture:** No conflicts. All changes are Flutter UI layer only.
- **UX Design Spec:** Should be updated to reflect new brand identity, button styles, party screen layout, ceremony visuals, and custom dialogs. This is a documentation update, not a blocker.

### Technical Impact
- **Code:** Flutter widgets only — screens, theme, assets. No server/API/DB changes.
- **Assets:** New mascot images already added to `assets/images/`. App icons already generated for iOS (15 sizes) and Android (5 densities).
- **Tests:** Screenshot test pipeline already built. Will be re-run after each story to verify.
- **Infrastructure:** No changes needed.

---

## Section 3: Recommended Approach

**Selected Path:** Direct Adjustment — Add Epic 10 to sprint backlog.

**Rationale:**
- The app is functionally complete — this is natural pre-release polish
- All changes are additive UI refinements, not architectural shifts
- Low risk — no server, database, or API modifications
- High impact — brand identity and button affordances directly affect user first impression and retention
- Medium effort — 7 stories, mostly Small-Medium, estimated 3-5 days total
- No rollback, scope reduction, or re-planning needed

**Alternatives Considered:**
- Rollback: Not applicable — no existing work needs reverting
- MVP Review: Not applicable — scope is unchanged, this is polish

---

## Section 4: Detailed Change Proposals

### New Epic: Epic 10 — UX Redesign & Brand Identity

**Location:** `_bmad-output/implementation-artifacts/epic-ux-redesign.md`

| # | Story | Priority | Size | Impact |
|---|-------|----------|------|--------|
| 10.1 | Home Screen — Brand Identity & Button Affordances | P1 | S-M | First impression |
| 10.2 | Join Screen — Balanced Layout & Input Sizing | P3 | M | Usability |
| 10.3 | Lobby Guest — Waiting State & Playlist Management | P5 | M | Feature gap |
| 10.4 | Party Screen — Song & Performer Display | P0 | M | Core UX |
| 10.5 | Ceremony Screen — Celebration Energy | P1 | S-M | Emotional peak |
| 10.6 | Branded Custom Dialogs | P4 | S | Polish |
| 10.7 | Color Consistency Across Party Flow | P2 | S | Cohesion |

**Recommended implementation order:**
1. Story 10.4 (Party Song Display) — fixes the core experience
2. Story 10.1 (Home Screen Brand) — first impression
3. Story 10.5 (Ceremony Energy) — emotional peak
4. Story 10.7 (Color Consistency) — cohesion
5. Story 10.2 (Join Screen) — usability
6. Story 10.6 (Branded Dialogs) — polish
7. Story 10.3 (Guest Lobby Playlist) — feature enhancement

### Sprint Status Updates

```yaml
# Add to sprint-status.yaml:
epic-10: backlog
10-1-home-screen-brand-identity: backlog
10-2-join-screen-layout-and-input-sizing: backlog
10-3-lobby-guest-waiting-and-playlist: backlog
10-4-party-screen-song-and-performer: backlog
10-5-ceremony-celebration-energy: backlog
10-6-branded-custom-dialogs: backlog
10-7-color-consistency-party-flow: backlog
epic-10-retrospective: optional
```

### UX Design Spec Updates (Deferred)
The UX Design Specification should be updated after Epic 10 implementation to reflect:
- New mascot logo brand identity
- Updated button styles (filled gold CTAs)
- Party screen song/performer display
- Ceremony vibe-colored backgrounds + confetti
- Custom branded dialog component
- Guest lobby waiting state messaging
- Import playlist song list management

---

## Section 5: Implementation Handoff

**Scope:** Minor — Direct implementation by dev team

**Handoff:**
- **Dev team:** Implement all 7 stories in priority order
- **Definition of Done per story:**
  - Implementation matches wireframe layout
  - Screenshot test re-run captures new design
  - Existing widget tests pass
  - Tested with all 5 vibes
  - No text overflow on standard phone sizes

**Success Criteria:**
- All 7 stories completed and passing screenshot verification
- App visually matches wireframes across all screens
- Brand identity (mascot, gold/purple palette) consistently applied
- No regression in existing functionality

**Pre-requisites:**
- Complete Story 9.5 review (currently in review status)
- Mascot assets already in place (`assets/images/mascot_icon.png`, `mascot_banner.png`)
- App icons already generated for iOS and Android

---

**Approved by:** Ducdo
**Date:** 2026-03-27
