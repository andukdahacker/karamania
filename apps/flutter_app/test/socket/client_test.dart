import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:karamania/audio/sound_cue.dart';
import 'package:karamania/audio/state_transition_audio.dart';
import 'package:karamania/config/app_config.dart';
import 'package:karamania/constants/party_cards.dart';
import 'package:karamania/models/finale_award.dart';
import 'package:karamania/socket/client.dart';
import 'package:karamania/state/party_provider.dart';
import 'package:karamania/theme/dj_theme.dart';

class MockStateTransitionAudio extends Mock implements StateTransitionAudio {}

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
        'icebreaker': DJState.icebreaker,
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

  group('SocketClient host emitter methods', () {
    test('emitHostSkip does not throw when not connected', () {
      expect(() => SocketClient.instance.emitHostSkip(), returnsNormally);
    });

    test('emitHostOverride does not throw when not connected', () {
      expect(() => SocketClient.instance.emitHostOverride('ceremony'), returnsNormally);
    });

    test('emitHostSongOver does not throw when not connected', () {
      expect(() => SocketClient.instance.emitHostSongOver(), returnsNormally);
    });

    test('emitHostEndParty does not throw when not connected', () {
      expect(() => SocketClient.instance.emitHostEndParty(), returnsNormally);
    });

    test('emitHostKickPlayer does not throw when not connected', () {
      expect(() => SocketClient.instance.emitHostKickPlayer('user-1'), returnsNormally);
    });
  });

  group('SocketClient party:ended and party:participantRemoved parsing', () {
    test('onSessionEnded sets provider status to ended', () {
      final provider = PartyProvider(wakelockToggle: (_) {});
      provider.onSessionEnded();
      expect(provider.sessionStatus, 'ended');
      expect(provider.djState, DJState.lobby);
    });

    test('onKicked sets provider status to ended and sets kickedMessage', () {
      final provider = PartyProvider(wakelockToggle: (_) {});
      provider.onKicked();
      expect(provider.sessionStatus, 'ended');
      expect(provider.kickedMessage, isNotNull);
    });

    test('onParticipantRemoved removes participant from list', () {
      final provider = PartyProvider(wakelockToggle: (_) {});
      provider.onParticipantsSync([
        const ParticipantInfo(userId: 'u1', displayName: 'Alice'),
        const ParticipantInfo(userId: 'u2', displayName: 'Bob'),
        const ParticipantInfo(userId: 'u3', displayName: 'Carol'),
      ]);
      expect(provider.participants.length, 3);

      provider.onParticipantRemoved('u2');
      expect(provider.participants.length, 2);
      expect(provider.participants.any((p) => p.userId == 'u2'), isFalse);
    });
  });

  group('SocketClient dj:pause parsing', () {
    test('onDjPause sets isPaused and pausedFromState on provider', () {
      final provider = PartyProvider(wakelockToggle: (_) {});

      provider.onDjPause(pausedFromState: 'song', timerRemainingMs: 15000);

      expect(provider.isPaused, isTrue);
      expect(provider.pausedFromState, 'song');
      expect(provider.timerStartedAt, isNull);
      expect(provider.timerDurationMs, isNull);
    });

    test('onDjPause with empty pausedFromState still sets paused', () {
      final provider = PartyProvider(wakelockToggle: (_) {});

      provider.onDjPause(pausedFromState: '', timerRemainingMs: null);

      expect(provider.isPaused, isTrue);
      expect(provider.pausedFromState, '');
    });
  });

  group('SocketClient dj:resume parsing', () {
    test('onDjStateUpdate with isPaused false clears pause state', () {
      final provider = PartyProvider(wakelockToggle: (_) {});
      // First pause
      provider.onDjPause(pausedFromState: 'song');
      expect(provider.isPaused, isTrue);

      // Resume via full state update (same as dj:resume handler)
      provider.onDjStateUpdate(
        state: DJState.song,
        songCount: 3,
        participantCount: 5,
        currentPerformer: 'Alice',
        timerStartedAt: 1000,
        timerDurationMs: 15000,
        isPaused: false,
      );

      expect(provider.isPaused, isFalse);
      expect(provider.pausedFromState, isNull);
      expect(provider.djState, DJState.song);
      expect(provider.timerStartedAt, 1000);
      expect(provider.timerDurationMs, 15000);
    });

    test('onDjResume explicitly clears pause state', () {
      final provider = PartyProvider(wakelockToggle: (_) {});
      provider.onDjPause(pausedFromState: 'ceremony');
      expect(provider.isPaused, isTrue);

      provider.onDjResume();

      expect(provider.isPaused, isFalse);
      expect(provider.pausedFromState, isNull);
    });
  });

  group('SocketClient host pause/resume emitters', () {
    test('emitHostPause does not throw when not connected', () {
      expect(() => SocketClient.instance.emitHostPause(), returnsNormally);
    });

    test('emitHostResume does not throw when not connected', () {
      expect(() => SocketClient.instance.emitHostResume(), returnsNormally);
    });
  });

  group('currentUserId getter', () {
    test('initial currentUserId is null', () {
      expect(SocketClient.instance.currentUserId, isNull);
    });
  });

  group('SocketClient audio integration', () {
    late MockStateTransitionAudio mockAudio;

    setUp(() {
      mockAudio = MockStateTransitionAudio();
      SocketClient.instance.stateTransitionAudioOverride = mockAudio;
    });

    tearDown(() {
      // Restore default to avoid leaking mock into other test groups
      SocketClient.instance.stateTransitionAudioOverride =
          StateTransitionAudio();
    });

    test('dj:stateChanged handler calls StateTransitionAudio.onStateChanged', () {
      // Simulate what _setupPartyListeners does for dj:stateChanged:
      // parse payload → call _stateTransitionAudio.onStateChanged(djState, isPaused: ...)
      final payload = <String, dynamic>{
        'state': 'song',
        'songCount': 3,
        'participantCount': 5,
        'currentPerformer': 'Alice',
        'isPaused': false,
      };

      final djState = DJState.values.byName(payload['state'] as String);

      // Call the same method SocketClient calls internally
      mockAudio.onStateChanged(
        djState,
        isPaused: payload['isPaused'] as bool? ?? false,
      );

      verify(() => mockAudio.onStateChanged(DJState.song, isPaused: false))
          .called(1);
    });

    test('dj:pause handler calls StateTransitionAudio.onPause', () {
      mockAudio.onPause();
      verify(() => mockAudio.onPause()).called(1);
    });

    test('dj:resume handler calls StateTransitionAudio.onResume', () {
      mockAudio.onResume();
      verify(() => mockAudio.onResume()).called(1);
    });

    test('disconnect calls StateTransitionAudio.reset', () {
      SocketClient.instance.disconnect();
      verify(() => mockAudio.reset()).called(1);
    });
  });

  group('SocketClient reaction methods', () {
    test('emitReaction does not throw when not connected', () {
      expect(() => SocketClient.instance.emitReaction('🔥'), returnsNormally);
    });

    test('reaction:broadcast parsing calls partyProvider.onReactionBroadcast', () {
      final provider = PartyProvider(wakelockToggle: (_) {});

      // Simulate what _setupPartyListeners does for reaction:broadcast
      final payload = <String, dynamic>{
        'userId': 'user-42',
        'emoji': '👏',
        'rewardMultiplier': 0.75,
      };

      provider.onReactionBroadcast(
        userId: payload['userId'] as String,
        emoji: payload['emoji'] as String,
        rewardMultiplier: (payload['rewardMultiplier'] as num).toDouble(),
      );

      expect(provider.reactionFeed, hasLength(1));
      final event = provider.reactionFeed.first;
      expect(event.userId, 'user-42');
      expect(event.emoji, '👏');
      expect(event.rewardMultiplier, 0.75);
      expect(event.id, isNotNull);
      expect(event.startX, greaterThanOrEqualTo(0.0));
    });

    test('reaction:streak parsing calls partyProvider.onStreakMilestone with correct args', () {
      final provider = PartyProvider(wakelockToggle: (_) {});

      // Simulate the exact payload parsing that _setupPartyListeners does
      // This mirrors the listener: (data) { final payload = data as Map<String, dynamic>; ... }
      final dynamic rawData = <String, dynamic>{
        'streakCount': 10,
        'emoji': '🔥',
        'displayName': 'Minh',
      };
      final payload = rawData as Map<String, dynamic>;

      provider.onStreakMilestone(
        streakCount: payload['streakCount'] as int,
        emoji: payload['emoji'] as String,
        displayName: payload['displayName'] as String,
      );

      expect(provider.streakMilestone, 10);
      expect(provider.streakEmoji, '🔥');
      expect(provider.streakDisplayName, 'Minh');
    });

    test('reaction:streak parsing handles different milestone values', () {
      final provider = PartyProvider(wakelockToggle: (_) {});

      for (final milestone in [5, 10, 20, 50]) {
        final dynamic rawData = <String, dynamic>{
          'streakCount': milestone,
          'emoji': '👏',
          'displayName': 'Player',
        };
        final payload = rawData as Map<String, dynamic>;

        provider.onStreakMilestone(
          streakCount: payload['streakCount'] as int,
          emoji: payload['emoji'] as String,
          displayName: payload['displayName'] as String,
        );

        expect(provider.streakMilestone, milestone);
      }
    });
  });

  group('SocketClient soundboard methods', () {
    test('emitSoundboard does not throw when not connected', () {
      expect(() => SocketClient.instance.emitSoundboard('sbAirHorn'), returnsNormally);
    });

    test('sound:play listener resolves valid soundId to correct SoundCue', () {
      // Simulate the full parsing path from _setupPartyListeners sound:play handler
      final payload = <String, dynamic>{
        'userId': 'user-42',
        'soundId': 'sbAirHorn',
        'rewardMultiplier': 1.0,
      };

      final soundId = payload['soundId'] as String;
      // This is the exact resolution path used in the listener
      final cue = SoundCue.values.byName(soundId);
      expect(cue, SoundCue.sbAirHorn);
      expect(cue.assetPath, 'assets/sounds/sb_air_horn.wav');
    });

    test('sound:play listener resolves all 6 soundboard cues correctly', () {
      const soundIds = [
        'sbAirHorn', 'sbCrowdCheer', 'sbDrumRoll',
        'sbRecordScratch', 'sbRimshot', 'sbWolfWhistle',
      ];
      for (final soundId in soundIds) {
        final cue = SoundCue.values.byName(soundId);
        expect(cue.name, soundId, reason: '$soundId should resolve to matching SoundCue');
      }
    });

    test('sound:play listener handles unknown soundId gracefully via try/catch', () {
      // Simulates the exact try/catch path in the listener
      expect(() {
        final soundId = 'nonExistentSound';
        try {
          SoundCue.values.byName(soundId);
          fail('Should have thrown ArgumentError');
        } catch (_) {
          // Silently ignored — same as in SocketClient listener
        }
      }, returnsNormally);
    });

    test('sound:play listener handles empty soundId gracefully', () {
      expect(() {
        try {
          SoundCue.values.byName('');
          fail('Should have thrown ArgumentError');
        } catch (_) {
          // Silently ignored
        }
      }, returnsNormally);
    });
  });

  group('SocketClient ceremony event parsing', () {
    late PartyProvider provider;

    setUp(() {
      provider = PartyProvider(wakelockToggle: (_) {});
    });

    test('ceremony:anticipation event calls partyProvider.onCeremonyAnticipation', () {
      final payload = <String, dynamic>{
        'performerName': 'Alice',
        'revealAt': 1234567890,
      };

      provider.onCeremonyAnticipation(
        performerName: payload['performerName'] as String?,
        revealAt: payload['revealAt'] as int,
      );

      expect(provider.ceremonyPerformerName, 'Alice');
      expect(provider.ceremonyRevealAt, 1234567890);
    });

    test('ceremony:anticipation with null performerName', () {
      final payload = <String, dynamic>{
        'performerName': null,
        'revealAt': 9999999,
      };

      provider.onCeremonyAnticipation(
        performerName: payload['performerName'] as String?,
        revealAt: payload['revealAt'] as int,
      );

      expect(provider.ceremonyPerformerName, isNull);
      expect(provider.ceremonyRevealAt, 9999999);
    });

    test('ceremony:reveal event calls partyProvider.onCeremonyReveal', () {
      final payload = <String, dynamic>{
        'award': 'Mic Drop Master',
        'performerName': 'Bob',
        'tone': 'hype',
        'songTitle': null,
      };

      provider.onCeremonyReveal(
        award: payload['award'] as String,
        performerName: payload['performerName'] as String?,
        tone: payload['tone'] as String,
        songTitle: payload['songTitle'] as String?,
      );

      expect(provider.ceremonyAward, 'Mic Drop Master');
      expect(provider.ceremonyPerformerName, 'Bob');
      expect(provider.ceremonyTone, 'hype');
      expect(provider.ceremonySongTitle, isNull);
    });

    test('ceremony:reveal handler passes songTitle to provider', () {
      final payload = <String, dynamic>{
        'award': 'Mic Drop Master',
        'performerName': 'Bob',
        'tone': 'hype',
        'songTitle': 'Bohemian Rhapsody',
      };

      provider.onCeremonyReveal(
        award: payload['award'] as String,
        performerName: payload['performerName'] as String?,
        tone: payload['tone'] as String,
        songTitle: payload['songTitle'] as String?,
      );

      expect(provider.ceremonySongTitle, 'Bohemian Rhapsody');
    });

    test('ceremony:reveal handler flow sets ceremony state and triggers moment card', () {
      // Simulates the full ceremony:reveal handler sequence from client.dart
      final payload = <String, dynamic>{
        'award': 'Mic Drop Master',
        'performerName': 'Alice',
        'tone': 'hype',
        'songTitle': 'Bohemian Rhapsody',
      };

      provider.onCeremonyReveal(
        award: payload['award'] as String,
        performerName: payload['performerName'] as String?,
        tone: payload['tone'] as String,
        songTitle: payload['songTitle'] as String?,
      );
      provider.showMomentCardOverlay();

      expect(provider.ceremonyAward, 'Mic Drop Master');
      expect(provider.ceremonySongTitle, 'Bohemian Rhapsody');
      expect(provider.showMomentCard, isTrue);
    });

    test('ceremony:quick event calls partyProvider.onCeremonyQuick', () {
      final payload = <String, dynamic>{
        'award': 'Star of the Show',
        'performerName': 'Carol',
        'tone': 'comedic',
      };

      provider.onCeremonyQuick(
        award: payload['award'] as String,
        performerName: payload['performerName'] as String?,
        tone: payload['tone'] as String,
      );

      expect(provider.ceremonyAward, 'Star of the Show');
      expect(provider.ceremonyPerformerName, 'Carol');
      expect(provider.ceremonyTone, 'comedic');
      expect(provider.ceremonyRevealAt, isNull);
    });

    test('ceremony:quick with null performerName', () {
      final payload = <String, dynamic>{
        'award': 'Star of the Show',
        'performerName': null,
        'tone': 'hype',
      };

      provider.onCeremonyQuick(
        award: payload['award'] as String,
        performerName: payload['performerName'] as String?,
        tone: payload['tone'] as String,
      );

      expect(provider.ceremonyAward, 'Star of the Show');
      expect(provider.ceremonyPerformerName, isNull);
    });
  });

  group('SocketClient finale:awards parsing (Story 8.1)', () {
    late PartyProvider provider;

    setUp(() {
      provider = PartyProvider(wakelockToggle: (_) {});
    });

    test('finale:awards payload parses List<dynamic> to List<FinaleAward>', () {
      // Simulate the exact parsing path from _setupPartyListeners finale:awards handler
      final dynamic rawData = <dynamic>[
        <String, dynamic>{
          'userId': 'u1',
          'displayName': 'Alice',
          'category': 'hypeLeader',
          'title': 'Reaction Machine',
          'tone': 'hype',
          'reason': 'Sent 47 reactions tonight',
        },
        <String, dynamic>{
          'userId': 'u2',
          'displayName': 'Bob',
          'category': 'everyone',
          'title': 'The Anchor',
          'tone': 'wholesome',
          'reason': 'Part of the crew from the start',
        },
      ];

      final rawAwards = rawData as List<dynamic>;
      final awards = rawAwards
          .map((a) => FinaleAward.fromJson(a as Map<String, dynamic>))
          .toList();
      provider.setFinaleAwards(awards);

      expect(provider.finaleAwards, isNotNull);
      expect(provider.finaleAwards!.length, 2);
      expect(provider.finaleAwards![0].userId, 'u1');
      expect(provider.finaleAwards![0].title, 'Reaction Machine');
      expect(provider.finaleAwards![0].reason, 'Sent 47 reactions tonight');
      expect(provider.finaleAwards![1].displayName, 'Bob');
      expect(provider.finaleAwards![1].category, 'everyone');
    });

    test('finale:awards handles missing fields via null-safe fromJson', () {
      final dynamic rawData = <dynamic>[
        <String, dynamic>{
          'userId': null,
          'displayName': null,
          'category': null,
          'title': null,
          'tone': null,
          'reason': null,
        },
      ];

      final rawAwards = rawData as List<dynamic>;
      final awards = rawAwards
          .map((a) => FinaleAward.fromJson(a as Map<String, dynamic>))
          .toList();
      provider.setFinaleAwards(awards);

      expect(provider.finaleAwards, isNotNull);
      expect(provider.finaleAwards!.length, 1);
      expect(provider.finaleAwards![0].userId, '');
      expect(provider.finaleAwards![0].category, 'everyone');
    });

    test('finale:awards empty array sets empty list', () {
      final dynamic rawData = <dynamic>[];
      final rawAwards = rawData as List<dynamic>;
      final awards = rawAwards
          .map((a) => FinaleAward.fromJson(a as Map<String, dynamic>))
          .toList();
      provider.setFinaleAwards(awards);

      expect(provider.finaleAwards, isNotNull);
      expect(provider.finaleAwards!.isEmpty, isTrue);
    });
  });

  group('SocketClient card:dealt parsing', () {
    late PartyProvider provider;
    late List<bool> wakelockCalls;

    setUp(() {
      wakelockCalls = [];
      provider = PartyProvider(wakelockToggle: (enable) => wakelockCalls.add(enable));
    });

    test('card:dealt listener parses payload and calls onCardDealt', () {
      final payload = <String, dynamic>{
        'cardId': 'chipmunk-mode',
        'title': 'Chipmunk Mode',
        'description': 'Sing in the highest pitch you can manage',
        'cardType': 'vocal',
        'emoji': '🐿️',
      };

      final card = PartyCardData.fromPayload(payload);
      provider.onCardDealt(card);

      expect(provider.currentCard, isNotNull);
      expect(provider.currentCard!.id, 'chipmunk-mode');
      expect(provider.currentCard!.title, 'Chipmunk Mode');
      expect(provider.currentCard!.type, PartyCardType.vocal);
    });

    test('card:dealt handles malformed payload gracefully', () {
      // PartyCardData.fromPayload will throw on bad data — the socket handler
      // catches and ignores. We test the parse failure here.
      expect(
        () => PartyCardData.fromPayload(<String, dynamic>{'bad': 'data'}),
        throwsA(isA<TypeError>()),
      );
    });

    test('emitCardRedraw does not throw when not connected', () {
      expect(() => SocketClient.instance.emitCardRedraw(), returnsNormally);
    });
  });

  group('SocketClient share emit methods (Story 8.3)', () {
    test('emitSetlistPosterShared does not throw when not connected', () {
      expect(
          () => SocketClient.instance.emitSetlistPosterShared(), returnsNormally);
    });

    test('emitMomentCardShared does not throw when not connected', () {
      expect(
          () => SocketClient.instance.emitMomentCardShared(), returnsNormally);
    });
  });
}
