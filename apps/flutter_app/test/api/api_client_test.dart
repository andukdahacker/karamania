import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:karamania/api/api_client.dart';

void main() {
  group('ApiClient.guestAuth', () {
    test('sends correct request body', () async {
      String? capturedBody;
      final mockClient = MockClient((request) async {
        capturedBody = request.body;
        return http.Response(
          jsonEncode({
            'data': {
              'token': 'test-token',
              'guestId': 'guest-123',
              'sessionId': 'session-456',
              'vibe': 'rock',
            },
          }),
          200,
        );
      });

      final apiClient = ApiClient(baseUrl: 'http://localhost', httpClient: mockClient);
      await apiClient.guestAuth(displayName: 'Alice', partyCode: 'VIBE');

      expect(capturedBody, isNotNull);
      final body = jsonDecode(capturedBody!) as Map<String, dynamic>;
      expect(body['displayName'], 'Alice');
      expect(body['partyCode'], 'VIBE');
    });

    test('returns token, guestId, sessionId, vibe on success', () async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'data': {
              'token': 'jwt-token-here',
              'guestId': 'g-001',
              'sessionId': 's-001',
              'vibe': 'kpop',
            },
          }),
          200,
        );
      });

      final apiClient = ApiClient(baseUrl: 'http://localhost', httpClient: mockClient);
      final result = await apiClient.guestAuth(displayName: 'Bob', partyCode: 'KPOP');

      expect(result['token'], 'jwt-token-here');
      expect(result['guestId'], 'g-001');
      expect(result['sessionId'], 's-001');
      expect(result['vibe'], 'kpop');
    });

    test('throws ApiException with NOT_FOUND on 404', () async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'error': {'code': 'NOT_FOUND', 'message': 'No active party with that code'},
          }),
          404,
        );
      });

      final apiClient = ApiClient(baseUrl: 'http://localhost', httpClient: mockClient);

      expect(
        () => apiClient.guestAuth(displayName: 'Charlie', partyCode: 'NOPE'),
        throwsA(isA<ApiException>().having((e) => e.code, 'code', 'NOT_FOUND')),
      );
    });

    test('throws ApiException with SESSION_FULL on 403', () async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'error': {'code': 'SESSION_FULL', 'message': 'This party is full'},
          }),
          403,
        );
      });

      final apiClient = ApiClient(baseUrl: 'http://localhost', httpClient: mockClient);

      expect(
        () => apiClient.guestAuth(displayName: 'Dave', partyCode: 'FULL'),
        throwsA(isA<ApiException>().having((e) => e.code, 'code', 'SESSION_FULL')),
      );
    });
  });
}
