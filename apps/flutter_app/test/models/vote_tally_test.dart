import 'package:flutter_test/flutter_test.dart';
import 'package:karamania/state/party_provider.dart';

void main() {
  group('VoteTally', () {
    test('fromJson creates instance with up and skip', () {
      final json = {'up': 3, 'skip': 2};

      final tally = VoteTally.fromJson(json);

      expect(tally.up, 3);
      expect(tally.skip, 2);
    });

    test('fromJson handles zero values', () {
      final json = {'up': 0, 'skip': 0};

      final tally = VoteTally.fromJson(json);

      expect(tally.up, 0);
      expect(tally.skip, 0);
    });
  });
}
