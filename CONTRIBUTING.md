# Contributing to Projects Dashboard

Thank you for your interest in contributing! This guide will help you get started.

## Getting Started

1. Fork and clone the repo
2. Install dependencies and run setup:
   ```bash
   npm install
   npm run setup
   ```
3. Start the dev server:
   ```bash
   npm run dev
   ```
4. Open http://localhost:3000 — the onboarding wizard will guide you through initial configuration.

## Development Workflow

1. Create a branch from `main`
2. Make your changes
3. Run tests: `npm test` and `npm run test:integration`
4. Ensure lint passes: `npm run lint`
5. Submit a pull request

## Testing

```bash
npm test                    # 154 unit tests
npm run test:integration    # 73 integration tests
npm run test:watch          # watch mode
```

Tests use Vitest. Unit tests are in `src/**/__tests__/` and `bin/__tests__/`. Integration tests use `vitest.integration.config.ts`.

## Code Style

- TypeScript strict mode is enabled
- Lint with `npm run lint` (ESLint with Next.js config)
- Use existing patterns in the codebase as reference
- Prefer editing existing files over creating new ones
- UI components use shadcn/ui patterns with Tailwind v4

## Project Structure

```
src/app/            Next.js App Router pages and API routes
src/components/     React components (shadcn/ui based)
src/hooks/          Custom React hooks
src/lib/            Utilities, config, database, pipeline, LLM providers
bin/                CLI launcher and bootstrap scripts
prisma/             Database schema
```

## Key Architecture

- **Pipeline:** TypeScript-native scan + derive (no Python dependency)
- **Database:** Prisma 7 + SQLite with LibSQL adapter
- **Merge model:** Override > Metadata > Derived > LLM > Scan
- **Distribution:** Web/CLI via NPX (`npx @eeshans/projects-dashboard`)
- **Config:** Settings UI > settings.json > env vars > defaults

## Reporting Bugs

Open an issue with:
- Steps to reproduce
- Expected vs actual behavior
- Node.js version and OS

## Suggesting Features

Open an issue describing:
- The problem you're trying to solve
- Your proposed solution
- Any alternatives you considered
