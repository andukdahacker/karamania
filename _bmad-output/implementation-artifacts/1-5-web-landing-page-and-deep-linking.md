# Story 1.5: Web Landing Page & Deep Linking

Status: done

## Story

As a guest receiving a party invitation,
I want to scan a QR code or visit a URL and seamlessly get into the app with the party code pre-filled,
so that joining is frictionless regardless of whether I have the app installed.

## Acceptance Criteria

1. **Given** a user scans the party QR code or visits the landing page URL
   **When** the page loads
   **Then** it loads in <2s on 4G and is under 50KB total (NFR39)
   **And** the page detects the user's platform (iOS/Android/desktop)
   **And** if the app is installed, Universal Links (iOS) / App Links (Android) deep-link into the app with the party code pre-filled (FR106)
   **And** if the app is not installed, the user sees app store buttons with a "Download to join the party" message (FR106)
   **And** if deep link fails, a graceful fallback to app store redirect is provided (NFR39)

2. **Given** a user navigates to the landing page directly (not via QR)
   **When** the page loads
   **Then** a manual party code entry field is displayed (FR107)
   **And** submitting a valid code triggers the same deep-link / store-redirect flow

3. **Given** the app is installed and a user taps a link to the landing page domain
   **When** the OS intercepts the URL via Universal Links / App Links
   **Then** the Flutter app opens directly with the `code` query parameter extracted
   **And** the app navigates to a join screen with the party code pre-filled

4. **Given** the server receives a request to `/.well-known/apple-app-site-association` or `/.well-known/assetlinks.json`
   **When** the response is returned
   **Then** the correct JSON is served with proper content types for deep link verification

5. **And** the web landing page is plain HTML/CSS/JS with no build step, no framework
6. **And** the page uses the Karamania dark theme colors

## Tasks / Subtasks

