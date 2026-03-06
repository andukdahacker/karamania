import 'package:flutter/foundation.dart';

/// Per-environment configuration populated from `--dart-define` values.
class AppConfig {
  static late AppConfig _instance;

  final String flavor;
  final String serverUrl;

  // Firebase keys — platform-specific
  final String firebaseIosApiKey;
  final String firebaseIosAppId;
  final String firebaseAndroidApiKey;
  final String firebaseAndroidAppId;

  // Firebase keys — shared
  final String firebaseMessagingSenderId;
  final String firebaseProjectId;
  final String firebaseStorageBucket;
  final String firebaseAuthDomain;
  final String firebaseIosBundleId;

  AppConfig._({
    required this.flavor,
    required this.serverUrl,
    required this.firebaseIosApiKey,
    required this.firebaseIosAppId,
    required this.firebaseAndroidApiKey,
    required this.firebaseAndroidAppId,
    required this.firebaseMessagingSenderId,
    required this.firebaseProjectId,
    required this.firebaseStorageBucket,
    required this.firebaseAuthDomain,
    required this.firebaseIosBundleId,
  });

  static AppConfig get instance => _instance;

  /// Returns the correct API key for the current platform.
  String get firebaseApiKey =>
      defaultTargetPlatform == TargetPlatform.iOS ||
              defaultTargetPlatform == TargetPlatform.macOS
          ? firebaseIosApiKey
          : firebaseAndroidApiKey;

  /// Returns the correct App ID for the current platform.
  String get firebaseAppId =>
      defaultTargetPlatform == TargetPlatform.iOS ||
              defaultTargetPlatform == TargetPlatform.macOS
          ? firebaseIosAppId
          : firebaseAndroidAppId;

  static void initialize({required String flavor}) {
    _instance = AppConfig._(
      flavor: flavor,
      serverUrl: const String.fromEnvironment('SERVER_URL'),
      firebaseIosApiKey:
          const String.fromEnvironment('FIREBASE_IOS_API_KEY'),
      firebaseIosAppId:
          const String.fromEnvironment('FIREBASE_IOS_APP_ID'),
      firebaseAndroidApiKey:
          const String.fromEnvironment('FIREBASE_ANDROID_API_KEY'),
      firebaseAndroidAppId:
          const String.fromEnvironment('FIREBASE_ANDROID_APP_ID'),
      firebaseMessagingSenderId:
          const String.fromEnvironment('FIREBASE_MESSAGING_SENDER_ID'),
      firebaseProjectId:
          const String.fromEnvironment('FIREBASE_PROJECT_ID'),
      firebaseStorageBucket:
          const String.fromEnvironment('FIREBASE_STORAGE_BUCKET'),
      firebaseAuthDomain:
          const String.fromEnvironment('FIREBASE_AUTH_DOMAIN'),
      firebaseIosBundleId:
          const String.fromEnvironment('FIREBASE_IOS_BUNDLE_ID'),
    );
  }

  /// For testing only.
  static void initializeForTest({required String flavor}) {
    _instance = AppConfig._(
      flavor: flavor,
      serverUrl: '',
      firebaseIosApiKey: '',
      firebaseIosAppId: '',
      firebaseAndroidApiKey: '',
      firebaseAndroidAppId: '',
      firebaseMessagingSenderId: '',
      firebaseProjectId: '',
      firebaseStorageBucket: '',
      firebaseAuthDomain: '',
      firebaseIosBundleId: '',
    );
  }

  bool get isDev => flavor == 'dev';
  bool get isStaging => flavor == 'staging';
  bool get isProduction => flavor == 'production';
}
