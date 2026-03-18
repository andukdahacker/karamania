import 'package:flutter_test/flutter_test.dart';
import 'package:karamania/services/media_storage_service.dart';

void main() {
  group('MediaStorageService', () {
    test('instance is a singleton', () {
      expect(MediaStorageService.instance, same(MediaStorageService.instance));
    });

    test('uploadFile returns false for nonexistent file', () async {
      final result = await MediaStorageService.instance.uploadFile(
        '/tmp/nonexistent_file_${DateTime.now().millisecondsSinceEpoch}.jpg',
        'session-1/capture-1.jpg',
      );

      expect(result, false);
    });

    test('uploadViaSignedUrl returns false for nonexistent file', () async {
      final result = await MediaStorageService.instance.uploadViaSignedUrl(
        '/tmp/nonexistent_file_${DateTime.now().millisecondsSinceEpoch}.jpg',
        'https://storage.googleapis.com/fake-signed-url',
        'image/jpeg',
      );

      expect(result, false);
    });
  });
}
