# Server — LLM Test Platform Backend

NestJS backend for the LLM Test Platform. Provides REST API for managing providers, tasks, evaluation runs, and AI scoring.

## Quick Start

```bash
cd server
cp .env.example .env   # generate ENCRYPTION_KEY with: openssl rand -hex 32
npm install
npm run prisma:migrate
npm run prisma:generate
npm run start:dev       # http://localhost:3000
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run start:dev` | Watch mode dev server |
| `npm run build` | Production build |
| `npm run test` | Run unit tests (Jest) |
| `npm run test:e2e` | Run E2E tests |
| `npm run test:cov` | Test coverage report |
| `npm run lint` | Lint + auto-fix (ESLint) |
| `npm run format` | Format (Prettier) |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:migrate` | Run database migrations |
| `npm run prisma:studio` | Open Prisma Studio GUI |

## Architecture

```
src/
├── agent/              # Agentic mode: tools, Docker sandbox, ReAct loop
├── common/             # EncryptionService (AES encrypt/decrypt API keys)
├── llm/
│   ├── adapters/       # LlmAdapter interface + OpenAI & Anthropic implementations
│   └── factories/      # Adapter factory (resolve by adapter type string)
├── models/             # Fetch model lists from provider APIs, cache to DB
├── prisma/             # PrismaService (DB client singleton)
├── providers/          # CRUD for LLM providers
├── runs/               # Task execution, SSE streaming, manual + AI scoring
└── tasks/              # Task CRUD with template support
```

## Key Concepts

### Adapter Pattern

`LlmAdapter` interface provides a uniform abstraction over different LLM APIs:

- `listModels()` — fetch available model IDs from a provider
- `streamChat()` — streaming one-shot chat completion (SSE)
- `chat()` — non-streaming chat completion
- `agentTurn()` — agentic turn with tools support
- `streamAgentTurn()` — streaming agentic turn

Implementations: `OpenAiAdapter`, `AnthropicAdapter`.

### SSE Streaming

Evaluation runs stream results via Server-Sent Events. The flow:

1. `POST /api/tasks/:id/run` creates `TaskRun` records
2. SSE events emitted: `created` → `delta`/`thinking` → `complete`/`error` → `done`

### AI Scoring

Uses a judge LLM to evaluate outputs across 5 dimensions:

| Dimension | Weight |
|-----------|--------|
| Accuracy | 25% |
| Completeness | 20% |
| Coherence | 20% |
| Creativity | 15% |
| Instruction Following | 20% |

Results stored as JSON array — supports multiple judges per run.

### Encryption

API keys are AES-256-CBC encrypted at rest via `EncryptionService`. Decryption happens only at runtime when making API calls.

### Agentic Mode

When `mode: "agentic"`, the task runs through a ReAct loop:

1. Send conversation + tool definitions to LLM
2. Parse text and tool_use blocks from response
3. Execute tool calls in Docker sandbox (or local fallback)
4. Feed tool results back as user message
5. Repeat until no more tool calls or max iterations reached

Built-in tools: `bash`, `python`, `read_file`, `write_file`, `web_request`.

## Database

SQLite via Prisma with libSQL adapter. See `prisma/schema.prisma` for the full schema.

Key models:
- **Provider** — LLM API configuration (URL, key, adapter type)
- **Model** — Cached model list per provider
- **Task** — Evaluation task definition (prompt, params, mode)
- **TaskRun** — Single evaluation run result (output, tokens, latency, score)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ENCRYPTION_KEY` | Yes | 64-char hex string for AES key derivation |
| `PORT` | No | Server port (default: 3000) |
| `DATABASE_URL` | No | SQLite file path (default: `file:./dev.db`) |
