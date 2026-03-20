import 'dart:async';

import 'package:flutter/material.dart';
import 'package:karamania/audio/audio_engine.dart';
import 'package:karamania/audio/sound_cue.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/models/finale_award.dart';
import 'package:karamania/theme/dj_tokens.dart';
import 'package:karamania/theme/dj_theme.dart';

class AwardsParadeWidget extends StatefulWidget {
  const AwardsParadeWidget({
    super.key,
    required this.awards,
    required this.vibe,
    required this.onComplete,
    this.reducedMotion = false,
  });

  final List<FinaleAward> awards;
  final PartyVibe vibe;
  final VoidCallback onComplete;
  final bool reducedMotion;

  @override
  State<AwardsParadeWidget> createState() => _AwardsParadeWidgetState();
}

class _AwardsParadeWidgetState extends State<AwardsParadeWidget>
    with TickerProviderStateMixin {
  int _revealedCount = 0;
  Timer? _revealTimer;
  final ScrollController _scrollController = ScrollController();
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

    if (widget.reducedMotion) {
      _revealedCount = widget.awards.length;
      _scheduleComplete();
    } else {
      _startParade();
    }
  }

  void _startParade() {
    if (widget.awards.isEmpty) {
      _scheduleComplete();
      return;
    }
    _revealNext();
  }

  void _revealNext() {
    if (!mounted) return;
    if (_revealedCount >= widget.awards.length) {
      // Brief celebration burst then auto-advance
      _revealTimer = Timer(const Duration(seconds: 1), () {
        if (mounted) widget.onComplete();
      });
      return;
    }

    setState(() {
      _revealedCount++;
    });

    // Play sound cue
    AudioEngine.instance.play(
      SoundCue.finaleAwardReveal,
      volume: SoundCue.finaleAwardReveal.defaultVolume,
    );

    // Auto-scroll to bottom
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });

    // Build tempo: first awards 3s gap, later awards 2s gap
    final gapMs = _revealedCount <= 2 ? 3000 : 2000;
    _revealTimer = Timer(Duration(milliseconds: gapMs), _revealNext);
  }

  void _scheduleComplete() {
    _revealTimer = Timer(const Duration(seconds: 2), () {
      if (mounted) widget.onComplete();
    });
  }

  @override
  void dispose() {
    _revealTimer?.cancel();
    _fadeController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  String _toneIcon(String tone) {
    switch (tone) {
      case 'comedic':
        return '😂';
      case 'hype':
        return '🔥';
      case 'absurd':
        return '🤪';
      case 'wholesome':
        return '💖';
      default:
        return '⭐';
    }
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _fadeAnimation,
      child: Column(
        key: const Key('awards-parade'),
        children: [
          Text(
            Copy.finaleAwardsTitle,
            style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                  color: widget.vibe.accent,
                  fontWeight: FontWeight.bold,
                ),
          ),
          const SizedBox(height: DJTokens.spaceMd),
          Expanded(
            child: ListView.builder(
              controller: _scrollController,
              itemCount: _revealedCount,
              itemBuilder: (context, index) {
                final award = widget.awards[index];
                return _AwardCard(
                  award: award,
                  vibe: widget.vibe,
                  toneIcon: _toneIcon(award.tone),
                  animate: !widget.reducedMotion,
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _AwardCard extends StatefulWidget {
  const _AwardCard({
    required this.award,
    required this.vibe,
    required this.toneIcon,
    required this.animate,
  });

  final FinaleAward award;
  final PartyVibe vibe;
  final String toneIcon;
  final bool animate;

  @override
  State<_AwardCard> createState() => _AwardCardState();
}

class _AwardCardState extends State<_AwardCard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _slideAnimation;
  late final Animation<double> _fadeAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
    _slideAnimation = Tween<double>(begin: 50.0, end: 0.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOut),
    );
    _fadeAnimation = CurvedAnimation(
      parent: _controller,
      curve: Curves.easeOut,
    );
    if (widget.animate) {
      _controller.forward();
    } else {
      _controller.value = 1.0;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return Transform.translate(
          offset: Offset(0, _slideAnimation.value),
          child: Opacity(
            opacity: _fadeAnimation.value,
            child: child,
          ),
        );
      },
      child: Container(
        margin: const EdgeInsets.symmetric(
          vertical: DJTokens.spaceXs,
          horizontal: DJTokens.spaceMd,
        ),
        padding: const EdgeInsets.all(DJTokens.spaceMd),
        decoration: BoxDecoration(
          color: DJTokens.surfaceElevated.withValues(alpha: 0.8),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: widget.vibe.accent.withValues(alpha: 0.3),
          ),
        ),
        child: Row(
          children: [
            Text(
              widget.toneIcon,
              style: const TextStyle(fontSize: DJTokens.iconSizeLg),
            ),
            const SizedBox(width: DJTokens.spaceMd),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    widget.award.displayName,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          color: DJTokens.textPrimary,
                          fontWeight: FontWeight.bold,
                        ),
                  ),
                  Text(
                    widget.award.title,
                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                          color: widget.vibe.accent,
                        ),
                  ),
                  Text(
                    widget.award.reason,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: DJTokens.textSecondary,
                        ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
