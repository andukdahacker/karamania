import 'package:flutter_test/flutter_test.dart';
import 'package:firebase_auth/firebase_auth.dart' hide AuthProvider;
import 'package:karamania/state/auth_provider.dart';
import 'package:karamania/state/loading_state.dart';

class FakeUser extends Fake implements User {
  @override
  String? get displayName => 'Test User';

  @override
  String? get email => 'test@test.com';
}

void main() {
  late AuthProvider provider;

  setUp(() {
    provider = AuthProvider();
  });

  group('AuthProvider', () {
    test('initial state is unauthenticated', () {
      expect(provider.state, AuthState.unauthenticated);
      expect(provider.firebaseUser, isNull);
      expect(provider.guestToken, isNull);
      expect(provider.guestId, isNull);
      expect(provider.displayName, isNull);
      expect(provider.isAuthenticated, isFalse);
    });

    test('onGuestAuthenticated switches state to authenticatedGuest', () {
      provider.onGuestAuthenticated('test-token', 'guest-123', 'GuestUser');

      expect(provider.state, AuthState.authenticatedGuest);
      expect(provider.guestToken, 'test-token');
      expect(provider.guestId, 'guest-123');
      expect(provider.displayName, 'GuestUser');
      expect(provider.isAuthenticated, isTrue);
    });

    test('onFirebaseAuthenticated switches state to authenticatedFirebase', () {
      final fakeUser = FakeUser();
      provider.onFirebaseAuthenticated(fakeUser);

      expect(provider.state, AuthState.authenticatedFirebase);
      expect(provider.firebaseUser, fakeUser);
      expect(provider.displayName, 'Test User');
      expect(provider.isAuthenticated, isTrue);
    });

    test('onSignedOut resets to unauthenticated and clears all fields', () {
      provider.onGuestAuthenticated('token', 'id', 'name');
      expect(provider.isAuthenticated, isTrue);

      provider.onSignedOut();

      expect(provider.state, AuthState.unauthenticated);
      expect(provider.firebaseUser, isNull);
      expect(provider.guestToken, isNull);
      expect(provider.guestId, isNull);
      expect(provider.displayName, isNull);
      expect(provider.isAuthenticated, isFalse);
    });

    test('profile fields are null initially', () {
      expect(provider.userId, isNull);
      expect(provider.avatarUrl, isNull);
      expect(provider.createdAt, isNull);
      expect(provider.profileLoading, LoadingState.idle);
    });

    test('onProfileLoaded sets userId, avatarUrl, createdAt, profileLoading', () {
      final testDate = DateTime.parse('2026-01-15T10:30:00Z');
      provider.onProfileLoaded(
        userId: 'user-uuid-123',
        displayName: 'Test User',
        avatarUrl: 'https://example.com/avatar.png',
        createdAt: testDate,
      );

      expect(provider.userId, 'user-uuid-123');
      expect(provider.displayName, 'Test User');
      expect(provider.avatarUrl, 'https://example.com/avatar.png');
      expect(provider.createdAt, testDate);
      expect(provider.profileLoading, LoadingState.success);
    });

    test('onProfileLoadFailed sets profileLoading to error', () {
      provider.onProfileLoadFailed();

      expect(provider.profileLoading, LoadingState.error);
    });

    test('onSignedOut clears all profile fields', () {
      provider.onProfileLoaded(
        userId: 'user-uuid-123',
        displayName: 'Test User',
        avatarUrl: 'https://example.com/avatar.png',
        createdAt: DateTime.now(),
      );

      provider.onSignedOut();

      expect(provider.userId, isNull);
      expect(provider.avatarUrl, isNull);
      expect(provider.createdAt, isNull);
      expect(provider.profileLoading, LoadingState.idle);
    });

    test('notifyListeners fires on each state change', () {
      int notifyCount = 0;
      provider.addListener(() => notifyCount++);

      provider.onGuestAuthenticated('token', 'id', 'name');
      expect(notifyCount, 1);

      provider.onSignedOut();
      expect(notifyCount, 2);

      final fakeUser = FakeUser();
      provider.onFirebaseAuthenticated(fakeUser);
      expect(notifyCount, 3);
    });
  });
}
