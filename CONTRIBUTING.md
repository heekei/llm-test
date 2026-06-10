# Contributing

Thanks for your interest in contributing to the LLM Test Platform!

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/llm-test.git`
3. Install dependencies: `npm install`
4. Set up the backend (see [Quick Start](README.md#quick-start))
5. Create a branch: `git checkout -b feature/my-feature`

## Development Workflow

```bash
# Type check before committing
npm run typecheck

# Run lint (server only)
cd server && npm run lint

# Run tests (server only)
cd server && npm run test
cd server && npm run test:e2e
```

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(server): add batch evaluation endpoint
fix(web): correct score display in compare view
docs: update API documentation
```

## Code Style

- TypeScript strict mode where possible
- ESLint + Prettier for formatting
- Use existing patterns (adapter pattern for LLM integrations, DTO validation via class-validator)

## Project Structure

See [README.md](README.md#project-structure) for the full layout.

## Adding a New LLM Provider

1. Create a new adapter in `server/src/llm/adapters/` implementing `LlmAdapter`
2. Register it in `server/src/llm/factories/adapter.factory.ts`
3. Add the adapter type to `Provider.adapterType` validation in `server/src/providers/dto/provider.dto.ts`

## Reporting Issues

Please include:
- Steps to reproduce
- Expected vs actual behavior
- Environment (OS, Node.js version)
- Relevant logs or screenshots
