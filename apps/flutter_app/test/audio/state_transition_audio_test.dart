import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:karamania/audio/audio_engine.dart';
import 'package:karamania/audio/sound_cue.dart';
import 'package:karamania/audio/state_transition_audio.dart';
import 'package:karamania/theme/dj_theme.dart';

class MockAudioEngine extends Mock implements AudioEngine {}

void main() {
  late MockAudioEngine mockEngine;
  late StateTransitionAudio audio;

  setUpAll(() {
    registerFallbackValue(SoundCue.songStart);
  });

  setUp(() {
    mockEngine = MockAudioEngine();
    audio = StateTransitionAudio(mockEngine);
  });

  group('StateTransitionAudio state-to-cue mapping', () {
    test('DJState.song plays SoundCue.songStart', () {
      audio.onStateChanged(DJState.song);
      verify(() => mockEngine.play(SoundCue.songStart, volume: 0.7)).called(1);
    });

    test('DJState.ceremony plays SoundCue.ceremonyStart at participant volume', () {
      audio.onStateChanged(DJState.ceremony);
      verify(() => mockEngine.play(SoundCue.ceremonyStart, volume: 0.6))
          .called(1);
    });

    test('DJState.ceremony plays SoundCue.ceremonyStart at host volume', () {
      audio.onStateChanged(DJState.ceremony, isHost: true);
      verify(() => mockEngine.play(SoundCue.ceremonyStart, volume: 1.0))
          .called(1);
    });

    test('DJState.interlude plays SoundCue.interludeStart', () {
      audio.onStateChanged(DJState.interlude);
      verify(() => mockEngine.play(SoundCue.interludeStart, volume: 0.7))
          .called(1);
    });

    test('DJState.partyCardDeal plays SoundCue.partyCardDeal', () {
      audio.onStateChanged(DJState.partyCardDeal);
      verify(() => mockEngine.play(SoundCue.partyCardDeal, volume: 0.7))
          .called(1);
    });

    test('DJState.lobby plays no sound', () {
      audio.onStateChanged(DJState.lobby);
      verifyNever(() => mockEngine.play(any(), volume: any(named: 'volume')));
    });

    test('DJState.songSelection plays no sound', () {
      audio.onStateChanged(DJState.songSelection);
      verifyNever(() => mockEngine.play(any(), volume: any(named: 'volume')));
    });

    test('DJState.finale plays no sound', () {
      audio.onStateChanged(DJState.finale);
      verifyNever(() => mockEngine.play(any(), volume: any(named: 'volume')));
    });
  });

  group('StateTransitionAudio deduplication', () {
    test('duplicate state does not play cue again', () {
      audio.onStateChanged(DJState.song);
      audio.onStateChanged(DJState.song);
      verify(() => mockEngine.play(SoundCue.songStart, volume: 0.7)).called(1);
    });

    test('different states play different cues', () {
      audio.onStateChanged(DJState.song);
      audio.onStateChanged(DJState.ceremony);
      verify(() => mockEngine.play(SoundCue.songStart, volume: 0.7)).called(1);
      verify(() => mockEngine.play(SoundCue.ceremonyStart, volume: 0.6))
          .called(1);
    });
  });

  group('StateTransitionAudio isPaused guard', () {
    test('isPaused true suppresses cue', () {
      audio.onStateChanged(DJState.song, isPaused: true);
      verifyNever(() => mockEngine.play(any(), volume: any(named: 'volume')));
    });

    test('isPaused true does not update previousState', () {
      audio.onStateChanged(DJState.song, isPaused: true);
      // Same state without pause should play (wasn't recorded)
      audio.onStateChanged(DJState.song);
      verify(() => mockEngine.play(SoundCue.songStart, volume: 0.7)).called(1);
    });
  });

  group('StateTransitionAudio pause/resume chimes', () {
    test('onPause plays pauseChime', () {
      audio.onPause();
      verify(() => mockEngine.play(SoundCue.pauseChime, volume: 0.4))
          .called(1);
    });

    test('onResume plays resumeChime', () {
      audio.onResume();
      verify(() => mockEngine.play(SoundCue.resumeChime, volume: 0.7))
          .called(1);
    });
  });

  group('StateTransitionAudio reset', () {
    test('reset clears previousState allowing same state to trigger again', () {
      audio.onStateChanged(DJState.song);
      verify(() => mockEngine.play(SoundCue.songStart, volume: 0.7)).called(1);

      audio.reset();
      audio.onStateChanged(DJState.song);
      verify(() => mockEngine.play(SoundCue.songStart, volume: 0.7)).called(1);
    });
  });
}
