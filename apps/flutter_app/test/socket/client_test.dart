import 'package:flutter_test/flutter_test.dart';
import 'package:karamania/socket/client.dart';

void main() {
  group('SocketClient', () {
    test('singleton instance is accessible', () {
      final client = SocketClient.instance;
      expect(client, isNotNull);
      expect(identical(client, SocketClient.instance), isTrue);
    });

    test('initial isConnected is false', () {
      expect(SocketClient.instance.isConnected, isFalse);
    });

    test('disconnect on unconnected socket does not throw', () {
      expect(() => SocketClient.instance.disconnect(), returnsNormally);
    });

    test('initial currentSessionId is null', () {
      expect(SocketClient.instance.currentSessionId, isNull);
    });
  });
}
