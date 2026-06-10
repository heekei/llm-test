# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LLM Test Platform — 模型评测 Web 平台，用于测试不同 LLM 模型在相同任务场景下的表现。Monorepo with npm workspaces (server + web).

## Commands

### Root (workspace)

```bash
npm install              # Install all workspace deps
npm run dev:server       # Start backend dev server
npm run dev:web          # Start frontend dev server
npm run build            # Build both server and web
npm run build:server     # Build server only
npm run build:web        # Build web only
npm run typecheck        # Type check (build server + web)
npm run prisma:migrate   # Run Prisma db migration
npm run prisma:generate  # Generate Prisma client
npm run prisma:studio    # Open Prisma Studio (SQLite browser)
```

### Server (NestJS)

```bash
cd server
npm run start:dev        # Watch mode (http://localhost:3000)
npm run test             # Jest unit tests
npm run test:e2e         # E2E tests
npm run test:watch       # Watch mode tests
npm run test:cov         # Coverage report
npm run lint             # ESLint --fix
npm run format           # Prettier
```

### Web (Vue 3 + Vite)

```bash
cd web
npm run dev              # Vite dev server (http://localhost:5173)
npm run build            # vue-tsc check + vite build
npm run preview          # Preview production build
```

### Environment Setup

```bash
cd server
cp .env.example .env     # Set ENCRYPTION_KEY (openssl rand -hex 32)
```

## Architecture

### Backend (server/) — NestJS 11 + Prisma 7 + SQLite

```
src/
├── prisma/              # PrismaService (DB client singleton)
├── common/              # EncryptionService (AES encrypt/decrypt API keys)
├── providers/           # CRUD for LLM providers (API base URL, key, adapter type)
├── models/              # List/fetch models from provider APIs, cache to DB
├── tasks/               # CRUD for evaluation tasks (prompts, params, targets)
├── runs/                # Task execution, SSE streaming, scoring (manual + AI)
└── llm/                 # Adapter pattern for LLM API integration
    ├── adapters/        # adapter.interface.ts (LlmAdapter), openai.adapter.ts, anthropic.adapter.ts
    └── factories/       # adapter.factory.ts (get adapter by type string)
```

Key flows:

- **SSE streaming**: `POST /api/runs/run-task/:taskId` creates TaskRun records, then uses NestJS `@Sse()` on `GET /api/runs/stream/:runId` to emit `created` → `delta`/`thinking` → `complete`/`error` → `done` events. Frontend consumes via `fetch` + `ReadableStream` in `web/src/composables/useSse.ts`.
- **AI scoring**: Runs service calls a judge LLM to score outputs across 5 dimensions (accuracy, completeness, coherence, creativity, instructionFollowing) with weighted scoring. Stores as JSON array supporting multiple judges per run.
- **Encryption**: API keys are AES-encrypted at rest via `EncryptionService`; decrypted only at runtime for API calls.
- **Adapter pattern**: `LlmAdapter` interface with `listModels()`, `streamChat()`, `chat()`. OpenAI and Anthropic adapters handle their respective API formats and stream parsing.
- **Task modes**: `"simple"` (single chat completion) or `"agentic"` (ReAct loop with tools, Docker sandbox, agent trace).

### Database (Prisma + SQLite via libsql/turso)

Models: `Provider` → `Model` (cached), `Task` → `TaskRun`. Runs track status, tokens, latency, score, thinking output, and agent trace. SQLite adapter via `@prisma/adapter-libsql`.

### Frontend (web/) — Vue 3 + TypeScript + Element Plus + Pinia

```
src/
├── api/                 # Axios client + module-specific API functions
├── components/          # Vue components (layout, runs, tasks)
├── composables/         # useSse.ts (SSE event stream consumer)
├── data/                # templates.ts (15+ built-in eval templates)
├── router/              # Vue Router (providers, tasks, history, compare)
├── stores/              # Pinia store (run state management)
├── types/               # TypeScript interfaces matching backend types
└── views/               # Page-level components
```

Vite dev server proxies `/api` to `http://localhost:3000`. Frontend uses Element Plus for UI components, Marked for rendering model markdown output, and Pinia for reactive state management.

### Routes (Vue Router)

| Path | View |
|------|------|
| `/providers` | List/manage LLM providers |
| `/providers/new` | Add provider |
| `/providers/:id/edit` | Edit provider |
| `/tasks` | List eval tasks |
| `/tasks/new` | Create task (with template selector) |
| `/tasks/:id` | Task detail (add targets, run, view results) |
| `/history` | All run history |
| `/compare/:taskId?` | Side-by-side output comparison |
