import 'dart:developer' as developer;

import 'package:flutter/foundation.dart';
import 'package:flutter_soloud/flutter_soloud.dart';
import 'package:karamania/audio/sound_cue.dart';

/// Thin wrapper around [SoLoud] for testability.
///
/// Production code uses [DefaultSoLoudWrapper]. Tests inject a mock.
abstract class SoLoudWrapper {
  Future<void> init();
  void deinit();
  Future<AudioSource> loadAsset(String path);
  void play(AudioSource source, {double volume = 1.0});
  void setGlobalVolume(double volume);
}

/// Default production implementation delegating to [SoLoud.instance].
class DefaultSoLoudWrapper implements SoLoudWrapper {
  @override
  Future<void> init() => SoLoud.instance.init();
  @override
  void deinit() => SoLoud.instance.deinit();
  @override
  Future<AudioSource> loadAsset(String path) =>
      SoLoud.instance.loadAsset(path);
  @override
  void play(AudioSource source, {double volume = 1.0}) =>
      SoLoud.instance.play(source, volume: volume);
  @override
  void setGlobalVolume(double volume) =>
      SoLoud.instance.setGlobalVolume(volume);
}

/// Singleton wrapper around SoLoud for fire-and-forget audio playback.
///
/// Graceful degradation: init/play failures are logged, never crash the app.
class AudioEngine {
  AudioEngine._([SoLoudWrapper? wrapper])
      : _soloud = wrapper ?? DefaultSoLoudWrapper();
  static final AudioEngine instance = AudioEngine._();

  /// Create a testable instance with a mock SoLoud wrapper.
  @visibleForTesting
  AudioEngine.forTesting(SoLoudWrapper wrapper) : _soloud = wrapper;

  final SoLoudWrapper _soloud;
  bool _initialized = false;
  final Map<String, AudioSource> _loadedSounds = {};

  /// Whether the engine has been successfully initialized.
  bool get isInitialized => _initialized;

  /// Initialize the SoLoud engine. Idempotent — safe to call multiple times.
  Future<void> init() async {
    if (_initialized) return;
    try {
      await _soloud.init();
      _initialized = true;
    } catch (e) {
      developer.log('AudioEngine init failed: $e', name: 'AudioEngine');
    }
  }

  /// Preload all sound cues for instant playback. Individual failures are
  /// logged but do not block other sounds from loading.
  Future<void> preloadAll() async {
    for (final cue in SoundCue.values) {
      await _loadSound(cue);
    }
  }

  Future<void> _loadSound(SoundCue cue) async {
    try {
      final source = await _soloud.loadAsset(cue.assetPath);
      _loadedSounds[cue.name] = source;
    } catch (e) {
      developer.log(
        'Failed to load ${cue.name}: $e',
        name: 'AudioEngine',
      );
    }
  }

  /// Fire-and-forget sound playback. No-op if not initialized or cue not loaded.
  void play(SoundCue cue, {double? volume}) {
    if (!_initialized) return;
    final source = _loadedSounds[cue.name];
    if (source == null) {
      developer.log(
        'Sound not loaded: ${cue.name}',
        name: 'AudioEngine',
      );
      return;
    }
    _soloud.play(source, volume: volume ?? cue.defaultVolume);
  }

  /// Set global volume (clamped to 0.0–1.0).
  void setGlobalVolume(double volume) {
    _soloud.setGlobalVolume(volume.clamp(0.0, 1.0));
  }

  /// Configure volume based on role. Accessibility equal-volume overrides role.
  void setRole({required bool isHost, bool accessibilityEqualVolume = false}) {
    if (accessibilityEqualVolume) {
      setGlobalVolume(1.0);
    } else if (isHost) {
      setGlobalVolume(1.0);
    } else {
      setGlobalVolume(0.6);
    }
  }

  /// Tear down the SoLoud engine.
  Future<void> dispose() async {
    if (!_initialized) return;
    try {
      _soloud.deinit();
      _initialized = false;
      _loadedSounds.clear();
    } catch (e) {
      developer.log('AudioEngine dispose failed: $e', name: 'AudioEngine');
    }
  }
}
