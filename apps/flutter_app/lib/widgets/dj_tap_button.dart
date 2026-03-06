import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:karamania/constants/tap_tiers.dart';
import 'package:karamania/state/accessibility_provider.dart';
import 'package:karamania/theme/dj_tokens.dart';

/// Core tap interaction widget with tier-specific haptic and animation behavior.
///
/// Requires a [Key] parameter (architecture rule 8).
///
/// Tier behaviors:
/// - Consequential: 500ms hold to confirm, heavyImpact on confirm, fill animation
/// - Social: immediate fire, lightImpact, 200ms debounce
/// - Private: immediate fire, no haptic, 200ms debounce
class DJTapButton extends StatefulWidget {
  const DJTapButton({
    required Key key,
    required this.tier,
    required this.onTap,
    required this.child,
    this.focusAccentColor,
  }) : super(key: key);

  final TapTier tier;
  final VoidCallback onTap;
  final Widget child;
  final Color? focusAccentColor;

  @override
  State<DJTapButton> createState() => _DJTapButtonState();
}

class _DJTapButtonState extends State<DJTapButton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _animationController;
  late final FocusNode _focusNode;

  bool _isPressed = false;
  bool _holdComplete = false;
  Timer? _holdTimer;
  Timer? _debounceTimer;
  DateTime? _lastTapTime;

  static const Duration _holdDuration = Duration(milliseconds: 500);
  static const Duration _debounceDuration = Duration(milliseconds: 200);

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      vsync: this,
      duration: _holdDuration,
    );
    _focusNode = FocusNode();
  }

  @override
  void dispose() {
    _animationController.dispose();
    _focusNode.dispose();
    _holdTimer?.cancel();
    _debounceTimer?.cancel();
    super.dispose();
  }

  bool get _reducedMotion {
    return context.read<AccessibilityProvider>().reducedMotion;
  }

  void _onPointerDown() {
    if (widget.tier == TapTier.consequential) {
      _handleConsequentialDown();
    } else {
      _handleImmediateDown();
    }
  }

  void _handleConsequentialDown() {
    setState(() {
      _isPressed = true;
      _holdComplete = false;
    });

    if (!_reducedMotion) {
      _animationController.forward(from: 0.0);
    }

    _holdTimer = Timer(_holdDuration, () {
      if (_isPressed) {
        setState(() => _holdComplete = true);
        HapticFeedback.heavyImpact();
        widget.onTap();
      }
    });
  }

  void _handleImmediateDown() {
    final now = DateTime.now();
    if (_lastTapTime != null &&
        now.difference(_lastTapTime!) < _debounceDuration) {
      return;
    }
    _lastTapTime = now;

    setState(() => _isPressed = true);

    if (widget.tier == TapTier.social) {
      HapticFeedback.lightImpact();
    }

    widget.onTap();
  }

  void _onPointerUp() {
    if (widget.tier == TapTier.consequential && !_holdComplete) {
      _holdTimer?.cancel();
      _animationController.reverse();
    }

    setState(() {
      _isPressed = false;
      _holdComplete = false;
    });
  }

  void _onPointerCancel() {
    _holdTimer?.cancel();
    _animationController.reverse();
    setState(() {
      _isPressed = false;
      _holdComplete = false;
    });
  }

  double get _currentScale {
    if (!_isPressed) return 1.0;
    if (_reducedMotion) return tapTierScale(widget.tier);
    return tapTierScale(widget.tier);
  }

  @override
  Widget build(BuildContext context) {
    final minSize = tapTierMinSize(widget.tier);
    final accentColor =
        widget.focusAccentColor ?? Theme.of(context).colorScheme.secondary;

    return Focus(
      focusNode: _focusNode,
      child: Builder(
        builder: (context) {
          final hasFocus = Focus.of(context).hasFocus;

          return Padding(
            padding: const EdgeInsets.all(8.0),
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTapDown: (_) => _onPointerDown(),
              onTapUp: (_) => _onPointerUp(),
              onTapCancel: _onPointerCancel,
              child: Container(
                decoration: hasFocus
                    ? BoxDecoration(
                        border: Border.all(color: accentColor, width: 2),
                        borderRadius: BorderRadius.circular(DJTokens.spaceSm),
                      )
                    : null,
                child: AnimatedScale(
                  scale: _currentScale,
                  duration: _reducedMotion
                      ? Duration.zero
                      : DJTokens.transitionFast,
                  child: ConstrainedBox(
                    constraints: BoxConstraints(
                      minWidth: minSize,
                      minHeight: minSize,
                    ),
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        if (widget.tier == TapTier.consequential &&
                            !_reducedMotion)
                          Positioned.fill(
                            child: AnimatedBuilder(
                              animation: _animationController,
                              builder: (context, child) {
                                return ClipRRect(
                                  borderRadius: BorderRadius.circular(
                                    DJTokens.spaceSm,
                                  ),
                                  child: LinearProgressIndicator(
                                    value: _animationController.value,
                                    backgroundColor: Colors.transparent,
                                    valueColor: AlwaysStoppedAnimation<Color>(
                                      accentColor.withValues(alpha: 0.3),
                                    ),
                                  ),
                                );
                              },
                            ),
                          ),
                        widget.child,
                      ],
                    ),
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
