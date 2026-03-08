import 'package:socket_io_client/socket_io_client.dart' as io;
import 'package:karamania/api/api_client.dart';
import 'package:karamania/state/auth_provider.dart';
import 'package:karamania/state/loading_state.dart';
import 'package:karamania/state/party_provider.dart';
import 'package:karamania/theme/dj_theme.dart';

/// Singleton Socket.io client.
/// Only SocketClient calls mutation methods on providers.
class SocketClient {
  SocketClient._();
  static final SocketClient instance = SocketClient._();

  io.Socket? _socket;
  bool _isConnected = false;
  String? _currentSessionId;

  bool get isConnected => _isConnected;
  String? get currentSessionId => _currentSessionId;

  Future<void> connect({
    required String serverUrl,
    required String token,
    required String sessionId,
    String? displayName,
  }) async {
    _currentSessionId = sessionId;

    _socket = io.io(
      serverUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({
            'token': token,
            'sessionId': sessionId,
            'displayName': displayName,
          })
          .setReconnectionDelay(500)
          .setReconnectionDelayMax(3000)
          .setReconnectionAttempts(20)
          .build(),
    );

    _socket!.onConnect((_) {
      _isConnected = true;
    });

    _socket!.onDisconnect((reason) {
      _isConnected = false;
      // If server kicked us (auth failure), don't auto-reconnect
      if (reason == 'io server disconnect') {
        _socket?.disconnect();
      }
    });

    _socket!.onConnectError((data) {
      _isConnected = false;
    });

    _socket!.onReconnect((_) {
      _isConnected = true;
    });
  }

  void disconnect() {
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
    _isConnected = false;
    _currentSessionId = null;
  }

  void on(String event, void Function(dynamic) callback) {
    _socket?.on(event, callback);
  }

  void emit(String event, [dynamic data]) {
    _socket?.emit(event, data);
  }

  void updateVibe({
    required PartyProvider partyProvider,
    required PartyVibe vibe,
  }) {
    partyProvider.onVibeChanged(vibe);
    emit('party:vibeChanged', {'vibe': vibe.name});
  }

  Future<void> createParty({
    required ApiClient apiClient,
    required AuthProvider authProvider,
    required PartyProvider partyProvider,
    required String serverUrl,
    String? displayName,
    String? vibe,
  }) async {
    partyProvider.onCreatePartyLoading(LoadingState.loading);
    try {
      final token = await authProvider.currentToken;
      final result = await apiClient.createSession(
        displayName: displayName,
        vibe: vibe,
        firebaseToken: token,
      );
      final sessionId = result['sessionId'] as String;
      final partyCode = result['partyCode'] as String;
      final guestToken = result['token'] as String?;
      final guestId = result['guestId'] as String?;

      if (guestToken != null && guestId != null) {
        authProvider.onGuestAuthenticated(
          guestToken,
          guestId,
          displayName ?? 'Host',
        );
      }

      partyProvider.onPartyCreated(sessionId, partyCode);

      final connectToken = guestToken ?? token;
      if (connectToken == null) throw Exception('No auth token available');

      await connect(
        serverUrl: serverUrl,
        token: connectToken,
        sessionId: sessionId,
        displayName: displayName ?? authProvider.displayName,
      );
    } catch (e) {
      partyProvider.onCreatePartyLoading(LoadingState.error);
      rethrow;
    }
  }
}
