import 'package:flutter_test/flutter_test.dart';
import 'package:karamania/config/app_config.dart';
import 'package:karamania/state/loading_state.dart';
import 'package:karamania/state/party_provider.dart' show PartyProvider, ParticipantInfo, ConnectionStatus;
import 'package:karamania/theme/dj_theme.dart';

void main() {
  setUpAll(() {
    AppConfig.initializeForTest(flavor: 'dev');
  });

  group('PartyProvider', () {
    late PartyProvider provider;

    setUp(() {
      provider = PartyProvider();
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
  });
}
