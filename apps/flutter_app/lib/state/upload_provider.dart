import 'package:flutter/foundation.dart';
import 'package:karamania/services/upload_queue.dart';

/// Reactive wrapper around UploadQueue for widget binding.
class UploadProvider extends ChangeNotifier {
  UploadProvider() {
    UploadQueue.instance.onChanged = _onQueueChanged;
  }

  void _onQueueChanged() {
    notifyListeners();
  }

  bool get hasActiveUploads => UploadQueue.instance.hasActiveUploads;
  bool get isProcessing => UploadQueue.instance.isProcessing;
  int get pendingCount => UploadQueue.instance.pendingCount;
  double get progress => UploadQueue.instance.progress;
  List<UploadItem> get items => UploadQueue.instance.items;

  void enqueue(UploadItem item) {
    UploadQueue.instance.enqueue(item);
  }

  void clearFinished() {
    UploadQueue.instance.clearFinished();
  }

  @override
  void dispose() {
    UploadQueue.instance.onChanged = null;
    super.dispose();
  }
}
