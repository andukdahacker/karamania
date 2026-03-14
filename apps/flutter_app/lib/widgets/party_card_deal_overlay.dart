import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/constants/party_cards.dart';
import 'package:karamania/theme/dj_tokens.dart';

/// Full-screen overlay displaying the dealt party card with slide-up flip animation.
/// Shown during DJState.partyCardDeal when a card has been dealt.
class PartyCardDealOverlay extends StatefulWidget {
  const PartyCardDealOverlay({
    super.key,
    required this.card,
  });

  final PartyCardData card;

  @override
  State<PartyCardDealOverlay> createState() => _PartyCardDealOverlayState();
}

class _PartyCardDealOverlayState extends State<PartyCardDealOverlay>
    with TickerProviderStateMixin {
  late final AnimationController _slideController;
  late final AnimationController _flipController;
  late final Animation<Offset> _slideAnimation;
  late final Animation<double> _flipAnimation;
  late final Animation<double> _fadeAnimation;

  @override
  void initState() {
    super.initState();

    // Slide up from bottom (400ms, easeOut)
    _slideController = AnimationController(
      duration: const Duration(milliseconds: 400),
      vsync: this,
    );
    _slideAnimation = Tween<Offset>(
      begin: const Offset(0.0, 1.0),
      end: Offset.zero,
    ).animate(CurvedAnimation(
      parent: _slideController,
      curve: Curves.easeOut,
    ));
    _fadeAnimation = Tween<double>(
      begin: 0.0,
      end: 1.0,
    ).animate(CurvedAnimation(
      parent: _slideController,
      curve: Curves.easeOut,
    ));

    // Flip reveal (500ms, easeOutBack) — starts after slide completes
    _flipController = AnimationController(
      duration: const Duration(milliseconds: 500),
      vsync: this,
    );
    _flipAnimation = Tween<double>(
      begin: math.pi / 2, // 90 degrees — card edge-on (hidden)
      end: 0.0,           // 0 degrees — card face (revealed)
    ).animate(CurvedAnimation(
      parent: _flipController,
      curve: Curves.easeOutBack,
    ));

    // Start slide, then flip
    _slideController.forward().then((_) {
      if (mounted) _flipController.forward();
    });
  }

  @override
  void didUpdateWidget(PartyCardDealOverlay oldWidget) {
    super.didUpdateWidget(oldWidget);
    // If card changes (host re-deal), replay flip animation
    if (oldWidget.card.id != widget.card.id) {
      _flipController.reset();
      _flipController.forward();
    }
  }

  @override
  void dispose() {
    _slideController.dispose();
    _flipController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _fadeAnimation,
      child: SlideTransition(
        position: _slideAnimation,
        child: Center(
          child: AnimatedBuilder(
            animation: _flipAnimation,
            builder: (context, child) {
              return Transform(
                alignment: Alignment.center,
                transform: Matrix4.identity()
                  ..setEntry(3, 2, 0.001) // Perspective
                  ..rotateY(_flipAnimation.value),
                child: child,
              );
            },
            child: _buildCard(),
          ),
        ),
      ),
    );
  }

  Widget _buildCard() {
    final borderColor = Color(widget.card.type.borderColor);

    return Container(
      key: const Key('party-card-deal'),
      margin: const EdgeInsets.symmetric(horizontal: DJTokens.spaceXl),
      padding: const EdgeInsets.all(DJTokens.spaceLg),
      decoration: BoxDecoration(
        color: DJTokens.surfaceElevated,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: borderColor, width: 3),
        boxShadow: [
          BoxShadow(
            color: borderColor.withValues(alpha: 0.3),
            blurRadius: 20,
            spreadRadius: 2,
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Card type label
          Text(
            widget.card.type.label,
            style: TextStyle(
              color: borderColor,
              fontSize: 12,
              fontWeight: FontWeight.w600,
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: DJTokens.spaceMd),
          // Card emoji
          Text(
            widget.card.emoji,
            style: const TextStyle(fontSize: 48),
          ),
          const SizedBox(height: DJTokens.spaceMd),
          // Card title
          Text(
            widget.card.title,
            key: const Key('party-card-title'),
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: DJTokens.textPrimary,
              fontSize: 24,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: DJTokens.spaceSm),
          // Card description (the challenge)
          Text(
            widget.card.description,
            key: const Key('party-card-description'),
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: DJTokens.textSecondary,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: DJTokens.spaceLg),
          // Challenge label
          Text(
            Copy.partyCardTitle,
            style: TextStyle(
              color: DJTokens.textSecondary.withValues(alpha: 0.6),
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}
