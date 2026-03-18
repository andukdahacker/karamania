import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:karamania/services/upload_queue.dart';
import 'package:karamania/state/capture_provider.dart';
import 'package:karamania/state/upload_provider.dart';
import 'package:karamania/widgets/capture_toolbar_icon.dart';

Widget _wrapWithProvider(
  Widget child, {
  required CaptureProvider captureProvider,
  required UploadProvider uploadProvider,
}) {
  return MultiProvider(
    providers: [
      ChangeNotifierProvider<CaptureProvider>.value(value: captureProvider),
      ChangeNotifierProvider<UploadProvider>.value(value: uploadProvider),
    ],
    child: MaterialApp(
      home: Scaffold(body: child),
    ),
  );
}

void main() {
  setUp(() {
    UploadQueue.instance.clearAll();
  });

  group('CaptureToolbarIcon', () {
    testWidgets('renders camera icon', (tester) async {
      final captureProvider = CaptureProvider();
      final uploadProvider = UploadProvider();

      await tester.pumpWidget(_wrapWithProvider(
        const CaptureToolbarIcon(),
        captureProvider: captureProvider,
        uploadProvider: uploadProvider,
      ));

      expect(find.byIcon(Icons.camera_alt_outlined), findsOneWidget);

      captureProvider.dispose();
      uploadProvider.dispose();
    });

    testWidgets('tap calls onManualCaptureTriggered', (tester) async {
      final captureProvider = CaptureProvider();
      final uploadProvider = UploadProvider();

      await tester.pumpWidget(_wrapWithProvider(
        const CaptureToolbarIcon(),
        captureProvider: captureProvider,
        uploadProvider: uploadProvider,
      ));

      await tester.tap(find.byKey(const Key('capture-toolbar-icon')));
      await tester.pump();

      expect(captureProvider.isSelectorVisible, isTrue);
      expect(captureProvider.captureTriggerType, 'manual');

      captureProvider.dispose();
      uploadProvider.dispose();
    });

    testWidgets('disabled when isCapturing is true', (tester) async {
      final captureProvider = CaptureProvider();
      captureProvider.onCaptureTypeSelected(CaptureType.photo);
      final uploadProvider = UploadProvider();

      await tester.pumpWidget(_wrapWithProvider(
        const CaptureToolbarIcon(),
        captureProvider: captureProvider,
        uploadProvider: uploadProvider,
      ));

      final iconButton = tester.widget<IconButton>(
        find.byKey(const Key('capture-toolbar-icon')),
      );
      expect(iconButton.onPressed, isNull);

      captureProvider.dispose();
      uploadProvider.dispose();
    });

    testWidgets('disabled when isSelectorVisible is true', (tester) async {
      final captureProvider = CaptureProvider();
      captureProvider.onManualCaptureTriggered();
      final uploadProvider = UploadProvider();

      await tester.pumpWidget(_wrapWithProvider(
        const CaptureToolbarIcon(),
        captureProvider: captureProvider,
        uploadProvider: uploadProvider,
      ));

      final iconButton = tester.widget<IconButton>(
        find.byKey(const Key('capture-toolbar-icon')),
      );
      expect(iconButton.onPressed, isNull);

      captureProvider.dispose();
      uploadProvider.dispose();
    });

    testWidgets('has correct widget key capture-toolbar-icon', (tester) async {
      final captureProvider = CaptureProvider();
      final uploadProvider = UploadProvider();

      await tester.pumpWidget(_wrapWithProvider(
        const CaptureToolbarIcon(),
        captureProvider: captureProvider,
        uploadProvider: uploadProvider,
      ));

      expect(find.byKey(const Key('capture-toolbar-icon')), findsOneWidget);

      captureProvider.dispose();
      uploadProvider.dispose();
    });

    testWidgets('shows upload progress ring when uploads active', (tester) async {
      final captureProvider = CaptureProvider();
      final uploadProvider = UploadProvider();

      // Add a pending upload item
      UploadQueue.instance.enqueue(UploadItem(
        filePath: '/tmp/test.jpg',
        sessionId: 'session-1',
        captureId: 'cap-progress',
        captureType: 'photo',
        triggerType: 'manual',
      ));

      await tester.pumpWidget(_wrapWithProvider(
        const CaptureToolbarIcon(),
        captureProvider: captureProvider,
        uploadProvider: uploadProvider,
      ));

      await tester.pump();

      expect(find.byKey(const Key('capture-upload-progress')), findsOneWidget);
      expect(find.byType(CircularProgressIndicator), findsOneWidget);

      captureProvider.dispose();
      uploadProvider.dispose();
    });

    testWidgets('hides upload progress ring when no active uploads', (tester) async {
      final captureProvider = CaptureProvider();
      final uploadProvider = UploadProvider();

      await tester.pumpWidget(_wrapWithProvider(
        const CaptureToolbarIcon(),
        captureProvider: captureProvider,
        uploadProvider: uploadProvider,
      ));

      expect(find.byKey(const Key('capture-upload-progress')), findsNothing);
      expect(find.byType(CircularProgressIndicator), findsNothing);

      captureProvider.dispose();
      uploadProvider.dispose();
    });
  });
}
