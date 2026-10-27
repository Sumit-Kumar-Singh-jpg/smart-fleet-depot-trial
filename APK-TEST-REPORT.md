# Android pilot validation — 27 October 2026

- Six Android APK variants built successfully; all six APK signatures verified with Android apksigner.
- Android 11 emulator with WebView 83: Entry, Cleaning, Charging, Scheduler, Manager and Admin each passed actual APK installation, role sign-in, shared-server connection, Kannada display and viewport checks. Hindi switching was also checked in Entry.
- 74 existing cross-depot and assignment checks passed.
- 31 local role-screen browser checks passed.
- 20 shared-server checks passed, including authentication, role checks, concurrency, idempotence, problem holds and logout revocation.
- 21 connected-app browser checks passed, including three-language switching, separate device sessions, a real assignment, explicit bus return and rejecting offline writes.

The cross-depot assignment fixture now explicitly records cleaning and charging approval. The readiness check was corrected so a central fleet record cannot enter the ready pool before both approvals.

These are debug-signed pilot APKs, not production releases. Physical camera/OCR accuracy, installed language voices, worker usability, native-language terminology and real fleet-data migration need field verification. The native Admin screen covers staff accounts; the full original depot/fleet editor remains a local desktop interface. No public server or store release has been deployed.
