import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/services/acrcloud_service.dart';
import 'package:karamania/state/detection_provider.dart';
import 'package:karamania/theme/dj_tokens.dart';

class DetectionPocScreen extends StatefulWidget {
  const DetectionPocScreen({super.key});

  @override
  State<DetectionPocScreen> createState() => _DetectionPocScreenState();
}

class _DetectionAttempt {
  final DateTime timestamp;
  final bool success;
  final String? title;
  final String? artist;
  final int? confidence;
  final int? timeOffsetMs;

  const _DetectionAttempt({
    required this.timestamp,
    required this.success,
    this.title,
    this.artist,
    this.confidence,
    this.timeOffsetMs,
  });
}

class _DetectionPocScreenState extends State<DetectionPocScreen> {
  final List<_DetectionAttempt> _attempts = [];
  bool _isDetecting = false;

  int get _successCount => _attempts.where((a) => a.success).length;
  double get _successRate =>
      _attempts.isEmpty ? 0 : (_successCount / _attempts.length) * 100;

  Future<void> _startDetection() async {
    if (_isDetecting) return;
    setState(() => _isDetecting = true);

    // NOTE: PoC screen intentionally calls provider mutation methods directly
    // (bypassing SocketClient) because this screen operates outside the normal
    // DJ state flow. This screen will be removed after PoC validation.
    final detectionProvider = context.read<DetectionProvider>();
    detectionProvider.onDetectionStarted();

    try {
      final result = await AcrCloudService.instance.startDetection();
      if (result != null) {
        detectionProvider.onDetectionResult(
          title: result.title,
          artist: result.artist,
          isrc: result.isrc,
          timeOffsetMs: result.playOffsetMs,
          confidence: result.confidence,
          source: 'acr',
        );
        setState(() {
          _attempts.insert(
            0,
            _DetectionAttempt(
              timestamp: DateTime.now(),
              success: true,
              title: result.title,
              artist: result.artist,
              confidence: result.confidence,
              timeOffsetMs: result.playOffsetMs,
            ),
          );
        });
      } else {
        detectionProvider.onDetectionFailed();
        setState(() {
          _attempts.insert(
            0,
            _DetectionAttempt(
              timestamp: DateTime.now(),
              success: false,
            ),
          );
        });
      }
    } catch (e) {
      detectionProvider.onDetectionFailed();
      setState(() {
        _attempts.insert(
          0,
          _DetectionAttempt(
            timestamp: DateTime.now(),
            success: false,
          ),
        );
      });
    } finally {
      setState(() => _isDetecting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final detection = context.watch<DetectionProvider>();
    final statusText = _statusText(detection);

    return Scaffold(
      backgroundColor: DJTokens.bgBase,
      appBar: AppBar(
        title: const Text('Detection PoC'),
        backgroundColor: DJTokens.bgBase,
      ),
      body: Padding(
        padding: EdgeInsets.all(DJTokens.spaceMd),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Status card
            Container(
              padding: EdgeInsets.all(DJTokens.spaceMd),
              decoration: BoxDecoration(
                color: DJTokens.bgSurface,
                borderRadius: BorderRadius.circular(DJTokens.radiusMd),
              ),
              child: Column(
                children: [
                  Text(
                    statusText,
                    style: TextStyle(
                      color: DJTokens.textPrimary,
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  if (detection.detectedSong != null) ...[
                    SizedBox(height: DJTokens.spaceSm),
                    Text(
                      '${detection.detectedSong!.title} — ${detection.detectedSong!.artist}',
                      style: TextStyle(color: DJTokens.textSecondary, fontSize: 16),
                      textAlign: TextAlign.center,
                    ),
                    SizedBox(height: DJTokens.spaceXs),
                    Text(
                      'Confidence: ${detection.detectedSong!.confidence}% | Offset: ${detection.detectedSong!.timeOffsetMs ?? 0}ms',
                      style: TextStyle(color: DJTokens.textTertiary, fontSize: 13),
                    ),
                  ],
                ],
              ),
            ),

            SizedBox(height: DJTokens.spaceMd),

            // Success rate
            if (_attempts.isNotEmpty)
              Text(
                '$_successCount/${_attempts.length} = ${_successRate.toStringAsFixed(0)}% success',
                style: TextStyle(
                  color: _successRate >= 60 ? Colors.green : Colors.orange,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
                textAlign: TextAlign.center,
              ),

            SizedBox(height: DJTokens.spaceMd),

            // Start detection button
            SizedBox(
              height: 56,
              child: ElevatedButton(
                onPressed: _isDetecting ? null : _startDetection,
                style: ElevatedButton.styleFrom(
                  backgroundColor: DJTokens.actionPrimary,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(DJTokens.radiusMd),
                  ),
                ),
                child: Text(
                  _isDetecting ? Copy.detectionListening : Copy.detectionStartButton,
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
              ),
            ),

            SizedBox(height: DJTokens.spaceMd),

            // Attempt history
            Expanded(
              child: ListView.builder(
                itemCount: _attempts.length,
                itemBuilder: (context, index) {
                  final attempt = _attempts[index];
                  return ListTile(
                    leading: Icon(
                      attempt.success ? Icons.check_circle : Icons.cancel,
                      color: attempt.success ? Colors.green : Colors.red,
                    ),
                    title: Text(
                      attempt.success
                          ? '${attempt.title} — ${attempt.artist}'
                          : 'No match',
                      style: TextStyle(color: DJTokens.textPrimary),
                    ),
                    subtitle: Text(
                      attempt.success
                          ? 'Confidence: ${attempt.confidence}% | Offset: ${attempt.timeOffsetMs}ms'
                          : '${attempt.timestamp.hour}:${attempt.timestamp.minute.toString().padLeft(2, '0')}',
                      style: TextStyle(color: DJTokens.textTertiary, fontSize: 12),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _statusText(DetectionProvider detection) {
    switch (detection.detectionStatus) {
      case DetectionStatus.idle:
        return Copy.detectionIdle;
      case DetectionStatus.listening:
        return Copy.detectionListening;
      case DetectionStatus.detected:
        return detection.detectedSong != null
            ? Copy.detectionDetected(detection.detectedSong!.title)
            : Copy.detectionIdle;
      case DetectionStatus.noMatch:
        return Copy.detectionNoMatch;
      case DetectionStatus.error:
        return Copy.detectionError;
    }
  }
}
