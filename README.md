[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](LICENSE)

# The Road So Far

A personal, offline-first travel planner. Trips, days, activities, and
reservations are stored locally in a SQLite database — no account, no
cloud sync, no data ever leaves the machine.

The frontend is a React SPA; a thin Express sidecar handles all database
access and proxies optional third-party API calls (TomTom geocoding,
routing, and static maps) so API keys stay server-side.

The same codebase runs in three modes:

| Mode | Command | How it works |
|---|---|---|
| Development | `npm run dev` | Vite dev server (5173) + Express sidecar (3001) via concurrently |
| Home server | `docker compose up` | Express serves the built frontend as static files on a single port; SQLite is volume-mounted |
| Desktop | `npm run tauri build` | Tauri bundles the frontend and Express sidecar into a native `.dmg` / `.exe` |

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TypeScript 5 (strict) |
| UI components | shadcn/ui (Radix primitives), Tailwind CSS v4 |
| Forms & validation | React Hook Form v7, Zod v4 |
| Data fetching | TanStack Query v5 |
| Database | SQLite via better-sqlite3, plain `.sql` migrations |
| Backend bridge | Express 5 — DB access and API proxying only, zero business logic |
| Mapping | Leaflet + react-leaflet (TomTom tiles) |
| PDF export | @react-pdf/renderer |
| Calendar export | RFC 5545 ICS — no external dependency |
| Testing | Vitest, @testing-library/react |
| Desktop | Tauri |

---

## Getting started

**Prerequisites:** Node.js 20+, npm 10+.

```bash
npm install
npm run dev
```

The app is available at `http://localhost:5173`.
The API bridge runs at `http://localhost:3001` (dev only — not exposed in Docker or Tauri).

### Third-party API keys (optional)

TomTom geocoding, routing, and static maps are optional. If you want them,
add your TomTom API key in the app's Settings page after first launch.
Keys are stored in the local SQLite database and never sent to the frontend.
The app is fully usable without them — maps will load without custom tiles,
and route distances will not be calculated.

---

## Running tests

```bash
npm test                  # run once
npm run test:watch        # watch mode
npm run test:coverage     # coverage report
```

---

## Building for desktop (Tauri)

```bash
npm run tauri build
```

Produces a native installer in `src-tauri/target/release/bundle/`.
Requires the [Tauri prerequisites](https://tauri.app/start/prerequisites/)
for your platform (Rust toolchain + platform SDK).

---

## Security

This app is designed for **local, single-user use only**.

- **Port 3001** (the Express sidecar) has no authentication layer.
  In development it is bound to localhost only. In Docker, port 3001
  is not published — only the frontend port is exposed. Never manually
  publish port 3001 on an untrusted network.
- **`/export/all`** returns all trip data in a single unauthenticated
  request. This is intentional for a local tool — do not expose the
  sidecar publicly.
- **API keys** (TomTom) are stored in the local SQLite settings table
  and transmitted only to those services by the sidecar. They are never
  sent to the frontend.

---

## License

[GNU Affero General Public License v3.0](LICENSE)