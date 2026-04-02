---
stepsCompleted: [1, 2, 3, 4, 5]
inputDocuments: []
workflowType: 'research'
lastStep: 1
research_type: 'technical'
research_topic: 'Real-time song detection and synced lyrics for karaoke companion app'
research_goals: 'Evaluate ShazamKit, Musixmatch, and related APIs for delivering Apple Music-style lyrics experience in live karaoke environments. Cross-platform feasibility (iOS + Android). Karaoke track catalog coverage.'
user_name: 'Ducdo'
date: '2026-04-01'
web_research_enabled: true
source_verification: true
---

# Research Report: Technical

**Date:** 2026-04-01
**Author:** Ducdo
**Research Type:** Technical

---

## Research Overview

This technical research evaluates the feasibility of building a real-time, lyrics-synced companion experience for the Karamania karaoke party app. The research investigates audio fingerprinting APIs (ShazamKit, ACRCloud), synced lyrics providers (Musixmatch, LRCLIB), and the architectural patterns needed to deliver an Apple Music-quality lyrics display in live karaoke environments.

**Key Conclusion**: The technology stack exists and is proven (Shazam + Musixmatch is the reference architecture). Flutter plugins are available for all core components. The primary risk is recognition accuracy in noisy karaoke rooms, which requires real-world validation via a 2-week PoC before committing to full implementation.

**Recommended Path**: ACRCloud (recognition) + LRCLIB (free synced lyrics) for MVP, with Musixmatch commercial as the upgrade path for word-level sync.

---

## Technical Research Scope Confirmation

**Research Topic:** Real-time song detection and synced lyrics for karaoke companion app
**Research Goals:** Evaluate ShazamKit, Musixmatch, and related APIs for delivering Apple Music-style lyrics experience in live karaoke environments. Cross-platform feasibility (iOS + Android). Karaoke track catalog coverage.

**Technical Research Scope:**

- Architecture Analysis - audio recognition pipelines, lyrics sync systems, end-to-end detection-to-display flow
- Implementation Approaches - Flutter integration with native SDKs, real-time audio processing
- Technology Stack - ShazamKit, ACRCloud, Musixmatch API, Genius API, LRCLib, Apple MusicKit
- Integration Patterns - song detection -> metadata -> lyrics retrieval pipeline, cross-platform bridging
- Performance Considerations - recognition in noisy environments, sync accuracy, latency

**Research Methodology:**

- Current web data with rigorous source verification
- Multi-source validation for critical technical claims
- Confidence level framework for uncertain information
- Comprehensive technical coverage with architecture-specific insights

**Scope Confirmed:** 2026-04-02

## Technology Stack Analysis

### Song Recognition / Audio Fingerprinting

#### ShazamKit (Apple)

ShazamKit is Apple's framework for audio recognition, available natively on iOS 15+, iPadOS, macOS, tvOS, visionOS, and watchOS. It also supports Android (API level 23+) via a developer token mechanism. Key capabilities:

- **Music Recognition**: Matches audio against Shazam's massive catalog (processes 20B+ queries annually)
- **Custom Catalogs**: Developers can create custom audio signature catalogs for proprietary content
- **Synced Experiences**: Supports assigning metadata at key time points for second-screen experiences
- **Privacy**: Audio is not shared with Apple; signatures cannot be reverse-engineered
- **Algorithm**: Uses constellation pattern matching for rapid, precise recognition

**Flutter Integration**: The `flutter_shazam_kit` plugin wraps ShazamKit for Flutter apps. Requires iOS 15+ and Android API 23+. On Android, an Apple Developer Token is required. Currently supports ShazamCatalog only (CustomCatalog planned). Requires RECORD_AUDIO and INTERNET permissions.

