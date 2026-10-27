# Smart Fleet OS — one Android app

Install **SmartFleet.apk** on every trial phone (Android 8.0 or later). This single app supports Entry, Cleaning, Charging, Scheduler, Depot Manager and Admin. The username determines the work screen; there is no separate APK or role selection.

Server: https://smart-fleet-depot-trial.onrender.com

1. Install SmartFleet.apk, either directly or from SmartFleet-Android-Pilot.zip.
2. Choose English, Kannada or Hindi in the header.
3. Sign in with your own account. Usernames are admin, chandapura-entry, chandapura-cleaner, chandapura-charging, chandapura-scheduler and chandapura-manager. The owner keeps the current passwords in server/data/cloud-trial-access.json.
4. Sign out to let another user sign in on the same app. The server enforces each account's role and depot.

The online server is preconfigured. Use **Server settings** only to change it. Earlier role-specific apps use different Android package IDs; the new app is named **Smart Fleet OS** and installs separately.

## UI source

The login, entry, cleaning, charging, scheduler and Admin presentation follows https://github.com/NIKHILNIDAGUNDI/SFR-os-1 at commit 07aa7c398dcb38484cbcd9ee21c98aa72ff91e1e. Original colours, forms, dropdowns, Admin dashboard and navigation are retained. A small native phone header adjustment fits the language and server controls. The Depot Manager screen is retained from the connected app.

The original Admin dashboard now reads shared server data. Fleet registration, depot creation, linking, transfers, resources and staff password changes save online. Concurrent edits are checked against the server revision. Existing passwords are masked; a password can be reset, and new depot credentials are shown only in the creating admin session. Use staff consoles for approvals and assignments, and the Manager screen for bus returns.

## Trial hosting

Render Free hosts the API; Neon Free stores accounts and records across server restarts. The service can sleep when unused, so the first sign-in can take about a minute. Apps show a startup message. Free quotas still apply. No keep-alive bot is configured.

This is a debug-signed pilot APK using the sample fleet. The APK was tested on an isolated Android 11 emulator against the live server. Camera accuracy, installed voices and real worker usability still need checks on depot phones.
