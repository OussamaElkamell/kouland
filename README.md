# Kouland

Corporate website and CRM for Kouland Technology. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and
[DEPLOY.md](DEPLOY.md).

## Requirements

Node 20+, pnpm 12, PostgreSQL 15+.

## Setup

```bash
pnpm install
```

Copy the values from `.env.example` into `apps/api/.env` and `apps/web/.env.local`, then create the tables:

```bash
pnpm db:migrate
```

## Run

```bash
pnpm dev
```

- Website: http://localhost:3100
- API: http://localhost:4100/api (health check at `/api/health`)

## Other commands

| Command | What it does |
|---|---|
| `pnpm build` | Builds every package and app |
| `pnpm test` | Runs all tests |
| `pnpm typecheck` | Type-checks every package and app |
| `pnpm db:deploy` | Applies migrations in production |
