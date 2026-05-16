# Contributing

Thanks for your interest in contributing to The Road So Far!

## Development setup

**Prerequisites:** Node.js 20+, npm 10+.

```bash
git clone https://github.com/matthiasseghers/the-road-so-far.git
cd the-road-so-far
npm install
npm run dev
```

The app opens at `http://localhost:5173`, the API runs at `http://localhost:3001`.

## Running checks

Before pushing, make sure everything passes:

```bash
npm run lint        # ESLint
npm run build       # TypeScript type-check + Vite build
npm test            # Vitest
```

These same steps run in CI on every push and pull request.

## Pull requests

1. Fork the repo and create a branch from `main`.
2. Make your changes — keep commits focused and use [Conventional Commits](https://www.conventionalcommits.org/) format.
3. Add or update tests if your change affects behaviour.
4. Ensure `npm run lint`, `npm run build`, and `npm test` all pass.
5. Open a PR against `main` with a clear description of what and why.

## Code style

- TypeScript strict mode — no `any`, no unused variables.
- Functional React components with hooks.
- Zod schemas for all API input validation.
- Parameterised SQL only — never interpolate user input into queries.

## Reporting bugs

Use the [bug report template](https://github.com/matthiasseghers/the-road-so-far/issues/new?template=bug_report.yml) on GitHub Issues.

## Suggesting features

Use the [feature request template](https://github.com/matthiasseghers/the-road-so-far/issues/new?template=feature_request.yml) on GitHub Issues.
