import 'package:flutter/foundation.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:karamania/state/loading_state.dart';

enum AuthState { unauthenticated, authenticatedFirebase, authenticatedGuest }

/// Reactive state container for authentication.
/// No business logic — SocketClient orchestrates auth-related network calls.
class AuthProvider extends ChangeNotifier {
  User? _firebaseUser;
  String? _guestToken;
  String? _guestId;
  String? _displayName;
  String? _userId;         // Server-side user UUID (not Firebase UID)
  String? _avatarUrl;      // From OAuth provider
  DateTime? _createdAt;    // Account creation date
  AuthState _state = AuthState.unauthenticated;
  LoadingState _authLoading = LoadingState.idle;
  LoadingState _profileLoading = LoadingState.idle;

  AuthState get state => _state;
  User? get firebaseUser => _firebaseUser;
  String? get guestToken => _guestToken;
  String? get guestId => _guestId;
  String? get displayName => _displayName;
  String? get userId => _userId;
  String? get avatarUrl => _avatarUrl;
  DateTime? get createdAt => _createdAt;
  LoadingState get authLoading => _authLoading;
  LoadingState get profileLoading => _profileLoading;
  bool get isAuthenticated => _state != AuthState.unauthenticated;

  set authLoading(LoadingState value) {
    _authLoading = value;
    notifyListeners();
  }

  set profileLoading(LoadingState value) {
    _profileLoading = value;
    notifyListeners();
  }

  /// Fetches user profile from server. Called by bootstrap after Firebase auth.
  /// NOT business logic — just state hydration from API response.
  void onProfileLoaded({
    required String userId,
    required String displayName,
    String? avatarUrl,
    required DateTime createdAt,
  }) {
    _userId = userId;
    _displayName = displayName;
    _avatarUrl = avatarUrl;
    _createdAt = createdAt;
    _profileLoading = LoadingState.success;
    notifyListeners();
  }

  void onProfileLoadFailed() {
    _profileLoading = LoadingState.error;
    notifyListeners();
  }

  Future<String?> get currentToken async {
    switch (_state) {
      case AuthState.authenticatedFirebase:
        return await _firebaseUser?.getIdToken();
      case AuthState.authenticatedGuest:
        return _guestToken;
      case AuthState.unauthenticated:
        return null;
    }
  }

  /// Called by SocketClient after successful guest auth.
  void onGuestAuthenticated(String token, String guestId, String displayName) {
    _guestToken = token;
    _guestId = guestId;
    _displayName = displayName;
    _state = AuthState.authenticatedGuest;
    _authLoading = LoadingState.success;
    notifyListeners();
  }

  /// Called by SocketClient after successful Firebase auth.
  void onFirebaseAuthenticated(User user) {
    _firebaseUser = user;
    _displayName = user.displayName ?? user.email ?? 'User';
    _state = AuthState.authenticatedFirebase;
    _authLoading = LoadingState.success;
    notifyListeners();
  }

  /// Called on sign-out.
  void onSignedOut() {
    _firebaseUser = null;
    _guestToken = null;
    _guestId = null;
    _displayName = null;
    _userId = null;
    _avatarUrl = null;
    _createdAt = null;
    _state = AuthState.unauthenticated;
    _authLoading = LoadingState.idle;
    _profileLoading = LoadingState.idle;
    notifyListeners();
  }

  /// Listen to Firebase Auth state changes. Call once from bootstrap.
  /// [onAuthenticated] callback enables the bootstrap to trigger side effects
  /// (like profile fetch) without putting business logic in the provider.
  void initAuthStateListener({Future<void> Function(User user)? onAuthenticated}) {
    FirebaseAuth.instance.authStateChanges().listen((user) async {
      if (user != null) {
        onFirebaseAuthenticated(user);
        if (onAuthenticated != null) {
          await onAuthenticated(user);
        }
      } else if (_state == AuthState.authenticatedFirebase) {
        onSignedOut();
      }
    });
  }

  /// Sign in with Google via Firebase Auth.
  /// Exception to "no business logic in providers" rule: Firebase Auth SDK
  /// is a client-side native flow, not an HTTP/socket call. State updates
  /// flow back through authStateChanges listener.
  Future<void> signInWithGoogle() async {
    _authLoading = LoadingState.loading;
    notifyListeners();
    try {
      final googleProvider = GoogleAuthProvider();
      await FirebaseAuth.instance.signInWithProvider(googleProvider);
      // State update handled by authStateChanges listener
    } catch (e) {
      _authLoading = LoadingState.error;
      notifyListeners();
      rethrow;
    }
  }

  // TODO: Implement Facebook auth if needed for MVP
  Future<void> signInWithFacebook() async {
    throw UnimplementedError('Facebook auth deferred to reduce Story 1.3 scope');
  }
}
