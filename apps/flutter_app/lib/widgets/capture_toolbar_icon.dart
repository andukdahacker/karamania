import 'package:flutter/material.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/state/capture_provider.dart';
import 'package:provider/provider.dart';

/// Persistent capture icon in participant toolbar (FR39).
/// Always visible. Independent of bubble system.
class CaptureToolbarIcon extends StatelessWidget {
  const CaptureToolbarIcon({super.key});

  @override
  Widget build(BuildContext context) {
    final captureProvider = context.watch<CaptureProvider>();

    return Semantics(
      label: Copy.captureManual,
      child: IconButton(
        key: const Key('capture-toolbar-icon'),
        icon: const Icon(Icons.camera_alt_outlined),
        iconSize: 24,
        color: Colors.white.withValues(alpha: 200 / 255),
        onPressed: captureProvider.isCapturing || captureProvider.isSelectorVisible
            ? null
            : () => captureProvider.onManualCaptureTriggered(),
      ),
    );
  }
}
