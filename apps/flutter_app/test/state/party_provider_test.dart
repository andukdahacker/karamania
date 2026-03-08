import 'package:flutter_test/flutter_test.dart';
import 'package:karamania/config/app_config.dart';
import 'package:karamania/state/loading_state.dart';
import 'package:karamania/state/party_provider.dart' show PartyProvider, ParticipantInfo;
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
  });
}
