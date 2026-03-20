import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/state/party_provider.dart';
import 'package:karamania/theme/dj_tokens.dart';

/// Stateful widget that fires "YOUR TURN!" flashes at timed intervals
/// during song state for the tag-team partner.
/// Rendered conditionally when isTagTeamPartner && djState == song.
class TagTeamFlashWidget extends StatefulWidget {
  const TagTeamFlashWidget({super.key});

  @override
  State<TagTeamFlashWidget> createState() => _TagTeamFlashWidgetState();
}

class _TagTeamFlashWidgetState extends State<TagTeamFlashWidget>
    with SingleTickerProviderStateMixin {
  final List<Timer> _timers = [];
  late final AnimationController _pulseController;

  // Approximate chorus moments for MVP (30s, 60s, 90s)
  static const _flashTimings = [
    Duration(seconds: 30),
    Duration(seconds: 60),
    Duration(seconds: 90),
  ];
  static const _flashDuration = Duration(seconds: 3);

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );

    final provider = context.read<PartyProvider>();
    for (final timing in _flashTimings) {
      final timer = Timer(timing, () {
        if (mounted) {
          provider.setShowTagTeamFlash(true);
          _pulseController.repeat(reverse: true);
          // Auto-hide after 3 seconds
          _timers.add(Timer(_flashDuration, () {
            if (mounted) {
              provider.setShowTagTeamFlash(false);
              _pulseController.stop();
              _pulseController.reset();
            }
          }));
        }
      });
      _timers.add(timer);
    }
  }

  @override
  void dispose() {
    for (final timer in _timers) {
      timer.cancel();
    }
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<PartyProvider>();
    if (!provider.showTagTeamFlash) return const SizedBox.shrink();

    return Positioned.fill(
      key: const Key('tag-team-flash'),
      child: AnimatedBuilder(
        animation: _pulseController,
        builder: (context, child) {
          return Container(
            color: provider.vibe.accent.withValues(alpha: 0.1 + _pulseController.value * 0.15),
            child: Center(
              child: Text(
                Copy.tagTeamYourTurn,
                style: Theme.of(context).textTheme.displayLarge?.copyWith(
                      color: DJTokens.textPrimary,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 4,
                    ),
              ),
            ),
          );
        },
      ),
    );
  }
}
