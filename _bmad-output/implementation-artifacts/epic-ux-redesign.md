# Epic: UX Redesign — Brand Identity & Screen Improvements

## Overview
Implement UX improvements identified in the visual review of all app screens, incorporating the new mascot logo brand identity (gold mic mascot + gold/purple palette) and fixing usability issues across Home, Join, Lobby, Party, Ceremony, and Session Detail screens.

## Reference Artifacts
- UX Review: Conversation findings (13 screenshots analyzed)
- Wireframes: `_bmad-output/excalidraw-diagrams/wireframe-ux-redesign.excalidraw`
- Brand Brief: `_bmad-output/brand-brief.md`
- Mascot Source: `_bmad-output/logo-concepts/mascot-final-2048.png`
- App Icons: Already generated in `ios/` and `android/` asset folders

---

## Story 1: Home Screen — Brand Identity & Button Affordances

**As a** new user opening the app for the first time,
**I want** to see an inviting, branded home screen with clear action buttons,
**so that** I immediately understand what the app is and feel confident tapping the CTAs.

### Acceptance Criteria
- [ ] Mascot logo image displayed centered above the wordmark (use `mascot-final-2048.png` as asset, sized ~120x140)
- [ ] "KARAMANIA" wordmark rendered in bold gold (`#FFD700`) below mascot
- [ ] "CREATE PARTY" button is a filled gold rectangle with dark text, rounded corners (12px), full-width padded
- [ ] "JOIN PARTY" button is an outlined gold rectangle with gold text, same dimensions
- [ ] Both buttons have clear tap feedback (ink splash or scale animation)
- [ ] "Save your session history" text + "Sign in" link remain below, with adequate spacing
- [ ] Authenticated state: layout stays vertically centered (no jarring shift from guest view)
- [ ] Empty session state: replace lonely "Start your first party!" with mascot + encouraging copy

### Technical Notes
- Add mascot PNG to `assets/images/` and reference in `pubspec.yaml`
- Modify `HomeScreen` widget to use `Image.asset` for mascot
- Replace plain text buttons with styled `Container` widgets matching wireframe
- Keep existing key names for test compatibility

### Estimate: Small-Medium

---

## Story 2: Join Screen — Balanced Layout & Input Sizing

**As a** guest joining a party,
**I want** a clean, balanced join form with readable inputs,
**so that** I can easily enter the party code and my name without text overflow.

### Acceptance Criteria
- [ ] Party code input uses 4 individual square boxes (70x70 each) with auto-advance focus
- [ ] Each box displays one character, centered, at fontSize 28 (no overflow/ellipsis)
- [ ] Helper text "Ask your host for the 4-letter code" displayed below code boxes in secondary color
- [ ] Display name input uses fontSize 16 (not the current oversized value) with proper placeholder
- [ ] "JOIN PARTY" button is full-width filled gold, matching Home screen button style
- [ ] Form is vertically centered in the upper 60% of the screen (no massive dead zone)
- [ ] Back arrow navigation in top-left corner
- [ ] Deep link pre-fill (`?code=VIBE`) still works, populating the 4 boxes

### Technical Notes
- Replace single `TextField` for party code with 4 `SizedBox` + `TextField` widgets using `FocusNode` chain
- Cap text input font sizes to prevent overflow
- Reuse the gold button component from Story 1

### Estimate: Medium

---

## Story 3: Lobby Guest View — Waiting State & Playlist Management

**As a** guest waiting in the lobby,
**I want** to know I'm waiting for the host and see my imported songs listed,
**so that** I feel informed and in control of my playlist contribution.

### Acceptance Criteria
- [ ] "Waiting for host to start..." message displayed with subtle pulse animation and hourglass icon
- [ ] Message appears only for non-host participants (when `isHost == false`)
- [ ] Imported playlist shows songs as a scrollable list with:
  - Song title (bold) + artist name (secondary) per row
  - ✕ button per song to remove it from the import
  - Song count indicator (e.g., "3 songs imported") above the list
- [ ] "+ Add song manually" link below the song list (opens manual song entry)
- [ ] Playlist URL input uses fontSize 14 (no overflow on long URLs)
- [ ] Import button styled with brand purple (`#6C63FF`)

### Technical Notes
- Add waiting message to `LobbyScreen` conditional on `!party.isHost`
- Refactor playlist import section to use `ListView.builder` for song list
- Add remove callback to playlist provider/state
- Ensure song removal doesn't break the import flow

### Estimate: Medium

---

## Story 4: Party Screen — Song & Performer Display

**As a** party participant during a song,
**I want** to see what song is playing and who's singing,
**so that** I know the context and can react appropriately.

### Acceptance Criteria
- [ ] Song title displayed prominently in gold (`#FFD700`), fontSize 28, centered
- [ ] Artist name displayed below in secondary color, fontSize 16
- [ ] Performer name displayed as "🎤 {name} is singing" below artist, fontSize 18
- [ ] Countdown timer remains large and centered below performer info
- [ ] Participant count badge shown in secondary text
- [ ] Reaction emoji buttons increased to fontSize 28 (from current smaller size) with more horizontal spacing
- [ ] Soundboard bar emoji increased to fontSize 24
- [ ] Top half of screen is no longer empty — song info fills the vertical center

