import 'package:flutter/material.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/state/capture_provider.dart';
import 'package:karamania/state/upload_provider.dart';
import 'package:karamania/theme/dj_tokens.dart';
import 'package:provider/provider.dart';

/// Persistent capture icon in participant toolbar (FR39).
/// Always visible. Independent of bubble system.
/// Shows subtle upload progress ring when uploads are in progress.
class CaptureToolbarIcon extends StatelessWidget {
  const CaptureToolbarIcon({super.key});

  @override
  Widget build(BuildContext context) {
    final captureProvider = context.watch<CaptureProvider>();
    final uploadProvider = context.watch<UploadProvider>();

    return Semantics(
      label: uploadProvider.hasActiveUploads
          ? Copy.captureUploading
          : Copy.captureManual,
      child: Stack(
        alignment: Alignment.center,
        children: [
          if (uploadProvider.hasActiveUploads)
            SizedBox(
              key: const Key('capture-upload-progress'),
              width: 28,
              height: 28,
              child: CircularProgressIndicator(
                value: uploadProvider.currentUploadProgress,
                strokeWidth: 2,
                color: Theme.of(context)
                    .colorScheme
                    .secondary
                    .withValues(alpha: 0.6),
              ),
            ),
          IconButton(
            key: const Key('capture-toolbar-icon'),
            icon: const Icon(Icons.camera_alt_outlined),
            iconSize: 24,
            color: DJTokens.textPrimary.withValues(alpha: 200 / 255),
            onPressed:
                captureProvider.isCapturing || captureProvider.isSelectorVisible
                    ? null
                    : () => captureProvider.onManualCaptureTriggered(),
          ),
        ],
      ),
    );
  }
}
