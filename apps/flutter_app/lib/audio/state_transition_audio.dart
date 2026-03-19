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
  void onStateChanged(DJState newState, {bool isPaused = false, bool isHost = false}) {
    if (isPaused) return;
    if (newState == _previousState) return;

    final cue = _cueForState(newState);
    if (cue != null) {
      // FR25: Host = full volume (dominant audio source), participants = 60% (spatial)
      final volume = (newState == DJState.ceremony && !isHost) ? 0.6 : cue.defaultVolume;
      _engine.play(cue, volume: volume);
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
        DJState.icebreaker => null,
        DJState.songSelection => null,
        DJState.finale => null,
      };
}
