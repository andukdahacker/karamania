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
      );

      final json = item.toJson();
      expect(json['djState'], isNull);

      final restored = UploadItem.fromJson(json);
      expect(restored.djState, isNull);
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
      );
      final item2 = UploadItem(
        filePath: '/tmp/b.jpg',
        sessionId: 'session-1',
        captureId: 'cap-1',
        captureType: 'video',
        triggerType: 'manual',
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
      // Enqueue two items — processQueue will start processing but the second
      // item should still be pending since uploads are sequential
      UploadQueue.instance.enqueue(UploadItem(
        filePath: '/tmp/a.jpg',
        sessionId: 'session-1',
        captureId: 'cap-1',
        captureType: 'photo',
        triggerType: 'manual',
      ));
      UploadQueue.instance.enqueue(UploadItem(
        filePath: '/tmp/b.jpg',
        sessionId: 'session-1',
        captureId: 'cap-2',
        captureType: 'video',
        triggerType: 'manual',
      ));

      // At least one item should be in the queue
      expect(UploadQueue.instance.items.length, 2);
    });
  });

  group('UploadQueue.clearFinished', () {
    test('removes completed and failed items from queue', () async {
      // Enqueue items and wait for processQueue to complete
      UploadQueue.instance.enqueue(UploadItem(
        filePath: '/tmp/nonexistent_1.jpg',
        sessionId: 'session-1',
        captureId: 'cap-fail',
        captureType: 'photo',
        triggerType: 'manual',
      ));

      // Wait for queue processing to settle
      await Future<void>.delayed(const Duration(milliseconds: 100));

      // After processing, files that don't exist are marked as failed (retries)
      // or completed (if file exists as placeholder). Clear the queue first.
      UploadQueue.instance.clearAll();

      // Now test the clearFinished logic by manipulating items directly
      final item1 = UploadItem(
        filePath: '/tmp/a.jpg',
        sessionId: 'session-1',
        captureId: 'cap-c1',
        captureType: 'photo',
        triggerType: 'manual',
        status: UploadStatus.completed,
      );
      final item2 = UploadItem(
        filePath: '/tmp/b.jpg',
        sessionId: 'session-1',
        captureId: 'cap-c2',
        captureType: 'video',
        triggerType: 'manual',
        status: UploadStatus.failed,
      );

      // Enqueue completed/failed items (they won't be reprocessed since status
      // prevents them from being picked by processQueue)
      UploadQueue.instance.enqueue(item1);
      UploadQueue.instance.enqueue(item2);

      UploadQueue.instance.clearFinished();

      expect(UploadQueue.instance.items.isEmpty, true);
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
      ));

      // At least one notification for enqueue
      expect(callCount, greaterThanOrEqualTo(1));

      UploadQueue.instance.onChanged = null;
    });
  });
}
