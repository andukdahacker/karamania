import 'dart:convert';

import 'package:http/http.dart' as http;

class ApiException implements Exception {
  const ApiException({required this.code, required this.message});
  final String code;
  final String message;

  @override
  String toString() => message;
}

class ApiClient {
  ApiClient({required this.baseUrl, http.Client? httpClient})
      : _httpClient = httpClient;

  final String baseUrl;
  final http.Client? _httpClient;

  Future<http.Response> _post(Uri url, {Map<String, String>? headers, Object? body}) {
    if (_httpClient != null) {
      return _httpClient.post(url, headers: headers, body: body);
    }
    return http.post(url, headers: headers, body: body);
  }

  Future<Map<String, dynamic>> createSession({
    String? displayName,
    String? vibe,
    String? venueName,
    String? firebaseToken,
  }) async {
    final headers = <String, String>{'Content-Type': 'application/json'};
    if (firebaseToken != null) {
      headers['Authorization'] = 'Bearer $firebaseToken';
    }
    final body = <String, dynamic>{};
    if (displayName != null) body['displayName'] = displayName;
    if (vibe != null) body['vibe'] = vibe;
    if (venueName != null) body['venueName'] = venueName;

    final response = await _post(
      Uri.parse('$baseUrl/api/sessions'),
      headers: headers,
      body: jsonEncode(body),
    );
    if (response.statusCode != 201) {
      throw Exception('Failed to create session: ${response.body}');
    }
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['data'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> guestAuth({
    required String displayName,
    required String partyCode,
  }) async {
    final response = await _post(
      Uri.parse('$baseUrl/api/auth/guest'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'displayName': displayName,
        'partyCode': partyCode,
      }),
    );

    if (response.statusCode == 200) {
      final json = jsonDecode(response.body) as Map<String, dynamic>;
      return json['data'] as Map<String, dynamic>;
    }

    // Parse error response
    try {
      final json = jsonDecode(response.body) as Map<String, dynamic>;
      final error = json['error'] as Map<String, dynamic>?;
      if (error != null) {
        throw ApiException(
          code: error['code'] as String? ?? 'UNKNOWN',
          message: error['message'] as String? ?? 'An error occurred',
        );
      }
    } catch (e) {
      if (e is ApiException) rethrow;
    }

    throw ApiException(
      code: 'UNKNOWN',
      message: 'Failed to join party (status ${response.statusCode})',
    );
  }
}
