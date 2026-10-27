# Android pilot validation — 27 October 2026

- Six Android APK variants built successfully; all six APK signatures verified with Android apksigner.
- Android 11 emulator with WebView 83: Entry, Cleaning, Charging, Scheduler, Manager and Admin each passed actual APK installation, role sign-in, shared-server connection, Kannada display and viewport checks. Hindi switching was also checked in Entry.
- 74 existing cross-depot and assignment checks passed.
- 31 local role-screen browser checks passed.
- 20 shared-server checks passed, including authentication, role checks, concurrency, idempotence, problem holds and logout revocation.
- 21 connected-app browser checks passed, including three-language switching, separate device sessions, a real assignment, explicit bus return and rejecting offline writes.

The cross-depot assignment fixture now explicitly records cleaning and charging approval. The readiness check was corrected so a central fleet record cannot enter the ready pool before both approvals.

These are debug-signed pilot APKs, not production releases. Physical camera/OCR accuracy, installed language voices, worker usability, native-language terminology and real fleet-data migration need field verification. The native Admin screen covers staff accounts; the full original depot/fleet editor remains a local desktop interface. No public server or store release has been deployed.

## Version 1.1 — Render/Neon preparation

Six refreshed APKs build successfully with server warm-up and 15-second revision-aware polling. The prior native wrapper checks remain applicable; the new cold-start flow has 7 dedicated browser checks. 20 PostgreSQL checks execute on an embedded real PostgreSQL engine and verify restart persistence and concurrent/idempotent commits. The 20 SQLite API checks, 74 fleet-rule checks and 21 connected browser checks pass after the storage adaptation. The Blueprint validates against Render's current JSON Schema; Render CLI validation and live Neon/Render end-to-end verification have not been performed. Neon must be connected before the persistent trial can be provisioned.

## Online trial verification

The live Render HTTPS service passed 19 API checks, including all six role logins and a complete sample bus cycle with a manager-reviewed problem hold. The returned bus is available for the next trial cycle. APKs are rebuilt with the public trial URL preconfigured. Render and Neon are both on their Free plans; quotas and cold starts still apply.

The second Render deploy (`dep-dbgb7m0m7kps73buk1tg`) reached live with database revision 7 preserved and all six account logins passing again. Six bundled-client browser checks also passed from the Android app origin against the live service, covering CORS, Kannada and viewport fit. These browser checks do not replace physical Android camera and voice testing.

## Version 1.1.1 � original UI restored

Restored the original login console, worker forms, bus dropdowns, colours and scheduler presentation from the pre-improvement backup. Cloud authentication, persistent records, Kannada/Hindi/English support and safe assignment/logout behaviour remain. Manager and connected admin functionality remain available in matching original colours.

The restored UI passed 17 local integration checks, 7 startup/polling checks and 20 shared-server checks. All six Android variants rebuilt successfully. Earlier card-layout checks above describe older versions; they are superseded by the restored UI checks. These UI changes have browser validation; the rebuilt APKs still need a physical-device usability check.
