import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/state/party_provider.dart';
import 'package:karamania/theme/dj_tokens.dart';

// Wheel segment colors — constant, non-vibe-shifting
const Color _wheelColorA = Color(0xFF6C63FF); // purple
const Color _wheelColorB = Color(0xFF3B82F6); // blue
const Color _spinActiveColor = Color(0xFF6C63FF);

class SpinTheWheelOverlay extends StatefulWidget {
  const SpinTheWheelOverlay({
    super.key,
    required this.segments,
    required this.phase,
    required this.targetIndex,
    required this.totalRotation,
    required this.spinDurationMs,
    required this.spinnerName,
    required this.vetoUsed,
    required this.timerDurationMs,
    required this.onSpin,
    required this.onVeto,
  });

  final List<SpinWheelSegment> segments;
  final String? phase;
  final int? targetIndex;
  final double? totalRotation;
  final int spinDurationMs;
  final String? spinnerName;
  final bool vetoUsed;
  final int timerDurationMs;
  final VoidCallback onSpin;
  final VoidCallback onVeto;

  @override
  State<SpinTheWheelOverlay> createState() => _SpinTheWheelOverlayState();
}

class _SpinTheWheelOverlayState extends State<SpinTheWheelOverlay>
    with SingleTickerProviderStateMixin {
  AnimationController? _spinController;
  Animation<double>? _spinAnimation;
  Timer? _countdownTimer;
  int _remainingSeconds = 15;
  Timer? _vetoCountdownTimer;
  int _vetoRemainingSeconds = 5;
  double _lastEndAngle = 0;

  @override
  void initState() {
    super.initState();
    _remainingSeconds = (widget.timerDurationMs / 1000).ceil();
    if (widget.phase == 'waiting') {
      _startCountdown();
    }
  }

  @override
  void didUpdateWidget(SpinTheWheelOverlay oldWidget) {
    super.didUpdateWidget(oldWidget);

    if (widget.phase == 'spinning' && oldWidget.phase != 'spinning') {
      _countdownTimer?.cancel();
      _startSpinAnimation();
    }

    if (widget.phase == 'landed' && oldWidget.phase != 'landed') {
      _startVetoCountdown();
    }

    // Re-spin on veto
    if (widget.phase == 'spinning' && oldWidget.phase == 'landed') {
      _vetoCountdownTimer?.cancel();
      _startSpinAnimation();
    }
  }

  void _startCountdown() {
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) {
        setState(() {
          _remainingSeconds = (_remainingSeconds - 1).clamp(0, 999);
        });
        if (_remainingSeconds <= 0) {
          _countdownTimer?.cancel();
        }
      }
    });
  }

  void _startVetoCountdown() {
    _vetoRemainingSeconds = 5;
    _vetoCountdownTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) {
        setState(() {
          _vetoRemainingSeconds = (_vetoRemainingSeconds - 1).clamp(0, 999);
        });
        if (_vetoRemainingSeconds <= 0) {
          _vetoCountdownTimer?.cancel();
        }
      }
    });
  }

  void _startSpinAnimation() {
    _spinController?.dispose();

    final totalRotation = widget.totalRotation ?? 0;
    _spinController = AnimationController(
      vsync: this,
      duration: Duration(milliseconds: widget.spinDurationMs),
    );
    _spinAnimation = Tween<double>(
      begin: _lastEndAngle,
      end: _lastEndAngle + totalRotation,
    ).animate(CurvedAnimation(
      parent: _spinController!,
      curve: Curves.easeOutCubic,
    ));

    _spinController!.addStatusListener((status) {
      if (status == AnimationStatus.completed) {
        _lastEndAngle = _lastEndAngle + totalRotation;
      }
    });

    _spinController!.forward();
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    _vetoCountdownTimer?.cancel();
    _spinController?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isSelected = widget.phase == 'selected';
    final isWaiting = widget.phase == 'waiting';
    final isLanded = widget.phase == 'landed';
    final isSpinning = widget.phase == 'spinning';

    return Container(
      key: const Key('spin-the-wheel-overlay'),
      color: Colors.black.withValues(alpha: 0.85),
      child: SafeArea(
        child: Column(
          children: [
            const SizedBox(height: DJTokens.spaceLg),
            // Title
            Text(
              Copy.spinTheWheelTitle,
              key: const Key('spin-wheel-title'),
              style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                    color: DJTokens.textPrimary,
                    fontWeight: FontWeight.bold,
                  ),
            ),
            const SizedBox(height: DJTokens.spaceSm),
            // Status line
            _buildStatusLine(context, isWaiting, isSpinning, isLanded, isSelected),
            const SizedBox(height: DJTokens.spaceMd),
            // Wheel area
            Expanded(
              child: Center(
                child: _buildWheel(context),
              ),
            ),
            // Veto button
            if (isLanded && !widget.vetoUsed)
              Padding(
                padding: const EdgeInsets.only(bottom: DJTokens.spaceMd),
                child: ElevatedButton(
                  key: const Key('spin-wheel-veto-button'),
                  onPressed: widget.onVeto,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: DJTokens.actionDanger,
                    foregroundColor: DJTokens.textPrimary,
                    padding: const EdgeInsets.symmetric(
                      horizontal: DJTokens.spaceLg,
                      vertical: DJTokens.spaceMd,
                    ),
                  ),
                  child: Text(
                    '${Copy.spinVetoLabel} ($_vetoRemainingSeconds s)',
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 18,
                    ),
                  ),
                ),
              ),
            // Winner display
            if (isSelected && widget.targetIndex != null && widget.targetIndex! < widget.segments.length)
              Padding(
                padding: const EdgeInsets.only(bottom: DJTokens.spaceLg),
                child: Column(
                  children: [
                    Text(
                      Copy.spinSelectedLabel,
                      key: const Key('spin-wheel-selected-label'),
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            color: DJTokens.actionConfirm,
                            fontWeight: FontWeight.bold,
                          ),
                    ),
                    const SizedBox(height: DJTokens.spaceSm),
                    Text(
                      widget.segments[widget.targetIndex!].songTitle,
                      style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                            color: DJTokens.textPrimary,
                            fontWeight: FontWeight.bold,
                          ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: DJTokens.spaceXs),
                    Text(
                      widget.segments[widget.targetIndex!].artist,
                      style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                            color: DJTokens.textSecondary,
                          ),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
            const SizedBox(height: DJTokens.spaceMd),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusLine(BuildContext context, bool isWaiting, bool isSpinning, bool isLanded, bool isSelected) {
    String text;
    Color color;

    if (isSelected) {
      text = Copy.spinSelectedLabel;
      color = DJTokens.actionConfirm;
    } else if (isSpinning) {
      final name = widget.spinnerName;
      text = name != null ? '$name is spinning!' : Copy.spinSpinningLabel;
      color = _spinActiveColor;
    } else if (isLanded) {
      text = Copy.spinLandedLabel;
      color = _spinActiveColor;
    } else if (isWaiting && _remainingSeconds <= 0) {
      text = Copy.spinAutoSpinLabel;
      color = DJTokens.textSecondary;
    } else if (isWaiting) {
      text = '${Copy.spinWaitingLabel}  ${_remainingSeconds}s';
      color = DJTokens.textSecondary;
    } else {
      text = '';
      color = DJTokens.textSecondary;
    }

    return Text(
      text,
      key: const Key('spin-wheel-status'),
      style: Theme.of(context).textTheme.bodyLarge?.copyWith(color: color),
    );
  }

  Widget _buildWheel(BuildContext context) {
    final size = MediaQuery.of(context).size.width * 0.75;
    final isWaiting = widget.phase == 'waiting';

    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Pointer at top
          Positioned(
            top: 0,
            child: Icon(
              Icons.arrow_drop_down,
              key: const Key('spin-wheel-pointer'),
              color: _spinActiveColor,
              size: 40,
            ),
          ),
          // Wheel
          Padding(
            padding: const EdgeInsets.all(20),
            child: AnimatedBuilder(
              animation: _spinAnimation ?? const AlwaysStoppedAnimation(0),
              builder: (context, child) {
                return Transform.rotate(
                  angle: _spinAnimation?.value ?? 0,
                  child: child,
                );
              },
              child: CustomPaint(
                size: Size(size - 40, size - 40),
                painter: _WheelPainter(segments: widget.segments),
              ),
            ),
          ),
          // Center SPIN button
          GestureDetector(
            key: const Key('spin-wheel-spin-button'),
            onTap: isWaiting ? widget.onSpin : null,
            child: Container(
              width: size * 0.25,
              height: size * 0.25,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isWaiting ? _spinActiveColor : DJTokens.surfaceElevated,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.3),
                    blurRadius: 8,
                  ),
                ],
              ),
              alignment: Alignment.center,
              child: Text(
                Copy.spinButtonLabel,
                style: TextStyle(
                  color: isWaiting ? DJTokens.textPrimary : DJTokens.textSecondary,
                  fontWeight: FontWeight.bold,
                  fontSize: 18,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Draws wheel segments using CustomPainter.
class _WheelPainter extends CustomPainter {
  _WheelPainter({required this.segments});

  final List<SpinWheelSegment> segments;

  static const List<Color> _segmentColors = [
    _wheelColorA,
    _wheelColorB,
  ];

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2;
    final segmentAngle = 2 * math.pi / segments.length;

    for (int i = 0; i < segments.length; i++) {
      final startAngle = i * segmentAngle - math.pi / 2;
      final paint = Paint()
        ..color = _segmentColors[i % 2].withValues(alpha: i % 2 == 0 ? 0.8 : 0.6)
        ..style = PaintingStyle.fill;

      canvas.drawArc(
        Rect.fromCircle(center: center, radius: radius),
        startAngle,
        segmentAngle,
        true,
        paint,
      );

      // Draw border between segments
      final borderPaint = Paint()
        ..color = Colors.white.withValues(alpha: 0.3)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1;
      canvas.drawArc(
        Rect.fromCircle(center: center, radius: radius),
        startAngle,
        segmentAngle,
        true,
        borderPaint,
      );

      // Draw text
      final textAngle = startAngle + segmentAngle / 2;
      final textRadius = radius * 0.65;
      final textX = center.dx + textRadius * math.cos(textAngle);
      final textY = center.dy + textRadius * math.sin(textAngle);

      canvas.save();
      canvas.translate(textX, textY);
      canvas.rotate(textAngle + math.pi / 2);

      final textPainter = TextPainter(
        text: TextSpan(
          text: segments[i].songTitle.length > 12
              ? '${segments[i].songTitle.substring(0, 12)}...'
              : segments[i].songTitle,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 10,
            fontWeight: FontWeight.bold,
          ),
        ),
        textDirection: TextDirection.ltr,
        textAlign: TextAlign.center,
      )..layout(maxWidth: radius * 0.5);

      textPainter.paint(canvas, Offset(-textPainter.width / 2, -textPainter.height / 2));
      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(_WheelPainter oldDelegate) =>
      oldDelegate.segments != segments;
}
