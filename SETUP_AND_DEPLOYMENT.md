# Karamania — Setup & Deployment Guide

## Table of Contents

1. [External Accounts to Create](#1-external-accounts-to-create)
2. [Firebase Setup](#2-firebase-setup)
3. [YouTube & Spotify API Keys](#3-youtube--spotify-api-keys)
4. [Domain & DNS](#4-domain--dns)
5. [Railway (Server + DB + Web Landing)](#5-railway-server--db--web-landing)
6. [Android Release Signing](#6-android-release-signing)
7. [iOS Release Signing](#7-ios-release-signing)
8. [Deep Linking Configuration](#8-deep-linking-configuration)
9. [Flutter Environment Files](#9-flutter-environment-files)
10. [App Store / Play Store Listings](#10-app-store--play-store-listings)
11. [CI/CD Pipeline](#11-cicd-pipeline)
12. [Optional: Sentry Error Tracking](#12-optional-sentry-error-tracking)
13. [Checklist Summary](#13-checklist-summary)

---

## 1. External Accounts to Create

| Account | Purpose | URL |
|---------|---------|-----|
| Firebase (Google Cloud) | Auth, Storage, push notifications | https://console.firebase.google.com |
| Google Cloud Console | YouTube Data API v3 | https://console.cloud.google.com |
| Spotify Developer | Spotify Web API | https://developer.spotify.com/dashboard |
| Railway | Server hosting + PostgreSQL | https://railway.app |
| Apple Developer Program | iOS distribution ($99/year) | https://developer.apple.com |
| Google Play Console | Android distribution ($25 one-time) | https://play.google.com/console |
| Domain registrar | `karamania.app` (or your domain) | Any registrar |
| Sentry (optional) | Error tracking | https://sentry.io |

---

## 2. Firebase Setup

### 2.1 Create Firebase Project

1. Go to Firebase Console → **Add Project**
2. Name it (e.g., `karamania-production`)
3. Enable Google Analytics if desired

### 2.2 Enable Firebase Auth

1. **Authentication** → **Sign-in method**
2. Enable providers you need (Anonymous auth at minimum for guest access)

### 2.3 Enable Firebase Storage

1. **Storage** → **Get started**
2. Set security rules for media uploads (photos/videos from sessions)
3. Note the bucket name: `<project-id>.firebasestorage.app`

### 2.4 Register Platform Apps

**iOS App:**
1. **Project Settings** → **Add app** → iOS
2. Bundle ID: `com.karamania.app`
3. Download `GoogleService-Info.plist` → place in `apps/flutter_app/ios/Runner/`
4. Note: `FIREBASE_IOS_API_KEY`, `FIREBASE_IOS_APP_ID`

**Android App:**
1. **Project Settings** → **Add app** → Android
2. Package name: `com.karamania.app`
3. Add SHA-1 and SHA-256 fingerprints (from your release keystore — see section 6)
4. Download `google-services.json` → place in `apps/flutter_app/android/app/`
5. Note: `FIREBASE_ANDROID_API_KEY`, `FIREBASE_ANDROID_APP_ID`

### 2.5 Generate Service Account Key (for server)

1. **Project Settings** → **Service accounts** → **Generate new private key**
2. From the JSON file, extract:
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY`
   - `project_id` → `FIREBASE_PROJECT_ID`

---

## 3. YouTube & Spotify API Keys

### YouTube Data API v3

1. Google Cloud Console → **APIs & Services** → **Enable APIs**
2. Enable **YouTube Data API v3**
3. **Credentials** → **Create Credentials** → **API Key**
4. Restrict to YouTube Data API v3
5. Note: Free tier is 10,000 units/day (sufficient for MVP with pre-built catalog)

### Spotify Web API

1. Spotify Developer Dashboard → **Create App**
2. Note `Client ID` and `Client Secret`
3. Set redirect URI if needed for OAuth flows

---

## 4. Domain & DNS

1. Register `karamania.app` (or your chosen domain)
2. DNS records to configure:
   - `karamania.app` → Railway web landing deployment (A/CNAME)
   - `api.karamania.app` → Railway server deployment (A/CNAME)
3. Railway provides custom domain configuration in the service settings

---

## 5. Railway (Server + DB + Web Landing)

### 5.1 Create Railway Project

1. Sign up at railway.app, create a new project
2. Connect your GitHub repo

### 5.2 Provision PostgreSQL

1. **New** → **Database** → **PostgreSQL**
2. Railway auto-provisions PostgreSQL 16
3. Copy the `DATABASE_URL` connection string from the service variables

### 5.3 Deploy Server

1. **New** → **GitHub Repo** → select `karamania`
2. Set **Root Directory** to `apps/server`
3. Set **Start Command** to `npm start` (or whatever your package.json scripts define)
4. Configure **Environment Variables** (all required):

```
DATABASE_URL=<from Railway PostgreSQL service>
JWT_SECRET=<generate a random 32+ char string>
YOUTUBE_API_KEY=<from step 3>
SPOTIFY_CLIENT_ID=<from step 3>
SPOTIFY_CLIENT_SECRET=<from step 3>
FIREBASE_PROJECT_ID=<from step 2>
FIREBASE_CLIENT_EMAIL=<from step 2.5>
FIREBASE_PRIVATE_KEY=<from step 2.5, include full PEM with newlines>
FIREBASE_STORAGE_BUCKET=<project-id>.firebasestorage.app
NODE_ENV=production
PORT=3000
```

5. Set custom domain: `api.karamania.app`

### 5.4 Run Database Migrations

After first deploy, run migrations via Railway shell or CLI:

```bash
npx kysely migrate:latest
```

Or add a pre-start script in `package.json` to auto-run migrations on deploy.

### 5.5 Deploy Web Landing Page

Option A — serve from same Railway service (if server serves static files)
Option B — separate Railway static service with root directory `apps/web_landing`
Option C — deploy to a CDN (Cloudflare Pages, Netlify, Vercel)

The `.well-known/` directory must be served from the root domain (`karamania.app`) for deep linking to work.

---

## 6. Android Release Signing

### 6.1 Generate Upload Keystore

```bash
keytool -genkey -v -keystore karamania-upload.keystore \
  -alias karamania \
  -keyalg RSA -keysize 2048 -validity 10000
```

Store securely — you cannot recover this. Back it up.

### 6.2 Create `key.properties`

Create `apps/flutter_app/android/key.properties` (gitignored):

```properties
storePassword=<your-keystore-password>
keyPassword=<your-key-password>
keyAlias=karamania
storeFile=<path-to>/karamania-upload.keystore
```

### 6.3 Update `build.gradle.kts`

Replace the TODO signing config in `apps/flutter_app/android/app/build.gradle.kts`:

```kotlin
// Load key.properties
val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

android {
    signingConfigs {
        create("release") {
            keyAlias = keystoreProperties["keyAlias"] as String
            keyPassword = keystoreProperties["keyPassword"] as String
            storeFile = file(keystoreProperties["storeFile"] as String)
            storePassword = keystoreProperties["storePassword"] as String
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("release")
        }
    }
}
```

### 6.4 Get SHA-256 Fingerprint (for Firebase + deep linking)

```bash
keytool -list -v -keystore karamania-upload.keystore -alias karamania
```

Copy the SHA-256 fingerprint for:
- Firebase Android app registration (step 2.4)
- `assetlinks.json` deep linking (step 8)

---

## 7. iOS Release Signing

### 7.1 Apple Developer Program

1. Enroll at https://developer.apple.com ($99/year)
2. Note your **Team ID** (visible in Membership details)

### 7.2 Create App IDs

In **Certificates, Identifiers & Profiles**:
1. Register App ID: `com.karamania.app` (production)
2. Register App ID: `com.karamania.dev` (development, optional)
3. Enable capabilities: **Associated Domains** (for deep linking)

### 7.3 Create Provisioning Profiles

1. Create a **Distribution** provisioning profile (App Store)
2. Download and install in Xcode

### 7.4 Xcode Configuration

1. Open `apps/flutter_app/ios/Runner.xcworkspace` in Xcode
2. Select **Runner** target → **Signing & Capabilities**
3. Set Team to your Apple Developer account
4. Ensure **Associated Domains** capability is added with:
   - `applinks:karamania.app`

---

## 8. Deep Linking Configuration

### 8.1 iOS — Apple App Site Association

Edit `apps/web_landing/.well-known/apple-app-site-association`:

Replace `TEAM_ID` with your actual Apple Team ID:

```json
{
  "applinks": {
    "details": [
      {
        "appIDs": [
          "<YOUR_TEAM_ID>.com.karamania.app",
          "<YOUR_TEAM_ID>.com.karamania.dev"
        ],
        ...
      }
    ]
  }
}
```

This file must be served at `https://karamania.app/.well-known/apple-app-site-association` with `Content-Type: application/json`.

### 8.2 Android — Asset Links

Edit `apps/web_landing/.well-known/assetlinks.json`:

Replace `PLACEHOLDER_SHA256_FINGERPRINT` with the SHA-256 from your release keystore (step 6.4):

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.karamania.app",
      "sha256_cert_fingerprints": ["XX:XX:XX:...your actual fingerprint"]
    }
  }
]
```

This file must be served at `https://karamania.app/.well-known/assetlinks.json`.

---

## 9. Flutter Environment Files

### 9.1 Create Production Dart Defines

Copy the example and fill in real values:

```bash
cp apps/flutter_app/dart_defines_production.json.example apps/flutter_app/dart_defines_production.json
```

Fill in all Firebase credentials from step 2.4:

```json
{
  "SERVER_URL": "https://api.karamania.app",
  "FIREBASE_IOS_API_KEY": "<real value>",
  "FIREBASE_IOS_APP_ID": "<real value>",
  "FIREBASE_ANDROID_API_KEY": "<real value>",
  "FIREBASE_ANDROID_APP_ID": "<real value>",
  "FIREBASE_MESSAGING_SENDER_ID": "<real value>",
  "FIREBASE_PROJECT_ID": "karamania-production",
  "FIREBASE_STORAGE_BUCKET": "karamania-production.firebasestorage.app",
  "FIREBASE_AUTH_DOMAIN": "karamania-production.firebaseapp.com",
  "FIREBASE_IOS_BUNDLE_ID": "com.karamania.app"
}
```

### 9.2 Create Staging Dart Defines (optional)

Same pattern with a separate Firebase project for staging.

### 9.3 Build Commands

```bash
# Android APK (production)
flutter build apk --flavor production --dart-define-from-file=dart_defines_production.json

# Android App Bundle (for Play Store)
flutter build appbundle --flavor production --dart-define-from-file=dart_defines_production.json

# iOS (production)
flutter build ios --flavor production --dart-define-from-file=dart_defines_production.json
```

---

## 10. App Store / Play Store Listings

### Google Play Store

1. Create app in Google Play Console
2. Upload AAB from `build/app/outputs/bundle/productionRelease/`
3. Required assets:
   - App icon (512x512 PNG)
   - Feature graphic (1024x500)
   - Screenshots (phone + tablet)
   - Short description, full description
   - Privacy policy URL
   - Content rating questionnaire
4. Enroll in Google Play App Signing (recommended — uses your upload key, Google manages the signing key)

### Apple App Store

1. Create app in App Store Connect
2. Upload via Xcode → **Archive** → **Distribute App** → **App Store Connect**
3. Required assets:
   - App icon (1024x1024)
   - Screenshots for each device size (6.7", 6.5", 5.5" at minimum)
   - Description, keywords, support URL
   - Privacy policy URL
   - App Review information (demo credentials if needed)

---

## 11. CI/CD Pipeline

### Current State

- Server CI exists at `.github/workflows/server-ci.yml` (runs on push to `apps/server/**`)
- No Flutter CI workflow yet
- No automated deployment to app stores yet

### Recommended Additions

**Flutter CI** — add `.github/workflows/flutter-ci.yml`:
- Trigger on `apps/flutter_app/**` changes
- Run `flutter analyze`, `flutter test`
- Build APK/IPA to verify compilation

**Automated Store Deployment** (future):
- Use Fastlane for iOS/Android store uploads
- Or GitHub Actions with `flutter build` + `google-play` / `app-store-connect` actions
- Store signing keys as GitHub Secrets

---

## 12. Optional: Sentry Error Tracking

1. Create Sentry project (Node.js for server, Flutter for mobile)
2. Set `SENTRY_DSN` environment variable on Railway
3. Add `sentry_flutter` package to Flutter app if not already present

---

## 13. Checklist Summary

### Accounts & Keys
- [ ] Firebase project created
- [ ] Firebase Auth enabled (Anonymous + any other providers)
- [ ] Firebase Storage enabled with security rules
- [ ] iOS app registered in Firebase (get API key, App ID)
- [ ] Android app registered in Firebase (get API key, App ID)
- [ ] Firebase service account key generated (for server)
- [ ] YouTube Data API v3 enabled, API key created
- [ ] Spotify Developer app created, credentials noted
- [ ] Apple Developer Program enrolled ($99/year)
- [ ] Google Play Console account created ($25)

### Domain & Hosting
- [ ] Domain registered (`karamania.app`)
- [ ] DNS configured (root → landing, `api.` → server)
- [ ] Railway project created
- [ ] Railway PostgreSQL provisioned
- [ ] Railway server service deployed with all env vars
- [ ] Railway custom domains configured + SSL
- [ ] Database migrations run (`npx kysely migrate:latest`)
- [ ] Web landing page deployed (`.well-known/` files accessible)

### Android
- [ ] Release keystore generated and backed up securely
- [ ] `key.properties` created (gitignored)
- [ ] `build.gradle.kts` updated with release signing config
- [ ] SHA-256 fingerprint added to Firebase Android app
- [ ] SHA-256 fingerprint added to `assetlinks.json`
- [ ] `google-services.json` placed in `android/app/`

### iOS
- [ ] Apple Team ID noted
- [ ] App ID registered with Associated Domains capability
- [ ] Provisioning profile created and installed
- [ ] Xcode signing configured
- [ ] `GoogleService-Info.plist` placed in `ios/Runner/`
- [ ] `TEAM_ID` replaced in `apple-app-site-association`
- [ ] Associated Domains entitlement: `applinks:karamania.app`

### Flutter App
- [ ] `dart_defines_production.json` created with real Firebase credentials
- [ ] Production build compiles: `flutter build apk --flavor production ...`
- [ ] Production build compiles: `flutter build ios --flavor production ...`

### Store Listings
- [ ] Google Play Store listing created with all required assets
- [ ] Apple App Store listing created with all required assets
- [ ] Privacy policy URL live and linked

### Deep Linking Verification
- [ ] `https://karamania.app/.well-known/apple-app-site-association` returns valid JSON
- [ ] `https://karamania.app/.well-known/assetlinks.json` returns valid JSON
- [ ] Android App Links verified (`adb shell am start -a android.intent.action.VIEW -d "https://karamania.app/join/test"`)
- [ ] iOS Universal Links verified (tap link on device, opens app)
