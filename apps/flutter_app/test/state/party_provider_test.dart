import 'package:fake_async/fake_async.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:karamania/config/app_config.dart';
import 'package:karamania/state/loading_state.dart';
import 'package:karamania/constants/party_cards.dart';
import 'package:karamania/state/party_provider.dart' show PartyProvider, ParticipantInfo, ConnectionStatus, ReactionEvent;
import 'package:karamania/theme/dj_theme.dart';

void main() {
  setUpAll(() {
    AppConfig.initializeForTest(flavor: 'dev');
  });

  group('PartyProvider', () {
    late PartyProvider provider;
    late List<bool> wakelockCalls;

    setUp(() {
      wakelockCalls = [];
      provider = PartyProvider(wakelockToggle: (enable) => wakelockCalls.add(enable));
    });

    test('initial state: sessionId null, partyCode null, isHost false, createPartyLoading idle', () {
      expect(provider.sessionId, isNull);
      expect(provider.partyCode, isNull);
      expect(provider.isHost, isFalse);
      expect(provider.createPartyLoading, LoadingState.idle);
      expect(provider.participantCount, 0);
    });

    test('onPartyCreated sets sessionId, partyCode, isHost=true, participantCount=1, loading=success', () {
      provider.onPartyCreated('session-123', 'ABCD');

      expect(provider.sessionId, 'session-123');
      expect(provider.partyCode, 'ABCD');
      expect(provider.isHost, isTrue);
      expect(provider.participantCount, 1);
      expect(provider.createPartyLoading, LoadingState.success);
    });

    test('onPartyCreated notifies listeners', () {
      int notifyCount = 0;
      provider.addListener(() => notifyCount++);

      provider.onPartyCreated('s1', 'CODE');

      expect(notifyCount, 1);
    });

    test('onCreatePartyLoading updates createPartyLoading and notifies', () {
      int notifyCount = 0;
      provider.addListener(() => notifyCount++);

      provider.onCreatePartyLoading(LoadingState.loading);
      expect(provider.createPartyLoading, LoadingState.loading);
      expect(notifyCount, 1);

      provider.onCreatePartyLoading(LoadingState.error);
      expect(provider.createPartyLoading, LoadingState.error);
      expect(notifyCount, 2);
    });

    test('onVibeChanged updates vibe and notifies', () {
      int notifyCount = 0;
      provider.addListener(() => notifyCount++);

      provider.onVibeChanged(PartyVibe.rock);

      expect(provider.vibe, PartyVibe.rock);
      expect(notifyCount, 1);
    });

    test('onJoinPartyLoading transitions loading states', () {
      int notifyCount = 0;
      provider.addListener(() => notifyCount++);

      provider.onJoinPartyLoading(LoadingState.loading);
      expect(provider.joinPartyLoading, LoadingState.loading);
      expect(notifyCount, 1);

      provider.onJoinPartyLoading(LoadingState.error);
      expect(provider.joinPartyLoading, LoadingState.error);
      expect(notifyCount, 2);
    });

    test('onPartyJoined sets sessionId, partyCode, vibe, isHost=false', () {
      provider.onPartyJoined(
        sessionId: 'session-abc',
        partyCode: 'ROCK',
        vibe: PartyVibe.rock,
      );

      expect(provider.sessionId, 'session-abc');
      expect(provider.partyCode, 'ROCK');
      expect(provider.vibe, PartyVibe.rock);
      expect(provider.isHost, isFalse);
      expect(provider.joinPartyLoading, LoadingState.success);
    });

    test('onParticipantJoined increments count and adds to list', () {
      int notifyCount = 0;
      provider.addListener(() => notifyCount++);

      provider.onParticipantJoined(
        userId: 'user-1',
        displayName: 'Alice',
        participantCount: 2,
      );

      expect(provider.participantCount, 2);
      expect(provider.participants.length, 1);
      expect(provider.participants[0].displayName, 'Alice');
      expect(notifyCount, 1);

      provider.onParticipantJoined(
        userId: 'user-2',
        displayName: 'Bob',
        participantCount: 3,
      );

      expect(provider.participantCount, 3);
      expect(provider.participants.length, 2);
      expect(notifyCount, 2);
    });

    test('onParticipantsSync replaces full participant list', () {
      provider.onParticipantJoined(
        userId: 'old-user',
        displayName: 'OldUser',
        participantCount: 1,
      );

      provider.onParticipantsSync([
        ParticipantInfo(userId: 'u1', displayName: 'Host'),
        ParticipantInfo(userId: 'u2', displayName: 'Guest1'),
        ParticipantInfo(userId: 'u3', displayName: 'Guest2'),
      ]);

      expect(provider.participants.length, 3);
      expect(provider.participantCount, 3);
      expect(provider.participants[0].displayName, 'Host');
    });

    // Story 1.7 tests

    test('initial sessionStatus is lobby', () {
      expect(provider.sessionStatus, 'lobby');
    });

    test('initial isCatchingUp is false', () {
      expect(provider.isCatchingUp, isFalse);
    });

    test('onPartyStarted sets sessionStatus to active and startPartyLoading to success', () {
      int notifyCount = 0;
      provider.addListener(() => notifyCount++);

      provider.onPartyStarted();

      expect(provider.sessionStatus, 'active');
      expect(provider.startPartyLoading, LoadingState.success);
      expect(notifyCount, 1);
    });

    test('onStartPartyLoading transitions loading states', () {
      int notifyCount = 0;
      provider.addListener(() => notifyCount++);

      provider.onStartPartyLoading(LoadingState.loading);
      expect(provider.startPartyLoading, LoadingState.loading);
      expect(notifyCount, 1);

      provider.onStartPartyLoading(LoadingState.error);
      expect(provider.startPartyLoading, LoadingState.error);
      expect(notifyCount, 2);

      provider.onStartPartyLoading(LoadingState.success);
      expect(provider.startPartyLoading, LoadingState.success);
      expect(notifyCount, 3);
    });

    test('onSessionStatus updates sessionStatus and notifies', () {
      int notifyCount = 0;
      provider.addListener(() => notifyCount++);

      provider.onSessionStatus('active');
      expect(provider.sessionStatus, 'active');
      expect(notifyCount, 1);

      provider.onSessionStatus('lobby');
      expect(provider.sessionStatus, 'lobby');
      expect(notifyCount, 2);
    });

    test('onCatchUpStarted sets isCatchingUp to true', () {
      int notifyCount = 0;
      provider.addListener(() => notifyCount++);

      provider.onCatchUpStarted();

      expect(provider.isCatchingUp, isTrue);
      expect(notifyCount, 1);
    });

    test('onCatchUpComplete sets isCatchingUp to false', () {
      provider.onCatchUpStarted();
      expect(provider.isCatchingUp, isTrue);

      int notifyCount = 0;
      provider.addListener(() => notifyCount++);

      provider.onCatchUpComplete();

      expect(provider.isCatchingUp, isFalse);
      expect(notifyCount, 1);
    });

    test('onPartyJoined accepts and stores status parameter', () {
      provider.onPartyJoined(
        sessionId: 'session-xyz',
        partyCode: 'LIVE',
        vibe: PartyVibe.kpop,
        status: 'active',
      );

      expect(provider.sessionId, 'session-xyz');
      expect(provider.partyCode, 'LIVE');
      expect(provider.vibe, PartyVibe.kpop);
      expect(provider.isHost, isFalse);
      expect(provider.sessionStatus, 'active');
      expect(provider.joinPartyLoading, LoadingState.success);
    });

    test('onPartyJoined defaults status to lobby when not provided', () {
      provider.onPartyJoined(
        sessionId: 'session-default',
        partyCode: 'DFLT',
        vibe: PartyVibe.general,
      );

      expect(provider.sessionStatus, 'lobby');
    });

    test('initial pendingCatchUp is false', () {
      expect(provider.pendingCatchUp, isFalse);
    });

    test('onPartyJoined with status active sets pendingCatchUp true', () {
      provider.onPartyJoined(
        sessionId: 'session-1',
        partyCode: 'LATE',
        vibe: PartyVibe.general,
        status: 'active',
      );

      expect(provider.pendingCatchUp, isTrue);
    });

    test('onPartyJoined with status lobby keeps pendingCatchUp false', () {
      provider.onPartyJoined(
        sessionId: 'session-1',
        partyCode: 'NORM',
        vibe: PartyVibe.general,
      );

      expect(provider.pendingCatchUp, isFalse);
    });

    test('onCatchUpStarted clears pendingCatchUp', () {
      provider.onPartyJoined(
        sessionId: 'session-1',
        partyCode: 'LATE',
        vibe: PartyVibe.general,
        status: 'active',
      );
      expect(provider.pendingCatchUp, isTrue);

      provider.onCatchUpStarted();

      expect(provider.pendingCatchUp, isFalse);
      expect(provider.isCatchingUp, isTrue);
    });

    // Story 1.8 tests

    test('initial connectionStatus is connected', () {
      expect(provider.connectionStatus, ConnectionStatus.connected);
    });

    test('onConnectionStatusChanged updates connectionStatus and notifies', () {
      int notifyCount = 0;
      provider.addListener(() => notifyCount++);

      provider.onConnectionStatusChanged(ConnectionStatus.reconnecting);
      expect(provider.connectionStatus, ConnectionStatus.reconnecting);
      expect(notifyCount, 1);

      provider.onConnectionStatusChanged(ConnectionStatus.connected);
      expect(provider.connectionStatus, ConnectionStatus.connected);
      expect(notifyCount, 2);
    });

    test('onParticipantDisconnected marks participant as offline', () {
      provider.onParticipantsSync([
        ParticipantInfo(userId: 'u1', displayName: 'Host'),
        ParticipantInfo(userId: 'u2', displayName: 'Alice'),
      ]);

      int notifyCount = 0;
      provider.addListener(() => notifyCount++);

      provider.onParticipantDisconnected('u2');

      expect(provider.participants.length, 2);
      expect(provider.participants.firstWhere((p) => p.userId == 'u2').isOnline, isFalse);
      expect(provider.participants.firstWhere((p) => p.userId == 'u1').isOnline, isTrue);
      expect(notifyCount, 1);
    });

    test('onParticipantReconnected marks participant back online', () {
      provider.onParticipantsSync([
        ParticipantInfo(userId: 'u1', displayName: 'Host'),
        ParticipantInfo(userId: 'u2', displayName: 'Alice'),
      ]);

      provider.onParticipantDisconnected('u2');
      expect(provider.participants.firstWhere((p) => p.userId == 'u2').isOnline, isFalse);

      int notifyCount = 0;
      provider.addListener(() => notifyCount++);

      provider.onParticipantReconnected('u2');

      expect(provider.participants.firstWhere((p) => p.userId == 'u2').isOnline, isTrue);
      expect(notifyCount, 1);
    });

    test('onHostTransferred(true) sets isHost to true', () {
      // Start as non-host
      provider.onPartyJoined(
        sessionId: 'session-1',
        partyCode: 'CODE',
        vibe: PartyVibe.general,
      );
      expect(provider.isHost, isFalse);

      int notifyCount = 0;
      provider.addListener(() => notifyCount++);

      provider.onHostTransferred(true);

      expect(provider.isHost, isTrue);
      expect(notifyCount, 1);
    });

    test('onHostTransferred(false) sets isHost to false', () {
      provider.onPartyCreated('session-1', 'CODE');
      expect(provider.isHost, isTrue);

      int notifyCount = 0;
      provider.addListener(() => notifyCount++);

      provider.onHostTransferred(false);

      expect(provider.isHost, isFalse);
      expect(notifyCount, 1);
    });

    test('onHostUpdate sets isHost and notifies', () {
      expect(provider.isHost, isFalse);

      int notifyCount = 0;
      provider.addListener(() => notifyCount++);

      provider.onHostUpdate(true);
      expect(provider.isHost, isTrue);
      expect(notifyCount, 1);

      provider.onHostUpdate(false);
      expect(provider.isHost, isFalse);
      expect(notifyCount, 2);
    });

    test('initial hostTransferPending is false', () {
      expect(provider.hostTransferPending, isFalse);
    });

    test('onHostTransferred(true) sets hostTransferPending to true', () {
      provider.onHostTransferred(true);
      expect(provider.hostTransferPending, isTrue);
    });

    test('onHostTransferred(false) does not set hostTransferPending', () {
      provider.onHostTransferred(false);
      expect(provider.hostTransferPending, isFalse);
    });

    test('clearHostTransferPending clears the flag and notifies', () {
      provider.onHostTransferred(true);
      expect(provider.hostTransferPending, isTrue);

      int notifyCount = 0;
      provider.addListener(() => notifyCount++);

      provider.clearHostTransferPending();
      expect(provider.hostTransferPending, isFalse);
      expect(notifyCount, 1);
    });

    test('clearHostTransferPending does not notify when already false', () {
      int notifyCount = 0;
      provider.addListener(() => notifyCount++);

      provider.clearHostTransferPending();
      expect(notifyCount, 0);
    });

    test('ParticipantInfo isOnline defaults to true', () {
      const participant = ParticipantInfo(userId: 'u1', displayName: 'Test');
      expect(participant.isOnline, isTrue);
    });

    test('ParticipantInfo supports explicit isOnline field', () {
      const online = ParticipantInfo(userId: 'u1', displayName: 'Online', isOnline: true);
      const offline = ParticipantInfo(userId: 'u2', displayName: 'Offline', isOnline: false);

      expect(online.isOnline, isTrue);
      expect(offline.isOnline, isFalse);
    });

    // Story 2.4 tests — onDjStateUpdate

    test('initial DJ state fields have correct defaults', () {
      expect(provider.djState, DJState.lobby);
      expect(provider.songCount, 0);
      expect(provider.currentPerformer, isNull);
      expect(provider.timerStartedAt, isNull);
      expect(provider.timerDurationMs, isNull);
    });

    test('onDjStateUpdate updates all DJ state fields', () {
      provider.onDjStateUpdate(
        state: DJState.song,
        songCount: 3,
        participantCount: 5,
        currentPerformer: 'Alice',
        timerStartedAt: 1000,
        timerDurationMs: 180000,
      );

      expect(provider.djState, DJState.song);
      expect(provider.songCount, 3);
      expect(provider.currentPerformer, 'Alice');
      expect(provider.timerStartedAt, 1000);
      expect(provider.timerDurationMs, 180000);
    });

    test('onDjStateUpdate calls notifyListeners exactly once', () {
      int notifyCount = 0;
      provider.addListener(() => notifyCount++);

      provider.onDjStateUpdate(
        state: DJState.songSelection,
        songCount: 1,
        participantCount: 4,
        currentPerformer: 'Bob',
        timerStartedAt: 2000,
        timerDurationMs: 30000,
      );

      expect(notifyCount, 1);
    });

    test('onDjStateUpdate clears nullable fields when null is passed', () {
      provider.onDjStateUpdate(
        state: DJState.song,
        currentPerformer: 'Alice',
        timerStartedAt: 1000,
        timerDurationMs: 180000,
      );
      expect(provider.currentPerformer, 'Alice');

      provider.onDjStateUpdate(
        state: DJState.songSelection,
        currentPerformer: null,
        timerStartedAt: null,
        timerDurationMs: null,
      );

      expect(provider.currentPerformer, isNull);
      expect(provider.timerStartedAt, isNull);
      expect(provider.timerDurationMs, isNull);
    });

    test('onDjStateUpdate updates participantCount only when non-null and session is active', () {
      // Session not active yet — participantCount should not update
      provider.onDjStateUpdate(
        state: DJState.songSelection,
        participantCount: 10,
      );
      expect(provider.participantCount, 0); // Unchanged — session not active

      // Make session active
      provider.onSessionStatus('active');

      provider.onDjStateUpdate(
        state: DJState.song,
        participantCount: 5,
      );
      expect(provider.participantCount, 5); // Updated — session is active

      // Null participantCount doesn't overwrite
      provider.onDjStateUpdate(
        state: DJState.ceremony,
        participantCount: null,
      );
      expect(provider.participantCount, 5); // Unchanged — null passed
    });

    test('onDjStateUpdate preserves songCount when null is passed', () {
      provider.onDjStateUpdate(
        state: DJState.song,
        songCount: 5,
      );
      expect(provider.songCount, 5);

      provider.onDjStateUpdate(
        state: DJState.songSelection,
        songCount: null,
      );
      expect(provider.songCount, 5); // Preserved
    });

    // Wakelock tests

    test('wakelock enabled for active DJ states (not lobby/finale)', () {
      provider.onDjStateUpdate(state: DJState.songSelection);
      expect(wakelockCalls, [true]);

      provider.onDjStateUpdate(state: DJState.song);
      // No redundant enable call
      expect(wakelockCalls, [true]);
    });

    test('wakelock disabled for lobby and finale states', () {
      // First enable
      provider.onDjStateUpdate(state: DJState.song);
      expect(wakelockCalls, [true]);

      // Then disable when returning to lobby
      provider.onDjStateUpdate(state: DJState.lobby);
      expect(wakelockCalls, [true, false]);
    });

    test('wakelock disabled for finale', () {
      provider.onDjStateUpdate(state: DJState.song);
      provider.onDjStateUpdate(state: DJState.finale);
      expect(wakelockCalls, [true, false]);
    });

    test('wakelock avoids redundant disable calls', () {
      // Start in lobby (default) — no wakelock calls
      provider.onDjStateUpdate(state: DJState.lobby);
      expect(wakelockCalls, isEmpty);
    });

    test('onSessionEnd disables wakelock if enabled', () {
      provider.onDjStateUpdate(state: DJState.song);
      expect(wakelockCalls, [true]);

      provider.onSessionEnd();
      expect(wakelockCalls, [true, false]);
    });

    test('onSessionEnd does nothing if wakelock not enabled', () {
      provider.onSessionEnd();
      expect(wakelockCalls, isEmpty);
    });

    // Story 2.5 tests — onSessionEnded, onKicked, onParticipantRemoved

    test('onSessionEnded sets status to ended, clears DJ state, disables wakelock', () {
      // Set up active session
      provider.onDjStateUpdate(state: DJState.song, currentPerformer: 'Alice', timerStartedAt: 1000, timerDurationMs: 180000);
      wakelockCalls.clear();

      int notifyCount = 0;
      provider.addListener(() => notifyCount++);

      provider.onSessionEnded();

      expect(provider.sessionStatus, 'ended');
      expect(provider.djState, DJState.lobby);
      expect(provider.currentPerformer, isNull);
      expect(provider.timerStartedAt, isNull);
      expect(provider.timerDurationMs, isNull);
      expect(wakelockCalls, [false]);
      expect(notifyCount, 1);
    });

    test('onKicked sets status to ended and sets kickedMessage', () {
      provider.onDjStateUpdate(state: DJState.song);
      wakelockCalls.clear();

      provider.onKicked();

      expect(provider.sessionStatus, 'ended');
      expect(provider.kickedMessage, isNotNull);
      expect(provider.djState, DJState.lobby);
      expect(wakelockCalls, [false]);
    });

    test('onParticipantRemoved removes participant from list', () {
      provider.onParticipantsSync([
        ParticipantInfo(userId: 'u1', displayName: 'Host'),
        ParticipantInfo(userId: 'u2', displayName: 'Alice'),
        ParticipantInfo(userId: 'u3', displayName: 'Bob'),
      ]);

      int notifyCount = 0;
      provider.addListener(() => notifyCount++);

      provider.onParticipantRemoved('u2');

      expect(provider.participants.length, 2);
      expect(provider.participantCount, 2);
      expect(provider.participants.any((p) => p.userId == 'u2'), isFalse);
      expect(notifyCount, 1);
    });

    test('initial kickedMessage is null', () {
      expect(provider.kickedMessage, isNull);
    });

    // Story 2.6 tests — pause/resume

    test('initial isPaused is false and pausedFromState is null', () {
      expect(provider.isPaused, isFalse);
      expect(provider.pausedFromState, isNull);
    });

    test('onDjPause sets isPaused and pausedFromState, clears timer fields', () {
      provider.onDjStateUpdate(
        state: DJState.song,
        timerStartedAt: 1000,
        timerDurationMs: 180000,
      );

      int notifyCount = 0;
      provider.addListener(() => notifyCount++);

      provider.onDjPause(pausedFromState: 'song', timerRemainingMs: 90000);

      expect(provider.isPaused, isTrue);
      expect(provider.pausedFromState, 'song');
      expect(provider.timerStartedAt, isNull);
      expect(provider.timerDurationMs, isNull);
      expect(notifyCount, 1);
    });

    test('onDjResume clears pause state', () {
      provider.onDjPause(pausedFromState: 'song');
      expect(provider.isPaused, isTrue);

      int notifyCount = 0;
      provider.addListener(() => notifyCount++);

      provider.onDjResume();

      expect(provider.isPaused, isFalse);
      expect(provider.pausedFromState, isNull);
      expect(notifyCount, 1);
    });

    test('onDjStateUpdate with isPaused flag sets pause state (mid-session join)', () {
      provider.onDjStateUpdate(
        state: DJState.song,
        isPaused: true,
      );

      expect(provider.isPaused, isTrue);
    });

    test('onDjStateUpdate with isPaused=false clears pause state', () {
      provider.onDjPause(pausedFromState: 'song');
      expect(provider.isPaused, isTrue);

      provider.onDjStateUpdate(
        state: DJState.song,
        isPaused: false,
      );

      expect(provider.isPaused, isFalse);
      expect(provider.pausedFromState, isNull);
    });

    test('onDjStateUpdate without isPaused leaves pause state unchanged', () {
      provider.onDjPause(pausedFromState: 'song');
      expect(provider.isPaused, isTrue);

      provider.onDjStateUpdate(state: DJState.ceremony);

      expect(provider.isPaused, isTrue); // Unchanged
    });
  });

  group('PartyProvider moment card', () {
    late PartyProvider provider;

    setUp(() {
      provider = PartyProvider(wakelockToggle: (_) {});
    });

    test('onCeremonyReveal with songTitle stores it correctly', () {
      provider.onCeremonyReveal(
        award: 'Mic Drop Master',
        performerName: 'Alice',
        tone: 'hype',
        songTitle: 'Bohemian Rhapsody',
      );

      expect(provider.ceremonySongTitle, 'Bohemian Rhapsody');
    });

    test('onCeremonyReveal without songTitle defaults to null', () {
      provider.onCeremonyReveal(
        award: 'Mic Drop Master',
        performerName: 'Alice',
        tone: 'hype',
      );

      expect(provider.ceremonySongTitle, isNull);
    });

    test('ceremonySongTitle getter returns stored value', () {
      provider.onCeremonyReveal(
        award: 'Award',
        performerName: null,
        tone: 'hype',
        songTitle: 'Don\'t Stop Believin\'',
      );

      expect(provider.ceremonySongTitle, 'Don\'t Stop Believin\'');
    });

    test('showMomentCardOverlay sets showMomentCard to true and notifies', () {
      int notifyCount = 0;
      provider.addListener(() => notifyCount++);

      provider.showMomentCardOverlay();

      expect(provider.showMomentCard, isTrue);
      expect(notifyCount, 1);
    });

    test('dismissMomentCard sets showMomentCard to false and notifies', () {
      provider.showMomentCardOverlay();

      int notifyCount = 0;
      provider.addListener(() => notifyCount++);

      provider.dismissMomentCard();

      expect(provider.showMomentCard, isFalse);
      expect(notifyCount, 1);
    });

    test('_clearCeremonyState clears ceremonySongTitle and dismisses moment card', () {
      provider.onCeremonyReveal(
        award: 'Award',
        performerName: null,
        tone: 'hype',
        songTitle: 'Song Title',
      );
      provider.showMomentCardOverlay();

      // Trigger _clearCeremonyState via onDjStateUpdate transitioning OUT of ceremony
      provider.onDjStateUpdate(state: DJState.ceremony);
      provider.onDjStateUpdate(state: DJState.interlude);

      expect(provider.ceremonySongTitle, isNull);
      expect(provider.showMomentCard, isFalse);
    });

    test('auto-dismiss: moment card timer fires after 10s', () {
      fakeAsync((async) {
        final provider = PartyProvider(wakelockToggle: (_) {});
        provider.showMomentCardOverlay();
        expect(provider.showMomentCard, isTrue);

        async.elapse(const Duration(seconds: 9));
        expect(provider.showMomentCard, isTrue);

        async.elapse(const Duration(seconds: 1));
        expect(provider.showMomentCard, isFalse);
      });
    });
  });

  group('PartyProvider reaction feed', () {
    late PartyProvider provider;

    setUp(() {
      provider = PartyProvider(wakelockToggle: (_) {});
    });

    test('onReactionBroadcast adds reaction to feed and notifies', () {
      int notifyCount = 0;
      provider.addListener(() => notifyCount++);

      provider.onReactionBroadcast(
        userId: 'user-1',
        emoji: '🔥',
        rewardMultiplier: 1.0,
      );

      expect(provider.reactionFeed, hasLength(1));
      expect(provider.reactionFeed.first.userId, 'user-1');
      expect(provider.reactionFeed.first.emoji, '🔥');
      expect(provider.reactionFeed.first.rewardMultiplier, 1.0);
      expect(notifyCount, 1);
    });

    test('reaction feed caps at _maxReactionFeedSize (50)', () {
      for (int i = 0; i < 55; i++) {
        provider.onReactionBroadcast(
          userId: 'user-$i',
          emoji: '🔥',
          rewardMultiplier: 1.0,
        );
      }

      expect(provider.reactionFeed, hasLength(50));
      // First 5 should have been pruned, so first remaining is user-5
      expect(provider.reactionFeed.first.userId, 'user-5');
    });

    test('reaction feed clears when DJ state exits song', () {
      // Enter song state
      provider.onDjStateUpdate(state: DJState.song);
      provider.onReactionBroadcast(
        userId: 'user-1',
        emoji: '🔥',
        rewardMultiplier: 1.0,
      );
      expect(provider.reactionFeed, hasLength(1));

      // Exit song state
      provider.onDjStateUpdate(state: DJState.songSelection);
      expect(provider.reactionFeed, isEmpty);
    });

    test('reactionFeed getter returns unmodifiable list', () {
      provider.onReactionBroadcast(
        userId: 'user-1',
        emoji: '🔥',
        rewardMultiplier: 1.0,
      );

      final feed = provider.reactionFeed;
      expect(() => (feed as List<ReactionEvent>).add(
        const ReactionEvent(id: 999, userId: 'x', emoji: 'x', rewardMultiplier: 1.0, timestamp: 0, startX: 0.5),
      ), throwsUnsupportedError);
    });

    test('onReactionBroadcast assigns stable id and startX', () {
      provider.onReactionBroadcast(
        userId: 'user-1',
        emoji: '🔥',
        rewardMultiplier: 1.0,
      );

      final event = provider.reactionFeed.first;
      expect(event.id, isNotNull);
      expect(event.startX, greaterThanOrEqualTo(0.0));
      expect(event.startX, lessThan(1.0));
    });

    test('removeReaction removes reaction by id and notifies', () {
      provider.onReactionBroadcast(
        userId: 'user-1',
        emoji: '🔥',
        rewardMultiplier: 1.0,
      );
      provider.onReactionBroadcast(
        userId: 'user-2',
        emoji: '👏',
        rewardMultiplier: 0.5,
      );
      expect(provider.reactionFeed, hasLength(2));

      final idToRemove = provider.reactionFeed.first.id;
      int notifyCount = 0;
      provider.addListener(() => notifyCount++);

      provider.removeReaction(idToRemove);

      expect(provider.reactionFeed, hasLength(1));
      expect(provider.reactionFeed.first.userId, 'user-2');
      expect(notifyCount, 1);
    });

    test('streakMilestone, streakEmoji, streakDisplayName are null initially', () {
      expect(provider.streakMilestone, isNull);
      expect(provider.streakEmoji, isNull);
      expect(provider.streakDisplayName, isNull);
    });

    test('onStreakMilestone sets streak fields and notifies', () {
      int notifyCount = 0;
      provider.addListener(() => notifyCount++);

      provider.onStreakMilestone(
        streakCount: 10,
        emoji: '🔥',
        displayName: 'TestUser',
      );

      expect(provider.streakMilestone, 10);
      expect(provider.streakEmoji, '🔥');
      expect(provider.streakDisplayName, 'TestUser');
      expect(notifyCount, 1);
    });

    test('dismissStreakMilestone clears all streak fields and notifies', () {
      provider.onStreakMilestone(
        streakCount: 5,
        emoji: '👏',
        displayName: 'Player',
      );

      int notifyCount = 0;
      provider.addListener(() => notifyCount++);

      provider.dismissStreakMilestone();

      expect(provider.streakMilestone, isNull);
      expect(provider.streakEmoji, isNull);
      expect(provider.streakDisplayName, isNull);
      expect(notifyCount, 1);
    });

    test('streak state clears when DJ state exits song', () {
      // Set to song state first
      provider.onDjStateUpdate(state: DJState.song);
      provider.onStreakMilestone(
        streakCount: 20,
        emoji: '🔥',
        displayName: 'DJ',
      );
      expect(provider.streakMilestone, 20);

      // Transition out of song
      provider.onDjStateUpdate(state: DJState.ceremony);

      expect(provider.streakMilestone, isNull);
      expect(provider.streakEmoji, isNull);
      expect(provider.streakDisplayName, isNull);
    });
  });

  group('Party card state', () {
    late PartyProvider provider;
    late List<bool> wakelockCalls;

    setUp(() {
      wakelockCalls = [];
      provider = PartyProvider(wakelockToggle: (enable) => wakelockCalls.add(enable));
    });

    test('onCardDealt sets currentCard and notifies listeners', () {
      int notifyCount = 0;
      provider.addListener(() => notifyCount++);

      const card = PartyCardData(
        id: 'chipmunk-mode',
        title: 'Chipmunk Mode',
        description: 'Sing high',
        type: PartyCardType.vocal,
        emoji: '🐿️',
      );

      provider.onCardDealt(card);

      expect(provider.currentCard, isNotNull);
      expect(provider.currentCard!.id, 'chipmunk-mode');
      expect(notifyCount, 1);
    });

    test('card state clears when leaving partyCardDeal state', () {
      // Set to partyCardDeal state
      provider.onDjStateUpdate(state: DJState.partyCardDeal);

      // Deal a card
      const card = PartyCardData(
        id: 'robot-mode',
        title: 'Robot Mode',
        description: 'Sing like a robot',
        type: PartyCardType.vocal,
        emoji: '🤖',
      );
      provider.onCardDealt(card);
      expect(provider.currentCard, isNotNull);

      // Transition out of partyCardDeal
      provider.onDjStateUpdate(state: DJState.song);

      expect(provider.currentCard, isNull);
    });

    test('card state is null initially', () {
      expect(provider.currentCard, isNull);
    });

    group('card interaction state', () {
    test('redrawUsed defaults to false', () {
      expect(provider.redrawUsed, isFalse);
    });

    test('onCardRedrawUsed sets redrawUsed to true', () {
      int notifyCount = 0;
      provider.addListener(() => notifyCount++);

      provider.onCardRedrawUsed();

      expect(provider.redrawUsed, isTrue);
      expect(notifyCount, 1);
    });

    test('redrawUsed resets when entering new partyCardDeal state', () {
      provider.onCardRedrawUsed();
      expect(provider.redrawUsed, isTrue);

      // Enter partyCardDeal
      provider.onDjStateUpdate(state: DJState.partyCardDeal);
      expect(provider.redrawUsed, isFalse);
    });

    test('redrawUsed resets when leaving partyCardDeal state', () {
      provider.onDjStateUpdate(state: DJState.partyCardDeal);
      provider.onCardRedrawUsed();
      expect(provider.redrawUsed, isTrue);

      provider.onDjStateUpdate(state: DJState.song);
      expect(provider.redrawUsed, isFalse);
    });

    test('isCurrentSinger is false when no localUserId set', () {
      provider.onDjStateUpdate(
        state: DJState.partyCardDeal,
        currentPerformer: 'user-1',
      );
      expect(provider.isCurrentSinger, isFalse);
    });

    test('isCurrentSinger is true when localUserId matches currentPerformer', () {
      provider.setLocalUserId('user-1');
      provider.onDjStateUpdate(
        state: DJState.partyCardDeal,
        currentPerformer: 'user-1',
      );
      expect(provider.isCurrentSinger, isTrue);
    });

    test('isCurrentSinger is false when localUserId does not match', () {
      provider.setLocalUserId('user-1');
      provider.onDjStateUpdate(
        state: DJState.partyCardDeal,
        currentPerformer: 'user-2',
      );
      expect(provider.isCurrentSinger, isFalse);
    });

    test('onCardAcceptedBroadcast sets acceptedCardTitle and notifies', () {
      int notifyCount = 0;
      provider.addListener(() => notifyCount++);

      provider.onCardAcceptedBroadcast('Chipmunk Mode', 'vocal');

      expect(provider.acceptedCardTitle, 'Chipmunk Mode');
      expect(provider.acceptedCardType, 'vocal');
      expect(notifyCount, 1);
    });

    test('acceptedCardTitle resets when entering new partyCardDeal', () {
      provider.onCardAcceptedBroadcast('Chipmunk Mode', 'vocal');
      expect(provider.acceptedCardTitle, isNotNull);

      provider.onDjStateUpdate(state: DJState.partyCardDeal);
      expect(provider.acceptedCardTitle, isNull);
    });
    });
  });
}
