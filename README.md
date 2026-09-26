# PhysioDesk

Full-stack clinic management app for a physiotherapy practice: patients, therapists, scheduling, billing, and a live dashboard.

Built as a take-home with **FastAPI**, **Next.js**, and **PostgreSQL**.

---

## Stack

| Layer | Choice |
| --- | --- |
| Backend | Python 3.14, FastAPI, SQLModel, Alembic, JWT (Argon2 passwords) |
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS v4, Lucide |
| Database | PostgreSQL 18 |
| Tooling | `uv` (Python), `pnpm` (Node), Docker Compose |

Schema overview: [docs/erd.md](docs/erd.md) · Interactive API docs: `/docs` on the API host

---

## Test login credentials

Seeded by `scripts/seed_users.py` (also runs automatically in the Docker `api` container).

| Role | Email | Password |
| --- | --- | --- |
| Admin (full access) | `admin@physiodesk.com` | `Admin123!` |
| Staff / receptionist | `staff@physiodesk.com` | `Staff123!` |

**Role rules**

- **Admin** — therapists CRUD, billing write, patients, schedule, dashboard
- **Staff** — patients + schedule; billing **read-only**; no therapist management

---

## Quick start (Docker — recommended)

One command for Postgres + API + frontend:

```bash
cp .env.example .env   # optional
docker compose up --build
```

| Service | URL |
| --- | --- |
| App | http://localhost:3000 |
| API / Swagger | http://localhost:8000/docs |
| Health | http://localhost:8000/api/v1/health |

On startup the API runs migrations and seeds demo data. Postgres data lives in the `physiodesk_pgdata` volume.

```bash
docker compose down       # stop (keep data)
docker compose down -v    # stop and wipe the DB volume
```

---

## Local development (services separately)

### Prerequisites

- Docker (Postgres)
- Node.js 20+ and [pnpm](https://pnpm.io)
- Python 3.14+ and [uv](https://docs.astral.sh/uv/)

### 1. Environment

```bash
cp .env.example .env
cp server/.env.example server/.env
cp client/.env.example client/.env.local
```

Align `DATABASE_URL` in `server/.env` with the root `POSTGRES_*` values.

### 2. Database

```bash
docker compose up -d db
cd server
uv sync
uv run alembic upgrade head
uv run python scripts/seed_users.py
```

### 3. Backend

```bash
cd server
uv run fastapi dev
```

- API: http://127.0.0.1:8000  
- Swagger: http://127.0.0.1:8000/docs  

### 4. Frontend

```bash
cd client
pnpm install
pnpm dev
```

Open http://localhost:3000 and sign in with the credentials above.

### 5. Tests

With Postgres up, migrations applied, and seed data present:

```bash
cd server
uv run pytest
```

Covers schedule slot generation and double-booking → HTTP 409.

---

## Environment variables

### Root (`.env`) — Compose

| Variable | Description |
| --- | --- |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Database credentials |
| `POSTGRES_PORT` | Host port (default `5432`) |
| `JWT_SECRET_KEY` | Used by the `api` Compose service |
| `NEXT_PUBLIC_API_URL` | Browser-facing API URL baked into the web image |

### Server (`server/.env`)

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | `postgresql+psycopg://user:pass@host:5432/db` |
| `CORS_ORIGINS` | Comma-separated origins (e.g. `http://localhost:3000`) |
| `JWT_SECRET_KEY` | Signing secret for access/refresh tokens |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Access JWT lifetime (default 30) |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Refresh JWT lifetime (default 7) |

### Client (`client/.env.local`)

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | FastAPI base URL for the browser |
| `API_URL` | FastAPI base URL for Next server components |

---

## Features

- **Auth** — email/password, Argon2 hashes, JWT access + rotated refresh tokens, logout / logout-everywhere
- **Dashboard** — patients today, therapists on duty, revenue today, open slots, capacity bars, recent patients
- **Patients** — CRUD, search/filter, profile with sessions + billing history
- **Schedule** — custom therapist × time grid (not a calendar library), book / reschedule / cancel, conflict warning UX
- **Billing** — invoice CRUD (staff read-only), printable invoice, Paid/Due
- **Therapists** — admin CRUD, weekly hours, day overrides (day off / custom hours), soft-deactivate

Extras: list pagination, Docker Compose full stack, schedule unit/API tests.

---

## API overview

Full interactive docs: **http://127.0.0.1:8000/docs**

| Area | Prefix | Notes |
| --- | --- | --- |
| Auth | `/api/v1/auth` | login, refresh, logout, logout-all, me |
| Therapists | `/api/v1/therapists` | writes admin-only; list paginated |
| Patients | `/api/v1/patients` | paginated list |
| Schedule | `/api/v1/schedule`, `/api/v1/appointments` | day grid + booking |
| Billing | `/api/v1/invoices` | writes admin-only; list paginated |
| Dashboard | `/api/v1/dashboard` | live aggregates |
| Packages | `/api/v1/packages` | lookup for enrollment / invoices |

List endpoints that support pagination return:

```json
{ "items": [], "page": 1, "page_size": 20, "total": 0, "total_pages": 0 }
```

Public (no auth): `/`, `/api/v1/health`.

---

## Project layout

```
PhysioDesk/
├── client/                 # Next.js app
│   ├── app/                # routes (login + authenticated shell)
│   └── components/         # UI + feature modules
├── server/
│   ├── app/                # FastAPI (models, schemas, routes, services)
│   ├── alembic/            # migrations
│   ├── scripts/            # seed_users.py
│   └── tests/              # pytest
├── docs/erd.md             # ERD
└── docker-compose.yml      # db + api + web
```

---

## Assumptions

- Therapists are **not** login users — only `users` (admin/staff) authenticate.
- Patient “session history” is derived from **appointments** (no separate clinical sessions table).
- `activity_logs` is an append-only audit trail (who did what), not clinical notes.
- Deleting a therapist **soft-deactivates** (`is_active=false`); existing appointments remain.
- Booking an appointment does **not** auto-create an invoice; invoices are created in Billing (optional `appointment_id`).
- Staff: full patients/schedule; billing read-only; no therapist management (API-enforced).
- Invoice `net_amount` = `amount - discount` (computed).
- Refresh tokens are stored hashed; each refresh **rotates** the token. Reusing a rotated refresh token revokes all sessions for that user.
- Schedule grid is custom-built (no FullCalendar) for tighter control of open / booked / off cells.

---

## What I would do with more time

- Deploy a public demo (e.g. Railway/Render + Vercel) and/or a short Loom walkthrough
- Stronger frontend test coverage (Playwright smoke for login → book → invoice)
- Soft-delete / archive for patients and invoices instead of hard delete where safer
- Email or SMS reminders for upcoming appointments
- Finer-grained audit UI for `activity_logs`
- Optimistic concurrency on booking (short-lived slot locks) for multi-reception desks

---

## Useful commands

| Command | Where | Purpose |
| --- | --- | --- |
| `docker compose up --build` | root | Full stack |
| `docker compose up -d db` | root | Postgres only |
| `uv run alembic upgrade head` | `server/` | Apply migrations |
| `uv run python scripts/seed_users.py` | `server/` | Seed users + demo data |
| `uv run fastapi dev` | `server/` | API with reload |
| `uv run pytest` | `server/` | Backend tests |
| `pnpm dev` | `client/` | Frontend dev server |
| `pnpm build` / `pnpm start` | `client/` | Production frontend |
