# Smart Fleet OS Android setup

One APK, **apk/SmartFleet.apk**, supports all six account roles. Install the same APK on every Android 8.0+ phone. Sign-in routes each account to its own work screen. The public trial server is preconfigured; see ONLINE-TRIAL.md for accounts and operation.

## Build

Run npm ci and npm run android:build from this folder. Requires JDK 17+, Android SDK platform 36 and Gradle 8.13. The build script uses Android Studio's JDK and the normal Windows Android SDK location unless JAVA_HOME or ANDROID_HOME is set.

The application ID is in.smartfleet.depot, version 1.2.0 (code 4). There are no role product flavors. The native shell bundles the web assets, supports camera permissions, image selection, back navigation and Android text-to-speech. The APK is debug-signed for the trial.

## Local depot server

With Node.js 24+, run npm run server. Without DATABASE_URL it uses SQLite and listens at http://127.0.0.1:8787. First-run local credentials are in the ignored server/data/initial-access.json. Online credentials are separate, in server/data/cloud-trial-access.json.

For a Wi-Fi trial, set FLEET_HOST=0.0.0.0 in PowerShell before starting the server and use its LAN IP in Server settings. The debug APK permits HTTP; production builds require HTTPS. For an Android emulator, use http://10.0.2.2:8787. Do not use the phone's own localhost.

## Verification

- npm test — fleet and assignment rules.
- npm run test:server and npm run test:postgres — API, concurrency and persistence.
- npm run test:ui — original screens and switching every role within one app session.
- node test_admin_dashboard.js and node test_admin_dashboard.js --postgres — connected original Admin forms, authorization and stale-edit protection.
- npm run test:remote — cold starts and revision polling.
- node scripts/test-android-webview.js --live — installs apk/SmartFleet.apk on the test emulator (ANDROID_SERIAL, default emulator-5580) and checks every role against the online service.

The built-in browser checks use isolated profiles and generated fixture accounts. No separate static server is needed. The emulator helper requires an already running test emulator and ADB. Camera/OCR and voice quality still need physical phone checks.
