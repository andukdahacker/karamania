import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:provider/provider.dart';
import 'package:karamania/app.dart';
import 'package:karamania/config/app_config.dart';
import 'package:karamania/state/accessibility_provider.dart';
import 'package:karamania/state/auth_provider.dart';
import 'package:karamania/state/capture_provider.dart';
import 'package:karamania/state/party_provider.dart';
import 'package:karamania/socket/client.dart';
import 'package:karamania/state/timeline_provider.dart';
import 'package:karamania/api/api_client.dart';

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

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => PartyProvider()),
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => CaptureProvider()),
        ChangeNotifierProvider(create: (_) => TimelineProvider()),
        ChangeNotifierProvider(create: (_) => AccessibilityProvider()),
        Provider<SocketClient>(create: (_) => SocketClient.instance),
        Provider<ApiClient>(create: (_) => ApiClient(baseUrl: AppConfig.instance.serverUrl)),
      ],
      child: const KaramaniaApp(),
    ),
  );
}
