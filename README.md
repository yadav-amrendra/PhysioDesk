# PhysioDesk

Clinic management tool for a physiotherapy practice — FastAPI backend, Next.js frontend, PostgreSQL.

## Stack

| Layer | Tech |
| --- | --- |
| Frontend | Next.js (App Router) + TypeScript + Tailwind |
| Backend | FastAPI + SQLModel + Alembic |
| Database | PostgreSQL 18 (Docker) |

## Project layout

```
PhysioDesk/
├── client/          # Next.js frontend
├── server/          # FastAPI backend
└── docker-compose.yml
```

## Prerequisites

- Node.js 20+ and [pnpm](https://pnpm.io)
- Python 3.14+ and [uv](https://docs.astral.sh/uv/)
- [Docker](https://docs.docker.com/get-docker/) (for Postgres)

## Quick start

### 1. Environment files

```bash
# Postgres (Docker Compose)
cp .env.example .env

# Backend
cp server/.env.example server/.env

# Frontend
cp client/.env.example client/.env.local
```

Keep `DATABASE_URL` in `server/.env` aligned with `POSTGRES_*` in the root `.env`.

### 2. Start Postgres

```bash
docker compose up -d db
```

### 3. Backend

```bash
cd server
uv sync
uv run fastapi dev
```

- API: http://127.0.0.1:8000
- Swagger: http://127.0.0.1:8000/docs
- Health: http://127.0.0.1:8000/api/v1/health

### 4. Frontend

```bash
cd client
pnpm install
pnpm dev
```

Open http://localhost:3000

## Environment variables

### Root (`.env`) — Docker Compose

| Variable | Description |
| --- | --- |
| `POSTGRES_USER` | Database user |
| `POSTGRES_PASSWORD` | Database password |
| `POSTGRES_DB` | Database name |
| `POSTGRES_PORT` | Host port (default `5432`) |

### Server (`server/.env`)

| Variable | Description |
| --- | --- |
| `APP_NAME` | API title |
| `APP_VERSION` | API version |
| `API_V1_PREFIX` | API mount path (default `/api/v1`) |
| `DEBUG` | SQL echo / debug flag |
| `DATABASE_URL` | SQLAlchemy URL (`postgresql+psycopg://…`) |
| `CORS_ORIGINS` | Comma-separated allowed origins |

### Client (`client/.env.local`)

| Variable | Description |
| --- | --- |
| `API_URL` | FastAPI base URL for server components |

## Backend structure

```
server/app/
  main.py       # app factory + lifespan
  core/         # settings
  db/           # engine + sessions
  models/       # SQLModel tables
  schemas/      # Pydantic API schemas
  api/          # routers + dependencies
  services/     # business logic
server/alembic/ # migrations
```

### Migrations

```bash
cd server
uv run alembic revision --autogenerate -m "describe change"
uv run alembic upgrade head
```

## Useful commands

| Command | Where | Purpose |
| --- | --- | --- |
| `docker compose up -d db` | root | Start Postgres |
| `docker compose down` | root | Stop Postgres (keep data) |
| `docker compose down -v` | root | Stop Postgres and wipe volume |
| `uv run fastapi dev` | `server/` | API with auto-reload |
| `uv run fastapi run` | `server/` | API production mode |
| `pnpm dev` | `client/` | Next.js dev server |
| `pnpm build` / `pnpm start` | `client/` | Production build |
| `pnpm lint` | `client/` | ESLint |


