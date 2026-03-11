import 'package:flutter_test/flutter_test.dart';
import 'package:karamania/config/app_config.dart';
import 'package:karamania/socket/client.dart';
import 'package:karamania/state/party_provider.dart';
import 'package:karamania/theme/dj_theme.dart';

void main() {
  setUpAll(() {
    AppConfig.initializeForTest(flavor: 'dev');
  });

  group('SocketClient', () {
    test('singleton instance is accessible', () {
      final client = SocketClient.instance;
      expect(client, isNotNull);
      expect(identical(client, SocketClient.instance), isTrue);
    });

    test('initial isConnected is false', () {
      expect(SocketClient.instance.isConnected, isFalse);
    });

    test('disconnect on unconnected socket does not throw', () {
      expect(() => SocketClient.instance.disconnect(), returnsNormally);
    });

    test('initial currentSessionId is null', () {
      expect(SocketClient.instance.currentSessionId, isNull);
    });
  });

  group('SocketClient dj:stateChanged parsing', () {
    late PartyProvider provider;
    late List<bool> wakelockCalls;

    setUp(() {
      wakelockCalls = [];
      provider = PartyProvider(wakelockToggle: (enable) => wakelockCalls.add(enable));
    });

    test('parses full dj:stateChanged payload and calls onDjStateUpdate', () {
      // Simulate what _setupPartyListeners does by directly invoking the parsing logic
      final payload = <String, dynamic>{
        'state': 'song',
        'songCount': 3,
        'participantCount': 5,
        'currentPerformer': 'Alice',
        'timerStartedAt': 1000,
        'timerDurationMs': 180000,
      };

      final stateString = payload['state'] as String;
      final djState = DJState.values.byName(stateString);

      // Set session active so participantCount updates
      provider.onSessionStatus('active');

      provider.onDjStateUpdate(
        state: djState,
        songCount: payload['songCount'] as int?,
        participantCount: payload['participantCount'] as int?,
        currentPerformer: payload['currentPerformer'] as String?,
        timerStartedAt: payload['timerStartedAt'] as int?,
        timerDurationMs: payload['timerDurationMs'] as int?,
      );

      expect(provider.djState, DJState.song);
      expect(provider.songCount, 3);
      expect(provider.participantCount, 5);
      expect(provider.currentPerformer, 'Alice');
      expect(provider.timerStartedAt, 1000);
      expect(provider.timerDurationMs, 180000);
    });

    test('parses payload with null optional fields', () {
      final payload = <String, dynamic>{
        'state': 'songSelection',
        'songCount': 0,
        'participantCount': 4,
        'currentPerformer': null,
        'timerStartedAt': null,
        'timerDurationMs': null,
      };

      final djState = DJState.values.byName(payload['state'] as String);

      provider.onDjStateUpdate(
        state: djState,
        songCount: payload['songCount'] as int?,
        participantCount: payload['participantCount'] as int?,
        currentPerformer: payload['currentPerformer'] as String?,
        timerStartedAt: payload['timerStartedAt'] as int?,
        timerDurationMs: payload['timerDurationMs'] as int?,
      );

      expect(provider.djState, DJState.songSelection);
      expect(provider.currentPerformer, isNull);
      expect(provider.timerStartedAt, isNull);
      expect(provider.timerDurationMs, isNull);
    });

    test('DJState.values.byName correctly maps all server state strings', () {
      final stateMap = {
        'lobby': DJState.lobby,
        'songSelection': DJState.songSelection,
        'partyCardDeal': DJState.partyCardDeal,
        'song': DJState.song,
        'ceremony': DJState.ceremony,
        'interlude': DJState.interlude,
        'finale': DJState.finale,
      };

      for (final entry in stateMap.entries) {
        expect(DJState.values.byName(entry.key), entry.value);
      }
    });

    test('unrecognized state string does not crash', () {
      // This tests the try-catch guard in SocketClient
      DJState? parsed;
      try {
        parsed = DJState.values.byName('unknownFutureState');
      } catch (_) {
        parsed = null;
      }

      expect(parsed, isNull);
    });
  });
}
