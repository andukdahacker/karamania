import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Status of a single upload item in the queue.
enum UploadStatus { pending, uploading, completed, failed }

/// A single item in the upload queue.
class UploadItem {
  UploadItem({
    required this.filePath,
    required this.sessionId,
    required this.captureId,
    required this.captureType,
    required this.triggerType,
    this.djState,
    this.status = UploadStatus.pending,
    this.retryCount = 0,
    DateTime? createdAt,
  }) : createdAt = createdAt ?? DateTime.now();

  final String filePath;
  final String sessionId;
  final String captureId;
  final String captureType;
  final String triggerType;
  final Map<String, dynamic>? djState;
  UploadStatus status;
  int retryCount;
  final DateTime createdAt;

  Map<String, dynamic> toJson() => {
        'filePath': filePath,
        'sessionId': sessionId,
        'captureId': captureId,
        'captureType': captureType,
        'triggerType': triggerType,
        'djState': djState,
        'status': status.name,
        'retryCount': retryCount,
        'createdAt': createdAt.millisecondsSinceEpoch,
      };

  factory UploadItem.fromJson(Map<String, dynamic> json) => UploadItem(
        filePath: json['filePath'] as String,
        sessionId: json['sessionId'] as String,
        captureId: json['captureId'] as String,
        captureType: json['captureType'] as String,
        triggerType: json['triggerType'] as String,
        djState: json['djState'] as Map<String, dynamic>?,
        status: UploadStatus.values.byName(json['status'] as String),
        retryCount: json['retryCount'] as int,
        createdAt:
            DateTime.fromMillisecondsSinceEpoch(json['createdAt'] as int),
      );
}

/// Manages background media uploads with retry and connectivity awareness.
class UploadQueue {
  UploadQueue._();
  static final UploadQueue instance = UploadQueue._();

  static const _storageKey = 'upload_queue';
  static const _maxRetries = 5;

  final List<UploadItem> _items = [];
  bool _isProcessing = false;
  StreamSubscription<List<ConnectivityResult>>? _connectivitySubscription;
  VoidCallback? _onChanged;

  List<UploadItem> get items => List.unmodifiable(_items);
  bool get isProcessing => _isProcessing;
  bool get hasActiveUploads =>
      _items.any((item) =>
          item.status == UploadStatus.pending ||
          item.status == UploadStatus.uploading);

  int get pendingCount =>
      _items.where((item) => item.status == UploadStatus.pending).length;

  double get progress {
    if (_items.isEmpty) return 1.0;
    final completed =
        _items.where((item) => item.status == UploadStatus.completed).length;
    return completed / _items.length;
  }

  /// Set a callback for when the queue state changes.
  set onChanged(VoidCallback? callback) {
    _onChanged = callback;
  }

  /// Initialize — load persisted queue and start connectivity listener.
  Future<void> init() async {
    await _loadFromStorage();
    _connectivitySubscription = Connectivity()
        .onConnectivityChanged
        .listen(_onConnectivityChanged);
  }

  /// Dispose resources.
  void dispose() {
    _connectivitySubscription?.cancel();
  }

  /// Add captured media to the upload queue.
  void enqueue(UploadItem item) {
    // No duplicate uploads
    if (_items.any((existing) => existing.captureId == item.captureId)) return;

    _items.add(item);
    _saveToStorage();
    _onChanged?.call();
    processQueue();
  }

  /// Sequential upload processing — one at a time.
  Future<void> processQueue() async {
    if (_isProcessing) return;
    _isProcessing = true;
    _onChanged?.call();

    while (true) {
      final next = _items.cast<UploadItem?>().firstWhere(
            (item) => item!.status == UploadStatus.pending,
            orElse: () => null,
          );
      if (next == null) break;

      next.status = UploadStatus.uploading;
      _onChanged?.call();

      final success = await _uploadFile(next);

      if (success) {
        next.status = UploadStatus.completed;
        _cleanupFile(next.filePath);
      } else {
        next.retryCount++;
        if (next.retryCount >= _maxRetries) {
          next.status = UploadStatus.failed;
          _cleanupFile(next.filePath);
        } else {
          next.status = UploadStatus.pending;
          // Exponential backoff: 2s, 4s, 8s, 16s, max 60s
          final delaySeconds = (1 << next.retryCount).clamp(2, 60);
          await Future<void>.delayed(Duration(seconds: delaySeconds));
        }
      }

      _saveToStorage();
      _onChanged?.call();
    }

    _isProcessing = false;
    _onChanged?.call();
  }

  /// Placeholder upload — stores file locally. Story 6.4 replaces with Firebase.
  Future<bool> _uploadFile(UploadItem item) async {
    try {
      final file = File(item.filePath);
      if (!await file.exists()) return false;
      // Placeholder: file exists locally, metadata created via REST.
      // Story 6.4 will upload to Firebase Storage here.
      return true;
    } catch (e) {
      debugPrint('Upload failed for ${item.captureId}: $e');
      return false;
    }
  }

  void _cleanupFile(String filePath) {
    try {
      final file = File(filePath);
      if (file.existsSync()) file.deleteSync();
    } catch (_) {
      // Best-effort cleanup
    }
  }

  void _onConnectivityChanged(List<ConnectivityResult> results) {
    final hasConnection =
        results.any((r) => r != ConnectivityResult.none);
    if (hasConnection && !_isProcessing && hasActiveUploads) {
      processQueue();
    }
  }

  Future<void> _saveToStorage() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final json = _items
          .where((item) => item.status != UploadStatus.completed)
          .map((item) => item.toJson())
          .toList();
      await prefs.setString(_storageKey, jsonEncode(json));
    } catch (_) {
      // Best-effort persistence
    }
  }

  Future<void> _loadFromStorage() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final stored = prefs.getString(_storageKey);
      if (stored == null) return;
      final list = jsonDecode(stored) as List<dynamic>;
      for (final item in list) {
        final uploadItem =
            UploadItem.fromJson(item as Map<String, dynamic>);
        if (!_items.any((e) => e.captureId == uploadItem.captureId)) {
          // Reset uploading items to pending on reload
          if (uploadItem.status == UploadStatus.uploading) {
            uploadItem.status = UploadStatus.pending;
          }
          _items.add(uploadItem);
        }
      }
    } catch (_) {
      // Best-effort load
    }
  }

  /// Clear completed and failed items from the queue.
  void clearFinished() {
    _items.removeWhere((item) =>
        item.status == UploadStatus.completed ||
        item.status == UploadStatus.failed);
    _saveToStorage();
    _onChanged?.call();
  }

  @visibleForTesting
  void clearAll() {
    _items.clear();
    _isProcessing = false;
  }
}
