import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:karamania/api/api_service.dart';
import 'package:karamania/services/media_storage_service.dart';
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
    required this.storagePath,
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
  final String storagePath;
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
        'storagePath': storagePath,
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
        storagePath: json['storagePath'] as String,
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
  ApiService? _apiService;
  Future<String?> Function()? _tokenProvider;

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

  /// Configure API access for guest upload fallback.
  void configure({
    required ApiService apiService,
    required Future<String?> Function() tokenProvider,
  }) {
    _apiService = apiService;
    _tokenProvider = tokenProvider;
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

  /// Current file upload progress (0.0 to 1.0) for the actively uploading file.
  double _currentUploadProgress = 0.0;
  double get currentUploadProgress => _currentUploadProgress;

  /// Upload file — uses Firebase SDK for authenticated users,
  /// server-signed URL for guest users.
  Future<bool> _uploadFile(UploadItem item) async {
    _currentUploadProgress = 0.0;

    bool hasFirebaseAuth;
    try {
      hasFirebaseAuth = FirebaseAuth.instance.currentUser != null;
    } catch (_) {
      hasFirebaseAuth = false;
    }

    if (hasFirebaseAuth) {
      final success = await MediaStorageService.instance.uploadFile(
        item.filePath,
        item.storagePath,
        onProgress: (progress) {
          _currentUploadProgress = progress;
          _onChanged?.call();
        },
      );
      if (success) _currentUploadProgress = 1.0;
      return success;
    }

    // Guest path: get signed upload URL from server, then HTTP PUT
    if (_apiService == null || _tokenProvider == null) {
      debugPrint('Guest upload failed: API service not configured');
      return false;
    }

    try {
      final token = await _tokenProvider!();
      final result = await _apiService!.getUploadUrl(
        sessionId: item.sessionId,
        captureId: item.captureId,
        token: token,
      );

      final ext = item.storagePath.split('.').last.toLowerCase();
      const contentTypes = {'jpg': 'image/jpeg', 'mp4': 'video/mp4', 'm4a': 'audio/mp4'};
      final contentType = contentTypes[ext] ?? 'application/octet-stream';

      final success = await MediaStorageService.instance.uploadViaSignedUrl(
        item.filePath,
        result.uploadUrl,
        contentType,
        onProgress: (progress) {
          _currentUploadProgress = progress;
          _onChanged?.call();
        },
      );
      if (success) _currentUploadProgress = 1.0;
      return success;
    } catch (e) {
      debugPrint('Guest upload failed: $e');
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

  @visibleForTesting
  void addItemWithoutProcessing(UploadItem item) {
    _items.add(item);
    _onChanged?.call();
  }
}
