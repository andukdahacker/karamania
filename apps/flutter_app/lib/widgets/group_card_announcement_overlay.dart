import 'dart:async';
import 'package:flutter/material.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/constants/party_cards.dart';
import 'package:karamania/theme/dj_tokens.dart';

/// Full-width overlay displaying group card announcement text.
/// Shows for 3 seconds then auto-fades. Pulses accent glow if local user is selected.
class GroupCardAnnouncementOverlay extends StatefulWidget {
  const GroupCardAnnouncementOverlay({
    super.key,
    required this.announcement,
    required this.selectedDisplayNames,
    required this.isSelectedForGroupCard,
    required this.onDismiss,
  });

  final String announcement;
  final List<String> selectedDisplayNames;
  final bool isSelectedForGroupCard;
  final VoidCallback onDismiss;

  @override
  State<GroupCardAnnouncementOverlay> createState() =>
      _GroupCardAnnouncementOverlayState();
}

class _GroupCardAnnouncementOverlayState
    extends State<GroupCardAnnouncementOverlay>
    with TickerProviderStateMixin {
  late final AnimationController _controller;
  late final AnimationController _fadeController;
  Timer? _autoDismissTimer;

  static final _goldAccent = Color(PartyCardType.group.borderColor);

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _fadeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
      value: 1.0,
    );

    if (widget.isSelectedForGroupCard) {
      _controller.repeat(reverse: true);
    } else {
      _controller.forward();
    }

    _autoDismissTimer = Timer(const Duration(milliseconds: 2500), () {
      if (mounted) {
        _fadeController.reverse().then((_) {
          if (mounted) widget.onDismiss();
        });
      }
    });
  }

  @override
  void dispose() {
    _autoDismissTimer?.cancel();
    _controller.dispose();
    _fadeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _fadeController,
      child: AnimatedBuilder(
        animation: _controller,
      builder: (context, child) {
        final glowOpacity = widget.isSelectedForGroupCard
            ? 0.1 + (_controller.value * 0.15)
            : 0.0;

        return Container(
          key: const Key('group-card-announcement-overlay'),
          color: widget.isSelectedForGroupCard
              ? _goldAccent.withValues(alpha: glowOpacity)
              : Colors.black.withValues(alpha: 0.5),
          child: Center(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: DJTokens.spaceLg),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    Copy.groupCardAnnouncementPrefix,
                    key: const Key('group-card-prefix'),
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          color: _goldAccent,
                          letterSpacing: 4,
                        ),
                  ),
                  const SizedBox(height: DJTokens.spaceMd),
                  Text(
                    widget.announcement,
                    key: const Key('group-card-announcement-text'),
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                          color: DJTokens.textPrimary,
                          fontWeight: FontWeight.bold,
                        ),
                  ),
                  if (widget.selectedDisplayNames.isNotEmpty) ...[
                    const SizedBox(height: DJTokens.spaceMd),
                    Text(
                      widget.selectedDisplayNames.join(', '),
                      key: const Key('group-card-selected-names'),
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            color: _goldAccent,
                          ),
                    ),
                  ],
                  if (widget.isSelectedForGroupCard) ...[
                    const SizedBox(height: DJTokens.spaceMd),
                    Text(
                      Copy.groupCardYouWereSelected,
                      key: const Key('group-card-you-selected'),
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            color: DJTokens.textPrimary,
                            fontWeight: FontWeight.bold,
                          ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        );
      },
    ),
    );
  }
}
