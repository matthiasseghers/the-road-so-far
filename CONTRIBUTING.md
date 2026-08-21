# Contributing

Thanks for your interest in contributing to The Road So Far!

## Development setup

**Prerequisites:** Node.js 24+ (LTS), npm 10+.

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
npm run validate      # format check + typecheck + lint + duplicate check + tests
```

Or run the individual checks:

```bash
npm run format:check  # Prettier
npm run lint          # ESLint
npm run dupcheck      # jscpd duplicate-code detection (fails above 5%)
npm run build         # TypeScript type-check + Vite build
npm test              # Vitest
```

These same steps run in CI on every push and pull request. A pre-commit hook
(husky + lint-staged) also formats staged files and runs ESLint on them
automatically — install dependencies with `npm install` and it is set up for you.

## Pull requests

1. Fork the repo and create a branch from `main`.
2. Make your changes — keep commits focused and use [Conventional Commits](https://www.conventionalcommits.org/) format.
3. Add or update tests if your change affects behaviour.
4. Ensure `npm run validate` passes.
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
