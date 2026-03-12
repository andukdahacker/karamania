import 'package:karamania/audio/audio_engine.dart';
import 'package:karamania/audio/sound_cue.dart';
import 'package:karamania/theme/dj_theme.dart';

/// Maps DJ state transitions to sound cues and plays them via [AudioEngine].
///
/// Instantiated by [SocketClient] — not a singleton.
class StateTransitionAudio {
  StateTransitionAudio([AudioEngine? engine])
      : _engine = engine ?? AudioEngine.instance;

  final AudioEngine _engine;
  DJState? _previousState;

  /// Play a sound cue when the DJ state changes.
  /// No-op for duplicate states or when paused.
  void onStateChanged(DJState newState, {bool isPaused = false}) {
    if (isPaused) return;
    if (newState == _previousState) return;

    final cue = _cueForState(newState);
    if (cue != null) {
      _engine.play(cue, volume: cue.defaultVolume);
    }
    _previousState = newState;
  }

  /// Play pause chime.
  void onPause() {
    _engine.play(
      SoundCue.pauseChime,
      volume: SoundCue.pauseChime.defaultVolume,
    );
  }

  /// Play resume chime.
  void onResume() {
    _engine.play(
      SoundCue.resumeChime,
      volume: SoundCue.resumeChime.defaultVolume,
    );
  }

  /// Clear previous state so the same state can trigger a cue again.
  void reset() {
    _previousState = null;
  }

  SoundCue? _cueForState(DJState state) => switch (state) {
        DJState.song => SoundCue.songStart,
        DJState.ceremony => SoundCue.ceremonyStart,
        DJState.interlude => SoundCue.interludeStart,
        DJState.partyCardDeal => SoundCue.partyCardDeal,
        DJState.lobby => null,
        DJState.songSelection => null,
        DJState.finale => null,
      };
}
