# Smart Fleet online trial

**Server:** https://smart-fleet-depot-trial.onrender.com

The server is live on Render Free, with persistent PostgreSQL data on Neon Free. The same trial records and accounts survived a verified Render redeployment.

## Start using the apps

1. Extract `SmartFleet-Android-Pilot.zip` and install the APK for the person's work role.
2. New installations use the online trial address automatically. If an older installation has a saved local server address, tap the gear and enter the HTTPS address above.
3. Choose English, Kannada or Hindi.
4. Sign in using the corresponding account from the private local file `server/data/cloud-trial-access.json` on the owner's computer. This file contains passwords and must not be uploaded or forwarded as part of the APK bundle.

| APK | Role |
| --- | --- |
| `app-entry-debug.apk` | Bus entry |
| `app-cleaner-debug.apk` | Cleaning |
| `app-charging-debug.apk` | Charging |
| `app-scheduler-debug.apk` | Scheduling and assignment |
| `app-manager-debug.apk` | Problem review and bus return |
| `app-admin-debug.apk` | Staff accounts |

The same HTTPS address can be opened in a browser to sign in without installing an APK.

## What was checked

- All six role accounts authenticate through the live HTTPS server.
- A sample bus passed entry, a reported problem and manager review, cleaning, charging, route/driver assignment, and explicit return to the depot.
- The six bundled client screens were tested against the live API from the Android app's origin, including CORS, Kannada and phone layout.
- Accounts, fleet state and the verification revision persisted across a second Render deployment.

The new online APKs are debug-signed pilot builds. The native Android wrapper was tested in the earlier emulator checks; the latest live checks used the bundled client assets in a browser. Physical-phone camera accuracy, installed language voices and worker usability still need field testing.

## Free-tier behavior

The service can sleep when unused. The first sign-in after inactivity may take about a minute; the apps show a server-starting message and wait before submitting credentials. Free usage quotas still apply and can pause service. No keep-alive bot has been configured.

This is a trial using the bundled sample fleet. Keep real operational data separate until the depot configuration, source-data migration and physical-phone checks have been completed. Automatic Render deployments are disabled; future code changes require a deliberate deployment.
