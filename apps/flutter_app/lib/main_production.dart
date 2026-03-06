import 'package:karamania/config/app_config.dart';
import 'package:karamania/config/bootstrap.dart';

void main() async {
  AppConfig.initialize(flavor: 'production');
  await bootstrap();
}
