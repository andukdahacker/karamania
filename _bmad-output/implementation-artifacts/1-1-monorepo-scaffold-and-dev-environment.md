# Story 1.1: Monorepo Scaffold & Dev Environment

Status: review

## Story

As a developer,
I want a fully configured monorepo with client, server, and shared packages,
So that all future stories have a consistent, working development environment.

## Acceptance Criteria

1. **Given** the repository is cloned and `pnpm install` is run, **When** `pnpm dev` is executed at the monorepo root, **Then** the Vite dev server starts serving the Svelte 5 client on a local port **And** the Node.js server starts with `tsx` on a separate port **And** both packages use TypeScript 5.x strict mode with ES modules **And** a shared types package exists at `packages/shared` with workspace protocol linking.

2. **Given** the monorepo is initialized, **When** the project structure is inspected, **Then** `turbo.json` defines `dev`, `build`, `test`, and `lint` pipelines **And** `pnpm-workspace.yaml` lists `packages/*` **And** `tsconfig.base.json` exists at root with strict settings extended per package **And** `.env.example` documents all required environment variables (DATABASE_URL, FIREBASE_PROJECT_ID, FIREBASE_STORAGE_BUCKET, PORT, NODE_ENV, LOG_LEVEL).

3. **Given** the client package exists, **When** `pnpm build` is run in the client package, **Then** Vite produces a production build in `packages/client/dist/` **And** Tailwind CSS v4.2 is configured with CSS-first `@theme` **And** Space Grotesk and Inter fonts are loaded **And** the gzipped JS bundle is under 100KB (NFR7 baseline).

4. **Given** the server package exists, **When** `pnpm build` is run in the server package, **Then** TypeScript compiles successfully **And** Express is configured to serve the client dist in production mode **And** Socket.io is initialized on the same HTTP server **And** `pino` structured JSON logging is configured **And** environment variables are validated at startup — server fails fast if required vars are missing.

5. **Given** testing is configured, **When** `pnpm test` is run at the monorepo root, **Then** Vitest runs for both client and server packages **And** at least one placeholder test passes per package.

## Tasks / Subtasks

