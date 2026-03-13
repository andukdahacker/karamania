import 'package:flutter/material.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/theme/dj_theme.dart';
import 'package:karamania/theme/dj_tokens.dart';

/// Shareable moment card rendered at 9:16 aspect ratio.
/// Content: performer name, song title (when available), award, vibe styling.
class MomentCard extends StatelessWidget {
  const MomentCard({
    super.key,
    required this.award,
    required this.vibe,
    this.performerName,
    this.songTitle,
  });

  final String award;
  final PartyVibe vibe;
  final String? performerName;
  final String? songTitle;

  @override
  Widget build(BuildContext context) {
    return AspectRatio(
      aspectRatio: 9 / 16,
      child: Container(
        key: const Key('moment-card'),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              vibe.bg,
              vibe.bg.withValues(alpha: 0.8),
              DJTokens.bgColor,
            ],
          ),
          borderRadius: BorderRadius.circular(DJTokens.spaceMd),
        ),
        padding: const EdgeInsets.symmetric(
          horizontal: DJTokens.spaceXl,
          vertical: DJTokens.spaceXl,
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Spacer(flex: 2),
            // Confetti emojis
            Text(
              (vibeConfettiEmojis[vibe] ?? vibeConfettiEmojis[PartyVibe.general]!).join(' '),
              style: const TextStyle(fontSize: DJTokens.iconSizeLg),
            ),
            const SizedBox(height: DJTokens.spaceLg),
            // Performer name
            if (performerName != null) ...[
              Text(
                performerName!,
                key: const Key('moment-card-performer'),
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      color: DJTokens.textSecondary,
                    ),
              ),
              const SizedBox(height: DJTokens.spaceSm),
            ],
            // Award title — star of the card
            Text(
              award,
              key: const Key('moment-card-award'),
              textAlign: TextAlign.center,
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.displayLarge?.copyWith(
                    color: vibe.accent,
                    fontWeight: FontWeight.bold,
                  ),
            ),
            const SizedBox(height: DJTokens.spaceMd),
            // Vibe flavor text
            Text(
              vibeAwardFlavors[vibe] ?? '',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: DJTokens.textSecondary,
                  ),
            ),
            // Song title (when available — Epic 5)
            if (songTitle != null) ...[
              const SizedBox(height: DJTokens.spaceMd),
              Text(
                songTitle!,
                key: const Key('moment-card-song'),
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      color: DJTokens.textSecondary,
                      fontStyle: FontStyle.italic,
                    ),
              ),
            ],
            const Spacer(flex: 3),
            // Karamania branding — visible but not dominant
            Text(
              Copy.appTitle,
              key: const Key('moment-card-branding'),
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: DJTokens.textSecondary.withValues(alpha: 0.5),
                    letterSpacing: 4,
                  ),
            ),
            const SizedBox(height: DJTokens.spaceSm),
          ],
        ),
      ),
    );
  }
}
