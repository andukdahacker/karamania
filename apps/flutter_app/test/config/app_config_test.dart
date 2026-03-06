import 'package:flutter_test/flutter_test.dart';
import 'package:karamania/config/app_config.dart';

void main() {
  group('AppConfig', () {
    test('isDev returns true for dev flavor', () {
      AppConfig.initializeForTest(flavor: 'dev');
      expect(AppConfig.instance.isDev, isTrue);
      expect(AppConfig.instance.isStaging, isFalse);
      expect(AppConfig.instance.isProduction, isFalse);
    });

    test('isStaging returns true for staging flavor', () {
      AppConfig.initializeForTest(flavor: 'staging');
      expect(AppConfig.instance.isDev, isFalse);
      expect(AppConfig.instance.isStaging, isTrue);
      expect(AppConfig.instance.isProduction, isFalse);
    });

    test('isProduction returns true for production flavor', () {
      AppConfig.initializeForTest(flavor: 'production');
      expect(AppConfig.instance.isDev, isFalse);
      expect(AppConfig.instance.isStaging, isFalse);
      expect(AppConfig.instance.isProduction, isTrue);
    });

    test('flavor field stores the provided value', () {
      AppConfig.initializeForTest(flavor: 'dev');
      expect(AppConfig.instance.flavor, 'dev');

      AppConfig.initializeForTest(flavor: 'staging');
      expect(AppConfig.instance.flavor, 'staging');

      AppConfig.initializeForTest(flavor: 'production');
      expect(AppConfig.instance.flavor, 'production');
    });
  });
}
