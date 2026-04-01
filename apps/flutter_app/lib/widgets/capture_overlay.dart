import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/socket/client.dart';
import 'package:karamania/state/capture_provider.dart';
import 'package:karamania/theme/dj_tokens.dart';
import 'package:path_provider/path_provider.dart';
import 'package:provider/provider.dart';
import 'package:record/record.dart';
import 'package:karamania/api/api_service.dart';
import 'package:karamania/services/upload_queue.dart';
import 'package:karamania/state/party_provider.dart';
import 'package:karamania/state/upload_provider.dart';

/// Inline capture overlay — shows mode selector after bubble pop,
/// then handles photo/video/audio capture without leaving party screen.
class CaptureOverlay extends StatefulWidget {
  const CaptureOverlay({super.key});

  @override
  State<CaptureOverlay> createState() => _CaptureOverlayState();
}

class _CaptureOverlayState extends State<CaptureOverlay>
    with SingleTickerProviderStateMixin {
  AudioRecorder? _activeRecorder;
  Timer? _audioStopTimer;
  Stopwatch? _audioStopwatch;
  late final AnimationController _pulseController;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
  }

  @override
  void dispose() {
    _audioStopTimer?.cancel();
    if (_activeRecorder != null) {
      _activeRecorder!.dispose();
      _activeRecorder = null;
      // H1 fix: reset provider state if widget disposed during active recording
      final provider = context.read<CaptureProvider>();
      if (provider.isCapturing) {
        provider.onCaptureCancelled();
      }
    }
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<CaptureProvider>();

    if (!provider.isSelectorVisible && !provider.isCapturing) {
      return const SizedBox.shrink();
    }

    if (provider.isSelectorVisible) {
      return _buildModeSelector(provider);
    }

    if (provider.isCapturing &&
        provider.activeCaptureType == CaptureType.audio) {
      return _buildAudioIndicator(provider);
    }

    return const SizedBox.shrink();
  }

  Widget _buildModeSelector(CaptureProvider provider) {
    return AnimatedOpacity(
      opacity: provider.isSelectorVisible ? 1.0 : 0.0,
      duration: const Duration(milliseconds: 200),
      child: GestureDetector(
        key: const Key('capture-selector-backdrop'),
        onTap: () => provider.onCaptureCancelled(),
        behavior: HitTestBehavior.opaque,
        child: Align(
          alignment: Alignment.bottomLeft,
          child: Padding(
            padding: EdgeInsets.only(
              bottom: DJTokens.spaceLg + 48 + DJTokens.spaceSm,
              left: DJTokens.spaceMd,
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _buildCaptureButton(
                  key: 'capture-photo',
                  icon: Icons.camera_alt_rounded,
                  label: Copy.capturePhoto,
                  onTap: () => _startCapture(provider, CaptureType.photo),
                ),
                const SizedBox(width: DJTokens.spaceSm),
                _buildCaptureButton(
                  key: 'capture-video',
                  icon: Icons.videocam_rounded,
                  label: Copy.captureVideo,
                  onTap: () => _startCapture(provider, CaptureType.video),
                ),
                const SizedBox(width: DJTokens.spaceSm),
                _buildCaptureButton(
                  key: 'capture-audio',
                  icon: Icons.mic_rounded,
                  label: Copy.captureAudio,
                  onTap: () => _startCapture(provider, CaptureType.audio),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildCaptureButton({
    required String key,
    required IconData icon,
    required String label,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            key: Key(key),
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.secondary,
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: DJTokens.textPrimary, size: 24),
          ),
          const SizedBox(height: DJTokens.spaceXs),
          Text(
            label,
            style: const TextStyle(color: DJTokens.textPrimary, fontSize: 12),
          ),
        ],
      ),
    );
  }

  Widget _buildAudioIndicator(CaptureProvider provider) {
    return Align(
      alignment: Alignment.bottomCenter,
      child: Padding(
        padding: const EdgeInsets.only(bottom: DJTokens.spaceLg + 48 + DJTokens.spaceSm),
        child: GestureDetector(
          key: const Key('capture-audio-indicator'),
          onTap: () => _stopAudioRecording(provider),
          child: Container(
            padding: const EdgeInsets.symmetric(
              horizontal: DJTokens.spaceMd,
              vertical: DJTokens.spaceSm,
            ),
            decoration: BoxDecoration(
              color: DJTokens.surfaceColor.withValues(alpha: 0.9),
              borderRadius: BorderRadius.circular(DJTokens.spaceMd),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                FadeTransition(
                  opacity: Tween<double>(begin: 0.3, end: 1.0)
                      .animate(_pulseController),
                  child: Container(
                    width: 12,
                    height: 12,
                    decoration: const BoxDecoration(
                      color: Colors.red,
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
                const SizedBox(width: DJTokens.spaceSm),
                Text(
                  '${Copy.captureRecording} ${provider.recordingSecondsRemaining}s',
                  style: const TextStyle(color: DJTokens.textPrimary, fontSize: 14),
                ),
                const SizedBox(width: DJTokens.spaceSm),
                Text(
                  Copy.captureRecordingStop,
                  style: TextStyle(
                    color: DJTokens.textPrimary.withValues(alpha: 0.7),
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _startCapture(CaptureProvider provider, CaptureType type) {
    provider.onCaptureTypeSelected(type);

    switch (type) {
      case CaptureType.photo:
        _capturePhoto(provider);
        break;
      case CaptureType.video:
        _captureVideo(provider);
        break;
      case CaptureType.audio:
        _captureAudio(provider);
        break;
    }
  }

  Future<void> _capturePhoto(CaptureProvider provider) async {
    SocketClient.instance.emitCaptureStarted(
      captureType: 'photo',
      triggerType: provider.captureTriggerType,
    );

    final picker = ImagePicker();
    final XFile? image = await picker.pickImage(
      source: ImageSource.camera,
      preferredCameraDevice: CameraDevice.front,
    );

    if (image != null) {
      final triggerType = provider.captureTriggerType;
      final sessionId = SocketClient.instance.currentSessionId;
      final userId = SocketClient.instance.currentUserId;
      if (!mounted) return;
      final djState = context.read<PartyProvider>().djStateRaw;
      SocketClient.instance.emitCaptureComplete(
        captureType: 'photo',
        triggerType: triggerType,
      );
      if (sessionId != null) {
        await _enqueueWithServerMetadata(
          filePath: image.path,
          sessionId: sessionId,
          captureType: 'photo',
          triggerType: triggerType,
          userId: userId,
          djState: djState,
        );
      }
      if (!mounted) return;
      provider.onCaptureComplete();
    } else {
      provider.onCaptureCancelled();
    }
  }

  Future<void> _captureVideo(CaptureProvider provider) async {
    final stopwatch = Stopwatch()..start();

    SocketClient.instance.emitCaptureStarted(
      captureType: 'video',
      triggerType: provider.captureTriggerType,
    );

    final picker = ImagePicker();
    final XFile? video = await picker.pickVideo(
      source: ImageSource.camera,
      preferredCameraDevice: CameraDevice.front,
      maxDuration: const Duration(seconds: 5),
    );

    stopwatch.stop();

    if (video != null) {
      final triggerType = provider.captureTriggerType;
      final sessionId = SocketClient.instance.currentSessionId;
      final userId = SocketClient.instance.currentUserId;
      if (!mounted) return;
      final djState = context.read<PartyProvider>().djStateRaw;
      SocketClient.instance.emitCaptureComplete(
        captureType: 'video',
        triggerType: triggerType,
        durationMs: stopwatch.elapsedMilliseconds,
      );
      if (sessionId != null) {
        await _enqueueWithServerMetadata(
          filePath: video.path,
          sessionId: sessionId,
          captureType: 'video',
          triggerType: triggerType,
          userId: userId,
          djState: djState,
        );
      }
      if (!mounted) return;
      provider.onCaptureComplete();
    } else {
      provider.onCaptureCancelled();
    }
  }

  Future<void> _captureAudio(CaptureProvider provider) async {
    final recorder = AudioRecorder();

    // M3 fix: hasPermission() can throw on some Android devices
    bool hasPermission;
    try {
      hasPermission = await recorder.hasPermission();
    } catch (_) {
      hasPermission = false;
    }
    if (!hasPermission) {
      recorder.dispose();
      provider.onCaptureCancelled();
      return;
    }

    _pulseController.repeat(reverse: true);

    SocketClient.instance.emitCaptureStarted(
      captureType: 'audio',
      triggerType: provider.captureTriggerType,
    );

    final tempDir = await getTemporaryDirectory();
    final filePath =
        '${tempDir.path}/capture_${DateTime.now().millisecondsSinceEpoch}.m4a';

    try {
      await recorder.start(
        const RecordConfig(encoder: AudioEncoder.aacLc),
        path: filePath,
      );
    } catch (e) {
      recorder.dispose();
      provider.onCaptureCancelled();
      return;
    }

    _audioStopwatch = Stopwatch()..start();
    _activeRecorder = recorder;

    _audioStopTimer = Timer(const Duration(seconds: 10), () async {
      if (await recorder.isRecording()) {
        final path = await recorder.stop();
        _onAudioComplete(provider, path);
      }
    });
  }

  Future<void> _stopAudioRecording(CaptureProvider provider) async {
    _audioStopTimer?.cancel();
    if (_activeRecorder != null && await _activeRecorder!.isRecording()) {
      final path = await _activeRecorder!.stop();
      _onAudioComplete(provider, path);
    }
  }

  Future<void> _onAudioComplete(CaptureProvider provider, String? path) async {
    _pulseController.stop();
    _pulseController.value = 1.0;
    _audioStopwatch?.stop();
    final durationMs = _audioStopwatch?.elapsedMilliseconds ?? 0;

    if (path != null) {
      final triggerType = provider.captureTriggerType;
      final sessionId = SocketClient.instance.currentSessionId;
      final userId = SocketClient.instance.currentUserId;
      if (!mounted) return;
      final djState = context.read<PartyProvider>().djStateRaw;
      SocketClient.instance.emitCaptureComplete(
        captureType: 'audio',
        triggerType: triggerType,
        durationMs: durationMs,
      );
      if (sessionId != null) {
        await _enqueueWithServerMetadata(
          filePath: path,
          sessionId: sessionId,
          captureType: 'audio',
          triggerType: triggerType,
          userId: userId,
          djState: djState,
        );
      }
      if (!mounted) return;
      provider.onCaptureComplete();
    } else {
      provider.onCaptureCancelled();
    }
    _activeRecorder?.dispose();
    _activeRecorder = null;
    _audioStopwatch = null;
  }

  Future<void> _enqueueWithServerMetadata({
    required String filePath,
    required String sessionId,
    required String captureType,
    required String triggerType,
    String? userId,
    Map<String, dynamic>? djState,
  }) async {
    if (!mounted) return;
    final apiService = context.read<ApiService>();
    final uploadProvider = context.read<UploadProvider>();
    try {
      final result = await apiService.createCapture(
        sessionId: sessionId,
        captureType: captureType,
        triggerType: triggerType,
        userId: userId,
      );
      uploadProvider.enqueue(UploadItem(
        filePath: filePath,
        sessionId: sessionId,
        captureId: result.captureId,
        captureType: captureType,
        triggerType: triggerType,
        storagePath: result.storagePath,
        djState: djState,
      ));
    } catch (e) {
      debugPrint('Failed to create capture metadata: $e');
      // Cleanup the local file since it cannot be uploaded without server metadata
      try {
        final file = File(filePath);
        if (await file.exists()) await file.delete();
      } catch (_) {}
    }
  }
}
