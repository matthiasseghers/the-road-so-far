[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](LICENSE)
[![CI](https://github.com/matthiasseghers/the-road-so-far/actions/workflows/ci.yml/badge.svg)](https://github.com/matthiasseghers/the-road-so-far/actions/workflows/ci.yml)

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)
![Zod](https://img.shields.io/badge/Zod-4-3E67B1?logo=zod&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-6E9F18?logo=vitest&logoColor=white)
![Leaflet](https://img.shields.io/badge/Leaflet-199900?logo=leaflet&logoColor=white)

# The Road So Far

A personal, offline-first travel planner that keeps everything on your
machine — no accounts, no cloud sync, no telemetry. Plan multi-day trips
with a full itinerary, track reservations, visualise routes on a map, and
export to PDF or your calendar app.

## Features

- **Multi-day itineraries** — organise activities per day with drag-and-drop reordering
- **Reservations** — lodging, flights, trains, buses, ferries, car rentals, and restaurants
- **Interactive map** — geocoded locations, route visualisation, and static map snapshots
- **Checklists** — per-trip packing or to-do lists
- **Calendar view** — see all trips at a glance in a month/year overview
- **Cover images** — search Pexels, Unsplash, or Pixabay directly from the app
- **PDF export** — generate a printable itinerary with multiple layout options
- **Calendar export** — ICS files compatible with Google Calendar, Apple Calendar, Outlook
- **Activity templates** — save and reuse common activity types
- **Dark and light themes**
- **Fully offline** — works without any network connection; external APIs are optional enhancements

## Deployment modes

| Mode | Command | Description |
|---|---|---|
| Development | `npm run dev` | Vite dev server (5173) + Express API (3001) via concurrently |
| Docker | `docker compose up` | Single container serving frontend + API on port 3000; SQLite volume-mounted for persistence |

## Getting started

**Prerequisites:** Node.js 20+, npm 10+.

```bash
npm install
npm run dev
```

The app opens at `http://localhost:5173`.

### Docker

```bash
docker compose up -d
```

Available at `http://localhost:3000`. Trip data persists in a named Docker volume.

### Third-party API keys (optional)

TomTom geocoding, routing, and static maps are optional extras. Add your
API key in **Settings** after first launch. Keys are stored in the local
SQLite database and proxied server-side — they never reach the browser.

Cover image search supports Pexels, Unsplash, and Pixabay — configure any
or all in Settings.

The app is fully usable without any API keys.

## Tech stack

shadcn/ui · TanStack Query v5 · React Hook Form · @react-pdf/renderer · RFC 5545 ICS export · GitHub Actions CI

## Running tests

```bash
npm test                  # run once
npm run test:watch        # watch mode
npm run test:coverage     # coverage report
```

## Security

This app is designed for **local, single-user use only**.

- The Express API has **no authentication**. In dev it binds to localhost;
  in Docker only port 3000 (frontend) is published.
- **`/export/all`** returns all trip data in a single request — intentional
  for a local tool. Do not expose the API publicly.
- **API keys** (TomTom, Pexels, Unsplash, Pixabay) are stored in SQLite,
  transmitted only to those services server-side, and redacted from
  frontend-facing responses.

### Hardening

- **Helmet** — secure HTTP headers
- **CORS** — restricted to Vite dev server origin
- **Rate limiting** — 300 req/min
- **Zod validation** — all mutation bodies parsed with `safeParse`
- **Parameterised SQL** — no string interpolation in queries
- **SSRF prevention** — cover image downloads use a hostname allowlist and `redirect: 'error'`
- **Path traversal prevention** — cover filenames validated with regex + `path.basename()`
- **Body size limit** — 1 MB on `express.json()`

## License

[GNU Affero General Public License v3.0](LICENSE)