- [x] Task 1: Initialize monorepo root (AC: #2)
  - [x] 1.1: Create root `package.json` with `"type": "module"`, scripts (`dev`, `build`, `test`, `lint` delegating to turbo), and devDependencies (turborepo, typescript)
  - [x] 1.2: Create `pnpm-workspace.yaml` with `packages: ["packages/*"]`
  - [x] 1.3: Create `turbo.json` with pipelines: `dev` (persistent, no cache), `build` (depends on `^build`), `test`, `lint`
  - [x] 1.4: Create `tsconfig.base.json` at root with strict mode, ES2022 target, ESNext modules, strict null checks, no implicit any
  - [x] 1.5: Create `.env.example` documenting all required env vars: DATABASE_URL, FIREBASE_PROJECT_ID, FIREBASE_STORAGE_BUCKET, FIREBASE_SERVICE_ACCOUNT_KEY, YOUTUBE_API_KEY, SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, PORT, NODE_ENV, LOG_LEVEL
  - [x] 1.6: Create `.gitignore` (node_modules, dist, .env, *.tsbuildinfo)
  - [x] 1.7: Create `.npmrc` with `shamefully-hoist=false` for strict pnpm behavior

- [x] Task 2: Scaffold `packages/shared` (AC: #1, #2)
  - [x] 2.1: Create `packages/shared/package.json` with `"name": "@karamania/shared"`, `"type": "module"`, exports pointing to `src/index.ts`
  - [x] 2.2: Create `packages/shared/tsconfig.json` extending `../../tsconfig.base.json`
  - [x] 2.3: Create `packages/shared/src/index.ts` as the sole barrel export (public API)
  - [x] 2.4: Create `packages/shared/src/types.ts` with placeholder types (e.g., `DJState`, `PartySession`)
  - [x] 2.5: Create `packages/shared/src/timestamps.ts` — the canonical timestamp utility (never `new Date()` inline elsewhere)
  - [x] 2.6: Create `packages/shared/src/states.ts` — placeholder for `DJStateType` enum with `UPPER_SNAKE_CASE` values
  - [x] 2.7: Create `packages/shared/src/events.ts` — placeholder for Socket.io event type definitions

- [x] Task 3: Scaffold `packages/server` (AC: #4)
  - [x] 3.1: Create `packages/server/package.json` with `"name": "@karamania/server"`, `"type": "module"`, dependency on `@karamania/shared` via `workspace:*`, dependencies (express, socket.io, pino, dotenv), devDependencies (tsx, vitest, pino-pretty, @types/express)
  - [x] 3.2: Create `packages/server/tsconfig.json` extending `../../tsconfig.base.json`, target Node 22
  - [x] 3.3: Create `packages/server/src/config.ts` — define ALL env vars from `.env.example` with types. For Story 1.1, only PORT, NODE_ENV, LOG_LEVEL are required (fail fast if missing). All others (DATABASE_URL, Firebase, API keys) are typed but optional — they become required when their respective stories wire the services
  - [x] 3.4: Create `packages/server/src/logger.ts` — pino instance with structured JSON logging, configurable LOG_LEVEL
  - [x] 3.5: Create `packages/server/src/index.ts` — Express app + HTTP server + Socket.io init on same server, imports config (triggers validation), starts listening
  - [x] 3.6: Create `packages/server/src/health.ts` — `GET /health` endpoint returning `{ status: 'ok', uptime, memoryUsage }`
  - [x] 3.7: Configure Express to serve `packages/client/dist/` in production mode (`NODE_ENV=production`)
  - [x] 3.8: Add SIGTERM handler: log shutdown, close Socket.io server, close HTTP server, wait up to 5s, `process.exit(0)`. Do NOT add party-specific broadcast logic yet — that comes in later stories when rooms exist
  - [x] 3.9: Create directory stubs with `.gitkeep` files: `src/dj/`, `src/session/`, `src/socket/`, `src/db/`, `src/api/`, `src/firebase/`, `src/__integration__/`

- [x] Task 4: Scaffold `packages/client` (AC: #1, #3)
  - [x] 4.1: Create `packages/client/` manually (do NOT use `create-vite` — it generates unwanted boilerplate and wrong package name). Create all files by hand for full control
  - [x] 4.2: Create `packages/client/package.json` with `"name": "@karamania/client"`, `"type": "module"`, dependency on `@karamania/shared` via `workspace:*`, dependencies (svelte, socket.io-client), devDependencies (vite, @sveltejs/vite-plugin-svelte, @tailwindcss/vite, typescript ~5.8, vitest)
  - [x] 4.2b: Create `packages/client/index.html` — Vite entry point with `<div id="app"></div>` and `<script type="module" src="/src/main.ts"></script>`
  - [x] 4.3: Create `packages/client/tsconfig.json` extending `../../tsconfig.base.json`
  - [x] 4.4: Create `packages/client/vite.config.ts` — Svelte plugin, `@tailwindcss/vite` plugin, dev server proxy for Socket.io (proxy `/socket.io` to server port), build output to `dist/`
  - [x] 4.5: Tailwind CSS v4.2 is configured via `@tailwindcss/vite` plugin in vite.config.ts — NO `tailwind.config.js`, NO `@tailwindcss/postcss`, NO postcss.config
  - [x] 4.6: Create `packages/client/src/app.css` — `@import "tailwindcss"` (v4 syntax), `@theme` block for vibe palette CSS custom properties, Google Fonts `@import` for Space Grotesk and Inter (self-hosting deferred to PWA story)
  - [x] 4.7: Create `packages/client/src/main.ts` — mount `App.svelte` to `#app`
  - [x] 4.8: Create `packages/client/src/App.svelte` — minimal shell, placeholder content
  - [x] 4.9: Create directory stubs with `.gitkeep` files: `src/lib/components/screens/`, `src/lib/components/overlays/`, `src/lib/components/persistent/`, `src/lib/components/shared/`, `src/lib/stores/`, `src/lib/services/`, `src/lib/socket/`, `src/lib/firebase/`, `src/lib/strings/`
  - [x] 4.10: Create `packages/client/src/lib/strings/ui.ts` — empty centralized string constants module (NFR38 i18n-readiness)

- [x] Task 4b: Configure ESLint (AC: #2 — lint pipeline)
  - [x] 4b.1: Install ESLint and `eslint-plugin-svelte` as root devDependencies
  - [x] 4b.2: Create root `eslint.config.js` (flat config) with TypeScript + Svelte rules
  - [x] 4b.3: Add `lint` script to each package's `package.json` running `eslint src/`
  - [x] 4b.4: Verify `turbo lint` runs across all packages without errors

- [x] Task 5: Configure testing (AC: #5)
  - [x] 5.1: Add Vitest ~4.0.18 as devDependency in both client and server packages
  - [x] 5.2: Client: Vitest configured via `defineConfig` in `vite.config.ts` (shares Svelte plugin). Server: create `packages/server/vitest.config.ts` (standalone)
  - [x] 5.3: Create `packages/server/src/health.test.ts` — placeholder test that verifies health module exports
  - [x] 5.4: Create `packages/client/src/App.test.ts` — placeholder test that verifies App component exists
  - [x] 5.5: Verify `turbo test` runs both packages and both tests pass

- [x] Task 6: Verify end-to-end setup (AC: #1, #2, #3, #4, #5)
  - [x] 6.1: Run `pnpm install` at root — verify all workspace linking works
  - [x] 6.2: Run `pnpm dev` — verify both client (Vite HMR) and server (tsx --watch) start
  - [x] 6.3: Run `pnpm build` — verify client dist output and server TypeScript compilation. Check client gzipped JS size is under 100KB (run `gzip -c dist/assets/*.js | wc -c` or inspect Vite build output)
  - [x] 6.4: Run `pnpm test` — verify both placeholder tests pass
  - [x] 6.5b: Run `pnpm lint` — verify ESLint passes across all packages
  - [x] 6.5: Verify shared package types are importable from both client and server via `@karamania/shared`

## Dev Notes

### Architecture Compliance

- **Monorepo tool:** pnpm 9.x workspaces + Turborepo. NOT npm/yarn/lerna/nx
- **Module system:** `"type": "module"` in ALL package.json files. ES modules everywhere
- **TypeScript:** ~5.8 strict mode in all packages. No `any` types. No `I` prefix on interfaces
- **No barrel exports** in server or client. ONLY `packages/shared/src/index.ts` is a barrel
- **Server dev:** `tsx --watch` for auto-restart (NOT `ts-node`, NOT `nodemon`)
- **Client dev:** Vite HMR (NOT webpack, NOT SvelteKit, NOT file-based routing)

### Tailwind CSS v4 — Critical Differences from v3

- **CSS-first configuration:** Use `@theme` directive in CSS file. Do NOT create `tailwind.config.js` or `tailwind.config.ts`
- **Import syntax:** `@import "tailwindcss"` (v4) not `@tailwind base/components/utilities` (v3)
- **Theme customization:** `@theme { --color-primary: #value; }` in `app.css`
- **Vite plugin:** Use `@tailwindcss/vite` (preferred for Vite projects). Do NOT use `@tailwindcss/postcss` or any postcss.config file
- The `data-dj-state` attribute on `<body>` will drive vibe theming in later stories — just ensure the CSS foundation supports it

### Svelte 5 — Runes Only

- This story only creates a minimal shell, but establish the pattern: **runes only** (`$state`, `$derived`, `$props`)
- Do NOT use Svelte 4 patterns: no `writable()`, no `$:` reactive statements, no `export let`
- Store files use `.svelte.ts` extension (e.g., `djStore.svelte.ts`)
- Component files use `PascalCase.svelte`

### Socket.io Setup

- Initialize Socket.io on the SAME HTTP server as Express: `new Server(httpServer)`
- Do NOT set up CORS (same-origin in production since Express serves client dist)
- **Dev mode:** Configure Vite dev server proxy in `vite.config.ts` to forward `/socket.io` requests to the server port. This avoids CORS entirely. Example:
  ```typescript
  server: {
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true
      }
    }
  }
  ```
- Namespace: default `/` is fine for MVP

### Pino Logger Pattern

```typescript
// packages/server/src/logger.ts
import pino from 'pino';
import { config } from './config.js';

export const logger = pino({
  level: config.LOG_LEVEL || 'info',
  // Dev: pretty print. Prod: JSON
  ...(config.NODE_ENV === 'development' && {
    transport: { target: 'pino-pretty' }
  })
});
```

- Always structured: object first, message second
- Always include `sessionId` in session-scoped logs
- Every `catch` block MUST log with structured context

### Environment Validation Pattern

```typescript
// packages/server/src/config.ts
import 'dotenv/config';

// Story 1.1: Only these 3 are required for the scaffold
const REQUIRED_NOW = ['PORT', 'NODE_ENV', 'LOG_LEVEL'] as const;

// Future stories will promote these to required as services are wired
const OPTIONAL_NOW = [
  'DATABASE_URL', 'FIREBASE_PROJECT_ID', 'FIREBASE_STORAGE_BUCKET',
  'FIREBASE_SERVICE_ACCOUNT_KEY', 'YOUTUBE_API_KEY',
  'SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET'
] as const;

// Validate required vars at import time — fail fast
for (const key of REQUIRED_NOW) {
  if (!process.env[key]) throw new Error(`Missing required env var: ${key}`);
}

export const config = {
  PORT: parseInt(process.env.PORT!, 10),
  NODE_ENV: process.env.NODE_ENV! as 'development' | 'production' | 'test',
  LOG_LEVEL: process.env.LOG_LEVEL! as 'debug' | 'info' | 'warn' | 'error',
  // Optional — typed but may be undefined
  DATABASE_URL: process.env.DATABASE_URL,
  // ... etc
};
```

### File Naming Conventions

| Domain | Convention | Example |
|--------|-----------|---------|
| TypeScript files | `camelCase.ts` | `djEngine.ts`, `sessionManager.ts` |
| Test files | `{name}.test.ts` co-located | `health.test.ts` next to `health.ts` |
| Svelte components | `PascalCase.svelte` | `App.svelte`, `Lobby.svelte` |
| Store files | `camelCase.svelte.ts` | `djStore.svelte.ts` |
| Directories | `camelCase` | `src/lib/stores/`, `src/dj/` |

### Vitest Configuration

- **Client:** Configure Vitest inside `vite.config.ts` via `/// <reference types="vitest" />` and `test: {}` block in `defineConfig`. This shares the Svelte plugin so component tests work
- **Server:** Create standalone `packages/server/vitest.config.ts` with `defineConfig` from `vitest/config`
- Do NOT create a vitest workspace config at root — Turborepo runs each package's tests independently

### Project Structure Notes

- This is a **greenfield project** — no existing source code
- The `_bmad/` and `_bmad-output/` directories already exist for project planning artifacts
- Add `_bmad*/` to `.gitignore` if not already present (check with user preference)
- The monorepo root is `/home/ducdo/Desktop/code/karamania/`

### What NOT To Do

- Do NOT install SvelteKit — this is a Svelte 5 + Vite SPA
- Do NOT install a router library — routing is via `{#if}` on DJ state (later stories)
- Do NOT create `tailwind.config.js` — Tailwind v4 uses CSS-first config
- Do NOT use `ts-node` — use `tsx` for server dev
- Do NOT add CSS modules or separate CSS files — use `<style>` in `.svelte` files
- Do NOT add `__tests__/` directories — tests are co-located
- Do NOT add loading spinners — Socket.io ops don't have loading states
- Do NOT add error toast/alert UI — errors are silent but logged (per project rules)

### References

- [Source: _bmad-output/planning-artifacts/architecture.md — Technology Stack, Monorepo Structure, Build Tooling]
- [Source: _bmad-output/planning-artifacts/architecture.md — Server Bootstrap, Development Workflow]
- [Source: _bmad-output/planning-artifacts/architecture.md — Testing Strategy, Client Architecture]
- [Source: _bmad-output/project-context.md — Technology Stack & Versions, Framework-Specific Rules, Development Workflow Rules]
- [Source: _bmad-output/planning-artifacts/epics.md — Epic 1, Story 1.1]

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
- Fixed TS2742 error on `app` export in server/src/index.ts by adding explicit `Express` type annotation
- Fixed dotenv path resolution: `.env` at monorepo root not found when tsx runs from packages/server. Resolved by using `path.resolve(__dirname, '../../../.env')`
- Used `@sveltejs/vite-plugin-svelte@6.2.4` (supports Vite 7) instead of v5 (Vite 6 only) or v7 (Vite 8 only)
- Excluded test files from tsc build and dist from vitest to prevent duplicate test runs
- CSS @import order: Google Fonts import must come before `@import "tailwindcss"` to avoid lightningcss warning

### Completion Notes List
- All 6 tasks + subtasks implemented and verified
- `pnpm install` — workspace linking works across all 3 packages
- `pnpm dev` — Vite HMR on :5173, server on :3001 via tsx --watch
- `pnpm build` — client gzipped JS: 8.86KB (well under 100KB budget), server tsc compiles clean
- `pnpm test` — 2 test files, 2 tests pass (health.test.ts + App.test.ts)
- `pnpm lint` — ESLint passes all packages (flat config with TypeScript + Svelte rules)
- Shared package exports verified importable from server via tsx
- All architecture requirements met: ES modules, strict TS, no barrel exports (except shared), Tailwind v4 CSS-first, Svelte 5 runes-ready

### Change Log
- 2026-03-05: Story 1.1 implemented — full monorepo scaffold with client, server, shared packages

### File List
- package.json (root)
- pnpm-workspace.yaml
- turbo.json
- tsconfig.base.json
- .env.example
- .env
- .gitignore
- .npmrc
- eslint.config.js
- packages/shared/package.json
- packages/shared/tsconfig.json
- packages/shared/src/index.ts
- packages/shared/src/types.ts
- packages/shared/src/timestamps.ts
- packages/shared/src/states.ts
- packages/shared/src/events.ts
- packages/server/package.json
- packages/server/tsconfig.json
- packages/server/vitest.config.ts
- packages/server/src/config.ts
- packages/server/src/logger.ts
- packages/server/src/index.ts
- packages/server/src/health.ts
- packages/server/src/health.test.ts
- packages/server/src/dj/.gitkeep
- packages/server/src/session/.gitkeep
- packages/server/src/socket/.gitkeep
- packages/server/src/db/.gitkeep
- packages/server/src/api/.gitkeep
- packages/server/src/firebase/.gitkeep
- packages/server/src/__integration__/.gitkeep
- packages/client/package.json
- packages/client/index.html
- packages/client/tsconfig.json
- packages/client/vite.config.ts
- packages/client/src/app.css
- packages/client/src/main.ts
- packages/client/src/App.svelte
- packages/client/src/App.test.ts
- packages/client/src/lib/strings/ui.ts
- packages/client/src/lib/components/screens/.gitkeep
- packages/client/src/lib/components/overlays/.gitkeep
- packages/client/src/lib/components/persistent/.gitkeep
- packages/client/src/lib/components/shared/.gitkeep
- packages/client/src/lib/stores/.gitkeep
- packages/client/src/lib/services/.gitkeep
- packages/client/src/lib/socket/.gitkeep
- packages/client/src/lib/firebase/.gitkeep
