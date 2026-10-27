# Smart Fleet OS 1.2.0 validation

One Android APK supports Entry, Cleaning, Charging, Scheduler, Depot Manager and Admin through the same sign-in screen. The application ID is in.smartfleet.depot, version code 4. It is a debug-signed trial build.

UI source: https://github.com/NIKHILNIDAGUNDI/SFR-os-1, commit 07aa7c398dcb38484cbcd9ee21c98aa72ff91e1e. Original forms, colours, dropdowns and Admin dashboard navigation are retained, with an extra phone header rule to fit the language and server controls. UI-SOURCE.json records the source. Manager is retained from the connected app.

## Completed checks

- 19 UI integration checks, including all six role logins and logouts in the same unrestricted app session.
- 19 original Admin dashboard checks with SQLite, and another 19 with embedded PostgreSQL: shared registration and depot creation, authenticated generated accounts, stale-edit rejection, authorization, password reset/session revocation, transfer queue cleanup and destination entry.
- 20 shared-server API checks.
- 20 PostgreSQL checks, including concurrency, idempotence and restart persistence.
- 7 cold-start and compact-polling checks.
- 74 fleet synchronization and assignment checks.
- Actual SmartFleet.apk installed on a separate Android 11 emulator (emulator-5580). All six role sign-ins, live server connectivity, Kannada and phone-width checks passed. Hindi switching passed on Entry. An additional native Entry check verified phone header spacing.

The online password reset from the previous request is preserved. Trial data and accounts remain on the existing Neon database. Admin configuration commits check the current state revision and cannot overwrite a newer worker approval. Passwords and hashes are excluded from snapshots and distributable archives.

Physical camera/OCR accuracy, installed language voices and worker usability need field checks on depot phones.

Render deploy dep-dbgca6avcj2c73bpgdjg is live. Ten read-only live API checks passed, all six bundled app-origin screens passed, and all six deployed website role screens were checked. Revision 7 and the six existing account passwords were retained. The final APK signature and its bundled original UI assets were verified.
