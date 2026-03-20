import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:provider/provider.dart';
import 'package:karamania/app.dart';
import 'package:karamania/config/app_config.dart';
import 'package:karamania/state/accessibility_provider.dart';
import 'package:karamania/state/auth_provider.dart';
import 'package:karamania/state/loading_state.dart';
import 'package:karamania/state/capture_provider.dart';
import 'package:karamania/state/party_provider.dart';
import 'package:karamania/socket/client.dart';
import 'package:karamania/state/timeline_provider.dart';
import 'package:karamania/api/api_service.dart';
import 'package:karamania/audio/audio_engine.dart';
import 'package:karamania/services/upload_queue.dart';
import 'package:karamania/state/upload_provider.dart';

Future<void> bootstrap() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Portrait-only orientation lock (Task 1.6)
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
  ]);

  // Firebase initialization using per-flavor dart-define keys
  final config = AppConfig.instance;
  await Firebase.initializeApp(
    options: FirebaseOptions(
      apiKey: config.firebaseApiKey,
      appId: config.firebaseAppId,
      messagingSenderId: config.firebaseMessagingSenderId,
      projectId: config.firebaseProjectId,
      storageBucket: config.firebaseStorageBucket,
      authDomain: config.firebaseAuthDomain,
      iosBundleId: config.firebaseIosBundleId,
    ),
  );

  // Audio engine init — graceful degradation if fails
  try {
    await AudioEngine.instance.init();
    await AudioEngine.instance.preloadAll();
  } catch (e) {
    debugPrint('Audio init failed: $e');
  }

  // Upload queue init — load persisted queue and start connectivity listener
  await UploadQueue.instance.init();

  final apiService = ApiService(baseUrl: AppConfig.instance.serverUrl);
  final authProvider = AuthProvider();

  // Configure upload queue with API access for guest upload fallback
  UploadQueue.instance.configure(
    apiService: apiService,
    tokenProvider: () => authProvider.currentToken,
  );

  // Listen to Firebase Auth state changes and fetch profile on authentication
  authProvider.initAuthStateListener(
    onAuthenticated: (user) async {
      authProvider.profileLoading = LoadingState.loading;
      final token = await user.getIdToken();
      if (token == null) {
        authProvider.onProfileLoadFailed();
        return;
      }
      final profileData = await apiService.fetchUserProfile(token);
      if (profileData != null) {
        try {
          authProvider.onProfileLoaded(
            userId: profileData['id'] as String,
            displayName: profileData['displayName'] as String,
            avatarUrl: profileData['avatarUrl'] as String?,
            createdAt: DateTime.parse(profileData['createdAt'] as String),
          );
        } catch (e) {
          debugPrint('Profile parse failed: $e');
          authProvider.onProfileLoadFailed();
        }
      } else {
        authProvider.onProfileLoadFailed();
      }
    },
  );

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => PartyProvider()),
        ChangeNotifierProvider<AuthProvider>.value(value: authProvider),
        ChangeNotifierProvider(create: (_) => CaptureProvider()),
        ChangeNotifierProvider(create: (_) => TimelineProvider()),
        ChangeNotifierProvider(create: (_) => AccessibilityProvider()),
        ChangeNotifierProvider(create: (_) => UploadProvider()),
        Provider<SocketClient>(create: (_) => SocketClient.instance),
        Provider<ApiService>.value(value: apiService),
      ],
      child: const KaramaniaApp(),
    ),
  );
}
