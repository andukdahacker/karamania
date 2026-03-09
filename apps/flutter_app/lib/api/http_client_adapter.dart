import 'package:dart_open_fetch_runtime/dart_open_fetch_runtime.dart';
import 'package:http/http.dart' as http;

class HttpClientAdapter implements HttpAdapter {
  HttpClientAdapter({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  @override
  Future<HttpResponse> send(HttpRequest request) async {
    final response = await switch (request.method) {
      'GET' => _client.get(request.url, headers: request.headers),
      'POST' =>
        _client.post(request.url, headers: request.headers, body: request.body),
      'PUT' =>
        _client.put(request.url, headers: request.headers, body: request.body),
      'DELETE' =>
        _client.delete(request.url, headers: request.headers, body: request.body),
      'PATCH' =>
        _client.patch(request.url, headers: request.headers, body: request.body),
      _ => throw UnsupportedError('Unsupported HTTP method: ${request.method}'),
    };
    return HttpResponse(
      statusCode: response.statusCode,
      headers: response.headers,
      body: response.body,
    );
  }
}
