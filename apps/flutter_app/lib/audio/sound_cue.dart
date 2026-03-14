/// Sound cue identifiers with asset paths and default volume levels.
///
/// Each value maps to an `.opus` file in `assets/sounds/`.
enum SoundCue {
  songStart,
  ceremonyStart,
  interludeStart,
  partyCardDeal,
  pauseChime,
  resumeChime,
  partyJoined,
  countdownTick,
  errorBuzz,
  uiTap,
  // Soundboard effects (Story 4.3)
  sbAirHorn,
  sbCrowdCheer,
  sbDrumRoll,
  sbRecordScratch,
  sbRimshot,
  sbWolfWhistle;

  /// Asset path for this sound cue (snake_case conversion).
  String get assetPath {
    final snakeName = name.replaceAllMapped(
      RegExp(r'[A-Z]'),
      (m) => '_${m.group(0)!.toLowerCase()}',
    );
    return 'assets/sounds/$snakeName.opus';
  }

  /// Default volume for this cue type.
  double get defaultVolume => switch (this) {
        SoundCue.songStart => 0.7,
        SoundCue.ceremonyStart => 1.0,
        SoundCue.interludeStart => 0.7,
        SoundCue.partyCardDeal => 0.7,
        SoundCue.pauseChime => 0.4,
        SoundCue.resumeChime => 0.7,
        SoundCue.partyJoined => 0.7,
        SoundCue.countdownTick => 0.7,
        SoundCue.errorBuzz => 0.7,
        SoundCue.uiTap => 0.7,
        SoundCue.sbAirHorn => 1.0,
        SoundCue.sbCrowdCheer => 1.0,
        SoundCue.sbDrumRoll => 1.0,
        SoundCue.sbRecordScratch => 1.0,
        SoundCue.sbRimshot => 1.0,
        SoundCue.sbWolfWhistle => 1.0,
      };
}
