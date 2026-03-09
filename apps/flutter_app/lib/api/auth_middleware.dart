import 'package:dart_open_fetch_runtime/dart_open_fetch_runtime.dart';

class AuthMiddleware extends Middleware {
  String? token;

  @override
  Future<HttpResponse> handle(HttpRequest request, Next next) {
    if (token != null) {
      final updatedHeaders = Map<String, String>.from(request.headers);
      updatedHeaders['Authorization'] = 'Bearer $token';
      return next(HttpRequest(
        method: request.method,
        url: request.url,
        headers: updatedHeaders,
        body: request.body,
      ));
    }
    return next(request);
  }
}
