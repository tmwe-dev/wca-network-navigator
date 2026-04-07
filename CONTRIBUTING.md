# Contributing to WCA Network Navigator

## Prerequisites

- Node.js 18+
- npm or bun

## Setup

```bash
git clone <repo-url>
cd wca-network-navigator
npm install
cp .env.example .env  # Configure Supabase credentials
npm run dev
```

## Development Workflow

1. Create a feature branch from `main`
2. Make changes following the conventions in `CLAUDE.md`
3. Verify before committing:
   ```bash
   npx tsc --noEmit       # Type check
   npx vitest run          # Unit tests
   ```
4. Commit with descriptive messages
5. Create a PR against `main`

## Project Structure

See `CLAUDE.md` for architecture overview and coding conventions.

## Code Style

- **Language**: English for code, comments, and docs. Italian for user-facing UI strings only.
- **TypeScript**: Strict mode enabled. No `any` types.
- **Components**: Under 400 lines. Decompose into sub-components if larger.
- **Hooks**: Under 300 lines. Return < 15 values. Single responsibility.
- **Tests**: Co-located with source files. Use Vitest + React Testing Library.

## Adding a New Feature

1. Create page component in `src/pages/`
2. Add lazy-loaded route in `src/App.tsx` with `FeatureErrorBoundary`
3. Business logic goes in `src/hooks/` (not in components)
4. Data access goes through `src/lib/repositories/`
5. Add tests for new hooks and critical components

## Bundle Analysis

After a production build, open `dist/bundle-stats.html` to inspect bundle composition:

```bash
npm run build
open dist/bundle-stats.html
```
