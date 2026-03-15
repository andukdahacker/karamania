import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/state/party_provider.dart';
import 'package:karamania/theme/dj_theme.dart';
import 'package:karamania/theme/dj_tokens.dart';
import 'package:karamania/widgets/hype_signal_button.dart';

/// Full-screen lightstick mode with animated glow and color picker.
class LightstickMode extends StatefulWidget {
  const LightstickMode({super.key, required this.onExit});

  final VoidCallback onExit;

  @override
  State<LightstickMode> createState() => _LightstickModeState();
}

class _LightstickModeState extends State<LightstickMode>
    with SingleTickerProviderStateMixin {
  AnimationController? _pulseController;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final reduceMotion = MediaQuery.of(context).disableAnimations;
    if (reduceMotion && _pulseController != null) {
      _pulseController!.stop();
      _pulseController!.dispose();
      _pulseController = null;
    } else if (!reduceMotion && _pulseController == null) {
      _pulseController = AnimationController(
        vsync: this,
        duration: const Duration(seconds: 2),
      )..repeat(reverse: true);
    }
  }

  @override
  void dispose() {
    _pulseController?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<PartyProvider>();
    final glowColor = provider.lightstickColor;
    final vibe = provider.vibe;
    final reduceMotion = MediaQuery.of(context).disableAnimations;

    final pickerColors = [
      vibe.accent,
      vibe.glow,
      vibe.primary,
      const Color(0xFFFFFFFF),
      const Color(0xFFFF4444),
    ];

    return GestureDetector(
      key: const Key('lightstick-mode'),
      onTap: widget.onExit,
      onVerticalDragEnd: (_) => widget.onExit(),
      child: Stack(
        children: [
          // Glow background
          if (reduceMotion)
            Positioned.fill(
              child: Container(color: glowColor),
            )
          else
            Positioned.fill(
              child: AnimatedBuilder(
                animation: _pulseController!,
                builder: (context, child) {
                  final opacity = 0.4 + _pulseController!.value * 0.6;
                  return Container(
                    decoration: BoxDecoration(
                      gradient: RadialGradient(
                        center: Alignment.center,
                        radius: 1.0,
                        colors: [
                          glowColor.withValues(alpha: opacity),
                          glowColor.withValues(alpha: opacity * 0.3),
                          Colors.transparent,
                        ],
                        stops: const [0.0, 0.5, 1.0],
                      ),
                    ),
                  );
                },
              ),
            ),

          // Exit hint text
          Positioned(
            top: DJTokens.spaceXl + MediaQuery.of(context).padding.top,
            left: 0,
            right: 0,
            child: Center(
              child: Text(
                Copy.lightstickExitHint,
                style: TextStyle(
                  color: DJTokens.textSecondary,
                  fontSize: 14,
                ),
              ),
            ),
          ),

          // Color picker row
          Positioned(
            bottom: DJTokens.spaceXl + DJTokens.spaceLg + 48 + DJTokens.spaceMd,
            left: 0,
            right: 0,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(pickerColors.length, (index) {
                final color = pickerColors[index];
                final isActive = color.value == glowColor.value;
                return GestureDetector(
                  key: Key('lightstick-color-$index'),
                  onTap: () {
                    provider.setLightstickColor(color);
                  },
                  child: AnimatedContainer(
                    duration: DJTokens.transitionFast,
                    margin: const EdgeInsets.symmetric(
                      horizontal: DJTokens.spaceSm,
                    ),
                    width: isActive ? 40 : 32,
                    height: isActive ? 40 : 32,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: color,
                      border: isActive
                          ? Border.all(color: Colors.white, width: 2)
                          : null,
                    ),
                  ),
                );
              }),
            ),
          ),

          // Hype signal button (bottom-right)
          Positioned(
            bottom: DJTokens.spaceXl,
            right: DJTokens.spaceMd,
            child: const HypeSignalButton(),
          ),
        ],
      ),
    );
  }
}