### Technical Notes
- `PartyScreen` needs to read `currentPerformer` from `PartyProvider` and display name
- Map performer userId to display name via participant list
- Song title/artist may need a new field from server or could use "Song #{songCount}" as fallback
- Adjust `DjStateLabel` widget or create new `SongInfoDisplay` widget
- Update reaction bar emoji `fontSize` in `ReactionBar` widget

### Estimate: Medium

---

## Story 5: Ceremony Screen — Celebration Energy

**As a** participant watching an award reveal,
**I want** to see a dramatic, celebratory ceremony screen,
**so that** the award moment feels special and rewarding.

### Acceptance Criteria
- [ ] Background uses vibe color (`PartyVibe.bg`) instead of plain white
- [ ] Radial gold glow effect behind the award text (use `RadialGradient` or `Container` with boxShadow)
- [ ] Confetti/sparkle emoji elements scattered around the award (4-6 positioned elements using vibe confetti pool)
- [ ] Award title in gold (`#FFD700`), fontSize 36, bold
- [ ] Performer name above award in secondary color, fontSize 22
- [ ] Song reference below award ("Bohemian Rhapsody") in secondary color for context
- [ ] "Quick Award" / ceremony type label remains but styled subtly
- [ ] Background color consistent with lobby/party dark theme (not jarring white)

### Technical Notes
- Modify ceremony overlay/widget to use `djStateBackgroundColor` for bg
- Add positioned confetti text widgets using `Stack` + `Positioned`
- Use `BoxDecoration` with `RadialGradient` for glow effect
- Pull song title from ceremony data if available, or from last song state

### Estimate: Small-Medium

---

## Story 6: Branded Custom Dialogs

**As a** user interacting with confirmation dialogs,
**I want** dialogs that match the app's dark theme and brand,
**so that** the experience feels cohesive and not like a generic Android app.

### Acceptance Criteria
- [ ] All `showDialog` calls use a custom themed dialog widget
- [ ] Dialog background: `DJTokens.surfaceElevated` (`#252542`)
- [ ] Dialog border radius: 16px
- [ ] Dialog title: `DJTokens.textPrimary` (`#F0F0F0`)
- [ ] Confirm button: gold filled (matching CTA buttons)
- [ ] Cancel/destructive button: outlined or text-only
- [ ] No Material Design default blue accent colors visible
- [ ] Applies to: exit confirmation, leave party, error dialogs

### Technical Notes
- Create `BrandedDialog` widget wrapping `Dialog` with custom styling
- Create `showBrandedDialog` helper function
- Replace all `showDialog` / `AlertDialog` usages across screens
- Audit: `PartyScreen` (exit confirm), `LobbyScreen` (leave party), any error dialogs

### Estimate: Small

---

## Story 7: Color Consistency Across Party Flow

**As a** user moving between lobby, party, and ceremony screens,
**I want** consistent dark-themed backgrounds,
**so that** the app feels like one cohesive experience, not three different apps.

### Acceptance Criteria
- [ ] Song state uses dark background (`#0A0A0F`) — not white/cream
- [ ] Song selection state uses dark background (`#0F0A1E`) — not light
- [ ] Ceremony state uses vibe background color — not plain white
- [ ] Pause overlay uses semi-transparent dark overlay — not opaque gray
- [ ] All text remains readable against dark backgrounds (maintain contrast ratios)
- [ ] Transition between screens feels smooth (no jarring light↔dark flashes)

### Technical Notes
- Review `djStateBackgroundColor()` in `dj_theme.dart` — some states may be mapping to light colors
- Verify `PartyScreen` applies the background color correctly per DJ state
- Test with all 5 vibes to ensure readability
- The ceremony fix overlaps with Story 5 — coordinate or combine

### Estimate: Small

---

## Priority Order

| Priority | Story | Impact | Effort |
|----------|-------|--------|--------|
| 1 | Story 4: Party Song Display | Core UX — this IS the app | Medium |
| 2 | Story 1: Home Screen Brand | First impression | Small-Medium |
| 3 | Story 5: Ceremony Energy | Emotional peak moment | Small-Medium |
| 4 | Story 7: Color Consistency | Cohesion across flow | Small |
| 5 | Story 2: Join Screen | Usability fix | Medium |
| 6 | Story 6: Branded Dialogs | Polish | Small |
| 7 | Story 3: Guest Lobby Playlist | Feature enhancement | Medium |

---

## Definition of Done (all stories)
- [ ] Implementation matches wireframe layout
- [ ] Screenshot test updated to capture new design (re-run `run_screenshots.sh`)
- [ ] Existing widget tests pass (update keys/finders if changed)
- [ ] Tested with all 5 vibes (general, kpop, rock, ballad, edm)
- [ ] No text overflow/ellipsis on standard phone sizes
