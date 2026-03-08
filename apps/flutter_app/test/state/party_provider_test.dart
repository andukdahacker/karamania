import 'package:flutter_test/flutter_test.dart';
import 'package:karamania/config/app_config.dart';
import 'package:karamania/state/loading_state.dart';
import 'package:karamania/state/party_provider.dart';
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
  });
}
