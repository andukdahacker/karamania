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

class ApiService {
  ApiService({required String baseUrl, runtime.HttpAdapter? adapter}) {
    _authMiddleware = AuthMiddleware();
    _client = KaramaniaApiClient(
      baseUrl: baseUrl,
      adapter: adapter ?? HttpClientAdapter(),
      middleware: [_authMiddleware],
    );
  }

  late final AuthMiddleware _authMiddleware;
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
              ? CreateSessionRequestVibe.fromJson(vibe)
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
