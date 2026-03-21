import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:dart_open_fetch_runtime/dart_open_fetch_runtime.dart' as runtime;
import 'package:karamania/api/auth_middleware.dart';
// Hide generated timeline types: dart_open_fetch emits nullable fields as
// `dynamic` and participantCount as `double`. We use the manually typed
// SessionTimelineItem from timeline_provider.dart instead.
import 'package:karamania/api/generated/karamania_api.dart'
    hide SessionTimelineItem, SessionTimelineItemInput;
import 'package:karamania/api/http_client_adapter.dart';
import 'package:karamania/state/session_detail_provider.dart';
import 'package:karamania/state/timeline_provider.dart';

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

  /// Create capture metadata on server, returns captureId and storagePath.
  Future<({String captureId, String storagePath})> createCapture({
    required String sessionId,
    required String captureType,
    required String triggerType,
    String? userId,
    String? token,
  }) async {
    _authMiddleware.token = token;
    try {
      final basePath = _baseUrl.endsWith('/')
          ? _baseUrl.substring(0, _baseUrl.length - 1)
          : _baseUrl;
      final url = Uri.parse('$basePath/api/sessions/$sessionId/captures');
      final bodyMap = <String, dynamic>{
        'captureType': captureType,
        'triggerType': triggerType,
      };
      if (userId != null) bodyMap['userId'] = userId;

      final request = runtime.HttpRequest(
        method: 'POST',
        url: url,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(bodyMap),
      );
      final response = await _chain.send(request);

      if (response.statusCode == 201) {
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        final data = json['data'] as Map<String, dynamic>;
        return (
          captureId: data['id'] as String,
          storagePath: data['storagePath'] as String,
        );
      }

      try {
        final errorJson = jsonDecode(response.body) as Map<String, dynamic>;
        final parsed = ErrorResponse.fromJson(errorJson);
        throw ApiException(code: parsed.error.code, message: parsed.error.message);
      } catch (e) {
        if (e is ApiException) rethrow;
        throw ApiException(code: 'UNKNOWN', message: 'Request failed (status ${response.statusCode})');
      }
    } finally {
      _authMiddleware.token = null;
    }
  }

  /// Get a signed upload URL for a capture (used by guest users).
  Future<({String uploadUrl, String storagePath})> getUploadUrl({
    required String sessionId,
    required String captureId,
    String? token,
  }) async {
    _authMiddleware.token = token;
    try {
      final basePath = _baseUrl.endsWith('/')
          ? _baseUrl.substring(0, _baseUrl.length - 1)
          : _baseUrl;
      final url = Uri.parse('$basePath/api/sessions/$sessionId/captures/$captureId/upload-url');
      final request = runtime.HttpRequest(
        method: 'GET',
        url: url,
        headers: {'Content-Type': 'application/json'},
      );
      final response = await _chain.send(request);

      if (response.statusCode == 200) {
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        final data = json['data'] as Map<String, dynamic>;
        return (
          uploadUrl: data['uploadUrl'] as String,
          storagePath: data['storagePath'] as String,
        );
      }

      try {
        final errorJson = jsonDecode(response.body) as Map<String, dynamic>;
        final parsed = ErrorResponse.fromJson(errorJson);
        throw ApiException(code: parsed.error.code, message: parsed.error.message);
      } catch (e) {
        if (e is ApiException) rethrow;
        throw ApiException(code: 'UNKNOWN', message: 'Request failed (status ${response.statusCode})');
      }
    } finally {
      _authMiddleware.token = null;
    }
  }

  /// Fetches the authenticated user's profile from the server.
  /// Caller must provide the Firebase ID token.
  /// Returns null on failure (network error, 401, etc.)
  Future<Map<String, dynamic>?> fetchUserProfile(String token) async {
    _authMiddleware.token = token;
    try {
      final basePath = _baseUrl.endsWith('/')
          ? _baseUrl.substring(0, _baseUrl.length - 1)
          : _baseUrl;
      final url = Uri.parse('$basePath/api/users/me');
      final request = runtime.HttpRequest(
        method: 'GET',
        url: url,
        headers: {'Content-Type': 'application/json'},
      );
      final response = await _chain.send(request);
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body) as Map<String, dynamic>;
        return body['data'] as Map<String, dynamic>?;
      }
      return null;
    } catch (e) {
      debugPrint('Profile fetch failed: $e');
      return null;
    } finally {
      _authMiddleware.token = null;
    }
  }

  /// Upgrades a guest session to a full Firebase account.
  /// Returns the upgraded user profile data on success, null on failure.
  Future<Map<String, dynamic>?> upgradeGuestToAccount({
    required String firebaseToken,
    required String guestId,
    required String sessionId,
    required String guestDisplayName,
    List<String> captureIds = const [],
  }) async {
    _authMiddleware.token = null;
    try {
      final basePath = _baseUrl.endsWith('/')
          ? _baseUrl.substring(0, _baseUrl.length - 1)
          : _baseUrl;
      final url = Uri.parse('$basePath/api/users/upgrade');
      final request = runtime.HttpRequest(
        method: 'POST',
        url: url,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'firebaseToken': firebaseToken,
          'guestId': guestId,
          'sessionId': sessionId,
          'guestDisplayName': guestDisplayName,
          'captureIds': captureIds,
        }),
      );
      final response = await _chain.send(request);
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body) as Map<String, dynamic>;
        return body['data'] as Map<String, dynamic>?;
      }
      debugPrint('Upgrade failed: ${response.statusCode} ${response.body}');
      return null;
    } catch (e) {
      debugPrint('Upgrade error: $e');
      return null;
    }
  }

  /// Fetches paginated session timeline for authenticated user.
  Future<({List<SessionTimelineItem> sessions, int total})> fetchSessions({
    required String token,
    int limit = 20,
    int offset = 0,
  }) async {
    _authMiddleware.token = token;
    try {
      final basePath = _baseUrl.endsWith('/')
          ? _baseUrl.substring(0, _baseUrl.length - 1)
          : _baseUrl;
      final url = Uri.parse('$basePath/api/sessions?limit=$limit&offset=$offset');
      final request = runtime.HttpRequest(
        method: 'GET',
        url: url,
        headers: {'Content-Type': 'application/json'},
      );
      final response = await _chain.send(request);
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body) as Map<String, dynamic>;
        final data = body['data'] as Map<String, dynamic>;
        final sessionsJson = data['sessions'] as List;
        final total = data['total'] as int;
        final sessions = sessionsJson.map((json) {
          final s = json as Map<String, dynamic>;
          return SessionTimelineItem(
            id: s['id'] as String,
            venueName: s['venueName'] as String?,
            endedAt: s['endedAt'] as String?,
            participantCount: s['participantCount'] as int,
            topAward: s['topAward'] as String?,
            thumbnailUrl: s['thumbnailUrl'] as String?,
          );
        }).toList();
        return (sessions: sessions, total: total);
      }

      try {
        final errorJson = jsonDecode(response.body) as Map<String, dynamic>;
        final parsed = ErrorResponse.fromJson(errorJson);
        throw ApiException(code: parsed.error.code, message: parsed.error.message);
      } catch (e) {
        if (e is ApiException) rethrow;
        throw ApiException(code: 'UNKNOWN', message: 'Request failed (status ${response.statusCode})');
      }
    } finally {
      _authMiddleware.token = null;
    }
  }

  /// Fetches full session detail for an authenticated user.
  Future<SessionDetail> fetchSessionDetail({
    required String token,
    required String sessionId,
  }) async {
    _authMiddleware.token = token;
    try {
      final basePath = _baseUrl.endsWith('/')
          ? _baseUrl.substring(0, _baseUrl.length - 1)
          : _baseUrl;
      final url = Uri.parse('$basePath/api/sessions/$sessionId');
      final request = runtime.HttpRequest(
        method: 'GET',
        url: url,
        headers: {'Content-Type': 'application/json'},
      );
      final response = await _chain.send(request);
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body) as Map<String, dynamic>;
        final data = body['data'] as Map<String, dynamic>;
        return SessionDetail.fromJson(data);
      }

      try {
        final errorJson = jsonDecode(response.body) as Map<String, dynamic>;
        final parsed = ErrorResponse.fromJson(errorJson);
        throw ApiException(code: parsed.error.code, message: parsed.error.message);
      } catch (e) {
        if (e is ApiException) rethrow;
        throw ApiException(code: 'UNKNOWN', message: 'Request failed (status ${response.statusCode})');
      }
    } finally {
      _authMiddleware.token = null;
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
