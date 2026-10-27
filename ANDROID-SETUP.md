# Smart Fleet Android pilot

For the free online trial with persistent PostgreSQL storage, follow [CLOUD-TRIAL-SETUP.md](CLOUD-TRIAL-SETUP.md). The local SQLite mode below remains available.

Six separate Android APKs are built in `apk/`: Entry, Cleaning, Charging, Scheduler, Manager and Admin. Each has a separate package ID, label and icon colour. The APKs contain the existing web application inside a native Android shell with bundled assets, camera permission handling, photo selection, back-button handling and native text-to-speech.

The screens support English, Kannada and Hindi. Choose the language using the top selector. Bus numbers, registration numbers, route identifiers and staff names remain unchanged. Audio needs the corresponding Android text-to-speech voice installed. These translations still need a Kannada/Hindi speaker and actual depot workers to review the terminology before rollout.

## What is included

- Staff sign in to their own role. The server authenticates passwords and enforces role and depot permissions.
- Entry, cleaning and charging approvals are committed on a shared SQLite-backed server. Other app sessions check for updates every 15 seconds while visible.
- Both cleaning and charging must finish before assignment. Repeated approvals are rejected. Server transactions and request IDs protect commits and request retries.
- Problem reports hold a bus until a manager reviews and resolves them. A manager can explicitly record an assigned bus returning to the depot. Signing out never resets buses.
- The Admin APK lists accounts and creates or updates role/depot accounts. Password changes revoke existing sessions for that account.
- When the server cannot be reached, cached screens remain visible and writes fail visibly. Offline writes are not queued or silently accepted.

The native Admin screen currently covers staff accounts. The original desktop Admin remains in the source for its existing local depot/fleet management; its full multi-depot editing interface has not been migrated into the connected Admin APK.

## Start the shared server

Requires Node.js 24 or newer. Run from the project folder:

```powershell
npm ci
npm run server
```

By default it listens only on this computer at `http://127.0.0.1:8787`. Open that address to use the connected browser login as well.

First run creates `server/data/fleet.sqlite` and **private** first-run credentials in `server/data/initial-access.json`. The file contains a separate randomly generated password for every role; it is excluded from source bundles and Git. Read the file locally, share only the appropriate account with each worker, and change initial passwords through the Admin app. The server never sends password hashes in app snapshots.

The server starts with the bundled Chandapura **sample fleet**. Existing browser-local data is not automatically imported. Confirm and migrate the real depot data before operational use.

### Emulator pilot

In the Android emulator, tap the gear button on sign-in and set the server address to `http://10.0.2.2:8787`. Sign in using that app's role account from the private credentials file. This address is specific to the Android emulator.

### Physical phone pilot

Use a depot-controlled HTTPS endpoint for the server. Enter that same address using the gear button in each app. Do not enter the phone's own `localhost` address.

For an explicitly local Wi-Fi test with the debug APKs, a manager can choose to bind the test server to the computer's network interface:

```powershell
$env:FLEET_HOST = '0.0.0.0'
npm run server
```

Then use `http://COMPUTER-LAN-IP:8787` on phones connected to the same private network, allowing the port through the computer firewall if needed. This exposes the test server to that network; use test accounts and test data. The default server remains loopback-only unless this is configured.

## Install and build

Install the appropriate APK on a test device with Android 8.0 or later. Android may ask to allow installation from the app used to open the APK. All builds in this delivery are **debug-signed pilot builds**, not Play Store releases. Release builds disable cleartext HTTP; live rollout needs HTTPS and a privately managed signing key.

Rebuild all six apps:

```powershell
npm run android:build
```

Requires a JDK 17 or newer, Android SDK platform 36 and Gradle 8.13 (or Android Studio). The build script discovers Android Studio's JDK and the normal Windows SDK path, while respecting `JAVA_HOME` and `ANDROID_HOME`.

## Tests

```powershell
npm test
npm run test:server
node test_connected_ui.js
```

`npm run test:ui` uses a local static server on port 8765, started with `python -m http.server 8765 --bind 127.0.0.1`. Browser tests use isolated profiles and generated fixture accounts.

The optional emulator smoke test uses our emulator `emulator-5580`, the running local shared server, debug APKs and ADB. It checks actual Android WebViews rather than a desktop browser:

```powershell
node scripts/test-android-webview.js entry cleaner charging scheduler manager admin
```

Camera hardware, OCR accuracy, installed voices, accessibility and field usability still require testing on the workers' actual phones. No public server has been deployed, no Play Store submission has been made, and no production signing key has been created.
