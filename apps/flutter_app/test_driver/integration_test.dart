import 'dart:io';

import 'package:integration_test/integration_test_driver_extended.dart';

Future<void> main() async {
  // Navigate to repo root (two levels up from flutter_app)
  final scriptDir = File(Platform.script.toFilePath()).parent.parent;
  final repoRoot = scriptDir.parent.parent;
  final outputDir = Directory('${repoRoot.path}/docs/screenshots');
  if (!outputDir.existsSync()) outputDir.createSync(recursive: true);

  await integrationDriver(
    onScreenshot: (String screenshotName, List<int> screenshotBytes,
        [Map<String, Object?>? args]) async {
      final file = File('${outputDir.path}/$screenshotName.png');
      await file.writeAsBytes(screenshotBytes);
      // ignore: avoid_print
      print('SCREENSHOT_SAVED: ${file.path}');
      return true;
    },
  );
}
