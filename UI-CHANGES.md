# Role screen improvements

Update: Android APKs and a connected server are now available. See [ANDROID-SETUP.md](ANDROID-SETUP.md) for current installation, languages, server setup and pilot limitations. The browser-only description below documents the earlier local mode.

The existing HTML application now opens each role directly after sign-in. Entry, Cleaning, Charging and Depot Manager share `src/css/worker.css` and `src/js/worker.js`. The existing Scheduler keeps its assignment engine and has simpler labels and larger controls.

## Run locally

From this folder, run `python -m http.server 8765 --bind 127.0.0.1`, then open `http://127.0.0.1:8765/index.html`. Use the existing accounts created in Admin → Depot Logins. The main login now routes Depot Manager accounts to `manager.html`.

Keep using the same browser and origin as your existing installation to retain its local data. A new port, host or browser has separate browser storage. Opening HTML files directly is unsuitable for shared browser storage and camera features.

## Worker workflow

1. Search the bus number or registration, or browse six buses at a time.
2. Explicitly tap a bus. Searching never selects or approves it.
3. Check the large bus number and registration.
4. Tap the named action, then confirm the bus in a dialog. Recent completions show saved work and timestamps.

Entry can scan a number plate using the existing browser OCR implementation. Scanning selects the bus for review and never approves it. Live camera needs HTTPS or localhost; photo upload and manual search remain available. The OCR library/model needs internet access on first use. Camera hardware, OCR accuracy and permission handling require testing on the workers' phones.

Where supported by the browser, Listen reads English instructions and the selected bus. Local-language text and audio have not been added because the language choice remains open. Voice availability depends on the device.

Charging shows available battery and charger information, labels bundled sample data, and explicitly states that no live charger connection exists. Missing values are shown as not recorded.

## Problems and manager review

Workers can report a problem with an optional note. The report is saved under `smart_fleet_issues`, retains its author and timestamps, and holds the bus across approvals and scheduling. Admin's operational approval actions also check for this hold.

The Depot Manager screen shows counts for that depot and its unresolved problems. A resolution note is required to release a hold; resolving a report never approves work. Resolved reports retain the resolution, reviewer and time in storage. Approval corrections still require manager intervention using the existing management workflow; this change does not add automatic reversal.

Scheduler sign-out only ends the session. It no longer returns or resets any bus. Queues respond to changes from other tabs on the same browser origin. A scheduler whose availability changes must choose the trip and resources again.

## Validation

- `npm test`: existing cross-depot and assignment suites, 74 checks.
- `npm run test:ui`: 31 Playwright checks using installed Microsoft Edge and the local HTTP server above. Tests use an isolated browser context and fixture accounts; they do not access a normal browser profile.
- Browser checks cover explicit selection, confirmation/cancel, reports and holds, manager login/resolution, first-load scheduler login, assignment preservation on logout, plate matching, pagination, role/depot checks, and mobile/desktop overflow.

## Deployment limits

Data and authentication remain browser-based, as in the original project. The UI session checks are navigation guards, not server-enforced authorization. Independent phones do not synchronize. Real multi-device operation needs a shared backend and server-side authentication/authorization. This update does not produce Android APKs or publish a site.

The pre-change source backup is at `C:\Users\sksja\OneDrive\Documents\ChatGPT\AshokLeyland\before-ui-improvements.zip`.
