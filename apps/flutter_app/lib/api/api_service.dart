import 'dart:convert';

import 'package:dart_open_fetch_runtime/dart_open_fetch_runtime.dart' as runtime;
import 'package:karamania/api/auth_middleware.dart';
import 'package:karamania/api/generated/karamania_api.dart';
import 'package:karamania/api/http_client_adapter.dart';

class ApiException implements Exception {
  const ApiException({required this.code, required this.message});
  final String code;
  final String message;

  @override
  String toString() => message;
}

class PlaylistImportResult {
  const PlaylistImportResult({
    required this.tracks,
    required this.matched,
    required this.unmatchedCount,
    required this.totalFetched,
  });

  final List<Map<String, dynamic>> tracks;
  final List<Map<String, dynamic>> matched;
  final int unmatchedCount;
  final int totalFetched;
}

class ApiService {
  ApiService({required String baseUrl, runtime.HttpAdapter? adapter}) {
    _baseUrl = baseUrl;
    _authMiddleware = AuthMiddleware();
    final httpAdapter = adapter ?? HttpClientAdapter();
    _chain = runtime.MiddlewareChain(httpAdapter, [_authMiddleware]);
    _client = KaramaniaApiClient(
      baseUrl: baseUrl,
      adapter: httpAdapter,
      middleware: [_authMiddleware],
    );
  }

  late final String _baseUrl;
  late final AuthMiddleware _authMiddleware;
  late final runtime.MiddlewareChain _chain;
  late final KaramaniaApiClient _client;

  Future<CreateSessionData> createSession({
    String? displayName,
    String? vibe,
    String? venueName,
    String? firebaseToken,
  }) async {
    _authMiddleware.token = firebaseToken;
    try {
      final response = await _client.postApiSessions(
        body: CreateSessionRequestInput(
          displayName: displayName,
          vibe: vibe != null
              ? CreateSessionRequestInputVibe.fromJson(vibe)
              : null,
          venueName: venueName,
        ),
      );
      return response.data.data;
    } on runtime.ApiException catch (e) {
      throw _mapException(e);
    } finally {
      _authMiddleware.token = null;
    }
  }

  Future<GuestAuthData> guestAuth({
    required String displayName,
    required String partyCode,
  }) async {
    try {
      final response = await _client.postApiAuthGuest(
        body: GuestAuthRequestInput(
          displayName: displayName,
          partyCode: partyCode,
        ),
      );
      return response.data.data;
    } on runtime.ApiException catch (e) {
      throw _mapException(e);
    }
  }

  Future<PlaylistImportResult> importPlaylist(String playlistUrl, {String? sessionId}) async {
    final basePath = _baseUrl.endsWith('/')
        ? _baseUrl.substring(0, _baseUrl.length - 1)
        : _baseUrl;
    final url = Uri.parse('$basePath/api/playlists/import');
    final bodyMap = <String, dynamic>{'playlistUrl': playlistUrl};
    if (sessionId != null) {
      bodyMap['sessionId'] = sessionId;
    }
    final request = runtime.HttpRequest(
      method: 'POST',
      url: url,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(bodyMap),
    );

    final response = await _chain.send(request);
    if (response.statusCode >= 200 && response.statusCode < 300) {
      final json = jsonDecode(response.body) as Map<String, dynamic>;
      final data = json['data'] as Map<String, dynamic>;
      return PlaylistImportResult(
        tracks: (data['tracks'] as List).map((e) => e as Map<String, dynamic>).toList(),
        matched: (data['matched'] as List).map((e) => e as Map<String, dynamic>).toList(),
        unmatchedCount: data['unmatchedCount'] as int,
        totalFetched: data['totalFetched'] as int,
      );
    }

    try {
      final errorJson = jsonDecode(response.body) as Map<String, dynamic>;
      final parsed = ErrorResponse.fromJson(errorJson);
      throw ApiException(
        code: parsed.error.code,
        message: parsed.error.message,
      );
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(
        code: 'UNKNOWN',
        message: 'Request failed (status ${response.statusCode})',
      );
    }
  }

  ApiException _mapException(runtime.ApiException e) {
    final parsed = e.parsedBody;
    if (parsed is ErrorResponse) {
      return ApiException(
        code: parsed.error.code,
        message: parsed.error.message,
      );
    }
    return ApiException(
      code: 'UNKNOWN',
      message: 'Request failed (status ${e.statusCode})',
    );
  }
}
