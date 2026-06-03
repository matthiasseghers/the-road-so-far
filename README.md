[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](LICENSE)
[![CI](https://github.com/matthiasseghers/the-road-so-far/actions/workflows/ci.yml/badge.svg)](https://github.com/matthiasseghers/the-road-so-far/actions/workflows/ci.yml)

# The Road So Far

A personal, offline-first travel planner that keeps everything on your
machine — no accounts, no cloud sync, no telemetry.

Plan multi-day trips with a full itinerary, track reservations, visualise
routes on an interactive map, and export to PDF or your calendar app.
Works entirely offline; external APIs are optional enhancements.

## Quick start

### Docker (recommended)

The fastest way to run the app. No Node.js installation required.

```bash
docker compose up -d
```

Open `http://localhost:3000`. Trip data persists in a named Docker volume.

### Local development

**Prerequisites:** Node.js 20+, npm 10+.

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173` (Vite dev server). The Express API runs
on port 3001 and is proxied automatically.

## Features

- **Multi-day itineraries** — organise activities per day with drag-and-drop reordering
- **Reservations** — lodging, flights, trains, buses, ferries, car rentals, and restaurants
- **Interactive map** — geocoded locations, route visualisation, and static map snapshots
- **Checklists** — per-trip packing or to-do lists
- **Calendar view** — see all trips at a glance in a month/year overview
- **Cover images** — search Pexels, Unsplash, or Pixabay directly from the app
- **PDF export** — generate a printable itinerary with multiple layout options
- **Calendar export** — ICS files compatible with Google Calendar, Apple Calendar, Outlook
- **Checklist templates** — save and reuse common checklist item sets across trips
- **Dark and light themes**

## API keys (optional)

The app is fully usable without any API keys. Geocoding uses
[Nominatim](https://nominatim.org/) by default — free, no key required.

For enhanced features, add keys in **Settings → Services** after first
launch. Keys are stored in the local SQLite database and proxied
server-side — they never reach the browser.

| Provider | What it unlocks |
|---|---|
| **TomTom** | Higher-quality geocoding, turn-by-turn routing, static map images |
| **Pexels** | Cover photo search |
| **Unsplash** | Cover photo search (also requires an app name) |
| **Pixabay** | Cover photo search |

## Configuration

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` (dev) / `3000` (Docker) | HTTP server port |
| `DB_PATH` | `./travel.db` (dev) / `/app/data/travel.db` (Docker) | SQLite database path |

All other settings (theme, units, currency, API keys) are configured in
the app's Settings page and stored in the database.

## Running tests

```bash
npm test                  # run once
npm run test:watch        # watch mode
npm run test:coverage     # coverage report
```

## Security

This app is designed for **local, single-user use only**. Do not expose
the API to the public internet.

- The Express API has **no authentication**. In dev it binds to localhost;
  in Docker only port 3000 is published.
- **API keys** (TomTom, Pexels, Unsplash, Pixabay) are stored in SQLite,
  transmitted only to those services server-side, and redacted from
  frontend-facing responses.

### Hardening

- **Helmet** — secure HTTP headers with per-request CSP nonces
- **CORS** — restricted to the Vite dev server origin
- **Rate limiting** — 300 req/min on `/api`
- **Zod validation** — all mutation bodies parsed with `safeParse`
- **Parameterised SQL** — no string interpolation in queries
- **SSRF prevention** — cover image downloads use a hostname allowlist and `redirect: 'error'`
- **Path traversal prevention** — cover filenames validated with regex + `path.basename()`
- **Body size limit** — 1 MB on `express.json()`

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development workflow,
code style, and PR guidelines.

## Built with

- **Frontend:** React 18, TypeScript 6, Vite 8, Tailwind CSS 4, Leaflet
- **Backend:** Express 5, SQLite 3, Better-SQLite3
- **Validation:** Zod 4, React Hook Form
- **PDF Generation:** @react-pdf/renderer
- **Testing:** Vitest 4, Testing Library
- **Deployment:** Docker, Docker Compose

## License

[GNU Affero General Public License v3.0](LICENSE)