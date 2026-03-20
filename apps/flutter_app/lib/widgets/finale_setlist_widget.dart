import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:share_plus/share_plus.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/models/setlist_entry.dart';
import 'package:karamania/socket/client.dart';
import 'package:karamania/theme/dj_tokens.dart';
import 'package:karamania/theme/dj_theme.dart';
import 'package:karamania/widgets/setlist_poster_widget.dart';

class FinaleSetlistWidget extends StatefulWidget {
  const FinaleSetlistWidget({
    super.key,
    required this.setlist,
    required this.vibe,
    this.venueName,
  });

  final List<SetlistEntry> setlist;
  final PartyVibe vibe;
  final String? venueName;

  @override
  State<FinaleSetlistWidget> createState() => _FinaleSetlistWidgetState();
}

class _FinaleSetlistWidgetState extends State<FinaleSetlistWidget>
    with SingleTickerProviderStateMixin {
  late final AnimationController _fadeController;
  late final Animation<double> _fadeAnimation;
  final GlobalKey _posterKey = GlobalKey();
  late final DateTime _posterDate;

  @override
  void initState() {
    super.initState();
    _posterDate = DateTime.now();
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

  Future<void> _shareSetlistPoster() async {
    try {
      final boundary = _posterKey.currentContext?.findRenderObject()
          as RenderRepaintBoundary?;
      if (boundary == null) return;

      final image = await boundary.toImage(pixelRatio: 3.0);
      final byteData = await image.toByteData(
        format: ui.ImageByteFormat.png,
      );
      if (byteData == null) return;

      final pngBytes = byteData.buffer.asUint8List();

      // Track share intent as viral signal
      SocketClient.instance.emitSetlistPosterShared();

      await SharePlus.instance.share(
        ShareParams(
          files: [
            XFile.fromData(
              pngBytes,
              mimeType: 'image/png',
              name: 'karamania-setlist.png',
            ),
          ],
        ),
      );
    } catch (e) {
      debugPrint('[FinaleSetlistWidget] Share failed: $e');
    }
  }

  static const _monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  Future<void> _shareSetlistText() async {
    final month = _monthNames[_posterDate.month - 1];
    final day = _posterDate.day.toString().padLeft(2, '0');
    final date = '$month $day, ${_posterDate.year}';
    final songLines = widget.setlist.map((s) {
      final parts = <String>['${s.position}. ${s.title} ${Copy.setlistPosterByArtist} ${s.artist}'];
      if (s.performerName != null) parts.add('(${s.performerName})');
      if (s.awardTitle != null) parts.add('— ${s.awardTitle}');
      return parts.join(' ');
    }).toList();
    final text = Copy.finaleShareText(date, songLines);
    try {
      await SharePlus.instance.share(ShareParams(text: text));
    } catch (e) {
      debugPrint('[FinaleSetlistWidget] Text share failed: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _fadeAnimation,
      child: Column(
        key: const Key('finale-setlist'),
        children: [
          // Poster rendered in RepaintBoundary for capture
          Expanded(
            child: RepaintBoundary(
              key: _posterKey,
              child: SetlistPosterWidget(
                setlist: widget.setlist,
                vibe: widget.vibe,
                venueName: widget.venueName,
                date: _posterDate,
              ),
            ),
          ),
          const SizedBox(height: DJTokens.spaceMd),
          // Primary: image share
          ElevatedButton.icon(
            key: const Key('setlist-poster-share-btn'),
            onPressed: _shareSetlistPoster,
            icon: const Icon(Icons.share),
            label: const Text(Copy.finaleShareButton),
            style: ElevatedButton.styleFrom(
              backgroundColor: widget.vibe.accent,
              foregroundColor: DJTokens.bgColor,
            ),
          ),
          // Secondary: text share (long-press)
          const SizedBox(height: DJTokens.spaceSm),
          GestureDetector(
            onLongPress: _shareSetlistText,
            child: Text(
              Copy.setlistPosterHoldForTextShare,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: DJTokens.textSecondary.withValues(alpha: 0.5),
                  ),
            ),
          ),
        ],
      ),
    );
  }
}
