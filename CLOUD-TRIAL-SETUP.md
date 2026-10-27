# Free online trial: Render + Neon

This configuration runs the Node API on Render Free and stores its accounts, sessions, bus records and issue reports in PostgreSQL on Neon Free. Restarting or replacing the Render process does not recreate that database. Free plans still have usage limits and no uptime guarantee.

## Required connections

The source must be available to Render through the user's GitHub connection. Neon is connected. The dedicated trial project and six role accounts are created and verified. Render repository access is granted and the Free API service is live at https://smart-fleet-depot-trial.onrender.com. The selected Render workspace for this trial is **My Workspace**.

Use only Free plans for both providers. The Blueprint creates one Free web service; it does not create a paid database or disk.

## Neon

Create a dedicated Free project for this trial, preferably near the Render service region. Use the default database on a dedicated trial branch, and obtain its pooled PostgreSQL connection string with TLS enabled. Store it as Render's secret `DATABASE_URL`; do not commit it or paste it into chat.

The server verifies database TLS certificates. Only a database on localhost may explicitly disable TLS for development. Never disable certificate verification to work around a cloud connection failure.

## Render

Deploy the checked-in `render.yaml` from the trial repository. Supply the following two secret values during initial setup:

- `DATABASE_URL`: the Neon connection string.
- `FLEET_ADMIN_PASSWORD`: a private password of at least 14 characters, chosen by the owner.

The first startup creates only the `admin` account in PostgreSQL. Sign into the Admin app using that configured password, then create the staff accounts. No cloud password file is written to Render's temporary filesystem. Changing the bootstrap environment variable later does not reset an existing admin password; account updates are made through the authenticated Admin screen.

The service binds to `0.0.0.0` using Render's injected `PORT`. It refuses to start in Render if `DATABASE_URL` is missing. Automatic deploys are disabled so a future source commit does not unexpectedly redeploy the trial.

The server starts with sample fleet data if the database is empty. Existing SQLite/local browser records are not automatically imported. A database migration/import must be planned separately if those existing records need to move online.

## Apps and startup

Enter the deployed `https://...onrender.com` address in each Android app's gear/settings screen. Install the refreshed APKs built with this release; they wait for a cold server to start before sending sign-in credentials. The wait is bounded to about 90 seconds, after which the user can retry.

Visible apps poll every 15 seconds. Unchanged polls return only a revision marker. Hidden apps and open confirmation/report dialogs do not poll. This reduces requests and database bandwidth; it does not guarantee that every trial workload will stay within the providers' quotas.

Render Free instance hours are shared across the workspace. My Workspace already contains another Free web service, so monitor the shared allowance before extended testing. An always-on bot can consume the free hours even when nobody is using the trial.

No keep-alive bot is required. Active app use already generates traffic. A health check can confirm availability, but it does not preserve a local database or guarantee that a free service will stay running.

Health is available at `/api/health`. It is a lightweight process liveness check, not a database backup or a periodic database probe. This avoids unnecessarily keeping Neon's database compute awake.

## Verification

- `npm test`: existing fleet rules.
- `npm run test:server`: API behavior with local SQLite.
- `npm run test:postgres`: PostgreSQL SQL behavior, concurrent commits, idempotent requests and persistence across restart, using an embedded PostgreSQL engine.
- `node test_connected_ui.js`: connected browser workflows.
- `npm run test:remote`: cold-start and compact polling behavior.

Embedded PostgreSQL tests do not confirm live Neon connectivity. Live HTTPS health, cloud sign-in, a complete sample bus cycle, and persistence across a Render redeployment are now verified. See `ONLINE-TRIAL.md` for user setup and the remaining physical-phone checks.

## Local depot mode remains available

Without `DATABASE_URL`, local runs use the existing SQLite database. The cloud guard applies when Render is detected or `FLEET_REQUIRE_POSTGRES=true`. The local launcher and APK role workflows remain available for depot-only trials.

## Current provisioning status

The dedicated Neon Free project is `hidden-bird-12340871`, branch `trial`, database `smart_fleet`, in Singapore. A live TLS-verified PostgreSQL connection, admin login and all five staff-role logins have been verified across a server-process restart. Private access details are stored in the ignored local `server/data/cloud-trial-access.json`; they are not in this repository or the download bundles.

The Free Render service is `srv-dbgb5c59el5s73ce9t3g` in Singapore. Its public URL is **https://smart-fleet-depot-trial.onrender.com**. All six role logins and a sample entry, problem review, cleaning, charging, assignment and return cycle have passed through this HTTPS endpoint. A second Render deployment is live and retained all accounts and fleet state at the same revision. All six bundled client role screens also passed live app-origin CORS, Kannada and phone viewport checks. Resource identifiers and verification status are recorded in `cloud-trial.json` without credentials.

The refreshed APKs contain this online URL as the default server address. If an older installation already saved a depot-local address, change it with the gear button. Private trial logins are available only in `server/data/cloud-trial-access.json` on the owner's computer. They are excluded from GitHub, public routes and download bundles.
