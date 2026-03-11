import 'package:flutter/material.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/theme/dj_tokens.dart';

class BridgeMomentDisplay extends StatelessWidget {
  const BridgeMomentDisplay({super.key, this.currentPerformer});

  final String? currentPerformer;

  @override
  Widget build(BuildContext context) {
    if (currentPerformer != null) {
      return _buildPerformerHype(context);
    }
    return _buildGenericBridge(context);
  }

  Widget _buildPerformerHype(BuildContext context) {
    return Column(
      key: const Key('bridge-performer-hype'),
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.mic, size: 32, color: DJTokens.textSecondary),
        const SizedBox(height: DJTokens.spaceSm),
        Text(
          Copy.bridgeUpNext,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                color: DJTokens.textSecondary,
              ),
        ),
        const SizedBox(height: DJTokens.spaceSm),
        Text(
          currentPerformer!,
          key: const Key('bridge-performer-name'),
          style: Theme.of(context).textTheme.displayLarge?.copyWith(
                color: DJTokens.textPrimary,
              ),
        ),
        const SizedBox(height: DJTokens.spaceSm),
        Text(
          Copy.bridgeLetsGo,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                color: DJTokens.textSecondary,
              ),
        ),
      ],
    );
  }

  Widget _buildGenericBridge(BuildContext context) {
    return Column(
      key: const Key('bridge-generic'),
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          Copy.bridgeGetReady,
          style: Theme.of(context).textTheme.displayLarge?.copyWith(
                color: DJTokens.textPrimary,
              ),
        ),
        const SizedBox(height: DJTokens.spaceSm),
        Text(
          Copy.bridgeWhosNext,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                color: DJTokens.textSecondary,
              ),
        ),
      ],
    );
  }
}
