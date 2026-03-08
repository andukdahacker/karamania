import 'dart:convert';

import 'package:http/http.dart' as http;

class ApiClient {
  ApiClient({required this.baseUrl});

  final String baseUrl;

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

    final response = await http.post(
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
}
