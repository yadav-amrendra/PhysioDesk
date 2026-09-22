"""SQLModel / SQLAlchemy ORM models.

Import concrete models here so Alembic and metadata discovery see them.
"""

from sqlmodel import SQLModel

from app.models.user import User, UserRole

__all__ = ["SQLModel", "User", "UserRole"]
