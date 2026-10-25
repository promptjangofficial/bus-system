# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Phitsanulok bus fleet manager + live simulation. Plain Node.js (>=18) and vanilla JS frontend. Layering and API are documented in @README.md.

## Rules the tests enforce
- No runtime npm dependencies: the app and tests use Node built-ins only (`node:test`). Dev-only tools (ESLint) are the sole exception; never add a runtime package.
- All UI text and code comments are Thai.
- Backend error and log messages live only in `backend/config/messages.js`. Every `AppError('CODE')` and `LOG.x()` used in code must exist there (phase 0 test).
- Core (`backend/core/`) returns `{ ok:false, code, ...params }` instead of throwing text; services convert with `fail()`.
- Frontend screen text goes in `frontend/js/content/texts.js`; every backend call goes through `frontend/js/lib/api.js`.
- Escape any data put into HTML with `esc()` from `frontend/js/lib/format.js`. Every `data-act` button needs a handler. Frontend modules must not touch the DOM at import time (phase 6 loads them in Node).
- Routes are circular: the closing segment (last stop → first stop) also needs a road in `backend/data/roads.json`.
- Station coordinates must stay inside Phitsanulok and must not duplicate another station.

## Testing
- `npm test` runs phases 0→6 in order and stops at the first failure; `npm test -- 4` runs one phase. After any change, run the full suite (later phases depend on earlier ones).
- `npm run lint` (ESLint 9 flat config in `eslint.config.js`): `backend/` and `tests/` are CommonJS, `frontend/` is ES modules with Leaflet's global `L`.
- Tests force `USE_OSRM=0` and a temp `BUS_RUNTIME_DIR`, so they never need network or touch `backend/data/runtime/`.

## Deployment
- Server: `cs31@100.104.87.92` (Tailscale, Arch Linux), project in `~/bus-system`, run with `docker compose`. Deploy with `/deploy`.
- Container listens on `127.0.0.1:3100` only. Public URL https://demo.promptjang.com goes through a Cloudflare Tunnel that is managed in the Cloudflare dashboard (token-based), so hostname routing is changed there, not on the server.
- Runtime data (saved buses, OSRM road cache) is in the Docker volume `bus-system_bus-data` mounted at `/data`.
- The server's `~/bus-system/.env` holds `DEVICE_API_KEY`. It is not in this repo; never overwrite or delete it when syncing.
- The same server runs other projects (`flood-x`, `promptjang-com`, minecraft). Only touch the `bus-system` compose project.
- This directory is not a git repository.
