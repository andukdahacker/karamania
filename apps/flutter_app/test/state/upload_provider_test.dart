import 'package:flutter_test/flutter_test.dart';
import 'package:karamania/services/upload_queue.dart';
import 'package:karamania/state/upload_provider.dart';

void main() {
  setUp(() {
    UploadQueue.instance.clearAll();
  });

  group('UploadProvider', () {
    test('hasActiveUploads returns false when queue is empty', () {
      final provider = UploadProvider();
      expect(provider.hasActiveUploads, false);
      provider.dispose();
    });

    test('hasActiveUploads returns true after enqueue', () {
      final provider = UploadProvider();
      provider.enqueue(UploadItem(
        filePath: '/tmp/a.jpg',
        sessionId: 'session-1',
        captureId: 'cap-1',
        captureType: 'photo',
        triggerType: 'manual',
      ));
      expect(provider.hasActiveUploads, true);
      provider.dispose();
    });

    test('pendingCount starts at 0', () {
      final provider = UploadProvider();
      expect(provider.pendingCount, 0);
      provider.dispose();
    });

    test('items reflect enqueued items', () {
      final provider = UploadProvider();
      provider.enqueue(UploadItem(
        filePath: '/tmp/a.jpg',
        sessionId: 'session-1',
        captureId: 'cap-1',
        captureType: 'photo',
        triggerType: 'manual',
      ));
      expect(provider.items.length, 1);
      provider.dispose();
    });

    test('progress returns 1.0 when empty', () {
      final provider = UploadProvider();
      expect(provider.progress, 1.0);
      provider.dispose();
    });

    test('notifies listeners on queue change', () {
      final provider = UploadProvider();
      int notifyCount = 0;
      provider.addListener(() => notifyCount++);

      provider.enqueue(UploadItem(
        filePath: '/tmp/a.jpg',
        sessionId: 'session-1',
        captureId: 'cap-1',
        captureType: 'photo',
        triggerType: 'manual',
      ));

      expect(notifyCount, greaterThanOrEqualTo(1));
      provider.dispose();
    });

    test('clearFinished removes completed items', () {
      final provider = UploadProvider();
      final item = UploadItem(
        filePath: '/tmp/a.jpg',
        sessionId: 'session-1',
        captureId: 'cap-done',
        captureType: 'photo',
        triggerType: 'manual',
        status: UploadStatus.completed,
      );
      UploadQueue.instance.enqueue(item);

      provider.clearFinished();
      expect(provider.items.isEmpty, true);
      provider.dispose();
    });

    test('dispose clears onChanged callback', () {
      final provider = UploadProvider();
      provider.dispose();
      // After dispose, queue should not hold reference to provider callback
      // This just verifies no exception is thrown
      UploadQueue.instance.enqueue(UploadItem(
        filePath: '/tmp/a.jpg',
        sessionId: 'session-1',
        captureId: 'cap-after-dispose',
        captureType: 'photo',
        triggerType: 'manual',
      ));
    });
  });
}
