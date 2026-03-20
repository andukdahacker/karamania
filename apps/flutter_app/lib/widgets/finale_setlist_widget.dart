import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/models/setlist_entry.dart';
import 'package:karamania/theme/dj_tokens.dart';
import 'package:karamania/theme/dj_theme.dart';

class FinaleSetlistWidget extends StatefulWidget {
  const FinaleSetlistWidget({
    super.key,
    required this.setlist,
    required this.vibe,
  });

  final List<SetlistEntry> setlist;
  final PartyVibe vibe;

  @override
  State<FinaleSetlistWidget> createState() => _FinaleSetlistWidgetState();
}

class _FinaleSetlistWidgetState extends State<FinaleSetlistWidget>
    with SingleTickerProviderStateMixin {
  late final AnimationController _fadeController;
  late final Animation<double> _fadeAnimation;

  @override
  void initState() {
    super.initState();
    _fadeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );
    _fadeAnimation = CurvedAnimation(
      parent: _fadeController,
      curve: Curves.easeOut,
    );
    _fadeController.forward();
  }

  @override
  void dispose() {
    _fadeController.dispose();
    super.dispose();
  }

  Future<void> _shareSetlist() async {
    final now = DateTime.now();
    final date = '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
    final songLines = widget.setlist.map((s) {
      final parts = <String>['${s.position}. ${s.title} by ${s.artist}'];
      if (s.performerName != null) parts.add('(${s.performerName})');
      if (s.awardTitle != null) parts.add('— ${s.awardTitle}');
      return parts.join(' ');
    }).toList();
    final text = Copy.finaleShareText(date, songLines);
    try {
      await SharePlus.instance.share(ShareParams(text: text));
    } catch (e) {
      debugPrint('[FinaleSetlistWidget] Share failed: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _fadeAnimation,
      child: Column(
        key: const Key('finale-setlist'),
        children: [
          Text(
            Copy.finaleSetlistTitle,
            style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                  color: widget.vibe.accent,
                  fontWeight: FontWeight.bold,
                ),
          ),
          const SizedBox(height: DJTokens.spaceMd),
          Expanded(
            child: ListView.builder(
              itemCount: widget.setlist.length,
              itemBuilder: (context, index) {
                final entry = widget.setlist[index];
                return _SetlistCard(entry: entry, vibe: widget.vibe);
              },
            ),
          ),
          const SizedBox(height: DJTokens.spaceMd),
          ElevatedButton.icon(
            onPressed: _shareSetlist,
            icon: const Icon(Icons.share),
            label: const Text(Copy.finaleShareButton),
            style: ElevatedButton.styleFrom(
              backgroundColor: widget.vibe.accent,
              foregroundColor: DJTokens.bgColor,
            ),
          ),
        ],
      ),
    );
  }
}

class _SetlistCard extends StatelessWidget {
  const _SetlistCard({
    required this.entry,
    required this.vibe,
  });

  final SetlistEntry entry;
  final PartyVibe vibe;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(
        vertical: DJTokens.spaceXs,
        horizontal: DJTokens.spaceMd,
      ),
      padding: const EdgeInsets.all(DJTokens.spaceSm),
      decoration: BoxDecoration(
        color: DJTokens.surfaceElevated.withValues(alpha: 0.8),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          SizedBox(
            width: 36,
            child: Text(
              '${entry.position}',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    color: vibe.accent.withValues(alpha: 0.6),
                    fontWeight: FontWeight.bold,
                  ),
              textAlign: TextAlign.center,
            ),
          ),
          const SizedBox(width: DJTokens.spaceSm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  entry.title,
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                        color: DJTokens.textPrimary,
                        fontWeight: FontWeight.bold,
                      ),
                ),
                Text(
                  entry.artist,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: DJTokens.textSecondary,
                      ),
                ),
              ],
            ),
          ),
          if (entry.performerName != null)
            Container(
              padding: const EdgeInsets.symmetric(
                horizontal: DJTokens.spaceSm,
                vertical: DJTokens.spaceXs,
              ),
              decoration: BoxDecoration(
                color: vibe.accent.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                entry.performerName!,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: vibe.accent,
                    ),
              ),
            ),
          if (entry.awardTitle != null) ...[
            const SizedBox(width: DJTokens.spaceXs),
            Container(
              padding: const EdgeInsets.symmetric(
                horizontal: DJTokens.spaceXs,
                vertical: DJTokens.spaceXs,
              ),
              decoration: BoxDecoration(
                color: vibe.glow.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                '🏆',
                style: const TextStyle(fontSize: 14),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
