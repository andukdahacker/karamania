import 'dart:async';

import 'package:flutter/material.dart';
import 'package:karamania/models/finale_award.dart';
import 'package:karamania/models/session_stats.dart';
import 'package:karamania/models/setlist_entry.dart';
import 'package:karamania/theme/dj_tokens.dart';
import 'package:karamania/theme/dj_theme.dart';
import 'package:karamania/widgets/awards_parade_widget.dart';
import 'package:karamania/widgets/feedback_prompt_widget.dart';
import 'package:karamania/widgets/finale_setlist_widget.dart';
import 'package:karamania/widgets/session_stats_widget.dart';

class FinaleOverlay extends StatefulWidget {
  const FinaleOverlay({
    super.key,
    required this.vibe,
    this.awards,
    this.stats,
    this.setlist,
    this.onStepChanged,
  });

  final PartyVibe vibe;
  final List<FinaleAward>? awards;
  final SessionStats? stats;
  final List<SetlistEntry>? setlist;
  final ValueChanged<int>? onStepChanged;

  @override
  State<FinaleOverlay> createState() => _FinaleOverlayState();
}

class _FinaleOverlayState extends State<FinaleOverlay>
    with SingleTickerProviderStateMixin {
  int _currentStep = 0; // 0=awards, 1=stats, 2=setlist, 3=feedback
  Timer? _autoAdvanceTimer;
  late final AnimationController _bgFadeController;
  late final Animation<double> _bgFadeAnimation;

  @override
  void initState() {
    super.initState();
    _bgFadeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );
    _bgFadeAnimation = CurvedAnimation(
      parent: _bgFadeController,
      curve: Curves.easeOut,
    );
    _bgFadeController.forward();
    widget.onStepChanged?.call(0);
  }

  @override
  void dispose() {
    _autoAdvanceTimer?.cancel();
    _bgFadeController.dispose();
    super.dispose();
  }

  void _advanceToStep(int step) {
    _autoAdvanceTimer?.cancel();
    if (!mounted) return;
    setState(() {
      _currentStep = step;
    });
    widget.onStepChanged?.call(step);
  }

  void _onAwardsComplete() {
    if (widget.stats != null) {
      _advanceToStep(1);
      // Auto-advance stats after 12 seconds
      _autoAdvanceTimer = Timer(const Duration(seconds: 12), () {
        if (mounted && _currentStep == 1) _advanceToSetlist();
      });
    } else {
      // Skip stats if not available, go to setlist or feedback
      if (widget.setlist != null) {
        _advanceToSetlist();
      } else {
        _advanceToStep(3);
      }
    }
  }

  void _advanceToSetlist() {
    _advanceToStep(2);
    // Auto-advance setlist to feedback after 18 seconds
    _autoAdvanceTimer = Timer(const Duration(seconds: 18), () {
      if (mounted && _currentStep == 2) _advanceToStep(3);
    });
  }

  Widget _buildCurrentStep() {
    // Show loading shimmer if data not yet available for the current step
    switch (_currentStep) {
      case 0:
        if (widget.awards == null || widget.awards!.isEmpty) {
          return _buildLoadingShimmer();
        }
        return AwardsParadeWidget(
          awards: widget.awards!,
          vibe: widget.vibe,
          onComplete: _onAwardsComplete,
          reducedMotion: MediaQuery.of(context).disableAnimations,
        );
      case 1:
        if (widget.stats == null) return _buildLoadingShimmer();
        return SessionStatsWidget(stats: widget.stats!, vibe: widget.vibe);
      case 2:
        if (widget.setlist == null) return _buildLoadingShimmer();
        return FinaleSetlistWidget(
          setlist: widget.setlist!,
          vibe: widget.vibe,
        );
      case 3:
        return FeedbackPromptWidget(vibe: widget.vibe);
      default:
        return const SizedBox.shrink();
    }
  }

  Widget _buildLoadingShimmer() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            width: 40,
            height: 40,
            child: CircularProgressIndicator(
              strokeWidth: 3,
              color: widget.vibe.accent,
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final finaleColor = djStateBackgroundColor(DJState.finale, widget.vibe);

    return FadeTransition(
      opacity: _bgFadeAnimation,
      child: Container(
        key: const Key('finale-overlay'),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              finaleColor,
              finaleColor.withValues(alpha: 0.95),
            ],
          ),
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: DJTokens.spaceLg),
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 300),
              child: _buildCurrentStep(),
            ),
          ),
        ),
      ),
    );
  }
}
