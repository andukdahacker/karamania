import 'package:flutter/material.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/theme/dj_tokens.dart';

class SpotifyGuide extends StatelessWidget {
  const SpotifyGuide({super.key = const Key('spotify-guide'), required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          Copy.spotifyGuideTitle,
          style: TextStyle(
            color: DJTokens.actionDanger,
            fontWeight: FontWeight.bold,
            fontSize: 14,
          ),
        ),
        const SizedBox(height: DJTokens.spaceSm),
        _buildStep('1', Copy.spotifyGuideStep1),
        const SizedBox(height: DJTokens.spaceXs),
        _buildStep('2', Copy.spotifyGuideStep2),
        const SizedBox(height: DJTokens.spaceXs),
        _buildStep('3', Copy.spotifyGuideStep3),
        const SizedBox(height: DJTokens.spaceMd),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            key: const Key('spotify-guide-retry-btn'),
            onPressed: onRetry,
            child: const Text(Copy.spotifyGuideRetry),
          ),
        ),
      ],
    );
  }

  Widget _buildStep(String number, String text) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 24,
          height: 24,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: DJTokens.surfaceColor,
            shape: BoxShape.circle,
            border: Border.all(color: DJTokens.textSecondary),
          ),
          child: Text(
            number,
            style: TextStyle(
              color: DJTokens.textPrimary,
              fontSize: 12,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
        const SizedBox(width: DJTokens.spaceSm),
        Expanded(
          child: Text(
            text,
            style: TextStyle(color: DJTokens.textPrimary, fontSize: 14),
          ),
        ),
      ],
    );
  }
}
