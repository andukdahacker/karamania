import 'package:flutter/material.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/constants/tap_tiers.dart';
import 'package:karamania/socket/client.dart';
import 'package:karamania/theme/dj_tokens.dart';
import 'package:karamania/widgets/dj_tap_button.dart';

class SongOverButton extends StatelessWidget {
  const SongOverButton({super.key});

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: Copy.hostSongOverHint,
      child: DJTapButton(
        key: const Key('song-over-button'),
        tier: TapTier.consequential,
        focusAccentColor: DJTokens.actionDanger,
        onTap: () => SocketClient.instance.emitHostSongOver(),
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: DJTokens.spaceLg,
            vertical: DJTokens.spaceMd,
          ),
          decoration: BoxDecoration(
            color: DJTokens.actionDanger.withValues(alpha: 0.2),
            borderRadius: BorderRadius.circular(DJTokens.spaceSm),
            border: Border.all(color: DJTokens.actionDanger, width: 2),
          ),
          child: const Text(
            Copy.hostSongOverLabel,
            style: TextStyle(
              color: DJTokens.textPrimary,
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
      ),
    );
  }
}
