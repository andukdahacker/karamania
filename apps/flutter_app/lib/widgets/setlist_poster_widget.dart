import 'package:flutter/material.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/models/setlist_entry.dart';
import 'package:karamania/theme/dj_theme.dart';
import 'package:karamania/theme/dj_tokens.dart';

const _monthNames = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/// Concert-poster-style setlist rendered at 9:16 aspect ratio.
/// Pure display widget — receives all data via constructor.
class SetlistPosterWidget extends StatelessWidget {
  const SetlistPosterWidget({
    super.key,
    required this.setlist,
    required this.vibe,
    this.venueName,
    required this.date,
  });

  final List<SetlistEntry> setlist;
  final PartyVibe vibe;
  final String? venueName;
  final DateTime date;

  String get _formattedDate {
    final month = _monthNames[date.month - 1];
    final day = date.day.toString().padLeft(2, '0');
    return '$month $day, ${date.year}';
  }

  double _baseFontScale(int songCount) {
    if (songCount <= 8) return 1.0;
    if (songCount <= 12) return 0.85;
    return 0.7;
  }

  @override
  Widget build(BuildContext context) {
    final scale = _baseFontScale(setlist.length);

    return AspectRatio(
      aspectRatio: 9 / 16,
      child: Container(
        key: const Key('setlist-poster'),
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
        padding: EdgeInsets.symmetric(
          horizontal: DJTokens.spaceXl,
          vertical: DJTokens.spaceLg * scale,
        ),
        child: Column(
          children: [
            // Header: branding + date
            Text(
              Copy.finaleSetlistTitle,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: DJTokens.textSecondary.withValues(alpha: 0.7),
                    letterSpacing: 6,
                    fontSize: 14 * scale,
                  ),
            ),
            SizedBox(height: DJTokens.spaceXs * scale),
            Text(
              _formattedDate,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: DJTokens.textSecondary,
                    fontSize: 12 * scale,
                  ),
            ),
            // Venue name
            if (venueName != null) ...[
              SizedBox(height: DJTokens.spaceXs * scale),
              Text(
                venueName!,
                key: const Key('setlist-poster-venue'),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: vibe.accent.withValues(alpha: 0.8),
                      fontSize: 12 * scale,
                    ),
              ),
            ],
            SizedBox(height: DJTokens.spaceMd * scale),
            // Song list
            Expanded(
              child: setlist.isEmpty
                  ? Center(
                      child: Text(
                        Copy.setlistPosterNoSongs,
                        style:
                            Theme.of(context).textTheme.bodyLarge?.copyWith(
                                  color: DJTokens.textSecondary,
                                ),
                      ),
                    )
                  : ListView.builder(
                      padding: EdgeInsets.zero,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: setlist.length,
                      itemBuilder: (context, index) {
                        return _PosterSongEntry(
                          entry: setlist[index],
                          vibe: vibe,
                          scale: scale,
                        );
                      },
                    ),
            ),
            // Footer: branding
            SizedBox(height: DJTokens.spaceSm * scale),
            Text(
              Copy.appTitle,
              key: const Key('setlist-poster-branding'),
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: DJTokens.textSecondary.withValues(alpha: 0.5),
                    letterSpacing: 4,
                    fontSize: 10 * scale,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PosterSongEntry extends StatelessWidget {
  const _PosterSongEntry({
    required this.entry,
    required this.vibe,
    required this.scale,
  });

  final SetlistEntry entry;
  final PartyVibe vibe;
  final double scale;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.symmetric(vertical: DJTokens.spaceXs * scale),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Position number
          SizedBox(
            width: 32 * scale,
            child: Text(
              '#${entry.position}',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: vibe.accent,
                    fontWeight: FontWeight.bold,
                    fontSize: 16 * scale,
                  ),
            ),
          ),
          SizedBox(width: DJTokens.spaceSm * scale),
          // Song details
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Song title
                Text(
                  entry.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                        color: DJTokens.textPrimary,
                        fontWeight: FontWeight.bold,
                        fontSize: 14 * scale,
                      ),
                ),
                // Artist
                Text(
                  '${Copy.setlistPosterByArtist} ${entry.artist}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: DJTokens.textSecondary,
                        fontSize: 11 * scale,
                      ),
                ),
                // Performer tag + award badge row
                if (entry.performerName != null ||
                    entry.awardTitle != null) ...[
                  SizedBox(height: 2 * scale),
                  Row(
                    children: [
                      if (entry.performerName != null)
                        Flexible(
                          child: Container(
                            key: Key(
                                'setlist-poster-performer-${entry.position}'),
                            padding: EdgeInsets.symmetric(
                              horizontal: DJTokens.spaceXs * scale,
                              vertical: 1 * scale,
                            ),
                            decoration: BoxDecoration(
                              color: vibe.primary.withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(3),
                            ),
                            child: Text(
                              entry.performerName!,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(context)
                                  .textTheme
                                  .bodySmall
                                  ?.copyWith(
                                    color: vibe.primary,
                                    fontSize: 10 * scale,
                                  ),
                            ),
                          ),
                        ),
                      if (entry.performerName != null &&
                          entry.awardTitle != null)
                        SizedBox(width: DJTokens.spaceXs * scale),
                      if (entry.awardTitle != null)
                        Flexible(
                          child: Container(
                            key: Key(
                                'setlist-poster-award-${entry.position}'),
                            padding: EdgeInsets.symmetric(
                              horizontal: DJTokens.spaceXs * scale,
                              vertical: 1 * scale,
                            ),
                            decoration: BoxDecoration(
                              border: Border.all(
                                color: vibe.accent.withValues(alpha: 0.5),
                              ),
                              borderRadius: BorderRadius.circular(3),
                            ),
                            child: Text(
                              entry.awardTitle!,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(context)
                                  .textTheme
                                  .bodySmall
                                  ?.copyWith(
                                    color: vibe.accent,
                                    fontSize: 10 * scale,
                                  ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
