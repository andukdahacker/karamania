import 'package:flutter_test/flutter_test.dart';
import 'package:karamania/audio/sound_cue.dart';

void main() {
  group('SoundCue', () {
    test('assetPath converts camelCase to snake_case opus path', () {
      expect(SoundCue.songStart.assetPath, 'assets/sounds/song_start.opus');
      expect(
        SoundCue.ceremonyStart.assetPath,
        'assets/sounds/ceremony_start.opus',
      );
      expect(
        SoundCue.interludeStart.assetPath,
        'assets/sounds/interlude_start.opus',
      );
      expect(
        SoundCue.partyCardDeal.assetPath,
        'assets/sounds/party_card_deal.opus',
      );
      expect(SoundCue.pauseChime.assetPath, 'assets/sounds/pause_chime.opus');
      expect(
        SoundCue.resumeChime.assetPath,
        'assets/sounds/resume_chime.opus',
      );
      expect(
        SoundCue.partyJoined.assetPath,
        'assets/sounds/party_joined.opus',
      );
      expect(
        SoundCue.countdownTick.assetPath,
        'assets/sounds/countdown_tick.opus',
      );
      expect(SoundCue.errorBuzz.assetPath, 'assets/sounds/error_buzz.opus');
      expect(SoundCue.uiTap.assetPath, 'assets/sounds/ui_tap.opus');
    });

    test('defaultVolume returns correct values per cue type', () {
      expect(SoundCue.songStart.defaultVolume, 0.7);
      expect(SoundCue.ceremonyStart.defaultVolume, 1.0);
      expect(SoundCue.interludeStart.defaultVolume, 0.7);
      expect(SoundCue.partyCardDeal.defaultVolume, 0.7);
      expect(SoundCue.pauseChime.defaultVolume, 0.4);
      expect(SoundCue.resumeChime.defaultVolume, 0.7);
    });

    test('all cue values are present (16 total)', () {
      expect(SoundCue.values.length, 16);
    });

    test('soundboard cues generate correct asset paths', () {
      expect(SoundCue.sbAirHorn.assetPath, 'assets/sounds/sb_air_horn.opus');
      expect(SoundCue.sbCrowdCheer.assetPath, 'assets/sounds/sb_crowd_cheer.opus');
      expect(SoundCue.sbDrumRoll.assetPath, 'assets/sounds/sb_drum_roll.opus');
      expect(SoundCue.sbRecordScratch.assetPath, 'assets/sounds/sb_record_scratch.opus');
      expect(SoundCue.sbRimshot.assetPath, 'assets/sounds/sb_rimshot.opus');
      expect(SoundCue.sbWolfWhistle.assetPath, 'assets/sounds/sb_wolf_whistle.opus');
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
