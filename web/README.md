# Web — LLM Test Platform Frontend

Vue 3 frontend for the LLM Test Platform. Built with Vite, Element Plus, and Pinia.

## Quick Start

```bash
cd web
npm install
npm run dev           # http://localhost:5173
```

The Vite dev server proxies `/api` requests to `http://localhost:3000`. Make sure the backend is running.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Type-check + production build |
| `npm run preview` | Preview production build |

## Architecture

```
src/
├── api/               # Axios client + module-specific API functions
├── components/        # Reusable Vue components (layout, runs, tasks)
├── composables/       # useSse.ts — SSE event stream consumer
├── data/              # templates.ts — 15+ built-in evaluation templates
├── router/            # Vue Router configuration
├── stores/            # Pinia store (run state management)
├── types/             # TypeScript interfaces matching backend types
└── views/             # Page-level components (one per route)
```

## Routes

| Path | View | Description |
|------|------|-------------|
| `/providers` | ProvidersView | List/manage LLM providers |
| `/providers/new` | ProviderFormView | Add new provider |
| `/providers/:id/edit` | ProviderFormView | Edit provider |
| `/tasks` | TasksView | List evaluation tasks |
| `/tasks/new` | TaskCreateView | Create task with template selector |
| `/tasks/:id` | TaskDetailView | Task detail, run targets, view results |
| `/history` | HistoryView | All run history |
| `/compare/:taskId?` | CompareView | Side-by-side output comparison |

## Tech Stack

- **Vue 3** + Composition API (`<script setup>`)
- **Vite** 8 for build tooling
- **Element Plus** for UI components
- **Pinia** for state management
- **Axios** for HTTP requests
- **Marked** for rendering markdown output

## SSE Streaming

The frontend consumes Server-Sent Events from the backend using `fetch` + `ReadableStream`. See `src/composables/useSse.ts` for the implementation. Events are dispatched by type:

- `created` — TaskRun record created
- `delta` — Text output chunk
- `thinking` — Thinking/reasoning chain chunk
- `complete` — Run finished successfully
- `error` — Run failed
- `done` — All runs for this task finished
