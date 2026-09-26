from datetime import date, datetime, time

from sqlalchemy import Column, Date, DateTime, Time, UniqueConstraint, func
from sqlmodel import Field, SQLModel


class Therapist(SQLModel, table=True):
    __tablename__ = "therapists"

    id: int | None = Field(default=None, primary_key=True)
    full_name: str = Field(max_length=255, index=True)
    specialty: str = Field(max_length=255)
    # ISO weekdays Mon=1 .. Sun=7, e.g. "1,2,3,4,5"
    working_days: str = Field(default="1,2,3,4,5", max_length=32)
    default_start_time: time = Field(sa_column=Column(Time, nullable=False))
    default_end_time: time = Field(sa_column=Column(Time, nullable=False))
    slot_duration_minutes: int = Field(default=30, ge=1)
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


class TherapistDayOverride(SQLModel, table=True):
    __tablename__ = "therapist_day_overrides"
    __table_args__ = (
        UniqueConstraint("therapist_id", "override_date", name="uq_therapist_override_date"),
    )

    id: int | None = Field(default=None, primary_key=True)
    therapist_id: int = Field(foreign_key="therapists.id", index=True)
    override_date: date = Field(sa_column=Column(Date, nullable=False, index=True))
    is_day_off: bool = Field(default=False)
    start_time: time | None = Field(default=None, sa_column=Column(Time, nullable=True))
    end_time: time | None = Field(default=None, sa_column=Column(Time, nullable=True))

    created_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), server_default=func.now(), nullable=False),
    )
