# Karamania — Project Overview

## Executive Summary

Karamania is a real-time karaoke party companion app that transforms casual karaoke sessions into interactive social experiences. It provides a DJ-like state machine orchestrating the flow of a party — from song selection and party cards to ceremonies, interludes, and a finale with awards. The app supports media capture, playlist import (Spotify/YouTube), TV pairing via YouTube Lounge API, and session sharing.

## Project Type

- **Repository Type:** Multi-part monorepo
- **Parts:** 3 (Flutter mobile app, Fastify backend server, static web landing page)
- **Domain:** Social entertainment / karaoke party management

## Technology Stack Summary

| Category | Technology | Version | Part |
|----------|-----------|---------|------|
| **Mobile Framework** | Flutter / Dart | SDK ^3.9.2 | flutter_app |
| **State Management** | Provider / ChangeNotifier | ^6.1.2 | flutter_app |
| **Navigation** | go_router | ^14.8.1 | flutter_app |
| **Real-time (Client)** | socket_io_client | ^3.0.2 | flutter_app |
| **Auth (Client)** | firebase_auth / firebase_core | ^5.5.1 / ^3.12.1 | flutter_app |
| **Audio** | flutter_soloud | ^3.4.6 | flutter_app |
| **API Client** | dart_open_fetch (generated) | git | flutter_app |
| **Backend Framework** | Fastify 5 | ^5.8.1 | server |
| **Language** | TypeScript (ES2022, strict) | ^5.9.3 | server |
| **Database** | PostgreSQL 16 | — | server |
| **ORM** | Kysely | ^0.28.11 | server |
| **Real-time (Server)** | Socket.IO | ^4.8.3 | server |
| **Validation** | Zod v4 | ^4.3.6 | server |
| **Auth (Server)** | Firebase Admin SDK + jose (JWT) | ^13.7.0 / ^6.2.0 | server |
| **API Docs** | @fastify/swagger (OpenAPI) | ^9.7.0 | server |
| **Testing (Server)** | Vitest | ^4.0.18 | server |
| **Testing (Flutter)** | flutter_test + mocktail | SDK / ^1.0.4 | flutter_app |
| **Web** | Vanilla HTML/CSS/JS | — | web_landing |
| **Infrastructure** | Docker Compose (local), Railway (prod) | — | project-wide |
| **CI/CD** | GitHub Actions | — | server + flutter_app |
| **Bot System** | Custom Node.js bot manager | — | server (local dev + testing) |
| **Performance Testing** | k6 | — | server (load + stress) |

## Architecture Classification

- **Pattern:** Event-driven client-server with real-time state machine orchestration
- **Communication:** REST API (Fastify) + WebSocket (Socket.IO) dual protocol
- **State Machine:** Pure, immutable DJ engine on server drives party flow through 8 states
- **Auth:** Dual-path — Firebase Auth (authenticated users) + JWT guest tokens (anonymous party access)
- **Data:** PostgreSQL with JSONB for flexible game state, event streams, and session summaries
- **Media:** Firebase Cloud Storage with signed URLs for photo/video/audio captures

## Repository Structure

```
karamania/
├── apps/
│   ├── flutter_app/      # Flutter mobile app (iOS + Android)
│   ├── server/           # Fastify 5 backend API + Socket.IO
│   └── web_landing/      # Static landing page + deep linking
├── .github/workflows/    # CI/CD (server-ci.yml + flutter-ci.yml)
├── docker-compose.yml    # Local PostgreSQL 16
├── SETUP_AND_DEPLOYMENT.md
├── _bmad/                # BMAD workflow tooling
└── _bmad-output/         # Planning & implementation artifacts
```

## Key Integration Points

| From | To | Protocol | Purpose |
|------|----|----------|---------|
| Flutter App | Server | REST + Socket.IO | Party management, real-time game state |
| Flutter App | Firebase | SDK | Authentication, storage upload |
| Server | Firebase Admin | SDK | Token verification, storage signed URLs |
| Server | PostgreSQL | Kysely ORM | Persistence (sessions, users, catalog, media) |
| Server | YouTube Data API | REST | Playlist import, video metadata |
| Server | Spotify Web API | REST (OAuth2) | Playlist import |
| Server | YouTube Lounge API | HTTP long-poll | TV pairing, queue management |
| Web Landing | Server | REST | Session sharing, deep link resolution |

## Lines of Code (Approximate)

| Part | Source Files | Test Files |
|------|-------------|------------|
| **server** | ~95 files in `src/` + 2 bot files | ~90+ test files in `tests/` (unit + integration + E2E + concurrency) |
| **flutter_app** | ~85 files in `lib/` | ~72 test files in `test/` |
| **web_landing** | 5 files | — |
