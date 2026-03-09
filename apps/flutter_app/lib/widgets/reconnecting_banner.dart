import 'package:flutter/material.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/theme/dj_tokens.dart';

class ReconnectingBanner extends StatelessWidget {
  const ReconnectingBanner({super.key});

  @override
  Widget build(BuildContext context) {
    return Positioned(
      top: 0,
      left: 0,
      right: 0,
      child: Container(
        key: const Key('reconnecting-banner'),
        padding: const EdgeInsets.symmetric(
          vertical: DJTokens.spaceSm,
          horizontal: DJTokens.spaceMd,
        ),
        color: DJTokens.surfaceColor.withValues(alpha: 0.95),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: DJTokens.textSecondary,
              ),
            ),
            const SizedBox(width: DJTokens.spaceSm),
            Text(
              Copy.reconnecting,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: DJTokens.textSecondary,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}
