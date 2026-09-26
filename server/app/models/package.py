from datetime import datetime
from decimal import Decimal

from sqlalchemy import Column, DateTime, Numeric, func
from sqlmodel import Field, SQLModel


class Package(SQLModel, table=True):
    __tablename__ = "packages"

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(unique=True, max_length=128, index=True)
    session_count: int = Field(default=1, ge=1)
    price: Decimal = Field(
        sa_column=Column(Numeric(10, 2), nullable=False),
    )
    description: str | None = Field(default=None)
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
