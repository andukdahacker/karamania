import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:provider/provider.dart';
import 'package:karamania/state/auth_provider.dart';
import 'package:karamania/state/party_provider.dart';
import 'package:karamania/state/session_detail_provider.dart';
import 'package:karamania/state/timeline_provider.dart';
import 'package:karamania/theme/dj_theme.dart';

import 'helpers/test_app.dart';

/// Automated screenshot capture for UX review.
///
/// Run via:
///   flutter drive --driver=test_driver/integration_test.dart \
///     --target=integration_test/screenshot_test.dart \
///     -d <device-id> --dart-define="SERVER_URL=http://localhost:9999"
///
/// The test driver (test_driver/integration_test.dart) receives screenshot
/// bytes via onScreenshot and writes them to docs/screenshots/ on the host.
void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  const phoneSize = Size(430, 932); // iPhone 15 Pro Max

  setUpAll(() {
    initializeTestConfig();
  });

  /// Takes a screenshot via the integration test binding.
  /// When run with `flutter drive`, the onScreenshot callback in the
  /// test driver writes the PNG to docs/screenshots/ on the host machine.
  Future<void> capture(
    IntegrationTestWidgetsFlutterBinding binding,
    WidgetTester tester,
    String name,
  ) async {
    await tester.pumpAndSettle(const Duration(milliseconds: 200));
    await tester.pump(const Duration(milliseconds: 100));
    await binding.takeScreenshot(name);
  }

  // ---------------------------------------------------------------------------
  // 1. Home Screen
  // ---------------------------------------------------------------------------

  group('Home screen', () {
    testWidgets('01_home_guest', (tester) async {
      await tester.binding.setSurfaceSize(phoneSize);
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(buildTestApp());
      await capture(binding, tester, '01_home_guest');
    });

    testWidgets('02_home_authenticated_empty', (tester) async {
      await tester.binding.setSurfaceSize(phoneSize);
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(buildTestApp());

      final context = tester.element(find.byType(MaterialApp).first);
      final auth = context.read<AuthProvider>();
      final timeline = context.read<TimelineProvider>();

      // Simulate guest auth (avoids Firebase dependency)
      auth.onGuestAuthenticated('fake-token', 'user-1', 'DJ Karamania');
      // Seed empty timeline to skip API call
      timeline.onSessionsLoaded([], 0);

      await capture(binding, tester, '02_home_authenticated_empty');
    });

    testWidgets('03_home_authenticated_sessions', (tester) async {
      await tester.binding.setSurfaceSize(phoneSize);
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(buildTestApp());

      final context = tester.element(find.byType(MaterialApp).first);
      final auth = context.read<AuthProvider>();
      final timeline = context.read<TimelineProvider>();

      auth.onGuestAuthenticated('fake-token', 'user-1', 'DJ Karamania');
      timeline.onSessionsLoaded([
        const SessionTimelineItem(
          id: 'sess-1',
          venueName: 'Friday Night Karaoke',
          endedAt: '2026-03-20T23:30:00Z',
          participantCount: 5,
          topAward: 'Crowd Favorite',
          thumbnailUrl: null,
        ),
        const SessionTimelineItem(
          id: 'sess-2',
          venueName: 'Birthday Bash',
          endedAt: '2026-03-15T22:00:00Z',
          participantCount: 8,
          topAward: 'Show Stopper',
          thumbnailUrl: null,
        ),
        const SessionTimelineItem(
          id: 'sess-3',
          venueName: 'K-Pop Night',
          endedAt: '2026-03-10T21:00:00Z',
          participantCount: 4,
          topAward: null,
          thumbnailUrl: null,
        ),
      ], 3);

      await capture(binding, tester, '03_home_authenticated_sessions');
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Join Screen
  // ---------------------------------------------------------------------------

  group('Join screen', () {
    testWidgets('04_join_empty', (tester) async {
      await tester.binding.setSurfaceSize(phoneSize);
      addTearDown(() => tester.binding.setSurfaceSize(null));

      final router = createTestRouter(initialLocation: '/join');
      await tester.pumpWidget(buildTestApp(router: router));
      await capture(binding, tester, '04_join_empty');
    });

    testWidgets('05_join_filled', (tester) async {
      await tester.binding.setSurfaceSize(phoneSize);
      addTearDown(() => tester.binding.setSurfaceSize(null));

      final router = createTestRouter(initialLocation: '/join?code=VIBE');
      await tester.pumpWidget(buildTestApp(router: router));
      await tester.pumpAndSettle();

      await tester.enterText(
        find.byKey(const Key('display-name-input')),
        'DJ Karamania',
      );

      await capture(binding, tester, '05_join_filled');
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Lobby Screen
  // ---------------------------------------------------------------------------

  group('Lobby screen', () {
    testWidgets('06_lobby_host_waiting', (tester) async {
      await tester.binding.setSurfaceSize(phoneSize);
      addTearDown(() => tester.binding.setSurfaceSize(null));

      final router = createTestRouter(initialLocation: '/lobby');
      await tester.pumpWidget(buildTestApp(router: router));

      final context = tester.element(find.byType(MaterialApp).first);
      final party = context.read<PartyProvider>();

      party.onPartyCreated('test-session', 'VIBE');
      party.onParticipantsSync([
        const ParticipantInfo(
          userId: 'host',
          displayName: 'DJ Karamania',
          isOnline: true,
        ),
      ]);

      await capture(binding, tester, '06_lobby_host_waiting');
    });

    testWidgets('07_lobby_host_ready', (tester) async {
      await tester.binding.setSurfaceSize(phoneSize);
      addTearDown(() => tester.binding.setSurfaceSize(null));

      final router = createTestRouter(initialLocation: '/lobby');
      await tester.pumpWidget(buildTestApp(router: router));

      final context = tester.element(find.byType(MaterialApp).first);
      final party = context.read<PartyProvider>();

      party.onPartyCreated('test-session', 'VIBE');
      party.onParticipantsSync([
        const ParticipantInfo(
            userId: 'host', displayName: 'DJ Karamania', isOnline: true),
        const ParticipantInfo(
            userId: 'g1', displayName: 'Alex', isOnline: true),
        const ParticipantInfo(
            userId: 'g2', displayName: 'Sam', isOnline: true),
        const ParticipantInfo(
            userId: 'g3', displayName: 'Jordan', isOnline: true),
      ]);

      await capture(binding, tester, '07_lobby_host_ready');
    });

    testWidgets('08_lobby_guest', (tester) async {
      await tester.binding.setSurfaceSize(phoneSize);
      addTearDown(() => tester.binding.setSurfaceSize(null));

      final router = createTestRouter(initialLocation: '/lobby');
      await tester.pumpWidget(buildTestApp(router: router));

      final context = tester.element(find.byType(MaterialApp).first);
      final party = context.read<PartyProvider>();

      party.onPartyJoined(
        sessionId: 'test-session',
        partyCode: 'VIBE',
        vibe: PartyVibe.general,
      );
      party.onParticipantsSync([
        const ParticipantInfo(
            userId: 'host', displayName: 'DJ Karamania', isOnline: true),
        const ParticipantInfo(
            userId: 'g1', displayName: 'Alex', isOnline: true),
        const ParticipantInfo(
            userId: 'g2', displayName: 'Sam', isOnline: true),
      ]);

      await capture(binding, tester, '08_lobby_guest');
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Party Screen
  // ---------------------------------------------------------------------------

  group('Party screen', () {
    testWidgets('09_party_song_active', (tester) async {
      await tester.binding.setSurfaceSize(phoneSize);
      addTearDown(() => tester.binding.setSurfaceSize(null));

      final router = createTestRouter(initialLocation: '/party');
      await tester.pumpWidget(buildTestApp(router: router));

      final context = tester.element(find.byType(MaterialApp).first);
      final party = context.read<PartyProvider>();

      party.onPartyCreated('test-session', 'VIBE');
      party.onPartyStarted();
      party.onParticipantsSync([
        const ParticipantInfo(
            userId: 'host', displayName: 'DJ Karamania', isOnline: true),
        const ParticipantInfo(
            userId: 'g1', displayName: 'Alex', isOnline: true),
        const ParticipantInfo(
            userId: 'g2', displayName: 'Sam', isOnline: true),
        const ParticipantInfo(
            userId: 'g3', displayName: 'Jordan', isOnline: true),
      ]);
      party.onDjStateUpdate(
        state: DJState.song,
        songCount: 3,
        participantCount: 4,
        currentPerformer: 'Alex',
        timerStartedAt: DateTime.now().millisecondsSinceEpoch,
        timerDurationMs: 180000,
      );

      await capture(binding, tester, '09_party_song_active');
    });

    testWidgets('10_party_song_selection', (tester) async {
      await tester.binding.setSurfaceSize(phoneSize);
      addTearDown(() => tester.binding.setSurfaceSize(null));

      final router = createTestRouter(initialLocation: '/party');
      await tester.pumpWidget(buildTestApp(router: router));

      final context = tester.element(find.byType(MaterialApp).first);
      final party = context.read<PartyProvider>();

      party.onPartyCreated('test-session', 'VIBE');
      party.onPartyStarted();
      party.onParticipantsSync([
        const ParticipantInfo(
            userId: 'host', displayName: 'DJ Karamania', isOnline: true),
        const ParticipantInfo(
            userId: 'g1', displayName: 'Alex', isOnline: true),
        const ParticipantInfo(
            userId: 'g2', displayName: 'Sam', isOnline: true),
        const ParticipantInfo(
            userId: 'g3', displayName: 'Jordan', isOnline: true),
      ]);
      party.onDjStateUpdate(
        state: DJState.songSelection,
        songCount: 2,
        participantCount: 4,
      );

      await capture(binding, tester, '10_party_song_selection');
    });

    testWidgets('11_party_paused', (tester) async {
      await tester.binding.setSurfaceSize(phoneSize);
      addTearDown(() => tester.binding.setSurfaceSize(null));

      final router = createTestRouter(initialLocation: '/party');
      await tester.pumpWidget(buildTestApp(router: router));

      final context = tester.element(find.byType(MaterialApp).first);
      final party = context.read<PartyProvider>();

      party.onPartyCreated('test-session', 'VIBE');
      party.onPartyStarted();
      party.onDjStateUpdate(
        state: DJState.song,
        songCount: 1,
        participantCount: 4,
        currentPerformer: 'Alex',
        timerStartedAt: DateTime.now().millisecondsSinceEpoch,
        timerDurationMs: 180000,
      );
      party.onDjPause(
        pausedFromState: DJState.song.name,
        timerRemainingMs: 90000,
      );

      await capture(binding, tester, '11_party_paused');
    });

    testWidgets('12_party_ceremony', (tester) async {
      await tester.binding.setSurfaceSize(phoneSize);
      addTearDown(() => tester.binding.setSurfaceSize(null));

      final router = createTestRouter(initialLocation: '/party');
      await tester.pumpWidget(buildTestApp(router: router));

      final context = tester.element(find.byType(MaterialApp).first);
      final party = context.read<PartyProvider>();

      party.onPartyCreated('test-session', 'VIBE');
      party.onPartyStarted();
      party.onDjStateUpdate(
        state: DJState.ceremony,
        songCount: 3,
        participantCount: 4,
        ceremonyType: 'quick',
      );
      party.onCeremonyQuick(
        award: 'Crowd Favorite',
        performerName: 'Alex',
        tone: 'hype',
      );

      await capture(binding, tester, '12_party_ceremony');
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Session Detail Screen
  // ---------------------------------------------------------------------------

  group('Session detail', () {
    testWidgets('13_session_detail', (tester) async {
      await tester.binding.setSurfaceSize(phoneSize);
      addTearDown(() => tester.binding.setSurfaceSize(null));

      final router = createTestRouter(initialLocation: '/session/test-123');
      await tester.pumpWidget(buildTestApp(router: router));

      // Seed provider before the post-frame callback fires
      final context = tester.element(find.byType(MaterialApp).first);
      final detailProvider = context.read<SessionDetailProvider>();
      detailProvider.onDetailLoaded(const SessionDetail(
        id: 'test-123',
        venueName: 'Friday Night Karaoke',
        vibe: 'general',
        createdAt: '2026-03-20T20:00:00Z',
        endedAt: '2026-03-20T23:30:00Z',
        stats: SessionDetailStats(
          songCount: 12,
          participantCount: 5,
          sessionDurationMs: 12600000,
          totalReactions: 245,
          totalSoundboardPlays: 38,
          totalCardsDealt: 8,
        ),
        participants: [
          SessionDetailParticipant(
            userId: 'u1',
            displayName: 'DJ Karamania',
            participationScore: 95,
            topAward: 'Crowd Favorite',
          ),
          SessionDetailParticipant(
            userId: 'u2',
            displayName: 'Alex',
            participationScore: 82,
            topAward: null,
          ),
          SessionDetailParticipant(
            userId: 'u3',
            displayName: 'Sam',
            participationScore: 78,
            topAward: 'Best Duet',
          ),
          SessionDetailParticipant(
            userId: 'u4',
            displayName: 'Jordan',
            participationScore: 65,
            topAward: null,
          ),
          SessionDetailParticipant(
            userId: 'u5',
            displayName: 'Taylor',
            participationScore: 55,
            topAward: 'Comeback King',
          ),
        ],
        setlist: [
          SessionDetailSetlistItem(
            position: 1,
            title: 'Bohemian Rhapsody',
            artist: 'Queen',
            performerName: 'Alex',
            awardTitle: 'Show Stopper',
            awardTone: 'hype',
          ),
          SessionDetailSetlistItem(
            position: 2,
            title: 'Dancing Queen',
            artist: 'ABBA',
            performerName: 'Sam',
            awardTitle: null,
            awardTone: null,
          ),
          SessionDetailSetlistItem(
            position: 3,
            title: 'Sweet Caroline',
            artist: 'Neil Diamond',
            performerName: 'DJ Karamania',
            awardTitle: 'Crowd Favorite',
            awardTone: 'warm',
          ),
          SessionDetailSetlistItem(
            position: 4,
            title: 'Don\'t Stop Believin\'',
            artist: 'Journey',
            performerName: 'Jordan',
            awardTitle: null,
            awardTone: null,
          ),
          SessionDetailSetlistItem(
            position: 5,
            title: 'Livin\' on a Prayer',
            artist: 'Bon Jovi',
            performerName: 'Taylor',
            awardTitle: 'Comeback King',
            awardTone: 'hype',
          ),
        ],
        awards: [],
        media: [],
      ));

      await capture(binding, tester, '13_session_detail');
    });
  });
}
