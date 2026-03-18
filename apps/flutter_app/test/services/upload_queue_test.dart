import 'package:flutter_test/flutter_test.dart';
import 'package:karamania/services/upload_queue.dart';

void main() {
  setUp(() {
    UploadQueue.instance.clearAll();
  });

  group('UploadItem serialization', () {
    test('toJson and fromJson round-trip correctly', () {
      final item = UploadItem(
        filePath: '/tmp/capture.jpg',
        sessionId: 'session-1',
        captureId: 'cap-1',
        captureType: 'photo',
        triggerType: 'manual',
        storagePath: 'session-1/cap-1.jpg',
        djState: {'state': 'song', 'songCount': 3},
        status: UploadStatus.pending,
        retryCount: 2,
        createdAt: DateTime(2026, 3, 18),
      );

      final json = item.toJson();
      final restored = UploadItem.fromJson(json);

      expect(restored.filePath, item.filePath);
      expect(restored.sessionId, item.sessionId);
      expect(restored.captureId, item.captureId);
      expect(restored.captureType, item.captureType);
      expect(restored.triggerType, item.triggerType);
      expect(restored.storagePath, item.storagePath);
      expect(restored.djState, item.djState);
      expect(restored.status, item.status);
      expect(restored.retryCount, item.retryCount);
      expect(restored.createdAt.millisecondsSinceEpoch,
          item.createdAt.millisecondsSinceEpoch);
    });

    test('toJson handles null djState', () {
      final item = UploadItem(
        filePath: '/tmp/capture.jpg',
        sessionId: 'session-1',
        captureId: 'cap-2',
        captureType: 'video',
        triggerType: 'session_start',
        storagePath: 'session-1/cap-2.mp4',
      );

      final json = item.toJson();
      expect(json['djState'], isNull);

      final restored = UploadItem.fromJson(json);
      expect(restored.djState, isNull);
    });

    test('storagePath is serialized and deserialized correctly', () {
      final item = UploadItem(
        filePath: '/tmp/capture.m4a',
        sessionId: 'session-1',
        captureId: 'cap-3',
        captureType: 'audio',
        triggerType: 'manual',
        storagePath: 'session-1/cap-3.m4a',
      );

      final json = item.toJson();
      expect(json['storagePath'], 'session-1/cap-3.m4a');

      final restored = UploadItem.fromJson(json);
      expect(restored.storagePath, 'session-1/cap-3.m4a');
    });
  });

  group('UploadQueue.enqueue', () {
    test('adds item to queue', () {
      final item = UploadItem(
        filePath: '/tmp/a.jpg',
        sessionId: 'session-1',
        captureId: 'cap-1',
        captureType: 'photo',
        triggerType: 'manual',
        storagePath: 'session-1/cap-1.jpg',
      );

      UploadQueue.instance.enqueue(item);

      expect(UploadQueue.instance.items.length, 1);
      expect(UploadQueue.instance.items.first.captureId, 'cap-1');
    });

    test('prevents duplicate captureId', () {
      final item1 = UploadItem(
        filePath: '/tmp/a.jpg',
        sessionId: 'session-1',
        captureId: 'cap-1',
        captureType: 'photo',
        triggerType: 'manual',
        storagePath: 'session-1/cap-1.jpg',
      );
      final item2 = UploadItem(
        filePath: '/tmp/b.jpg',
        sessionId: 'session-1',
        captureId: 'cap-1',
        captureType: 'video',
        triggerType: 'manual',
        storagePath: 'session-1/cap-1.mp4',
      );

      UploadQueue.instance.enqueue(item1);
      UploadQueue.instance.enqueue(item2);

      expect(UploadQueue.instance.items.length, 1);
    });
  });

  group('UploadQueue.hasActiveUploads', () {
    test('returns false when queue is empty', () {
      expect(UploadQueue.instance.hasActiveUploads, false);
    });

    test('returns true when pending items exist', () {
      UploadQueue.instance.enqueue(UploadItem(
        filePath: '/tmp/a.jpg',
        sessionId: 'session-1',
        captureId: 'cap-1',
        captureType: 'photo',
        triggerType: 'manual',
        storagePath: 'session-1/cap-1.jpg',
      ));

      expect(UploadQueue.instance.hasActiveUploads, true);
    });
  });

  group('UploadQueue.progress', () {
    test('returns 1.0 when queue is empty', () {
      expect(UploadQueue.instance.progress, 1.0);
    });
  });

  group('UploadQueue.pendingCount', () {
    test('returns number of pending items', () {
      UploadQueue.instance.enqueue(UploadItem(
        filePath: '/tmp/a.jpg',
        sessionId: 'session-1',
        captureId: 'cap-1',
        captureType: 'photo',
        triggerType: 'manual',
        storagePath: 'session-1/cap-1.jpg',
      ));
      UploadQueue.instance.enqueue(UploadItem(
        filePath: '/tmp/b.jpg',
        sessionId: 'session-1',
        captureId: 'cap-2',
        captureType: 'video',
        triggerType: 'manual',
        storagePath: 'session-1/cap-2.mp4',
      ));

      expect(UploadQueue.instance.items.length, 2);
    });
  });

  group('UploadQueue.clearFinished', () {
    test('removes completed and failed items from queue', () async {
      UploadQueue.instance.enqueue(UploadItem(
        filePath: '/tmp/nonexistent_1.jpg',
        sessionId: 'session-1',
        captureId: 'cap-fail',
        captureType: 'photo',
        triggerType: 'manual',
        storagePath: 'session-1/cap-fail.jpg',
      ));

      await Future<void>.delayed(const Duration(milliseconds: 100));

      UploadQueue.instance.clearAll();

      final item1 = UploadItem(
        filePath: '/tmp/a.jpg',
        sessionId: 'session-1',
        captureId: 'cap-c1',
        captureType: 'photo',
        triggerType: 'manual',
        storagePath: 'session-1/cap-c1.jpg',
        status: UploadStatus.completed,
      );
      final item2 = UploadItem(
        filePath: '/tmp/b.jpg',
        sessionId: 'session-1',
        captureId: 'cap-c2',
        captureType: 'video',
        triggerType: 'manual',
        storagePath: 'session-1/cap-c2.mp4',
        status: UploadStatus.failed,
      );

      UploadQueue.instance.enqueue(item1);
      UploadQueue.instance.enqueue(item2);

      UploadQueue.instance.clearFinished();

      expect(UploadQueue.instance.items.isEmpty, true);
    });
  });

  group('UploadQueue.currentUploadProgress', () {
    test('starts at 0.0', () {
      expect(UploadQueue.instance.currentUploadProgress, 0.0);
    });
  });

  group('UploadQueue.onChanged', () {
    test('notifies callback when items are enqueued', () {
      int callCount = 0;
      UploadQueue.instance.onChanged = () => callCount++;

      UploadQueue.instance.enqueue(UploadItem(
        filePath: '/tmp/a.jpg',
        sessionId: 'session-1',
        captureId: 'cap-1',
        captureType: 'photo',
        triggerType: 'manual',
        storagePath: 'session-1/cap-1.jpg',
      ));

      expect(callCount, greaterThanOrEqualTo(1));

      UploadQueue.instance.onChanged = null;
    });
  });
}
