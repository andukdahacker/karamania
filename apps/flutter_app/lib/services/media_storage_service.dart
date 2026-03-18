import 'dart:async';
import 'dart:io';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

class MediaStorageService {
  MediaStorageService._();
  static final MediaStorageService instance = MediaStorageService._();

  /// Upload file to Firebase Storage using the client SDK (authenticated users).
  Future<bool> uploadFile(
    String filePath,
    String storagePath, {
    void Function(double)? onProgress,
  }) async {
    StreamSubscription<TaskSnapshot>? progressSub;
    try {
      final file = File(filePath);
      if (!await file.exists()) return false;

      final ref = FirebaseStorage.instance.ref(storagePath);
      final task = ref.putFile(file);

      if (onProgress != null) {
        progressSub = task.snapshotEvents.listen((snapshot) {
          final total = snapshot.totalBytes;
          final progress = total > 0
              ? snapshot.bytesTransferred / total
              : 0.0;
          onProgress(progress);
        });
      }

      await task;
      return true;
    } on FirebaseException catch (e) {
      debugPrint('Firebase upload failed for $storagePath: ${e.message}');
      return false;
    } catch (e) {
      debugPrint('Upload failed for $storagePath: $e');
      return false;
    } finally {
      await progressSub?.cancel();
    }
  }

  /// Upload file via a server-signed URL (guest users without Firebase Auth).
  Future<bool> uploadViaSignedUrl(
    String filePath,
    String signedUrl,
    String contentType, {
    void Function(double)? onProgress,
  }) async {
    try {
      final file = File(filePath);
      if (!await file.exists()) return false;

      final bytes = await file.readAsBytes();
      onProgress?.call(0.0);

      final response = await http.put(
        Uri.parse(signedUrl),
        headers: {'Content-Type': contentType},
        body: bytes,
      );

      if (response.statusCode >= 200 && response.statusCode < 300) {
        onProgress?.call(1.0);
        return true;
      }

      debugPrint('Signed URL upload failed: ${response.statusCode}');
      return false;
    } catch (e) {
      debugPrint('Signed URL upload failed: $e');
      return false;
    }
  }
}
