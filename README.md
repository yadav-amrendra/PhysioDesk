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
├── docs/            # Schema ERD and notes
└── docker-compose.yml
```

Database ERD: [docs/erd.md](docs/erd.md)

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
| `JWT_SECRET_KEY` | Secret used to sign JWTs |
| `JWT_ALGORITHM` | JWT algorithm (default `HS256`) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Access token lifetime |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Refresh token lifetime |

### Client (`client/.env.local`)

| Variable | Description |
| --- | --- |
| `API_URL` | FastAPI base URL (server components) |
| `NEXT_PUBLIC_API_URL` | FastAPI base URL (browser / login) |

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

### Auth API

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/api/v1/auth/login` | No | Email + password → access & refresh JWT |
| `POST` | `/api/v1/auth/refresh` | No | Refresh token → new token pair |
| `GET` | `/api/v1/auth/me` | Bearer | Current user profile |

### Therapists API (admin only)

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/v1/therapists` | Roster list (`q`, `include_inactive`); includes weekly hours + patients seen today. **Any authenticated user** (for patient assignment). |
| `POST` | `/api/v1/therapists` | Create therapist (**admin**) |
| `GET` | `/api/v1/therapists/{id}` | Get one (authenticated) |
| `PATCH` | `/api/v1/therapists/{id}` | Update (**admin**) |
| `DELETE` | `/api/v1/therapists/{id}` | Soft-deactivate (**admin**) |
| `GET` | `/api/v1/therapists/{id}/overrides` | List day overrides (**admin**) |
| `PUT` | `/api/v1/therapists/{id}/overrides` | Upsert day off / custom hours (**admin**) |
| `DELETE` | `/api/v1/therapists/{id}/overrides/{override_id}` | Remove override (**admin**) |

### Packages API

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/v1/packages` | List packages (`active_only`, default true) |

### Patients API (admin + staff)

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/v1/patients` | List (`q`, `therapist_id`, `status`) |
| `POST` | `/api/v1/patients` | Create |
| `GET` | `/api/v1/patients/{id}` | Detail + session history + billing history |
| `PATCH` | `/api/v1/patients/{id}` | Update |
| `DELETE` | `/api/v1/patients/{id}` | Hard delete (blocked if invoices exist) |

Roles: `admin` (full access), `staff` (patients/schedule; therapists management admin-only; billing read-only when billing lands).

Seed users (after migrate):

```bash
cd server
uv run python scripts/seed_users.py
```

| Email | Password | Role |
| --- | --- | --- |
| `admin@physiodesk.com` | `Admin123!` | admin |
| `staff@physiodesk.com` | `Staff123!` | staff |

Passwords are hashed with **Argon2** (`pwdlib`). `/` and `/api/v1/health` stay public for ops; other routes will require auth as they are added.

The seed script also creates packages, therapists, patients, appointments, invoices, and sample activity logs when the domain tables are empty.

## Assumptions

- **Therapists are not login users** — only `users` (admin/staff) authenticate.
- **Session history** on a patient profile comes from **appointments** (no separate clinical sessions table).
- **`activity_logs`** is an append-only who-did-what audit trail (not clinical notes).
- **Deleting a therapist** soft-deactivates (`is_active=false`); existing appointments stay.
- **Booking an appointment does not auto-create an invoice** — invoices are created via Billing; optional `appointment_id` link.
- **Staff:** full access to patients/schedule; read-only billing; no therapist management (enforced as those APIs land).
- **Net invoice amount** = `amount - discount` (computed, not stored).

## Frontend structure

```
client/app/
  (app)/            # authenticated shell (sidebar + pages)
  login/            # login page (no sidebar)
client/components/
  layout/           # AppShell, Sidebar, TopBar
  ui/               # Button, Card, StatusPill, Input
```

Design system tokens live in `client/app/globals.css` (palette + Fraunces / Inter / IBM Plex Mono).

Auth: login-only (no signup). Tokens live in `localStorage`. Unauthenticated users are redirected to `/login`. Staff do not see the Therapists nav (admin-only).


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


