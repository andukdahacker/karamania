import 'package:flutter/material.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/socket/client.dart';
import 'package:karamania/theme/dj_tokens.dart';

class SongModeToggle extends StatelessWidget {
  const SongModeToggle({
    super.key,
    required this.currentMode,
  });

  final String currentMode;

  @override
  Widget build(BuildContext context) {
    return Container(
      key: const Key('song-mode-toggle'),
      padding: const EdgeInsets.symmetric(horizontal: DJTokens.spaceSm),
      child: SegmentedButton<String>(
        segments: const [
          ButtonSegment<String>(
            value: 'quickPick',
            label: Text(Copy.modeQuickPick),
            icon: Icon(Icons.thumbs_up_down, size: 16),
          ),
          ButtonSegment<String>(
            value: 'spinWheel',
            label: Text(Copy.modeSpinWheel),
            icon: Icon(Icons.rotate_right, size: 16),
          ),
        ],
        selected: {currentMode},
        onSelectionChanged: (selection) {
          final mode = selection.first;
          SocketClient.instance.emitModeChange(mode);
        },
        style: ButtonStyle(
          backgroundColor: WidgetStateProperty.resolveWith<Color>((states) {
            if (states.contains(WidgetState.selected)) {
              return DJTokens.actionConfirm.withValues(alpha: 0.3);
            }
            return DJTokens.surfaceElevated;
          }),
          foregroundColor: WidgetStateProperty.resolveWith<Color>((states) {
            if (states.contains(WidgetState.selected)) {
              return DJTokens.textPrimary;
            }
            return DJTokens.textSecondary;
          }),
        ),
      ),
    );
  }
}
