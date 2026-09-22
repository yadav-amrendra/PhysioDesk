from datetime import datetime
from enum import Enum

from sqlalchemy import Column, DateTime, String, func
from sqlmodel import Field, SQLModel


class UserRole(str, Enum):
    ADMIN = "admin"
    STAFF = "staff"


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: int | None = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True, max_length=255)
    full_name: str = Field(max_length=255)
    hashed_password: str = Field(max_length=255)
    role: UserRole = Field(
        default=UserRole.STAFF,
        sa_column=Column(String(32), index=True, nullable=False),
    )
    is_active: bool = Field(default=True)

    created_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), server_default=func.now(), nullable=False),
    )
    updated_at: datetime | None = Field(
        default=None,
        sa_column=Column(
            DateTime(timezone=True),
            server_default=func.now(),
            onupdate=func.now(),
            nullable=False,
        ),
    )
