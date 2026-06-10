# LLM Test Platform

[中文文档](README.zh-CN.md) | [Templates](TEMPLATES.md) | [Contributing](CONTRIBUTING.md)

A self-hosted web platform for comparing LLM performance across multiple models and providers. Define evaluation tasks, run them against different models, and get side-by-side comparisons with AI-powered scoring.

## Features

- **Multi-Provider Support** — OpenAI, Anthropic, and any OpenAI-compatible API
- **Dual Evaluation Modes** — Simple chat completion + Agentic (ReAct loop with Docker sandbox)
- **Real-time Streaming** — SSE-based streaming output with thinking/reasoning chain display
- **AI Scoring** — Automatic 5-dimension scoring (accuracy, completeness, coherence, creativity, instruction-following) with multi-judge support
- **Side-by-Side Compare** — Compare outputs from different models on the same task
- **API Key Encryption** — AES-encrypted at rest, decrypted only at runtime
- **15+ Built-in Templates** — Ready-to-use evaluation prompt templates
- **Agent Trace** — Full tool-call trace and iteration history for agentic runs

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | NestJS 11 + TypeScript |
| Database | SQLite via Prisma 7 + libSQL |
| Frontend | Vue 3 + Vite + Element Plus |
| State | Pinia |
| Runtime | Node.js 18+ |

## Quick Start

### Prerequisites

- Node.js 18+
- npm 9+
- Docker (optional, for agentic sandbox mode)

### Setup

```bash
# Clone and install
git clone https://github.com/heekei/llm-test.git
cd llm-test
npm install

# Configure
cd server
cp .env.example .env
# Edit .env — set ENCRYPTION_KEY (generate with: openssl rand -hex 32)

# Initialize database
cd ..
npm run prisma:migrate
npm run prisma:generate
```

### Run

```bash
# Terminal 1: Backend (http://localhost:3000)
npm run dev:server

# Terminal 2: Frontend (http://localhost:5173)
npm run dev:web
```

### Add a Provider

1. Open http://localhost:5173/providers
2. Click "Add Provider"
3. Fill in: Name, API Base URL, API Key, Adapter Type (openai/anthropic)
4. Click "Fetch Models" to pull available models from the API

### Run Your First Evaluation

1. Go to http://localhost:5173/tasks
2. Click "New Task" and pick a template or write your own prompt
3. Open the task detail page, add target models, and hit "Run"
4. Watch streaming results, then use AI Scoring for automated evaluation

## Project Structure

```
llm-test/
├── server/                 # NestJS backend
│   ├── src/
│   │   ├── agent/          # Agentic mode: tools, Docker sandbox, ReAct loop
│   │   ├── common/         # EncryptionService (AES key encryption)
│   │   ├── llm/            # Adapter pattern (OpenAI & Anthropic)
│   │   ├── models/         # Fetch & cache model lists from providers
│   │   ├── prisma/         # Database service
│   │   ├── providers/      # Provider CRUD
│   │   ├── runs/           # Execution, SSE streaming, scoring
│   │   └── tasks/          # Task CRUD, templates
│   └── prisma/             # Schema & migrations
├── web/                    # Vue 3 frontend
│   └── src/
│       ├── api/            # HTTP client & API modules
│       ├── components/     # Reusable Vue components
│       ├── composables/    # SSE stream consumer
│       ├── data/           # Built-in eval templates
│       ├── router/         # Vue Router config
│       ├── stores/         # Pinia state management
│       └── views/          # Page-level components
└── package.json            # npm workspaces root
```

## API Overview

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/providers` | List providers |
| POST | `/api/providers` | Add provider |
| GET | `/api/models/:providerId` | Fetch & cache models from provider |
| GET | `/api/tasks` | List tasks |
| POST | `/api/tasks` | Create task |
| POST | `/api/tasks/:id/run` | Run task against targets (SSE) |
| GET | `/api/runs` | List all runs |
| PATCH | `/api/runs/:id/score` | Set manual score |
| POST | `/api/runs/:id/ai-score` | Trigger AI scoring |
| GET | `/api/tasks/:taskId/compare` | Get comparison data for a task |

## Architecture

### Evaluation Modes

- **Simple** (`mode: "simple"`) — Single chat completion, streaming text output
- **Agentic** (`mode: "agentic"`) — ReAct loop with tool execution in Docker sandbox
  - Built-in tools: bash, python, read_file, write_file, web_request
  - Full trace of every iteration, tool call, and result

### SSE Streaming Flow

```
POST /api/tasks/:id/run
  → creates TaskRun records
  → GET /api/runs/stream/:runId (SSE)
    → created → delta/thinking → complete/error → done
```

### AI Scoring

Calls a judge LLM to score outputs across 5 weighted dimensions. Supports multiple judges per run. Scores stored as JSON array.

### Encryption

API keys encrypted with AES-256-CBC at rest. Key derived from `ENCRYPTION_KEY` environment variable. Decrypted only when making API calls.

## Roadmap

- [ ] Benchmark dataset support (pre-defined test sets)
- [ ] Batch evaluation with concurrency control
- [ ] Export results as CSV/JSON
- [ ] User authentication & multi-tenancy
- [ ] More built-in agents and tools
- [ ] PostgreSQL support
- [ ] Dark mode

## Development

See [server/README.md](server/README.md) and [web/README.md](web/README.md) for development guides.

```bash
# Type check
npm run typecheck

# Lint (server only)
cd server && npm run lint

# Database GUI
npm run prisma:studio
```

## License

MIT — see [LICENSE](LICENSE) for details.
