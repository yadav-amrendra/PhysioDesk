#!/bin/sh
set -e

echo "Waiting for database…"
uv run python - <<'PY'
import time
from sqlalchemy import text
from app.db.session import engine

for attempt in range(30):
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("Database is ready")
        break
    except Exception as exc:
        print(f"DB not ready ({attempt + 1}/30): {exc}")
        time.sleep(1)
else:
    raise SystemExit("Database never became ready")
PY

echo "Running migrations…"
uv run alembic upgrade head

echo "Seeding demo data…"
uv run python scripts/seed_users.py

echo "Starting API…"
PORT="${PORT:-8000}"
exec uv run uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
