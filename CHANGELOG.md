# Changelog

## 1.0.3

- Update the locked Hono dependencies to include security fixes for request routing and the Node.js server adapter.
- Include Hono 4.13.18 and @hono/node-server 2.1.8 in the source archive, verified through a fresh installation and the production browser and MCP checks.

## 1.0.2

- Protect local recovery files during development and preserve existing identities across upgrades.
- Refresh compatible dependencies and strengthen isolated verification.

## 1.0.1

- Encrypt per-board browser signing identities with a device passphrase instead of saving raw keys in browser storage.
- Protect existing browser identities on first return without changing their signing identity; require the passphrase on later visits.
- Keep recovery-file and confirmed recovery-link restores, including an explicit recovery-file path when a passphrase is forgotten.
- Verify wrong-passphrase rejection, identity migration, reload continuity, and recovery in the production browser journey.

## 1.0.0

- Package the public board website and five local stdio assistant tools as a versioned source release with MIT licensing and exact dependency installation.
- Apply available MCP SDK, source-map-js and sharp patches while retaining the existing event format, recovery files and board interface.
- Add repeatable production browser and assistant checks for posting/readback, reply retries, device recovery and process restart.
- Document newcomer setup, public relay behavior, upgrades and extension points. Verify the actual downloadable ZIP from a fresh folder before publishing.
