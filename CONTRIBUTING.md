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
4. Open http://localhost:3000, go to Settings, set your Dev Root, and run a Scan.

## Development Workflow

1. Create a branch from `main`
2. Make your changes
3. Ensure lint passes: `npm run lint`
4. Ensure the build succeeds: `npm run build`
5. Submit a pull request

## Code Style

- TypeScript strict mode is enabled
- Lint with `npm run lint` (ESLint with Next.js config)
- Use existing patterns in the codebase as reference
- Prefer editing existing files over creating new ones

## Project Structure

```
src/app/          — Next.js App Router pages and API routes
src/components/   — React components (shadcn/ui based)
src/hooks/        — Custom React hooks
src/lib/          — Utilities, config, database, LLM providers
pipeline/         — Python scripts for scanning and deriving project data
prisma/           — Database schema and migrations
```

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
