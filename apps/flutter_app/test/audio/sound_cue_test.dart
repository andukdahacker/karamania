import 'package:flutter_test/flutter_test.dart';
import 'package:karamania/audio/sound_cue.dart';

void main() {
  group('SoundCue', () {
    test('assetPath converts camelCase to snake_case wav path', () {
      expect(SoundCue.songStart.assetPath, 'assets/sounds/song_start.wav');
      expect(
        SoundCue.ceremonyStart.assetPath,
        'assets/sounds/ceremony_start.wav',
      );
      expect(
        SoundCue.interludeStart.assetPath,
        'assets/sounds/interlude_start.wav',
      );
      expect(
        SoundCue.partyCardDeal.assetPath,
        'assets/sounds/party_card_deal.wav',
      );
      expect(SoundCue.pauseChime.assetPath, 'assets/sounds/pause_chime.wav');
      expect(
        SoundCue.resumeChime.assetPath,
        'assets/sounds/resume_chime.wav',
      );
      expect(
        SoundCue.partyJoined.assetPath,
        'assets/sounds/party_joined.wav',
      );
      expect(
        SoundCue.countdownTick.assetPath,
        'assets/sounds/countdown_tick.wav',
      );
      expect(SoundCue.errorBuzz.assetPath, 'assets/sounds/error_buzz.wav');
      expect(SoundCue.uiTap.assetPath, 'assets/sounds/ui_tap.wav');
    });

    test('defaultVolume returns correct values per cue type', () {
      expect(SoundCue.songStart.defaultVolume, 0.7);
      expect(SoundCue.ceremonyStart.defaultVolume, 1.0);
      expect(SoundCue.interludeStart.defaultVolume, 0.7);
      expect(SoundCue.partyCardDeal.defaultVolume, 0.7);
      expect(SoundCue.pauseChime.defaultVolume, 0.4);
      expect(SoundCue.resumeChime.defaultVolume, 0.7);
    });

    test('all cue values are present (17 total)', () {
      expect(SoundCue.values.length, 17);
    });

    test('finaleAwardReveal reuses ceremony_start asset', () {
      expect(
        SoundCue.finaleAwardReveal.assetPath,
        'assets/sounds/ceremony_start.wav',
      );
      expect(SoundCue.finaleAwardReveal.defaultVolume, 0.8);
    });

    test('soundboard cues generate correct asset paths', () {
      expect(SoundCue.sbAirHorn.assetPath, 'assets/sounds/sb_air_horn.wav');
      expect(SoundCue.sbCrowdCheer.assetPath, 'assets/sounds/sb_crowd_cheer.wav');
      expect(SoundCue.sbDrumRoll.assetPath, 'assets/sounds/sb_drum_roll.wav');
      expect(SoundCue.sbRecordScratch.assetPath, 'assets/sounds/sb_record_scratch.wav');
      expect(SoundCue.sbRimshot.assetPath, 'assets/sounds/sb_rimshot.wav');
      expect(SoundCue.sbWolfWhistle.assetPath, 'assets/sounds/sb_wolf_whistle.wav');
    });

    test('all soundboard cues have defaultVolume of 1.0', () {
      final soundboardCues = [
        SoundCue.sbAirHorn,
        SoundCue.sbCrowdCheer,
        SoundCue.sbDrumRoll,
        SoundCue.sbRecordScratch,
        SoundCue.sbRimshot,
        SoundCue.sbWolfWhistle,
      ];
      for (final cue in soundboardCues) {
        expect(cue.defaultVolume, 1.0, reason: '${cue.name} should have volume 1.0');
      }
    });
  });
}
