import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/constants/party_cards.dart';
import 'package:karamania/theme/dj_tokens.dart';

/// Full-screen overlay displaying the dealt party card with slide-up flip animation.
/// Shows singer view (with action buttons) or audience view based on isCurrentSinger.
class PartyCardDealOverlay extends StatefulWidget {
  const PartyCardDealOverlay({
    super.key,
    required this.card,
    required this.isCurrentSinger,
    required this.redrawUsed,
    this.currentPerformerName,
    this.acceptedCardTitle,
    this.onAccept,
    this.onDismiss,
    this.onRedraw,
  });

  final PartyCardData card;
  final bool isCurrentSinger;
  final bool redrawUsed;
  final String? currentPerformerName;
  final String? acceptedCardTitle;
  final VoidCallback? onAccept;
  final VoidCallback? onDismiss;
  final VoidCallback? onRedraw;

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

  // 8-second auto-dismiss timer (singer view only)
  Timer? _autoDismissTimer;
  static const int _autoDismissSeconds = 8;
  int _secondsRemaining = _autoDismissSeconds;
  bool _actionTaken = false;

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

    // Start slide, then flip, then start timer
    _slideController.forward().then((_) {
      if (mounted) {
        _flipController.forward().then((_) {
          if (mounted && widget.isCurrentSinger) {
            _startAutoDismissTimer();
          }
        });
      }
    });
  }

  @override
  void didUpdateWidget(PartyCardDealOverlay oldWidget) {
    super.didUpdateWidget(oldWidget);
    // If card changes (redraw), replay flip animation and reset timer
    if (oldWidget.card.id != widget.card.id) {
      _flipController.reset();
      _flipController.forward();
      _resetAutoDismissTimer();
    }
  }

  void _startAutoDismissTimer() {
    _autoDismissTimer?.cancel();
    _secondsRemaining = _autoDismissSeconds;
    _autoDismissTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      setState(() {
        _secondsRemaining--;
      });
      if (_secondsRemaining <= 0) {
        timer.cancel();
        if (!_actionTaken) {
          _actionTaken = true;
          widget.onDismiss?.call();
        }
      }
    });
  }

  void _resetAutoDismissTimer() {
    _actionTaken = false;
    if (widget.isCurrentSinger) {
      _startAutoDismissTimer();
    }
  }

  void _handleAccept() {
    if (_actionTaken) return;
    _actionTaken = true;
    _autoDismissTimer?.cancel();
    widget.onAccept?.call();
  }

  void _handleDismiss() {
    if (_actionTaken) return;
    _actionTaken = true;
    _autoDismissTimer?.cancel();
    widget.onDismiss?.call();
  }

  void _handleRedraw() {
    _autoDismissTimer?.cancel();
    widget.onRedraw?.call();
  }

  @override
  void dispose() {
    _autoDismissTimer?.cancel();
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
          child: widget.isCurrentSinger
              ? AnimatedBuilder(
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
                  child: _buildSingerView(),
                )
              : _buildAudienceView(),
        ),
      ),
    );
  }

  Widget _buildSingerView() {
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
          // Card type badge
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
          // Card description
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
          // Countdown timer
          _buildCountdownIndicator(),
          const SizedBox(height: DJTokens.spaceMd),
          // Action buttons
          _buildActionButtons(borderColor),
        ],
      ),
    );
  }

  Widget _buildCountdownIndicator() {
    final progress = _secondsRemaining / _autoDismissSeconds;
    return SizedBox(
      key: const Key('card-countdown-timer'),
      width: 40,
      height: 40,
      child: Stack(
        alignment: Alignment.center,
        children: [
          CircularProgressIndicator(
            value: progress,
            strokeWidth: 3,
            color: _secondsRemaining <= 3
                ? DJTokens.actionDanger
                : DJTokens.textSecondary,
            backgroundColor: DJTokens.surfaceColor,
          ),
          Text(
            '$_secondsRemaining',
            style: TextStyle(
              color: _secondsRemaining <= 3
                  ? DJTokens.actionDanger
                  : DJTokens.textSecondary,
              fontSize: 14,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActionButtons(Color borderColor) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        // Dismiss button — grey, 48x48
        SizedBox(
          key: const Key('card-dismiss-button'),
          width: 48,
          height: 48,
          child: IconButton(
            onPressed: _handleDismiss,
            style: IconButton.styleFrom(
              backgroundColor: DJTokens.surfaceColor,
              shape: const CircleBorder(),
            ),
            icon: const Icon(
              Icons.close,
              color: DJTokens.textSecondary,
              size: 24,
            ),
            tooltip: Copy.cardDismissLabel,
          ),
        ),
        const SizedBox(width: DJTokens.spaceMd),
        // Accept button — green, 56x56
        SizedBox(
          key: const Key('card-accept-button'),
          width: 56,
          height: 56,
          child: IconButton(
            onPressed: _handleAccept,
            style: IconButton.styleFrom(
              backgroundColor: DJTokens.actionConfirm,
              shape: const CircleBorder(),
            ),
            icon: const Icon(
              Icons.check,
              color: DJTokens.bgColor,
              size: 28,
            ),
            tooltip: Copy.cardAcceptLabel,
          ),
        ),
        const SizedBox(width: DJTokens.spaceMd),
        // Redraw button — accent, 48x48, only if not used
        if (!widget.redrawUsed)
          SizedBox(
            key: const Key('card-redraw-button'),
            width: 48,
            height: 48,
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                IconButton(
                  onPressed: _handleRedraw,
                  style: IconButton.styleFrom(
                    backgroundColor: borderColor,
                    shape: const CircleBorder(),
                  ),
                  icon: const Icon(
                    Icons.refresh,
                    color: DJTokens.bgColor,
                    size: 24,
                  ),
                  tooltip: Copy.cardRedrawLabel,
                ),
                // "1 FREE" badge
                Positioned(
                  top: -4,
                  right: -4,
                  child: Container(
                    key: const Key('card-redraw-badge'),
                    padding: const EdgeInsets.symmetric(
                      horizontal: DJTokens.spaceXs,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: DJTokens.actionConfirm,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Text(
                      '1 FREE',
                      style: TextStyle(
                        color: DJTokens.bgColor,
                        fontSize: 8,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }

  Widget _buildAudienceView() {
    // If card was accepted, briefly show the card title
    if (widget.acceptedCardTitle != null && widget.acceptedCardTitle!.isNotEmpty) {
      return Container(
        key: const Key('party-card-accepted-view'),
        margin: const EdgeInsets.symmetric(horizontal: DJTokens.spaceXl),
        padding: const EdgeInsets.all(DJTokens.spaceLg),
        decoration: BoxDecoration(
          color: DJTokens.surfaceElevated,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: DJTokens.actionConfirm, width: 2),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.check_circle,
              color: DJTokens.actionConfirm,
              size: DJTokens.iconSizeLg,
            ),
            const SizedBox(height: DJTokens.spaceMd),
            Text(
              widget.acceptedCardTitle!,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: DJTokens.textPrimary,
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
      );
    }

    // Default audience view — "CHALLENGE INCOMING..."
    return Container(
      key: const Key('party-card-audience-view'),
      margin: const EdgeInsets.symmetric(horizontal: DJTokens.spaceXl),
      padding: const EdgeInsets.all(DJTokens.spaceLg),
      decoration: BoxDecoration(
        color: DJTokens.surfaceElevated,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: DJTokens.textSecondary, width: 2),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text(
            Copy.cardChallengeIncoming,
            key: Key('card-challenge-incoming'),
            textAlign: TextAlign.center,
            style: TextStyle(
              color: DJTokens.textPrimary,
              fontSize: 24,
              fontWeight: FontWeight.bold,
            ),
          ),
          if (widget.currentPerformerName != null) ...[
            const SizedBox(height: DJTokens.spaceMd),
            Text(
              widget.currentPerformerName!,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: DJTokens.textSecondary,
                fontSize: 18,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
