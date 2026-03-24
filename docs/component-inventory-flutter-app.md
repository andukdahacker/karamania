# Karamania Flutter App — Component Inventory

## Screens (6)

| Screen | Route | Description |
|--------|-------|-------------|
| HomeScreen | `/` | Landing page with create/join party, session timeline, profile |
| JoinScreen | `/join?code=` | Party code entry + display name input |
| LobbyScreen | `/lobby` | Pre-game setup (QR, vibes, playlist import, participants) |
| PartyScreen | `/party` | Main gameplay with 8 DJ state overlays |
| SessionDetailScreen | `/session/:id` | Past session replay (stats, setlist, media, awards) |
| MediaGalleryScreen | `/media` | User's captured media library grid |

## Widgets (44)

### Game Overlays

| Widget | Purpose | Key State Dependencies |
|--------|---------|----------------------|
| QuickPickOverlay | Song voting with thumbnails and vote counts | PartyProvider (quickPickSongs, quickPickVotes) |
| SpinTheWheelOverlay | Animated spinning wheel selector (4 phases) | PartyProvider (spinWheelSegments, spinWheelPhase) |
| IcebreakerOverlay | Question voting with progress bars | PartyProvider (icebreakerQuestion, options) |
| InterludeVoteOverlay | Activity voting with vote counts | PartyProvider (interludeOptions, voteCounts) |
| KingsCupOverlay | Kings Cup group rule display + countdown | PartyProvider (interludeCard) |
| DarePullOverlay | Slot-machine name reveal + dare card | PartyProvider (interludeCard, targetDisplayName) |
| QuickVoteOverlay | Binary opinion poll (A vs B) | PartyProvider (quickVoteOptions) |
| GroupSingAlongOverlay | Group sing-along prompt + countdown | PartyProvider (interludeCard) |
| PartyCardDealOverlay | Card reveal with accept/dismiss/redraw | PartyProvider (currentCard, isCurrentSinger) |
| GroupCardAnnouncementOverlay | Group card participant selection | CaptureProvider (groupCardSelectedNames) |
| CeremonyDisplay | Award anticipation + reveal animation | PartyProvider (ceremonyAward, revealAt) |
| QuickCeremonyDisplay | Quick ceremony with scale animation | PartyProvider (quickCeremonyAward) |

### Finale Components

| Widget | Purpose |
|--------|---------|
| FinaleOverlay | Multi-step finale sequence container (awards → stats → setlist → feedback) |
| AwardsParadeWidget | Animated sequential award reveals with auto-scroll |
| SessionStatsWidget | Stat cards grid display |
| FinaleSetlistWidget | Concert poster display + share functionality |
| FeedbackPromptWidget | 5-emoji rating scale for post-finale feedback |

### Media & Capture

| Widget | Purpose |
|--------|---------|
| CaptureBubble | Floating 48x48 camera bubble (15s auto-dismiss, 60s cooldown) |
| CaptureOverlay | Mode selector (photo/video/audio) + recording indicator |
| CaptureToolbarIcon | Persistent camera icon with upload progress ring |
| MomentCard | 9:16 shareable moment card (performer + award + song) |
| MomentCardOverlay | Moment card share flow (capture as PNG, native share) |

### Interaction Bars

| Widget | Purpose |
|--------|---------|
| ReactionBar | Vibe-specific emoji reaction buttons (social tier tap) |
| ReactionFeed | Floating emoji particles with upward float + fade-out |
| SoundboardBar | 6 sound effect buttons (social tier tap) |
| NowPlayingBar | TV-detected song display (title, artist, equalizer icon) |

### Host Controls

| Widget | Purpose |
|--------|---------|
| HostControlsOverlay | Expandable FAB menu (redeal, invite, skip, override, pause, kick, end) |
| SongOverButton | Long-press (500ms) button to end current song (consequential tier) |
| SongModeToggle | SegmentedButton switching quickPick/spinWheel |

### Display Widgets

| Widget | Purpose |
|--------|---------|
| SelectedSongDisplay | Queued song with "Mark as Playing" for host |
| BridgeMomentDisplay | Between-song filler text |
| StreakMilestoneOverlay | Streak celebration (auto-dismiss 2s) |
| TagTeamFlashWidget | "YOUR TURN!" flash at timed intervals |
| ReconnectingBanner | Connection status indicator |
| LightstickMode | Full-screen glow with color picker + hype button |
| HypeSignalButton | Hype button with screen flash + flashlight + 5s cooldown |
| TvPairingOverlay | TV pairing code entry + connection status |

### Sharing & Import

| Widget | Purpose |
|--------|---------|
| SetlistPosterWidget | 9:16 concert poster renderer (scaled fonts) |
| PlaylistImportCard | URL input for Spotify/YouTube playlist import |
| SpotifyGuide | Instructions for making Spotify playlist public |
| SessionTimelineCard | Past session summary card in timeline |

### Foundation

| Widget | Purpose |
|--------|---------|
| DJTapButton | Tier-based tap widget (consequential/social/private) |
| EmojiText | Platform-native emoji rendering (avoids Impeller issues) |

## Providers (8)

| Provider | Type | Key Responsibilities |
|----------|------|---------------------|
| AuthProvider | ChangeNotifier | Firebase/guest auth state, upgrade flow |
| PartyProvider | ChangeNotifier | DJ state, songs, votes, ceremonies, reactions, cards, TV, playlist |
| CaptureProvider | ChangeNotifier | Capture bubble, mode selector, capture IDs |
| TimelineProvider | ChangeNotifier | Session history pagination |
| SessionDetailProvider | ChangeNotifier | Past session detail loading |
| AccessibilityProvider | ChangeNotifier | Reduced motion detection |
| UploadProvider | ChangeNotifier | Upload queue state wrapper |
| LoadingState | Enum | idle, loading, success, error |

## Models (3)

| Model | Fields |
|-------|--------|
| FinaleAward | userId, displayName, category, title, tone, reason |
| SessionStats | songCount, participantCount, sessionDurationMs, totalReactions, totalSoundboardPlays, totalCardsDealt, topReactor, longestStreak |
| SetlistEntry | position, title, artist, performerName, awardTitle, awardTone |

## Constants (4 files)

| File | Content |
|------|---------|
| copy.dart | All user-facing strings (384 lines), vibe emoji mappings, reaction sets |
| tap_tiers.dart | DJTapButton tier definitions (sizes, delays, haptics) |
| soundboard_config.dart | 6 soundboard buttons with SoundCue mappings |
| party_cards.dart | 19 party cards (7 vocal, 7 performance, 5 group) |

## Design System

### Vibes (5)
| Vibe | Accent | Glow | Emoji |
|------|--------|------|-------|
| general | Purple | Violet | 🎤 |
| kpop | Pink | Magenta | 💜 |
| rock | Red | Crimson | 🤘 |
| ballad | Blue | Cyan | 💙 |
| edm | Green | Lime | 🎧 |

### DJ State Colors (8)
Each state has a specific background color, with `ceremony` being vibe-colored.

### Tokens (DJTokens)
- Backgrounds: #0A0A0F (bg), #1A1A2E (surface), #252540 (elevated)
- Text: #F0F0F0 (primary), #A0A0B0 (secondary)
- Actions: #4ADE80 (confirm), #FF4444 (danger), #6C63FF (primary)
- Spacing: 4/8/12/16/24/32px scale
