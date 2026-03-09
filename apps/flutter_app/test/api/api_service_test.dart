import 'dart:convert';

import 'package:dart_open_fetch_runtime/dart_open_fetch_runtime.dart'
    show HttpAdapter, HttpRequest, HttpResponse;
import 'package:flutter_test/flutter_test.dart';
import 'package:karamania/api/api_service.dart';

class _MockHttpAdapter implements HttpAdapter {
  _MockHttpAdapter(this._handler);
  final Future<HttpResponse> Function(HttpRequest) _handler;

  @override
  Future<HttpResponse> send(HttpRequest request) => _handler(request);
}

void main() {
  group('ApiService.guestAuth', () {
    test('sends correct request body', () async {
      String? capturedBody;
      final adapter = _MockHttpAdapter((request) async {
        capturedBody = request.body;
        return HttpResponse(
          statusCode: 200,
          body: jsonEncode({
            'data': {
              'token': 'test-token',
              'guestId': 'guest-123',
              'sessionId': 'session-456',
              'vibe': 'rock',
              'status': 'lobby',
            },
          }),
        );
      });

      final apiService =
          ApiService(baseUrl: 'http://localhost', adapter: adapter);
      await apiService.guestAuth(displayName: 'Alice', partyCode: 'VIBE');

      expect(capturedBody, isNotNull);
      final body = jsonDecode(capturedBody!) as Map<String, dynamic>;
      expect(body['displayName'], 'Alice');
      expect(body['partyCode'], 'VIBE');
    });

    test('returns typed GuestAuthData on success', () async {
      final adapter = _MockHttpAdapter((request) async {
        return HttpResponse(
          statusCode: 200,
          body: jsonEncode({
            'data': {
              'token': 'jwt-token-here',
              'guestId': 'g-001',
              'sessionId': 's-001',
              'vibe': 'kpop',
              'status': 'lobby',
            },
          }),
        );
      });

      final apiService =
          ApiService(baseUrl: 'http://localhost', adapter: adapter);
      final result =
          await apiService.guestAuth(displayName: 'Bob', partyCode: 'KPOP');

      expect(result.token, 'jwt-token-here');
      expect(result.guestId, 'g-001');
      expect(result.sessionId, 's-001');
      expect(result.vibe, 'kpop');
      expect(result.status, 'lobby');
    });

    test('throws ApiException with NOT_FOUND on 404', () async {
      final adapter = _MockHttpAdapter((request) async {
        return HttpResponse(
          statusCode: 404,
          body: jsonEncode({
            'error': {
              'code': 'NOT_FOUND',
              'message': 'No active party with that code',
            },
          }),
        );
      });

      final apiService =
          ApiService(baseUrl: 'http://localhost', adapter: adapter);

      expect(
        () => apiService.guestAuth(displayName: 'Charlie', partyCode: 'NOPE'),
        throwsA(
            isA<ApiException>().having((e) => e.code, 'code', 'NOT_FOUND')),
      );
    });

    test('throws ApiException with SESSION_FULL on 403', () async {
      final adapter = _MockHttpAdapter((request) async {
        return HttpResponse(
          statusCode: 403,
          body: jsonEncode({
            'error': {
              'code': 'SESSION_FULL',
              'message': 'This party is full',
            },
          }),
        );
      });

      final apiService =
          ApiService(baseUrl: 'http://localhost', adapter: adapter);

      expect(
        () => apiService.guestAuth(displayName: 'Dave', partyCode: 'FULL'),
        throwsA(
            isA<ApiException>().having((e) => e.code, 'code', 'SESSION_FULL')),
      );
    });
  });
}
