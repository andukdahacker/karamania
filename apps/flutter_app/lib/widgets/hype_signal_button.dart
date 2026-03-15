import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/socket/client.dart';
import 'package:karamania/state/party_provider.dart';
import 'package:karamania/theme/dj_tokens.dart';
import 'package:torch_light/torch_light.dart';

/// Hype signal button with screen flash, flashlight, and cooldown indicator.
class HypeSignalButton extends StatefulWidget {
  const HypeSignalButton({super.key});

  @override
  State<HypeSignalButton> createState() => _HypeSignalButtonState();
}

class _HypeSignalButtonState extends State<HypeSignalButton>
    with SingleTickerProviderStateMixin {
  Timer? _cooldownTimer;
  Timer? _cooldownTickTimer;
  double _cooldownProgress = 0.0;
  OverlayEntry? _flashOverlay;

  @override
  void dispose() {
    _cooldownTimer?.cancel();
    _cooldownTickTimer?.cancel();
    _flashOverlay?.remove();
    _flashOverlay = null;
    super.dispose();
  }

  Future<void> _fireHype() async {
    final provider = context.read<PartyProvider>();
    if (provider.isHypeCooldown) return;

    final reduceMotion = MediaQuery.of(context).disableAnimations;

    // 1. Start client-side cooldown
    provider.startHypeCooldown();
    _startCooldownTimer();

    // 2. Emit to server
    SocketClient.instance.emitHypeSignal();

    // 3. Screen flash
    _showScreenFlash(reduceMotion ? 1 : 3);

    // 4. Activate flashlight (graceful degradation)
    if (!reduceMotion) {
      _activateFlashlight();
    }
  }

  void _startCooldownTimer() {
    _cooldownTimer?.cancel();
    _cooldownTickTimer?.cancel();
    setState(() => _cooldownProgress = 0.0);

    const totalMs = 5000;
    const tickMs = 50;
    var elapsed = 0;

    _cooldownTickTimer = Timer.periodic(
      const Duration(milliseconds: tickMs),
      (timer) {
        elapsed += tickMs;
        if (mounted) {
          setState(() => _cooldownProgress = elapsed / totalMs);
        }
        if (elapsed >= totalMs) {
          timer.cancel();
        }
      },
    );

    _cooldownTimer = Timer(const Duration(seconds: 5), () {
      if (mounted) {
        context.read<PartyProvider>().clearHypeCooldown();
        setState(() => _cooldownProgress = 0.0);
      }
    });
  }

  void _showScreenFlash(int flashCount) {
    var remaining = flashCount;

    void doFlash() {
      if (remaining <= 0 || !mounted) return;
      remaining--;

      final overlay = Overlay.of(context);
      _flashOverlay?.remove();
      _flashOverlay = OverlayEntry(
        builder: (context) => Positioned.fill(
          child: IgnorePointer(
            child: Container(color: Colors.white.withValues(alpha: 0.8)),
          ),
        ),
      );
      overlay.insert(_flashOverlay!);

      Future.delayed(const Duration(milliseconds: 100), () {
        if (!mounted) return;
        _flashOverlay?.remove();
        _flashOverlay = null;
        if (remaining > 0) {
          Future.delayed(const Duration(milliseconds: 50), doFlash);
        }
      });
    }

    doFlash();
  }

  Future<void> _activateFlashlight() async {
    try {
      await TorchLight.enableTorch();
      await Future.delayed(const Duration(milliseconds: 500));
      await TorchLight.disableTorch();
    } catch (_) {
      // Flashlight unavailable — silent failure (graceful degradation)
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<PartyProvider>();
    final isCooldown = provider.isHypeCooldown;
    final vibe = provider.vibe;

    return SizedBox(
      key: const Key('hype-signal-button'),
      width: 48,
      height: 48,
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Cooldown progress ring
          if (isCooldown)
            SizedBox(
              width: 48,
              height: 48,
              child: CircularProgressIndicator(
                value: _cooldownProgress,
                strokeWidth: 3,
                color: vibe.accent.withValues(alpha: 0.5),
                backgroundColor: DJTokens.textSecondary.withValues(alpha: 0.2),
              ),
            ),
          // Button
          IconButton(
            onPressed: isCooldown ? null : _fireHype,
            icon: Icon(
              Icons.flash_on,
              color: isCooldown ? DJTokens.textSecondary : vibe.accent,
              size: 28,
            ),
            tooltip: isCooldown ? Copy.hypeSignalCooldown : Copy.hypeSignalButton,
          ),
        ],
      ),
    );
  }
}
