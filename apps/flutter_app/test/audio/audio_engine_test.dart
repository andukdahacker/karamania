import 'package:flutter_soloud/flutter_soloud.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:karamania/audio/audio_engine.dart';
import 'package:karamania/audio/sound_cue.dart';

class MockSoLoudWrapper extends Mock implements SoLoudWrapper {}

class MockAudioSource extends Mock implements AudioSource {}

void main() {
  late MockSoLoudWrapper mockSoloud;
  late AudioEngine engine;

  setUpAll(() {
    registerFallbackValue(MockAudioSource());
  });

  setUp(() {
    mockSoloud = MockSoLoudWrapper();
    engine = AudioEngine.forTesting(mockSoloud);
  });

  group('AudioEngine singleton', () {
    test('instance returns the same object', () {
      expect(identical(AudioEngine.instance, AudioEngine.instance), isTrue);
    });
  });

  group('AudioEngine.init', () {
    test('isInitialized is false before init', () {
      expect(engine.isInitialized, isFalse);
    });

    test('calls SoLoud init and sets initialized', () async {
      when(() => mockSoloud.init()).thenAnswer((_) async {});

      await engine.init();

      expect(engine.isInitialized, isTrue);
      verify(() => mockSoloud.init()).called(1);
    });

    test('is idempotent — second call is no-op', () async {
      when(() => mockSoloud.init()).thenAnswer((_) async {});

      await engine.init();
      await engine.init();

      verify(() => mockSoloud.init()).called(1);
    });

    test('failure keeps initialized false and does not throw', () async {
      when(() => mockSoloud.init()).thenThrow(Exception('native error'));

      await engine.init();

      expect(engine.isInitialized, isFalse);
    });
  });

  group('AudioEngine.preloadAll', () {
    test('loads all SoundCue values', () async {
      when(() => mockSoloud.init()).thenAnswer((_) async {});
      when(() => mockSoloud.loadAsset(any()))
          .thenAnswer((_) async => MockAudioSource());

      await engine.init();
      await engine.preloadAll();

      verify(() => mockSoloud.loadAsset(any()))
          .called(SoundCue.values.length);
    });

    test('individual load failure does not block other sounds', () async {
      when(() => mockSoloud.init()).thenAnswer((_) async {});

      var callCount = 0;
      when(() => mockSoloud.loadAsset(any())).thenAnswer((_) async {
        callCount++;
        if (callCount == 1) throw Exception('corrupt file');
        return MockAudioSource();
      });

      await engine.init();
      await engine.preloadAll();

      // All 10 values attempted despite first failure
      verify(() => mockSoloud.loadAsset(any()))
          .called(SoundCue.values.length);
    });
  });

  group('AudioEngine.play', () {
    test('when initialized calls SoLoud play with correct source and default volume', () async {
      final mockSource = MockAudioSource();
      when(() => mockSoloud.init()).thenAnswer((_) async {});
      when(() => mockSoloud.loadAsset(any()))
          .thenAnswer((_) async => mockSource);

      await engine.init();
      await engine.preloadAll();
      engine.play(SoundCue.songStart);

      verify(() => mockSoloud.play(mockSource, volume: 0.7)).called(1);
    });

    test('with custom volume overrides default', () async {
      final mockSource = MockAudioSource();
      when(() => mockSoloud.init()).thenAnswer((_) async {});
      when(() => mockSoloud.loadAsset(any()))
          .thenAnswer((_) async => mockSource);

      await engine.init();
      await engine.preloadAll();
      engine.play(SoundCue.songStart, volume: 0.3);

      verify(() => mockSoloud.play(mockSource, volume: 0.3)).called(1);
    });

    test('when NOT initialized is a no-op (no crash)', () {
      expect(() => engine.play(SoundCue.songStart), returnsNormally);
      verifyNever(() => mockSoloud.play(any(), volume: any(named: 'volume')));
    });

    test('with unloaded cue is a no-op', () async {
      when(() => mockSoloud.init()).thenAnswer((_) async {});

      await engine.init();
      // Don't preload — cues not in _loadedSounds
      engine.play(SoundCue.songStart);

      verifyNever(() => mockSoloud.play(any(), volume: any(named: 'volume')));
    });
  });

  group('AudioEngine.setGlobalVolume', () {
    test('clamps value above 1.0 to 1.0', () {
      engine.setGlobalVolume(1.5);
      verify(() => mockSoloud.setGlobalVolume(1.0)).called(1);
    });

    test('clamps value below 0.0 to 0.0', () {
      engine.setGlobalVolume(-0.3);
      verify(() => mockSoloud.setGlobalVolume(0.0)).called(1);
    });

    test('passes through value in valid range', () {
      engine.setGlobalVolume(0.7);
      verify(() => mockSoloud.setGlobalVolume(0.7)).called(1);
    });
  });

  group('AudioEngine.setRole', () {
    test('isHost: true sets volume to 1.0', () {
      engine.setRole(isHost: true);
      verify(() => mockSoloud.setGlobalVolume(1.0)).called(1);
    });

    test('isHost: false sets volume to 0.6', () {
      engine.setRole(isHost: false);
      verify(() => mockSoloud.setGlobalVolume(0.6)).called(1);
    });

    test('accessibilityEqualVolume overrides to 1.0 regardless of role', () {
      engine.setRole(isHost: false, accessibilityEqualVolume: true);
      verify(() => mockSoloud.setGlobalVolume(1.0)).called(1);
    });
  });

  group('AudioEngine.dispose', () {
    test('calls deinit, resets initialized, clears loaded sounds', () async {
      when(() => mockSoloud.init()).thenAnswer((_) async {});
      when(() => mockSoloud.loadAsset(any()))
          .thenAnswer((_) async => MockAudioSource());

      await engine.init();
      await engine.preloadAll();
      expect(engine.isInitialized, isTrue);

      await engine.dispose();

      expect(engine.isInitialized, isFalse);
      verify(() => mockSoloud.deinit()).called(1);

      // After dispose, play is a no-op (not initialized)
      engine.play(SoundCue.songStart);
      verifyNever(() => mockSoloud.play(any(), volume: any(named: 'volume')));
    });

    test('on uninitialized engine is a no-op', () async {
      await engine.dispose();
      verifyNever(() => mockSoloud.deinit());
    });
  });
}
