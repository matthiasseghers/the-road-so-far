[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](LICENSE)

# The Road So Far

A personal, offline-first travel planner. Trips, days, activities, and reservations are stored locally in a SQLite database — no account, no cloud sync, no external data ever leaves the machine. The frontend is a React SPA; a thin Express sidecar handles all database access and proxies optional third-party API calls (TomTom geocoding, routing, and static maps) so API keys stay server-side. The app runs in three modes from the same codebase: a Vite dev server, a Docker container for home-server / LAN use, and a Tauri desktop executable.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TypeScript 5 (strict) |
| UI components | shadcn/ui (Radix primitives), Tailwind CSS v4 |
| Forms & validation | React Hook Form, Zod |
| Data fetching | TanStack Query v5 |
| Database | SQLite via better-sqlite3, schema managed with plain `.sql` migrations |
| Backend bridge | Express 5 (zero business logic — DB access only) |
| Mapping | Leaflet / react-leaflet |
| PDF export | @react-pdf/renderer |
| Calendar export | RFC 5545 ICS (no external dependency) |
| Testing | Vitest, @testing-library/react |
| Desktop distribution | Tauri |

---

## Getting started

**Prerequisites:** Node.js 20+, npm 10+.

```bash
# Install dependencies
npm install

# Start the Express DB bridge (port 3001) and Vite dev server (port 5173) together
npm run dev
```

The app is available at `http://localhost:5173`. The API bridge runs on `http://localhost:3001`.

### Docker

A Docker image and `docker-compose.yml` are planned but not yet included in this repository. See `ARCHITECTURE.md` for the intended container setup (Express serves the built frontend as static files on a single port; the SQLite file is volume-mounted).

---

## Running tests

```bash
npm test
```

Watch mode: `npm run test:watch`  
Coverage report: `npm run test:coverage`

---

## License

[GNU Affero General Public License v3.0](LICENSE)

---

## Security

This app is designed for local, single-user use only. Port 3001 (the Express sidecar) has no authentication layer and should never be exposed on an untrusted network — bind it to `127.0.0.1` or protect it with a firewall when running in Docker or on a home server. The `/export/all` endpoint returns all trip data in a single unauthenticated request, which is intentional for a local-only tool but would be a significant exposure if the port were publicly reachable. API keys for third-party services (TomTom) are stored in the local SQLite settings table and transmitted only to those services by the sidecar — they are never sent to the frontend.