- [x] Task 1: Create web landing page HTML (AC: #1, #2, #5, #6)
  - [x] 1.1: Create `apps/web_landing/` directory
  - [x] 1.2: Create `apps/web_landing/index.html` — single-page layout:
    ```
    +---------------------+
    |  KARAMANIA           |
    |  Join the party!     |
    |                      |
    |  [OPEN IN APP]       |  ← Attempts deep link via custom scheme
    |                      |
    |  --- or -------------|
    |                      |
    |  Don't have the app? |
    |  [Download for iOS]  |  ← App Store link (placeholder URL for now)
    |  [Download Android]  |  ← Play Store link (placeholder URL for now)
    |                      |
    |  --- or -------------|
    |                      |
    |  Enter party code:   |
    |  [_ _ _ _]           |  ← Manual 4-char code entry
    |  [JOIN]              |
    |                      |
    +---------------------+
    ```
    - Link `style.css` and `script.js` in the head/body
    - Use semantic HTML: `<main>`, `<section>`, `<button>`, `<input>`
    - No external dependencies, no CDN links, no fonts — system fonts only
    - Include `<meta name="viewport" content="width=device-width, initial-scale=1">` for mobile
    - Include `<meta name="theme-color" content="#0A0A0F">` for browser chrome
    - `lang="en"` on `<html>` tag
    - Party code display section (shows code from URL param, hidden if no code)
    - Manual code entry section (always visible, input maxlength="4", pattern="[A-Z0-9]{4}", uppercase transform)
    - Platform-specific store buttons (detected by JS, hidden for desktop)

  - [x] 1.3: Create `apps/web_landing/style.css` — dark theme matching Karamania:
    ```css
    /* Colors from DJTokens */
    --dj-bg: #0A0A0F;
    --dj-surface: #1A1A2E;
    --dj-text-primary: #F0F0F0;
    --dj-text-secondary: #8888AA;
    --dj-action-primary: #6C63FF;
    --dj-action-confirm: #4ADE80;
    ```
    - Mobile-first: single column, centered, max-width 428px
    - Tap targets: min 48x48px (matching NFR14)
    - 8px spacing system matching DJTokens (`--space-sm: 8px`, `--space-md: 16px`, `--space-lg: 24px`, `--space-xl: 32px`)
    - Code input: large monospace digits, letter-spacing for readability, uppercase
    - Buttons: rounded corners, full-width on mobile
    - Simple fade-in animation on load (no heavy animations)
    - System font stack: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
    - WCAG AA contrast: primary text (#F0F0F0) on bg (#0A0A0F) = 18.3:1

  - [x] 1.4: Create `apps/web_landing/script.js` — platform detection and deep link logic:
    ```javascript
    // 1. Read party code from URL params
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    // 2. Platform detection via user agent
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isAndroid = /Android/i.test(navigator.userAgent);

    // 3. If code present, show it prominently and attempt deep link
    // 4. Show platform-specific store buttons
    // 5. Manual code entry handler: validate 4-char code, attempt deep link
    ```
    - Deep link attempt: set `window.location.href` to custom URL scheme `karamania://join?code=CODE`. Set a 2-second timeout — if page is still visible (`document.hidden === false`), the app isn't installed, so show store buttons
    - "OPEN IN APP" button: fires deep link attempt on click
    - "JOIN" button (manual entry): validates input (4 chars, alphanumeric), then fires same deep link attempt
    - Store link placeholders: `https://apps.apple.com/app/karamania/id000000000` and `https://play.google.com/store/apps/details?id=com.karamania.app` — update when app is published
    - Auto-uppercase the code input on keyup
    - Desktop fallback: if neither iOS nor Android, hide store buttons, show message "Open the Karamania app on your phone and enter the code"
    - NO external dependencies, NO fetch calls, NO tracking scripts

- [x] Task 2: Serve web landing from Fastify (AC: #1, #4)
  - [x] 2.1: Install `@fastify/static`:
    ```bash
    cd apps/server && npm install @fastify/static
    ```
  - [x] 2.2: Create `apps/server/src/routes/web-landing.ts` — Fastify route plugin:
    ```typescript
    import type { FastifyInstance } from 'fastify';
    import fastifyStatic from '@fastify/static';
    import { fileURLToPath } from 'node:url';
    import path from 'node:path';

    const __dirname = path.dirname(fileURLToPath(import.meta.url));

    export async function webLandingRoutes(fastify: FastifyInstance): Promise<void> {
      await fastify.register(fastifyStatic, {
        root: path.join(__dirname, '../../../web_landing'),
        prefix: '/',
        decorateReply: false,
      });
    }
    ```
    IMPORTANT: Register `webLandingRoutes` AFTER all API routes in `index.ts` so `/api/*` routes take precedence. Use `decorateReply: false` to avoid conflict with the default Fastify reply decorator
  - [x] 2.3: Register in `src/index.ts`: add `import { webLandingRoutes } from './routes/web-landing.js'` and `await fastify.register(webLandingRoutes)` AFTER `sessionRoutes`
  - [x] 2.4: Verify route precedence: `GET /api/health` still works (not intercepted by static), `GET /` serves `index.html`, `GET /style.css` serves CSS

- [x] Task 3: Serve well-known files for deep link verification (AC: #4)
  - [x] 3.1: Create `apps/web_landing/.well-known/apple-app-site-association` (NO `.json` extension — Apple requires this exact filename):
    ```json
    {
      "applinks": {
        "details": [
          {
            "appIDs": [
              "TEAM_ID.com.karamania.app",
              "TEAM_ID.com.karamania.dev",
              "TEAM_ID.com.karamania.staging"
            ],
            "components": [
              {
                "/": "*",
                "comment": "Match all paths for deep linking"
              },
              {
                "/": "/api/*",
                "exclude": true,
                "comment": "Exclude API routes from deep linking"
              }
            ]
          }
        ]
      }
    }
    ```
    Note: `TEAM_ID` is a placeholder — must be replaced with the actual Apple Developer Team ID before production. All three flavors (dev, staging, production) are included so deep links work across environments
  - [x] 3.2: Create `apps/web_landing/.well-known/assetlinks.json`:
    ```json
    [
      {
        "relation": ["delegate_permission/common.handle_all_urls"],
        "target": {
          "namespace": "android_app",
          "package_name": "com.karamania.app",
          "sha256_cert_fingerprints": ["PLACEHOLDER_SHA256_FINGERPRINT"]
        }
      },
      {
        "relation": ["delegate_permission/common.handle_all_urls"],
        "target": {
          "namespace": "android_app",
          "package_name": "com.karamania.dev",
          "sha256_cert_fingerprints": ["PLACEHOLDER_SHA256_FINGERPRINT"]
        }
      }
    ]
    ```
    Note: SHA-256 fingerprints are placeholders — replace with `keytool -list -v -keystore <keystore>` output before production
  - [x] 3.3: Add explicit routes for well-known files in `routes/web-landing.ts`. CRITICAL: `@fastify/static` ignores dotfiles/dotfolders by default (`dotfiles: 'ignore'`), so `.well-known/` will NOT be served automatically. These routes MUST be registered:
    ```typescript
    import { promises as fs } from 'node:fs';

    fastify.get('/.well-known/apple-app-site-association', async (request, reply) => {
      const filePath = path.join(__dirname, '../../../web_landing/.well-known/apple-app-site-association');
      const content = await fs.readFile(filePath, 'utf8');
      return reply.type('application/json').send(content);
    });
    fastify.get('/.well-known/assetlinks.json', async (request, reply) => {
      const filePath = path.join(__dirname, '../../../web_landing/.well-known/assetlinks.json');
      const content = await fs.readFile(filePath, 'utf8');
      return reply.type('application/json').send(content);
    });
    ```
    These explicit routes are MANDATORY — they guarantee correct `Content-Type: application/json` and bypass the dotfolder restriction. Without them, Apple and Google domain verification will silently fail in production

- [x] Task 4: Configure Android App Links (AC: #3)
  - [x] 4.1: Update `apps/flutter_app/android/app/src/main/AndroidManifest.xml` — add intent-filters to the `<activity>` element:
    ```xml
    <!-- Deep link: custom URL scheme (development fallback) -->
    <intent-filter>
        <action android:name="android.intent.action.VIEW"/>
        <category android:name="android.intent.category.DEFAULT"/>
        <category android:name="android.intent.category.BROWSABLE"/>
        <data android:scheme="karamania" android:host="join"/>
    </intent-filter>

    <!-- App Links: Universal HTTP deep link (production) -->
    <intent-filter android:autoVerify="true">
        <action android:name="android.intent.action.VIEW"/>
        <category android:name="android.intent.category.DEFAULT"/>
        <category android:name="android.intent.category.BROWSABLE"/>
        <data android:scheme="https" android:host="karamania.app"/>
    </intent-filter>
    ```
    Place both intent-filters INSIDE the existing `<activity>` element, AFTER the existing `<intent-filter>` for MAIN/LAUNCHER
  - [x] 4.2: `android:autoVerify="true"` tells Android to verify the domain by fetching `/.well-known/assetlinks.json` at install time. This only works when the domain is properly configured (production). For development, the custom scheme `karamania://` works without verification

- [x] Task 5: Configure iOS Universal Links (AC: #3)
  - [x] 5.1: Create `apps/flutter_app/ios/Runner/Runner.entitlements`:
    ```xml
    <?xml version="1.0" encoding="UTF-8"?>
    <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
    <plist version="1.0">
    <dict>
        <key>com.apple.developer.associated-domains</key>
        <array>
            <string>applinks:karamania.app</string>
        </array>
    </dict>
    </plist>
    ```
  - [x] 5.2: Add the entitlements file to the Xcode project. Update the `project.pbxproj` to reference `Runner.entitlements` in the build settings under `CODE_SIGN_ENTITLEMENTS` for both Debug and Release configurations:
    ```
    CODE_SIGN_ENTITLEMENTS = Runner/Runner.entitlements;
    ```
    Search for `buildSettings` sections with `PRODUCT_BUNDLE_IDENTIFIER = com.karamania` and add the entitlements line to each
  - [x] 5.3: Add custom URL scheme to `Info.plist` (development fallback):
    ```xml
    <key>CFBundleURLTypes</key>
    <array>
        <dict>
            <key>CFBundleURLSchemes</key>
            <array>
                <string>karamania</string>
            </array>
            <key>CFBundleURLName</key>
            <string>com.karamania.app</string>
        </dict>
    </array>
    ```
    Place inside the top-level `<dict>` in Info.plist

- [x] Task 6: Flutter deep link handling in GoRouter (AC: #3)
  - [x] 6.1: Add `/join` route to `lib/app.dart` GoRouter:
    ```dart
    GoRoute(
      path: '/join',
      builder: (context, state) {
        final code = state.uri.queryParameters['code'];
        return JoinScreen(initialCode: code);
      },
    ),
    ```
  - [x] 6.2: Add redirect logic to GoRouter for root path with code parameter:
    ```dart
    final GoRouter _router = GoRouter(
      routes: [...],
      redirect: (context, state) {
        // Deep link: /?code=VIBE → /join?code=VIBE
        if (state.matchedLocation == '/' && state.uri.queryParameters.containsKey('code')) {
          final code = state.uri.queryParameters['code'];
          return '/join?code=$code';
        }
        return null;
      },
    );
    ```
    This handles Universal Links/App Links which open the app at `/` with query params
  - [x] 6.3: Create `lib/screens/join_screen.dart` — stub for Story 1.6 join flow:
    ```dart
    class JoinScreen extends StatefulWidget {
      const JoinScreen({super.key, this.initialCode});
      final String? initialCode;

      @override
      State<JoinScreen> createState() => _JoinScreenState();
    }

    class _JoinScreenState extends State<JoinScreen> {
      late final TextEditingController _codeController;

      @override
      void initState() {
        super.initState();
        _codeController = TextEditingController(text: widget.initialCode ?? '');
      }

      @override
      void dispose() {
        _codeController.dispose();
        super.dispose();
      }

      @override
      Widget build(BuildContext context) {
        return Scaffold(
          body: SafeArea(
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 428),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: DJTokens.spaceMd),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(Copy.joinParty, style: Theme.of(context).textTheme.headlineMedium),
                      const SizedBox(height: DJTokens.spaceLg),
                      TextField(
                        key: const Key('party-code-input'),
                        controller: _codeController,
                        maxLength: 4,
                        textAlign: TextAlign.center,
                        textCapitalization: TextCapitalization.characters,
                        style: Theme.of(context).textTheme.displayMedium,
                        decoration: InputDecoration(
                          hintText: Copy.enterPartyCode,
                          counterText: '',
                        ),
                      ),
                      const SizedBox(height: DJTokens.spaceLg),
                      // TODO: Implement join flow in Story 1.6
                      SizedBox(
                        width: double.infinity,
                        height: 56,
                        child: ElevatedButton(
                          key: const Key('join-party-submit-btn'),
                          onPressed: _codeController.text.length == 4 ? () {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text(Copy.joinFlowComingSoon)),
                            );
                          } : null,
                          child: const Text(Copy.joinParty),
                        ),
                      ),
                      const SizedBox(height: DJTokens.spaceMd),
                      TextButton(
                        onPressed: () => context.go('/'),
                        child: const Text(Copy.backToHome),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        );
      }
    }
    ```
    Key: `Key('party-code-input')` for the text field, `Key('join-party-submit-btn')` for the button
  - [x] 6.4: Update home screen "JOIN PARTY" button to navigate to `/join`:
    In `lib/screens/home_screen.dart`, update the join button's onPressed from placeholder/stub to:
    ```dart
    onPressed: () => context.go('/join'),
    ```
  - [x] 6.5: Import `JoinScreen` in `app.dart`: `import 'package:karamania/screens/join_screen.dart';`

- [x] Task 7: Add copy strings (AC: #2, #3)
  - [x] 7.1: Add to `lib/constants/copy.dart`:
    ```dart
    // Join screen
    static const String enterPartyCode = 'Enter party code';
    static const String joinFlowComingSoon = 'Join flow coming in the next update!';
    static const String backToHome = 'Back to home';
    ```
    Note: `joinParty` already exists from Story 1.4

- [x] Task 8: Update dart_defines for dev (AC: #1)
  - [x] 8.1: Update `dart_defines_dev.json` — change `WEB_LANDING_URL` from `http://localhost:3001` to `http://localhost:3000` since the landing page is now served from the Fastify server:
    ```json
    "WEB_LANDING_URL": "http://localhost:3000"
    ```
    This ensures QR codes generated in dev point to the correct server where the landing page is served. Also update `dart_defines_local.json.example` if it exists

- [x] Task 9: Server tests (AC: #1, #4)
  - [x] 9.1: Create `apps/server/tests/routes/web-landing.test.ts`:
    - `GET /` returns HTML with status 200 and `Content-Type: text/html`
    - `GET /style.css` returns CSS with status 200 and `Content-Type: text/css`
    - `GET /script.js` returns JS with status 200
    - `GET /.well-known/apple-app-site-association` returns JSON with status 200 and `Content-Type: application/json`
    - `GET /.well-known/assetlinks.json` returns JSON with status 200 and `Content-Type: application/json`
    - `GET /api/health` still works (API routes not intercepted by static serving)
    - Use Fastify `.inject()` for all tests
  - [x] 9.2: For the static file tests, create a minimal test Fastify instance that registers the web-landing routes. Import `webLandingRoutes` from the routes module. Verify file contents include expected strings (e.g., HTML contains "KARAMANIA", AASA contains "applinks")

- [x] Task 10: Flutter tests (AC: #3)
  - [x] 10.1: Create `test/screens/join_screen_test.dart`:
    - Renders party code input field with Key `party-code-input`
    - Renders join button with Key `join-party-submit-btn`
    - Pre-fills code when `initialCode` is provided
    - Join button is disabled when code is empty or less than 4 chars
    - Join button shows snackbar when tapped (stub behavior)
    - Back button navigates to home
  - [x] 10.2: Create `test/routing/deep_link_test.dart`:
    - GoRouter redirect: `/?code=VIBE` redirects to `/join?code=VIBE`
    - GoRouter: `/join?code=VIBE` shows JoinScreen with code pre-filled
    - GoRouter: `/join` without code shows JoinScreen with empty code field
    - GoRouter: `/` without code shows HomeScreen (no redirect)

## Dev Notes

### Architecture Compliance

- **Plain HTML/JS/CSS**: No build step, no framework, no bundler. The web landing page is 3 static files served by Fastify. Total size MUST be <50KB (NFR39)
- **Server-authoritative**: The landing page does NOT validate party codes client-side (beyond format check). It simply passes the code to the app. The app's join flow (Story 1.6) validates the code server-side
- **Component boundaries ENFORCED**:
  - `routes/web-landing.ts` only serves static files — no business logic
  - `JoinScreen` is a display-only stub — actual join logic is Story 1.6
  - Deep link handling is purely routing (GoRouter) — no provider mutations

### Deep Linking: How It Works

**OS-Level Interception (Primary)**:
1. User scans QR code → phone opens URL `https://karamania.app?code=VIBE`
2. If app installed AND Universal Links/App Links verified → OS opens app directly, browser never loads
3. Flutter receives the URL → GoRouter redirect `/?code=VIBE` → `/join?code=VIBE` → JoinScreen

**Web Landing Page Fallback (Secondary)**:
1. If app NOT installed → browser loads `https://karamania.app?code=VIBE`
2. Landing page JavaScript reads `code` param, shows code prominently
3. User taps "Download" → goes to app store
4. After installing, user must manually enter the party code (deferred deep links require Branch.io or similar — out of MVP scope)

**Custom URL Scheme (Dev Fallback)**:
1. `karamania://join?code=VIBE` — works in development without a real HTTPS domain
2. Configured in AndroidManifest.xml and Info.plist
3. Does NOT require domain verification (unlike Universal Links/App Links)

### Why @fastify/static Over Manual Routes

- Standard Fastify plugin for serving static files
- Handles content types automatically (HTML, CSS, JS, JSON)
- Handles caching headers
- `decorateReply: false` prevents conflicts with existing plugins
- Registered AFTER API routes so `/api/*` takes precedence

### Deep Link Verification Files

Both `apple-app-site-association` and `assetlinks.json` contain **placeholder values** that MUST be updated before production:
- `TEAM_ID` → actual Apple Developer Team ID (found in developer.apple.com account)
- `PLACEHOLDER_SHA256_FINGERPRINT` → actual signing key fingerprint (`keytool -list -v -keystore <keystore> | grep SHA256`)
- App store URLs → actual listing URLs after app is published

For local development, these files are served but not verified by the OS. The custom URL scheme (`karamania://`) is used instead.

### Cross-Story Dependencies

- **Story 1.4 (Party Creation)**: QR code already encodes `${webLandingUrl}?code=$partyCode`. This story creates the page that URL points to. VERIFY: QR code URL format is `https://karamania.app?code=XXXX`
- **Story 1.6 (Party Join Flow)**: The actual join flow (name entry, WebSocket connect, lobby join) is implemented in Story 1.6. This story creates the JoinScreen stub that Story 1.6 will flesh out
- **Story 1.7 (Party Start)**: No dependency
- **Story 1.8 (Connection Resilience)**: No dependency

### Existing Patterns to Follow

**Route registration** (from Story 1.2/1.3/1.4):
```typescript
// In routes/web-landing.ts — register @fastify/static plugin
export async function webLandingRoutes(fastify: FastifyInstance): Promise<void> { ... }
// In index.ts — register LAST (after all API routes)
await fastify.register(webLandingRoutes);
```

**Import pattern** (CRITICAL):
```typescript
import fastifyStatic from '@fastify/static'; // default import
import { fileURLToPath } from 'node:url'; // Node built-in
import path from 'node:path'; // Node built-in
```

**Flutter screen pattern** (from Story 1.4):
```dart
// SafeArea → ConstrainedBox(maxWidth: 428) → Padding(DJTokens.spaceMd)
// All strings from Copy class
// Widget keys with Key('kebab-case')
// DJTokens for all spacing
```

**GoRouter pattern** (from Story 1.4):
```dart
GoRoute(
  path: '/join',
  builder: (context, state) => JoinScreen(initialCode: state.uri.queryParameters['code']),
),
```

### Anti-Patterns (NEVER DO THESE)

| Wrong | Right |
|-------|-------|
| CDN-hosted CSS/JS frameworks | Inline CSS/JS, no external deps |
| `<script src="https://cdn.example.com/...">` | `<script src="/script.js">` (local file) |
| React/Vue/Svelte for landing page | Plain HTML/JS (<50KB) |
| Server-side rendering for landing | Static files served by @fastify/static |
| `window.open(storeUrl)` (blocked by popup blocker) | `window.location.href = storeUrl` |
| Validating party code on landing page via API call | Just pass code to app, server validates in join flow |
| `Navigator.push()` in Flutter | `context.go('/join')` via GoRouter |
| Hardcoded strings in JoinScreen | All copy in `constants/copy.dart` |
| `Padding(padding: EdgeInsets.all(16))` | `Padding(padding: EdgeInsets.all(DJTokens.spaceMd))` |
| `Color(0xFF6C63FF)` in a widget | Use theme colors from `DJTokens` |
| Creating `web-landing-routes.ts` | Use `web-landing.ts` (kebab-case, matches existing route files) |

### Previous Story Intelligence

**From Story 1.4:**
- QR code encodes `${AppConfig.instance.webLandingUrl}?code=$partyCode` — the URL format is already set
- `webLandingUrl` is in AppConfig (default: `https://karamania.app`, dev: `http://localhost:3001`)
- `joinParty` string already exists in `Copy.dart`
- Home screen has a "JOIN PARTY" button with Key `join-party-btn` that currently has no navigation
- LobbyScreen shows QR code with vibe-colored styling
- `@fastify/static` is NOT yet a dependency — needs `npm install`
- Debug lessons: `QrEyeShape.roundedRect` not available, only `square`/`circle`. Row overflow fixed with `Wrap`. Factory null handling fixed with spread operator
- **86 server tests, 97 Flutter tests** — must not regress

**From Story 1.3:**
- WebSocket auth middleware requires `sessionId` — joining a party via deep link will need REST first (Story 1.6 concern, not this story)
- `AuthProvider` has `onGuestAuthenticated()` method
- Route tests need `validatorCompiler`/`serializerCompiler` from `fastify-type-provider-zod`

**From Story 1.2:**
- Server config at `src/config.ts` validates env vars
- Fastify error handler at `shared/errors.ts`
- `badRequestError()`, `notFoundError()` available

**From Story 1.1:**
- DJTokens: `spaceSm` (8), `spaceMd` (16), `spaceLg` (24), `spaceXl` (32)
- DJTapButton with TapTier enum (ambient, social, consequential)
- GoRouter in `app.dart` with routes `/`, `/lobby`, `/party`
- ConstrainedBox maxWidth 428 pattern
- All providers registered in bootstrap.dart MultiProvider

### Project Structure Notes

```
apps/web_landing/                              # NEW directory
  index.html                                   # Landing page HTML
  style.css                                    # Dark theme CSS
  script.js                                    # Platform detection + deep link logic
  .well-known/
    apple-app-site-association                 # iOS Universal Links config (no .json ext)
    assetlinks.json                            # Android App Links config

apps/server/
  src/routes/
    web-landing.ts                             # NEW: Serve static web landing files
  src/index.ts                                 # MODIFIED: register webLandingRoutes
  package.json                                 # MODIFIED: add @fastify/static
  tests/routes/
    web-landing.test.ts                        # NEW

apps/flutter_app/
  lib/
    screens/
      join_screen.dart                         # NEW: Deep link landing / code entry stub
    constants/
      copy.dart                                # MODIFIED: add join screen strings
    app.dart                                   # MODIFIED: add /join route + redirect
    screens/
      home_screen.dart                         # MODIFIED: JOIN PARTY navigates to /join
  android/app/src/main/
    AndroidManifest.xml                        # MODIFIED: add intent-filters
  ios/Runner/
    Info.plist                                 # MODIFIED: add URL schemes
    Runner.entitlements                        # NEW: Associated Domains
  ios/Runner.xcodeproj/
    project.pbxproj                            # MODIFIED: add entitlements reference
  dart_defines_dev.json                        # MODIFIED: WEB_LANDING_URL → localhost:3000
  test/
    screens/join_screen_test.dart              # NEW
    routing/deep_link_test.dart                # NEW
```

### Testing Requirements

- **DO test**: Static file serving (correct content types, 200 status), well-known file endpoints, GoRouter redirect logic, JoinScreen rendering and code pre-fill, button states
- **DO NOT test**: Actual Universal Links / App Links verification (requires real domain + signed app), actual deep link interception (platform-level), CSS visual rendering, animations
- Server: Vitest with Fastify `.inject()`
- Flutter: flutter_test
- Verify NO test regressions from previous stories (86 server, 97 Flutter)

### Performance Budget

| File | Max Size | Content |
|------|----------|---------|
| index.html | ~3KB | Semantic HTML, no inline CSS/JS |
| style.css | ~3KB | Dark theme, responsive layout |
| script.js | ~2KB | Platform detection, deep link logic |
| **Total** | **<10KB** | Well under 50KB limit (NFR39) |

### References

- [Source: epics.md#Story 1.5] — FR106, FR107, NFR39
- [Source: architecture.md#Web Landing Page] — Plain HTML/JS, <50KB, same Railway domain
- [Source: architecture.md#Deep Link Support] — Universal Links, App Links, GoRouter config
- [Source: architecture.md#Deployment] — Railway auto-deploy, static serving
- [Source: ux-design-specification.md#Web Landing Page] — Layout wireframe, dark theme, platform detection
- [Source: ux-design-specification.md#Party Join Flow] — Path A (app installed), Path B (first-time user)
- [Source: ux-design-specification.md#Design Tokens] — Color system, spacing, typography
- [Source: project-context.md#Project Structure] — Monorepo: apps/flutter_app/, apps/server/, apps/web_landing/
- [Source: project-context.md#Naming Conventions] — kebab-case.ts, snake_case.dart
- [Source: 1-4-party-creation-and-qr-code-generation.md] — QR URL format, webLandingUrl config, existing patterns

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Fixed join_screen_test.dart syntax error (`() => {` should be `() {`)
- API precedence test: avoided importing healthRoutes (triggers config validation), used inline test route instead

### Completion Notes List

- Task 1: Created `apps/web_landing/` with index.html (1.7KB), style.css (2.8KB), script.js (2.6KB) — total ~7KB, well under 50KB limit. Dark theme with Karamania colors, platform detection, deep link attempt with 2s timeout fallback, manual code entry with validation
- Task 2: Installed `@fastify/static`, created `routes/web-landing.ts` serving static files with `decorateReply: false`. Registered AFTER all API routes in `index.ts`
- Task 3: Created `.well-known/apple-app-site-association` (no .json ext per Apple spec) and `.well-known/assetlinks.json` with placeholder TEAM_ID and fingerprints. Added explicit Fastify routes for dotfiles (bypassing @fastify/static dotfile ignore)
- Task 4: Added Android intent-filters for custom scheme (`karamania://join`) and App Links (`https://karamania.app`) with `autoVerify="true"`
- Task 5: Created `Runner.entitlements` with associated domains, added `CODE_SIGN_ENTITLEMENTS` to all Runner build settings in project.pbxproj, added `CFBundleURLTypes` for `karamania://` scheme in Info.plist
- Task 6: Added `/join` GoRouter route with `initialCode` query param, redirect from `/?code=X` to `/join?code=X`, created `JoinScreen` stub with code input and disabled join button, updated home screen JOIN PARTY button to navigate to `/join`
- Task 7: Added 3 copy strings: `enterPartyCode`, `joinFlowComingSoon`, `backToHome`
- Task 8: Updated `dart_defines_dev.json` WEB_LANDING_URL from `localhost:3001` to `localhost:3000`
- Task 9: Created 6 server tests (static file serving, well-known endpoints, API route precedence) — all passing
- Task 10: Created 8 JoinScreen tests (rendering, code pre-fill, button states, snackbar) + 4 deep link routing tests (redirect, direct /join, empty code, no redirect) — all passing

### Change Log

- 2026-03-08: Implemented Story 1.5 - Web Landing Page & Deep Linking (all 10 tasks complete)
- 2026-03-08: Code review fixes — 6 MEDIUM + 3 LOW issues resolved: added error handling & caching for well-known routes, fixed shallow back-button test to use GoRouter, added Content-Type assertion for script.js test, hid "OPEN IN APP" on desktop, added 100vh fallback, updated File List

### Senior Developer Review (AI)

**Reviewer:** Ducdo on 2026-03-08
**Model:** Claude Opus 4.6
**Outcome:** Approved (after fixes)

**Issues Found:** 0 Critical, 6 Medium, 3 Low
**Issues Fixed:** 9/9

| # | Severity | File | Issue | Fix |
|---|----------|------|-------|-----|
| 1 | MEDIUM | Story File List | `package-lock.json` missing from File List | Added to File List |
| 2 | MEDIUM | web-landing.ts | No error handling for `fs.readFile()` on well-known routes | Cached files at startup + null guard |
| 3 | MEDIUM | join_screen_test.dart | Back-button test only checked text, not navigation | Rewrote with GoRouter to test actual navigation |
| 4 | MEDIUM | web-landing.test.ts | Missing Content-Type assertion for script.js | Added `application/javascript` check |
| 5 | MEDIUM | script.js | "OPEN IN APP" visible on desktop (scheme fails) | Hidden button when `!isIOS && !isAndroid` |
| 6 | MEDIUM | Story File List | `dart_defines_dev.json` listed as modified but gitignored | Noted as gitignored/local-only in File List |
| 7 | LOW | web-landing.ts | Well-known files read from disk every request | Cached at startup via `loadWellKnownFiles()` |
| 8 | LOW | style.css | `100dvh` no fallback for older browsers | Added `100vh` fallback before `100dvh` |
| 9 | LOW | web-landing.ts | No custom 404 for non-API paths | Accepted — low priority, default Fastify 404 sufficient for MVP |

### File List

**New files:**
- apps/web_landing/index.html
- apps/web_landing/style.css
- apps/web_landing/script.js
- apps/web_landing/.well-known/apple-app-site-association
- apps/web_landing/.well-known/assetlinks.json
- apps/server/src/routes/web-landing.ts
- apps/server/tests/routes/web-landing.test.ts
- apps/flutter_app/lib/screens/join_screen.dart
- apps/flutter_app/ios/Runner/Runner.entitlements
- apps/flutter_app/test/screens/join_screen_test.dart
- apps/flutter_app/test/routing/deep_link_test.dart

**Modified files:**
- apps/server/src/index.ts (added webLandingRoutes import and registration)
- apps/server/package.json (added @fastify/static dependency)
- apps/server/package-lock.json (auto-generated from npm install)
- apps/flutter_app/lib/app.dart (added /join route, redirect logic, JoinScreen import)
- apps/flutter_app/lib/screens/home_screen.dart (JOIN PARTY button navigates to /join)
- apps/flutter_app/lib/constants/copy.dart (added join screen strings)
- apps/flutter_app/dart_defines_dev.json (WEB_LANDING_URL → localhost:3000) _(gitignored, local-only change)_
- apps/flutter_app/android/app/src/main/AndroidManifest.xml (added intent-filters)
- apps/flutter_app/ios/Runner/Info.plist (added CFBundleURLTypes)
- apps/flutter_app/ios/Runner.xcodeproj/project.pbxproj (added CODE_SIGN_ENTITLEMENTS)