_Source: [ShazamKit - Apple Developer](https://developer.apple.com/shazamkit/), [flutter_shazam_kit on pub.dev](https://pub.dev/documentation/flutter_shazam_kit/latest/), [GitHub - flutter_shazam_kit](https://github.com/ssttonn/flutter_shazam_kit)_

#### ACRCloud (Cross-Platform Alternative)

ACRCloud is a commercial audio recognition platform with 150M+ indexed tracks. Key capabilities:

- **Recognition Accuracy**: 98%+ accuracy from clips as brief as 5 seconds
- **Noise Handling**: Handles pitch-shifted, time-stretched, noisy music, and humming
- **Cover/Humming Recognition**: Dedicated "Cover Song (humming) Identification" mode for detecting covers and live performances - directly relevant for karaoke
- **Configuration**: Supports "Recorded Audio" source mode optimized for noisy real-world capture
- **Scale**: Handles hundreds of millions of daily queries

**Flutter Integration**: Multiple plugins available:
- `flutter_acrcloud` - clean Dart interface with session-based recognition, fingerprint generation
- `flutter_acrcloud_plugin` - third-party alternative
- `acr_cloud_sdk` - another community option

All provide: setUp with API credentials, startSession for recording, ACRCloudResponse with matched track metadata, and advanced fingerprint creation/recognition.

_Source: [ACRCloud](https://www.acrcloud.com/), [ACRCloud Music Recognition](https://www.acrcloud.com/music-recognition/), [flutter_acrcloud on pub.dev](https://pub.dev/packages/flutter_acrcloud), [Medium - Flutter ACRCloud Integration](https://medium.com/@nrubin29/adding-shazam-like-music-recognition-to-my-flutter-app-with-acrcloud-and-flutter-acrcloud-2e46a2ec73f0)_

#### Other Recognition Services

- **AudD API**: 99.5% accuracy, ~300ms latency. Commercial API with cross-platform support.
- **SoundHound**: Supports humming recognition (10 seconds of humming). Can capture system playback. Struggles with noisy environments.
- **AHA Music**: 100M+ song database, handles noisy recordings and live performances.

_Source: [GeeLark - Audio Fingerprinting](https://www.geelark.com/glossary/audio-fingerprinting/), [Rokform - Best Music Recognition Apps 2026](https://www.rokform.com/blogs/rokform-blog/best-music-recognition-apps-2026)_

### Synced Lyrics Providers

#### Musixmatch API (Commercial - Primary Source)

Musixmatch is the world's largest lyrics database and the upstream provider for Apple Music, Amazon, Google, Facebook, and Shazam lyrics. This is the same data source powering the Apple Music lyrics experience.

**Key Endpoints:**
- `track.subtitle.get` - Returns synced lyrics in LRC or DFXP format. **Requires commercial plan.**
- `track.richsync.get` - Enhanced sync with per-character positioning, multiple voices, and formatting. **Requires commercial plan.**
- `track.lyrics.get` - Plain (unsynced) lyrics. Available on free tier.

**Access Tiers:**
- **Free**: 50 requests/day, basic lyrics and track search only (no synced lyrics)
- **Commercial**: Contact sales@musixmatch.com for synced lyrics access and pricing

**Critical Finding**: Synced/time-stamped lyrics (the feature we need) are gated behind commercial access. The free tier only provides unsynced plain text lyrics.

_Source: [Musixmatch API Documentation](https://musixmatch.mintlify.app/lyrics-api/introduction), [Musixmatch - PublicAPIs](https://publicapis.io/musixmatch-api), [Musixmatch Blog - Shazam Partnership](https://medium.com/musixmatch-blog/shazam-musixmatch-eeb91585ff37)_

#### LRCLIB (Free / Open Source)

LRCLIB is a free, community-driven synced lyrics database with zero profit intention, primarily serving FOSS music players.

- **Database Size**: ~3,000,000 lyrics (as of early 2024, likely larger now)
- **Format**: LRC (line-level time sync)
- **API**: Completely free, no API key required
- **Search**: By track name, artist, album, or duration
- **Limitations**: Community-contributed data, coverage may be inconsistent for niche or regional songs. No per-character sync (line-level only).

_Source: [LRCLIB](https://lrclib.net/), [LRCLIB API Docs](https://lrclib.net/docs), [HN Discussion](https://news.ycombinator.com/item?id=39480390)_

#### Apple MusicKit Lyrics

**Lyrics are NOT available through the public MusicKit API.** The Song object includes a `hasLyrics` boolean property but does not expose actual lyrics content. Apple has encouraged developers to file feature requests via Feedback Assistant. An unofficial project (MusanovaKit) can access private lyric endpoints but requires privileged tokens, violates Apple's terms, and may break without notice.

**Verdict**: Not a viable path for production use. [High Confidence]

_Source: [Apple Developer Forums - Lyrics Access](https://developer.apple.com/forums/thread/698127), [Apple Developer Forums - Song Lyrics](https://developer.apple.com/forums/thread/112061), [GitHub - MusanovaKit](https://github.com/rryam/MusanovaKit)_

#### Other Lyrics Sources

- **Lyrica**: Open source Python tool fetching synced lyrics from YouTube Music and LRCLIB with millisecond precision. Updated Feb 2026 (v1.2.10). Provides mood/sentiment analysis and rich metadata.
- **Spotify Lyrics API (unofficial)**: Fetches lyrics from Spotify (powered by Musixmatch). Updated Feb 2026. Uses private/undocumented APIs - may break.
- **Genius API**: Primarily unsynced lyrics with annotations. Not suitable for real-time sync display.

_Source: [GitHub - Lyrica](https://github.com/Wilooper/Lyrica), [GitHub - spotify-lyrics-api](https://github.com/akashrchandran/spotify-lyrics-api), [GitHub - synced-lyrics topic](https://github.com/topics/synced-lyrics)_

### Synced Lyrics Formats

| Format | Sync Level | Description |
|--------|-----------|-------------|
| **LRC** | Line-level | Standard format, timestamps per line. Widely supported. |
| **Enhanced LRC** | Word-level | Extended LRC with per-word timestamps. Less common. |
| **DFXP/TTML** | Flexible | XML-based subtitle format. Used by some streaming services. |
| **RichSync (Musixmatch)** | Character-level | Per-character positioning, multiple voices, formatting. Proprietary. |

### Karaoke Track Recognition Coverage

**Critical Challenge**: Karaoke venues often play modified versions of songs (instrumental backing tracks, different arrangements, cover versions).

- **Shazam**: Catalog includes some karaoke versions. Recognition works best on original recordings. Singing over a track may confuse fingerprint matching. [Medium Confidence]
- **ACRCloud**: Dedicated cover song / humming identification mode. Better suited for karaoke contexts where the audio differs from the original recording. Can handle pitch-shifted and time-stretched audio. [High Confidence]
- **General Finding**: Audio fingerprinting works by matching against known recordings. If the karaoke system plays a recognizable backing track (even without vocals), recognition can work. If it plays a heavily modified or custom arrangement, recognition may fail.

_Source: [Quora - Shazam Instrumental Recognition](https://www.quora.com/Is-there-a-way-to-identify-an-instrumental-music-track-if-neither-Shazam-nor-SoundHound-can-identify-it), [ACRCloud Docs](https://docs.acrcloud.com/tutorials/recognize-music), [Shazam on Karaoke Versions](https://www.shazam.com/song/1795029008/)_

### Performance in Noisy Environments

- **ACRCloud**: Designed for real-world conditions. "Recorded Audio" mode optimized for ambient noise. Still, overlapping conversations, echoes, and softer background tracks can produce wrong matches or no results. [High Confidence]
- **ShazamKit**: Robust at scale (20B queries/year) but no specific noisy-environment performance data published. Constellation pattern matching is inherently somewhat noise-tolerant. [Medium Confidence]
- **General**: Recognition accuracy degrades with: loud crowd noise, echo/reverb in karaoke rooms, singing over the track, low speaker volume. Short recognition windows (5-10 seconds) help minimize noise interference.

_Source: [ACRCloud](https://www.acrcloud.com/), [Speechify - SoundHound Alternatives](https://speechify.com/blog/alternatives-to-soundhound-ai/), [Oreate AI - ACRCloud Guide](https://www.oreateai.com/blog/unlocking-the-power-of-acrcloud-your-guide-to-audio-recognition-apis/5272d0d842cc546c677d2999206e5023)_

### Technology Adoption Trends

- **Shazam + Musixmatch Partnership (2018-present)**: Shazam's real-time lyrics feature is powered by Musixmatch. This is the proven architecture: audio fingerprinting + Musixmatch synced lyrics = real-time sing-along experience. [High Confidence]
- **Musixmatch as Industry Standard**: Supplies lyrics to Apple Music, Amazon, Google, Facebook, Shazam. The dominant B2B lyrics provider.
- **LRCLIB Growth**: Community-driven alternative gaining traction in open source ecosystem. 3M+ entries and growing.
- **Flutter Audio Recognition**: Multiple plugin options exist for both ShazamKit and ACRCloud, indicating active community interest in this space.

_Source: [Musixmatch Blog - Shazam Partnership](https://medium.com/musixmatch-blog/shazam-musixmatch-eeb91585ff37), [Behind Shazam's Lyrics Feature](https://medium.com/@alex.telek/behind-the-scenes-of-shazams-real-time-lyrics-feature-8feeb628ad), [Musixmatch Wikipedia](https://en.wikipedia.org/wiki/Musixmatch)_

## Integration Patterns Analysis

### End-to-End Pipeline Architecture

The core integration pattern for our karaoke lyrics companion follows a three-stage pipeline:

```
[Microphone Audio] → [Song Recognition API] → [Track Metadata (ISRC/ID)] → [Lyrics API Lookup] → [Synced Lyrics Display]
```

This mirrors the proven Shazam + Musixmatch architecture that powers Shazam's real-time lyrics feature since 2018.

_Source: [Musixmatch Blog - Shazam Partnership](https://medium.com/musixmatch-blog/shazam-musixmatch-eeb91585ff37), [Behind Shazam's Lyrics Feature](https://medium.com/@alex.telek/behind-the-scenes-of-shazams-real-time-lyrics-feature-8feeb628ad)_

### Stage 1: Song Recognition APIs

#### ShazamKit Integration Pattern

- **Response Format**: JSON with nested "track", "matches", and "hub" objects
- **Key Metadata Returned**: Title, artist, album, genre, unique track ID, ISRC code, match accuracy, timestamps, streaming service links
- **ISRC Access**: Available via `SHMediaItem.isrc` property - this is the critical bridge to lyrics lookup
- **Flutter Bridge**: `flutter_shazam_kit` plugin handles the native channel bridge. On iOS uses native ShazamKit framework; on Android requires Apple Developer Token for Shazam catalog access
- **Platform Channels**: Flutter MethodChannel / FlutterMethodChannel enables bidirectional Dart-to-native communication for SDK calls

_Source: [ShazamKit SHMediaItem Docs](https://developer.apple.com/documentation/shazamkit/shmediaitem), [ShazamKit ISRC](https://developer.apple.com/documentation/shazamkit/shmediaitem/isrc), [Flutter Platform Channels](https://docs.flutter.dev/platform-integration/platform-channels)_

#### ACRCloud Integration Pattern

- **Response Format**: JSON with "metadata" object containing timestamp and "music" array of matched tracks
- **Key Metadata Returned**: Artists, album info, ACRID (internal ID), external_ids (including ISRC), UPC, genre, label, release date, `*_time_offset_ms` fields
- **ISRC Access**: Returned in `external_ids` object - same bridge to lyrics APIs
- **Metadata API**: Can also query by song URL, ISRC, ACRID, or title+artist to get enriched metadata including third-party platform IDs, album art, audio previews, stream URLs
- **Flutter Bridge**: `flutter_acrcloud` plugin provides `ACRCloud.setUp()` + `ACRCloud.startSession()` pattern with `ACRCloudResponse` callback

_Source: [ACRCloud Metadata API](https://docs.acrcloud.com/reference/metadata-api), [ACRCloud Music Metadata](https://www.acrcloud.com/music-metadata/), [ACRCloud Identification API](https://docs.acrcloud.com/reference/identification-api)_

### Stage 2: Lyrics Lookup APIs

#### Musixmatch API Integration

- **Track Matching**: Recommended to use ISRC as primary identifier, fall back to title + artist when ISRC unavailable
- **Track ID Types**: Supports `commontrack_id` and `track_id` for lyrics retrieval
- **Synced Lyrics Endpoint**: `track.subtitle.get` returns LRC or DFXP format. **Commercial plan required.**
- **RichSync Endpoint**: `track.richsync.get` returns per-character sync with multiple voice support. **Commercial plan required.**
- **Duration Matching**: When multiple lyric versions exist, choose the one closest to your track's duration
- **Rate Limiting**: Free tier limited to 50 requests/day (insufficient for production)

**Integration Flow**: Recognition API returns ISRC → Query Musixmatch `track.search` with ISRC → Get `track_id` → Call `track.subtitle.get` with `track_id` → Receive LRC-formatted synced lyrics

_Source: [Musixmatch API Docs](https://musixmatch.mintlify.app/lyrics-api/introduction), [Musixmatch Implementation Guidelines](https://musixmatch.mintlify.app/enterprise-integration/implementation-guidelines)_

#### LRCLIB API Integration (Free Alternative)

- **Endpoint**: `GET https://lrclib.net/api/get`
- **Search Parameters**: `track_name` (required), `artist_name`, `album_name`, `duration` (seconds)
- **Response Format**: JSON with `id`, `trackName`, `artistName`, `albumName`, `duration`, `instrumental` (boolean), `plainLyrics`, `syncedLyrics`
- **Synced Lyrics Format**: Standard LRC timestamps, e.g., `[00:27.93] Listen to the wind blow`
- **No Auth Required**: Completely free, no API key needed
- **Client Libraries**: TypeScript (`lrclib-api` npm), Python (`lrclibapi`)

**Integration Flow**: Recognition API returns title + artist → Query LRCLIB `/api/get?track_name=X&artist_name=Y&duration=Z` → Receive synced LRC lyrics directly

_Source: [LRCLIB API Docs](https://lrclib.net/docs), [lrclib-api npm](https://www.npmjs.com/package/lrclib-api), [LRCLIB Python API](https://lrclibapi.readthedocs.io/en/latest/examples/fetch_lyrics.html)_

### Stage 3: Lyrics Display Integration

#### LRC Format Parsing

LRC is a simple text format with timestamps per line:
```
[00:12.00] First line of lyrics
[00:17.50] Second line of lyrics
```

Parsing is straightforward: regex extract `[mm:ss.xx]` timestamps, convert to milliseconds, and schedule display against a running clock synchronized to the song playback start time.

#### Sync Strategy

- **Initial Sync**: When song is recognized, the recognition API returns a time offset (how far into the song we are). Use this to jump to the correct lyric position.
- **Ongoing Sync**: Run a local timer from the initial offset. LRC timestamps determine when to advance to the next line.
- **Drift Correction**: Periodically re-recognize to correct any drift (every 30-60 seconds). ACRCloud returns `*_time_offset_ms` which can be used for this.
- **Fallback**: If recognition is lost, continue displaying lyrics based on the local timer. Re-sync when recognition resumes.

### Flutter Native Bridge Pattern

For both ShazamKit and ACRCloud, the Flutter integration follows the same pattern:

```
Flutter Dart Layer
    ↓ MethodChannel call
Platform Channel (iOS: Swift/ObjC, Android: Kotlin/Java)
    ↓ Native SDK call
ShazamKit / ACRCloud Native SDK
    ↓ Audio capture + fingerprinting
Recognition Result
    ↑ Return via MethodChannel
Flutter Dart Layer → Lyrics API call → UI Update
```

Existing Flutter plugins (`flutter_shazam_kit`, `flutter_acrcloud`) abstract this bridge, but custom method channels may be needed for advanced features like continuous recognition or time offset extraction.

_Source: [Flutter Platform Channels Docs](https://docs.flutter.dev/platform-integration/platform-channels), [FlutterFlow Method Channels](https://docs.flutterflow.io/concepts/advanced/method-channels/)_

### Recommended Integration Architecture

Based on the research, the recommended two-tier approach:

**Primary Path (Best Experience)**:
```
ACRCloud (recognition + time offset) → ISRC → Musixmatch (commercial synced lyrics) → RichSync display
```
- Pros: Best accuracy in karaoke environments (cover song mode), character-level sync, multiple voice support
- Cons: Both services require commercial licensing, ongoing API costs

**Fallback Path (MVP / Cost-Effective)**:
```
ACRCloud or ShazamKit (recognition) → title + artist → LRCLIB (free synced lyrics) → LRC line-level display
```
- Pros: LRCLIB is free with no auth, 3M+ songs
- Cons: Line-level sync only (not word/character), incomplete catalog coverage, community-maintained data quality

**Hybrid Strategy**: Try Musixmatch first for richsync, fall back to LRCLIB if no commercial license or if Musixmatch doesn't have the track. This gives the best experience where possible while maintaining broad coverage.

### Cost & Licensing Summary

| Service | Free Tier | Commercial | Notes |
|---------|-----------|-----------|-------|
| **ShazamKit** | Free (Apple Developer account) | N/A | Requires Apple Developer Program membership |
| **ACRCloud** | 14-day trial | Contact sales | Tiered by volume. No public pricing. |
| **Musixmatch** | 50 req/day, no synced lyrics | Contact sales@musixmatch.com | Synced lyrics (subtitle/richsync) commercial only |
| **LRCLIB** | Unlimited, free | N/A | Community-driven, no guarantees |
| **AudD** | Limited free | Paid tiers | 99.5% accuracy alternative |

_Source: [ACRCloud](https://www.acrcloud.com/), [Musixmatch API](https://publicapis.io/musixmatch-api), [LRCLIB](https://lrclib.net/), [Oreate AI - ACRCloud Guide](https://www.oreateai.com/blog/navigating-acrcloud-music-recognition-api-a-look-ahead-to-2025/72be989008610fbe4e3c294858b17286)_

## Architectural Patterns and Design

### System Architecture: Second Screen Companion Pattern

Our karaoke lyrics app fits squarely into the **second screen companion** architecture pattern - a device displaying synchronized content alongside a primary media experience. This is a well-established pattern used in live TV companion apps, concert experiences, and sports engagement platforms.

**Key Architectural Principle**: The second screen synchronizes with the primary experience (karaoke system audio) via **Automatic Content Recognition (ACR)** - audio fingerprinting pulled from the phone's microphone matched against a database. This is the same technique used by Gracenote, Shazam, and other second-screen sync platforms.

_Source: [Synchronized Second-Screen Technologies](https://blog.eltrovemo.com/529/synchronized-second-screen-technologies-panorama/), [Second Screen - Wikipedia](https://en.wikipedia.org/wiki/Second_screen), [Gracenote TV Sync API - TechCrunch](https://techcrunch.com/2013/06/19/second-screen-apps/)_

### Core Architecture: Listen-Detect-Display Pipeline

```
┌─────────────────────────────────────────────────────────┐
│                    Flutter App Layer                      │
│                                                          │
│  ┌──────────┐    ┌──────────┐    ┌───────────────────┐  │
│  │ Audio     │    │ Lyrics   │    │ Lyrics Display    │  │
│  │ Capture   │───▶│ Resolver │───▶│ Engine            │  │
│  │ Service   │    │          │    │ (Scroll/Highlight)│  │
│  └──────────┘    └──────────┘    └───────────────────┘  │
│       │               │                    │             │
│       ▼               ▼                    ▼             │
│  ┌──────────┐    ┌──────────┐    ┌───────────────────┐  │
│  │ Platform  │    │ Lyrics   │    │ Animation         │  │
│  │ Channel   │    │ Cache    │    │ Controller        │  │
│  │ Bridge    │    │ (Local)  │    │ (Timer-driven)    │  │
│  └──────────┘    └──────────┘    └───────────────────┘  │
│       │                                                  │
├───────┼──────────────────────────────────────────────────┤
│       ▼          Native Layer                            │
│  ┌──────────────────────────────┐                        │
│  │ ACRCloud SDK / ShazamKit SDK │                        │
│  │ (Audio fingerprint + match)  │                        │
│  └──────────────────────────────┘                        │
│       │                                                  │
├───────┼──────────────────────────────────────────────────┤
│       ▼          External APIs                           │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐          │
│  │ ACRCloud │    │Musixmatch│    │  LRCLIB  │          │
│  │ (Recog)  │    │(Paid LRC)│    │(Free LRC)│          │
│  └──────────┘    └──────────┘    └──────────┘          │
└─────────────────────────────────────────────────────────┘
```

### Design Pattern: Periodic Recognition with Timer-Driven Display

Rather than continuous microphone streaming (battery killer), the architecture uses a **periodic recognition** pattern:

1. **Initial Recognition Burst**: On session start, capture 5-10 seconds of audio → send to ACRCloud/ShazamKit → get song ID + time offset
2. **Lyrics Fetch**: Use ISRC/title+artist to query lyrics API → cache locally
3. **Timer-Driven Display**: Start a local high-precision timer from the detected time offset → advance lyrics based on LRC timestamps
4. **Periodic Re-sync**: Every 30-60 seconds, perform another short recognition burst to correct drift
5. **Song Change Detection**: When re-sync returns a different song or no match, trigger new recognition cycle

This pattern minimizes microphone usage and API calls while maintaining sync accuracy.

_Source: [Real-Time Sound Classification on Android](https://medium.com/@harissabil/real-time-sound-classification-on-android-running-ml-models-in-a-foreground-service-dcf9fbe3e6ca), [Mastering Audio Processing in Flutter](https://medium.com/@AlexCodeX/mastering-audio-processing-streaming-in-flutter-8a6ea13698d4)_

### Lyrics Display Engine Architecture

**Critical Insight from Apple Music Engineering**: The lyrics display animation is simpler than it appears. Most of the "intelligence" is baked offline into the timestamps. The playback engine just needs the current time and fires events accurately.

**Apple Music's Approach (the gold standard we're emulating):**
- Uses **TTML** (Timed Text Markup Language) for word-level and syllable-level timestamps
- **Gradient mask/clip-path animation** reveals words progressively left-to-right
- Progress value calculated as: `(currentTime - wordStart) / (wordEnd - wordStart)` → drives clipping mask width
- Fast lyrics (hip-hop) = short time windows = fast animation. Slow ballads = long windows = slow animation. **The timing IS the music, encoded in timestamps.**

**Our Implementation Approach:**
- **With Musixmatch RichSync (commercial)**: Character-level sync → can replicate Apple Music's word-by-word highlight exactly
- **With LRCLIB LRC (free)**: Line-level sync → highlight current line, scroll to next line. Simpler but still effective karaoke-style display
- **Animation Controller**: Timer-based, calculates progress per line/word, drives Flutter animation widgets

_Source: [How Apple Music Maps Audio to Lyrics](https://medium.com/@ethchor/how-apple-music-maps-audio-to-lyrics-the-engineering-behind-real-time-lyric-sync-a2485385c9a9), [How Lyrics Stay in Sync](https://medium.com/@majid.golshadi/how-lyrics-stay-in-sync-the-technologies-behind-real-time-music-experiences-1e226bca4626), [Lyric App Framework - CHI 2023](https://dl.acm.org/doi/10.1145/3544548.3580931)_

### Flutter Audio Capture Architecture

**Key Plugins:**
- **flutter_voice_processor** (Picovoice): Asynchronous audio capture delivering raw 16-bit mono PCM frames via listeners. Designed for real-time processing.
- **audio_service**: Background audio service with media notification integration. Supports Android, iOS, web, Linux.
- **Platform Channels**: For bridging to native ShazamKit/ACRCloud SDKs when existing plugins are insufficient.

**Architecture Pattern**: Clean Architecture with BLoC for state management + audio_service for background execution. Audio capture runs in a foreground service (Android) / background mode (iOS) to survive app switching.

**Challenge**: iOS audio capture is restrictive without native channel bridging. Advanced audio features require native integration or FFI. Real-time audio latency may be high without low-level optimizations.

_Source: [Flutter Voice Processor](https://github.com/Picovoice/flutter-voice-processor), [audio_service pub.dev](https://pub.dev/packages/audio_service), [Flutter Audio-Driven Apps](https://medium.com/@reach.subhanu/flutter-for-audio-driven-apps-real-time-sound-visualization-audio-processing-and-voice-41f2d2cccb73)_

### Battery & Performance Architecture

Continuous microphone listening is a known battery drain. Our periodic recognition pattern mitigates this:

| Mode | Mic Active | Battery Impact | Accuracy |
|------|-----------|---------------|----------|
| Continuous listening | Always on | High drain | Best sync |
| Periodic burst (30s intervals) | ~10% of time | Low drain | Good sync with occasional drift |
| Manual trigger | On-demand only | Minimal | User-initiated, no auto-sync |

**Recommended Default**: Periodic burst mode with 30-second re-sync intervals. Users can force re-sync with a tap if lyrics drift.

**Best Practices Applied:**
- Background processing via foreground service (Android) / background mode (iOS)
- Batch API calls (recognition + lyrics fetch in single cycle)
- Local lyrics cache to avoid repeat API calls for same song
- Use Xcode Energy Analyzer / Android Profiler for real-device testing

_Source: [Optimizing Battery in iOS Apps](https://medium.com/@edabdallamo/optimizing-battery-usage-in-your-ios-app-a-comprehensive-guide-8203cb074b8a), [Apple Developer - Battery Analysis](https://developer.apple.com/documentation/xcode/analyzing-your-app-s-battery-use)_

### State Machine: Song Lifecycle

```
[IDLE] ──(session start)──▶ [LISTENING]
                               │
                     (recognition result)
                               │
                    ┌──────────┴──────────┐
                    ▼                     ▼
              [SONG_DETECTED]      [NO_MATCH]
                    │                     │
            (lyrics fetched)        (retry after interval)
                    │                     │
                    ▼                     ▼
             [LYRICS_PLAYING]      [LISTENING]
                    │
          ┌────────┼────────┐
          ▼        ▼        ▼
    (re-sync:   (re-sync:  (song ends /
     same song)  new song)  no match)
          │        │         │
          ▼        ▼         ▼
   [LYRICS_PLAYING] [LISTENING] [IDLE or LISTENING]
```

This state machine handles song transitions naturally - when someone finishes karaoke and the next person starts, the re-sync cycle detects the new song and transitions automatically.

### Security Considerations

- **API Key Storage**: ACRCloud and Musixmatch API keys must be stored securely (iOS Keychain / Android Keystore), not hardcoded
- **Audio Privacy**: Audio data should only be sent as fingerprints, never raw audio (both ShazamKit and ACRCloud work on fingerprints)
- **Rate Limiting**: Implement client-side rate limiting to prevent accidental API quota exhaustion
- **Caching**: Cache lyrics locally with TTL to reduce API calls and improve offline resilience

## Implementation Approaches and Technology Adoption

### Implementation Strategy: Phased Approach

Given the mix of free and commercial APIs, uncertain karaoke-room performance, and the need to validate the core concept, a phased implementation is strongly recommended over a big-bang approach.

#### Phase 1: Proof of Concept (1-2 weeks)
**Goal**: Validate song recognition works in a real karaoke room

- Implement basic ACRCloud recognition using `flutter_acrcloud` plugin
- Test in actual karaoke venues: measure recognition accuracy, latency, failure rate
- Test with different karaoke systems (different audio quality, speaker setups)
- No lyrics display yet - just prove detection works reliably

**Why ACRCloud over ShazamKit for PoC**: ACRCloud's cover song identification mode is specifically relevant for karaoke. ShazamKit is optimized for original recordings. Test both if time allows.

_Source: [flutter_acrcloud on pub.dev](https://pub.dev/packages/flutter_acrcloud), [ACRCloud Music Recognition Docs](https://docs.acrcloud.com/tutorials/recognize-music)_

#### Phase 2: MVP Lyrics Experience (2-3 weeks)
**Goal**: End-to-end song detection + synced lyrics display

- Wire up LRCLIB as lyrics source (free, no API key, immediate start)
- Implement `flutter_lyric` package for LRC parsing and synced display with highlight animation
- Build periodic recognition loop (detect → fetch lyrics → display → re-sync every 30s)
- Implement song change detection and automatic transition
- Handle edge cases: no lyrics found, recognition failure, lyrics drift

**Key Flutter Packages:**
- `flutter_acrcloud` or `flutter_shazam_kit` - song recognition
- `flutter_lyric` (v3.0.1, updated Dec 2025) - LRC parsing + synced lyrics display with highlight, smooth scrolling, custom UI, translation support
- `lyrics_parser` - alternative lightweight LRC parser if `flutter_lyric` is too opinionated
- `audio_service` - background audio processing

_Source: [flutter_lyric on pub.dev](https://pub.dev/packages/flutter_lyric), [lyrics_parser on pub.dev](https://pub.dev/documentation/lyrics_parser/latest/), [LRCLIB API](https://lrclib.net/docs)_

#### Phase 3: Premium Experience (if validated)
**Goal**: Apple Music-quality lyrics with word-level highlighting

- Negotiate commercial Musixmatch API access for RichSync (character-level sync)
- Implement word-by-word highlight animation using progress mask pattern: `(currentTime - wordStart) / (wordEnd - wordStart)`
- Use Flutter `CustomPainter` or `ShaderMask` for gradient reveal animation
- Add visual flair: color themes, blur effects, typography that matches the song mood

_Source: [How Apple Music Maps Audio to Lyrics](https://medium.com/@ethchor/how-apple-music-maps-audio-to-lyrics-the-engineering-behind-real-time-lyric-sync-a2485385c9a9), [Flutter Text Effects](https://www.dhiwise.com/post/animating-your-app-a-guide-on-flutter-text-effects)_

### Development Workflow and Tooling

**Flutter Package Ecosystem for This Feature:**

| Package | Purpose | Status |
|---------|---------|--------|
| `flutter_acrcloud` | ACRCloud music recognition | Available, community maintained |
| `flutter_shazam_kit` | ShazamKit recognition | Available, iOS 15+ / Android 23+ |
| `flutter_lyric` | LRC parsing + synced lyrics UI | v3.0.1 (Dec 2025), actively maintained |
| `lyrics_parser` | Lightweight LRC file parsing | Available |
| `audio_service` | Background audio processing | Mature, cross-platform |
| `flutter_voice_processor` | Real-time audio capture | By Picovoice, production-grade |

**Testing Strategy:**
- Unit tests: LRC parser, timing calculations, state machine transitions
- Integration tests: API mocking for recognition + lyrics fetch pipeline
- **Real-world testing is critical**: Automated tests cannot simulate karaoke room acoustics. Must test in actual venues with various setups.

### Existing Open Source Reference Projects

- **Wazzaps/karaoke** (Flutter): Small karaoke/lyrics display syncing with VLC playback. Good reference for lyrics display architecture.
- **react-karaoke-lyric** (React): Component library for karaoke lyric progress display. Reference for animation patterns.
- **tayormi/shazam** (Flutter): Shazam clone using ACRCloud + Riverpod. Direct reference for recognition architecture in Flutter.

_Source: [Wazzaps/karaoke](https://github.com/Wazzaps/karaoke), [react-karaoke-lyric](https://github.com/chentsulin/react-karaoke-lyric), [tayormi/shazam](https://github.com/tayormi/shazam)_

### Cost Optimization and Resource Management

#### API Cost Estimates

| Service | Free Tier | Entry Commercial | Notes |
|---------|-----------|-----------------|-------|
| **ACRCloud** | 14-day trial (~100 queries/day) | ~10,000 requests/year package | Custom pricing, contact sales |
| **Musixmatch** | 50 req/day (no synced lyrics) | Custom (contact sales@musixmatch.com) | Synced lyrics require commercial plan |
| **LRCLIB** | Unlimited, free forever | N/A | Community data, no SLA |
| **ShazamKit** | Free with Apple Developer ($99/yr) | N/A | Included in Apple Developer Program |

#### Cost Optimization Strategies

1. **Aggressive Local Caching**: Cache lyrics by song ID. A karaoke venue plays the same popular songs repeatedly - cache hit rate should be high.
2. **Minimize Recognition Calls**: 30-second re-sync intervals = ~120 recognition calls per hour. Per-session cost stays manageable.
3. **LRCLIB-First Fallback**: Check LRCLIB (free) before Musixmatch (paid). Only call Musixmatch for songs not in LRCLIB.
4. **Server-Side Lyrics Cache**: Build a backend cache of lyrics fetched from APIs. Subsequent requests for the same song hit your cache, not the paid API.

### Risk Assessment and Mitigation

| Risk | Severity | Likelihood | Mitigation |
|------|----------|-----------|------------|
| Song not recognized in noisy karaoke room | High | Medium | ACRCloud cover-song mode, manual search fallback, test multiple venues |
| Lyrics not available for detected song | Medium | Medium | Multi-source fallback (Musixmatch → LRCLIB → no lyrics graceful state) |
| Karaoke backing tracks not in fingerprint database | High | Medium-High | ACRCloud cover recognition, manual song selection as fallback |
| Lyrics drift / desync over time | Medium | Low | 30-second re-sync with time offset correction |
| iOS background microphone restrictions | Medium | Medium | Foreground service pattern, test on real devices early |
| API rate limits exceeded | Low | Low | Local caching, rate limiting, monitoring |
| Musixmatch commercial pricing too high | Medium | Unknown | Start with LRCLIB (free), prove value before investing |
| flutter_shazam_kit / flutter_acrcloud plugin unmaintained | Medium | Low | Both have source on GitHub; can fork and maintain if needed |

### Skills Requirements

- **Flutter Native Integration**: Platform channels / method channels for bridging native SDKs
- **Audio Processing Basics**: Understanding of audio fingerprinting concepts (not building our own, but debugging issues)
- **Animation in Flutter**: CustomPainter, ShaderMask, or AnimatedBuilder for lyrics highlight effects
- **State Management**: BLoC or Riverpod for managing the listen-detect-display state machine
- **iOS/Android Permissions**: Microphone access, background processing, foreground services

## Technical Research Recommendations

### Implementation Roadmap

```
Week 1-2:  PoC - ACRCloud recognition in karaoke rooms
           → GO/NO-GO decision based on recognition accuracy

Week 3-4:  MVP - LRCLIB + flutter_lyric synced display
           → End-to-end working prototype

Week 5-6:  Polish - Song transitions, error handling, battery optimization
           → Beta-ready for user testing

Week 7+:   Premium (if validated) - Musixmatch commercial, word-level sync
           → Apple Music-quality experience
```

### Technology Stack Recommendations

**Recommended Stack (MVP):**
- **Recognition**: ACRCloud (primary) + ShazamKit (secondary/iOS-only)
- **Lyrics**: LRCLIB (free, immediate) → Musixmatch commercial (upgrade path)
- **Display**: `flutter_lyric` package for LRC rendering + custom animation layer
- **Audio Capture**: `flutter_voice_processor` or platform channel to native
- **State Management**: Riverpod (aligns with existing app patterns)
- **Caching**: Local SQLite/Hive cache for lyrics by song identifier

**Why ACRCloud Primary**: Cover song identification mode, cross-platform, time offset in response, handles noisy environments better than ShazamKit for karaoke use case. [High Confidence]

**Why LRCLIB for MVP**: Zero cost, no API key, 3M+ songs, immediate integration. Validates the concept before committing to Musixmatch commercial spend. [High Confidence]

### Success Metrics and KPIs

| Metric | Target (MVP) | Target (Premium) |
|--------|-------------|-----------------|
| Song recognition accuracy in karaoke rooms | > 70% | > 85% |
| Recognition latency (time to first lyric) | < 10 seconds | < 5 seconds |
| Lyrics availability for recognized songs | > 50% | > 80% |
| Lyrics sync accuracy (perceived by user) | Line-level, acceptable | Word-level, smooth |
| Battery drain per hour of active session | < 10% | < 8% |
| User engagement (% of session with lyrics active) | Baseline measurement | > 60% |

### Critical Go/No-Go Gate

**After Phase 1 PoC, evaluate:**
1. Can ACRCloud/ShazamKit recognize songs in at least 3 different karaoke venue setups with >60% accuracy?
2. Does recognition work with karaoke backing tracks (not just original recordings)?
3. Is the recognition latency acceptable (<15 seconds from song start to detection)?

If any answer is NO, consider:
- Manual song selection as primary input (user types/searches the song) with recognition as enhancement
- QR code integration with karaoke system song lists
- NFC tap from karaoke remote to phone

These fallbacks still enable the lyrics display experience without relying on audio recognition.

---

**Research completed: 2026-04-02**
