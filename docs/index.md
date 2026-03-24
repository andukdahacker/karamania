# Karamania — Project Documentation Index

> Generated: 2026-03-24 | Scan: Exhaustive | Mode: Initial Scan

## Project Overview

- **Type:** Multi-part monorepo with 3 parts
- **Domain:** Real-time karaoke party companion app
- **Primary Languages:** Dart (Flutter), TypeScript (Fastify)
- **Architecture:** Event-driven client-server with pure state machine orchestration

## Quick Reference

### flutter_app (Mobile)
- **Type:** Flutter/Dart mobile app (iOS + Android)
- **Tech Stack:** Flutter 3.9, Provider, go_router, Socket.IO, Firebase Auth/Storage, SoLoud audio
- **Root:** `apps/flutter_app/`
- **Entry Point:** `lib/main.dart`

### server (Backend)
- **Type:** Fastify 5 API + Socket.IO real-time server
- **Tech Stack:** TypeScript, PostgreSQL 16 (Kysely), Zod v4, Firebase Admin, Socket.IO
- **Root:** `apps/server/`
- **Entry Point:** `src/index.ts`

### web_landing (Web)
- **Type:** Static HTML/CSS/JS landing page
- **Tech Stack:** Vanilla HTML/CSS/JS
- **Root:** `apps/web_landing/`
- **Purpose:** Deep linking, party join, session sharing

## Generated Documentation

- [Project Overview](./project-overview.md) — Executive summary, tech stack, architecture classification
- [Source Tree Analysis](./source-tree-analysis.md) — Complete annotated directory tree
- [Architecture — Server](./architecture-server.md) — DJ engine, data architecture, API design, testing
- [Architecture — Flutter App](./architecture-flutter-app.md) — Provider architecture, screens, widgets, audio
- [API Contracts — Server](./api-contracts-server.md) — 21 REST endpoints + 50+ Socket.IO events
- [Data Models — Server](./data-models-server.md) — 5 PostgreSQL tables, JSONB schemas, in-memory stores
- [Component Inventory — Flutter App](./component-inventory-flutter-app.md) — 44 widgets, 8 providers, 6 screens
- [Integration Architecture](./integration-architecture.md) — Cross-part communication, data flows
- [Development Guide](./development-guide.md) — Setup, commands, testing, CI/CD, conventions

## Existing Documentation

- [Setup & Deployment Guide](../SETUP_AND_DEPLOYMENT.md) — Firebase, Railway, signing, deep links, store listings
- [Server CI](./.github/workflows/server-ci.yml) — GitHub Actions (Node 24, PostgreSQL 16)

## Planning Artifacts (BMAD)

- [Product Brief](../_bmad-output/planning-artifacts/product-brief-karaoke-party-app-2026-03-04.md)
- [PRD](../_bmad-output/planning-artifacts/prd.md)
- [Architecture](../_bmad-output/planning-artifacts/architecture.md)
- [UX Design Specification](../_bmad-output/planning-artifacts/ux-design-specification.md)
- [Epics & Stories](../_bmad-output/planning-artifacts/epics.md)
- [Project Context](../_bmad-output/project-context.md)
- [Implementation Readiness Report](../_bmad-output/planning-artifacts/implementation-readiness-report-2026-03-06.md)
- [Sprint Status](../_bmad-output/implementation-artifacts/sprint-status.yaml)
- ~70 story implementation specs in `_bmad-output/implementation-artifacts/`

## Getting Started

### Quick Start (Local Development)

1. **Start PostgreSQL:** `docker compose up -d`
2. **Server:** `cd apps/server && npm install && cp .env.example .env && npx kysely migrate:latest && npm run dev`
3. **Flutter:** `cd apps/flutter_app && flutter pub get && flutter run --dart-define-from-file=dart_defines_dev.json`
4. **Web landing** is served automatically by the server

### For AI-Assisted Development

When planning new features:
1. Start with this `index.md` for project context
2. Reference the relevant architecture doc for the part you're modifying
3. Check [API Contracts](./api-contracts-server.md) for existing endpoints
4. Check [Data Models](./data-models-server.md) for schema context
5. Review [Integration Architecture](./integration-architecture.md) for cross-part impacts
6. See [Development Guide](./development-guide.md) for conventions and testing patterns
