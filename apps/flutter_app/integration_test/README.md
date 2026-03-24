# Integration Tests

Flutter integration tests run on a real device or emulator. They exercise the
full widget tree (providers, routing, theming) in a way that unit/widget tests
cannot.

## Prerequisites

- A running iOS Simulator, Android Emulator, or a connected physical device.
- Flutter SDK installed and on your `PATH`.

## Running

### Basic run (uses stubbed config, no server needed)

```bash
cd apps/flutter_app
flutter test integration_test/
```

### Run with local dev environment config

If you need the app to connect to a local server (for future server-dependent
tests), pass the dart-define file:

```bash
cd apps/flutter_app
flutter test integration_test/ \
  --dart-define-from-file=dart_defines_local.json
```

### Run a single test file

```bash
cd apps/flutter_app
flutter test integration_test/app_test.dart
```

## What these tests cover

| Area | Status |
|------|--------|
| App launch / home screen renders | Active |
| Navigation to join screen | Active |
| Party join flow (server required) | Stub / skipped |
| Reaction UI during party | Stub / skipped |
| Ceremony overlay display | Stub / skipped |

## Design decisions

- **No server communication**: Current tests use `AppConfig.initializeForTest`
  which stubs out all server URLs. Socket and HTTP calls are not exercised here;
  that coverage lives in the server-side bot tests.
- **Provider tree mirrors production**: The test helper (`helpers/test_app.dart`)
  recreates the same `MultiProvider` tree as `bootstrap.dart` so screens find
  every provider they expect.
- **GoRouter routes duplicated**: Routes are duplicated in the test helper
  rather than importing the production `_router` (which is library-private).
  If routes change in `app.dart`, update `helpers/test_app.dart` accordingly.
