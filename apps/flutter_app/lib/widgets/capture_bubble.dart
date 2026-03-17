import 'package:flutter/material.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/state/capture_provider.dart';
import 'package:karamania/theme/dj_tokens.dart';
import 'package:provider/provider.dart';

/// Floating 48x48 capture bubble with subtle pulse animation.
/// Appears at bottom-left. Auto-dismisses after 15s. Tapping initiates
/// capture flow (Story 6.2).
class CaptureBubble extends StatefulWidget {
  const CaptureBubble({super.key});

  @override
  State<CaptureBubble> createState() => _CaptureBubbleState();
}

class _CaptureBubbleState extends State<CaptureBubble>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulseController;
  late final Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );
    _pulseAnimation = Tween<double>(begin: 1.0, end: 1.15).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final captureProvider = context.watch<CaptureProvider>();
    if (!captureProvider.isBubbleVisible) {
      _pulseController.stop();
      _pulseController.reset();
      return const SizedBox.shrink();
    }
    if (!_pulseController.isAnimating) {
      _pulseController.repeat(reverse: true);
    }

    final accentColor = Theme.of(context).colorScheme.secondary;

    return Semantics(
      label: Copy.captureMoment,
      button: true,
      child: ScaleTransition(
        scale: _pulseAnimation,
        child: GestureDetector(
          key: const Key('capture-bubble'),
          onTap: () {
            captureProvider.onBubbleTapped();
          },
          child: Container(
            width: DJTokens.iconSizeLg,
            height: DJTokens.iconSizeLg,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: accentColor.withAlpha(230),
              boxShadow: [
                BoxShadow(
                  color: accentColor.withAlpha(100),
                  blurRadius: 12,
                  spreadRadius: 2,
                ),
              ],
            ),
            child: const Icon(
              Icons.camera_alt_rounded,
              color: Colors.white,
              size: 24,
            ),
          ),
        ),
      ),
    );
  }
}
