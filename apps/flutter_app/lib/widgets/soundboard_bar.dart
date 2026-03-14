import 'package:flutter/material.dart';
import 'package:karamania/audio/audio_engine.dart';
import 'package:karamania/audio/sound_cue.dart';
import 'package:karamania/constants/soundboard_config.dart';
import 'package:karamania/socket/client.dart';
import 'package:karamania/widgets/dj_tap_button.dart';
import 'package:karamania/constants/tap_tiers.dart';

/// Horizontal row of soundboard effect buttons.
/// Only shown during DJState.song.
class SoundboardBar extends StatelessWidget {
  const SoundboardBar({super.key});

  @override
  Widget build(BuildContext context) {
    return Row(
      key: const Key('soundboard-bar'),
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: soundboardButtons.map((button) {
        return DJTapButton(
          key: Key('soundboard-${button.soundId}'),
          tier: TapTier.social,
          onTap: () {
            // Play locally IMMEDIATELY for 50ms latency (NFR3)
            try {
              final cue = SoundCue.values.byName(button.soundId);
              AudioEngine.instance.play(cue);
            } catch (_) {}
            // Emit to server for broadcast to others + scoring
            SocketClient.instance.emitSoundboard(button.soundId);
          },
          child: Text(
            button.emoji,
            style: const TextStyle(fontSize: 24),
          ),
        );
      }).toList(),
    );
  }
}
