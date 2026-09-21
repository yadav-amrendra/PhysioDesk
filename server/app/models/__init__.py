"""SQLModel / SQLAlchemy ORM models.

Import concrete models here so Alembic and metadata discovery see them.
"""

from sqlmodel import SQLModel

# from app.models.user import User  # noqa: F401 — add as features land

__all__ = ["SQLModel"]
