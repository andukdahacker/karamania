import 'package:flutter/material.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/constants/tap_tiers.dart';
import 'package:karamania/socket/client.dart';
import 'package:karamania/theme/dj_theme.dart';
import 'package:karamania/widgets/dj_tap_button.dart';

/// Row of vibe-specific emoji reaction buttons.
/// Tapping sends reaction via socket. Visual feedback dims when rate-limited.
class ReactionBar extends StatelessWidget {
  const ReactionBar({
    super.key,
    required this.vibe,
  });

  final PartyVibe vibe;

  @override
  Widget build(BuildContext context) {
    final emojis = vibeReactionButtons[vibe] ??
        vibeReactionButtons[PartyVibe.general]!;

    return Row(
      key: const Key('reaction-bar'),
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: emojis.map((emoji) {
        return DJTapButton(
          key: Key('reaction-emoji-$emoji'),
          tier: TapTier.social,
          onTap: () => SocketClient.instance.emitReaction(emoji),
          child: Text(
            emoji,
            style: const TextStyle(fontSize: 32),
          ),
        );
      }).toList(),
    );
  }
}
