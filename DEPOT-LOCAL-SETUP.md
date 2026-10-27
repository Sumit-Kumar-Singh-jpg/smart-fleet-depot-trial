# Run inside the depot with no cloud hosting fee

Use an existing Windows depot computer as the shared server. All worker phones connect to it through the depot Wi-Fi. Bus records stay on that computer. There is no cloud subscription or domain to buy; existing hardware, electricity and network costs still apply.

## Computer setup

1. Install Node.js 24 or newer on the depot computer. Keep the complete project/source folder on that computer, including `server` and `src`.
2. Connect the computer and the phones to the same trusted depot Wi-Fi or connected depot LAN. Guest Wi-Fi/client isolation can prevent devices from reaching the computer.
3. Double-click **Start-Depot.cmd**. It detects the active private network and prints the phone server address. Keep that window open.
4. If Windows Firewall prevents phone access, have the computer administrator run **Allow-Depot-Network.cmd** as administrator once. It allows only the selected Node program/port, from the local subnet, on Private/Domain profiles. It refuses to change a network marked Public.
5. Ask the network administrator to reserve the computer's address in the router. Otherwise the address can change, requiring an update in each app.

The launcher binds only to the selected private IPv4 address. It does not open router ports, change firewall rules, or publish the server to the internet. The separate firewall helper only runs when a computer administrator explicitly starts it. This application does not need public access; router/firewall policies should keep inbound internet access disabled.

## Phone setup

1. Install the APK for that person's work role.
2. Connect the phone to the depot Wi-Fi.
3. Open the app, tap the gear, and enter the exact address printed by **Start-Depot.cmd**, for example `http://192.168.1.50:8787`. This example is not a fixed address.
4. Choose Kannada, Hindi or English, then sign in using the role account provided by the manager.

Managers obtain the private first-run credentials from `server/data/initial-access.json` on the computer. Give each worker only their relevant account. The server stores hashed passwords in the database.

## Availability and data

- Keep the server computer powered on, awake and connected while work is taking place.
- When phones leave the depot network, shared updates stop; offline approvals are not accepted or queued.
- The supplied APKs support local HTTP for pilot testing. HTTP is not encrypted. Use a trusted depot network with test data; operational rollout needs trusted HTTPS and production-signed APKs, which can also be arranged internally without buying cloud hosting.
- The server initially contains sample fleet data. Real depot data still needs migration and verification.
- Back up `server/data` when the server is stopped. The SQLite database uses WAL, so retain the entire folder together. Keep backups and first-run credentials private.

If the computer has multiple active networks, run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-depot.ps1 -BindAddress YOUR_DEPOT_IP` from this folder. The address must belong to an active private network on this computer.
