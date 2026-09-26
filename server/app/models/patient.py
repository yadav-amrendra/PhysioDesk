from datetime import datetime

from sqlalchemy import Column, DateTime, String, func
from sqlmodel import Field, SQLModel

from app.models.enums import PatientGender, PatientStatus


class Patient(SQLModel, table=True):
    __tablename__ = "patients"

    id: int | None = Field(default=None, primary_key=True)
    full_name: str = Field(max_length=255, index=True)
    phone: str = Field(max_length=32, index=True)
    age: int = Field(ge=1)
    gender: PatientGender = Field(
        default=PatientGender.UNSPECIFIED,
        sa_column=Column(String(32), nullable=False),
    )
    address: str = Field(default="")
    condition: str = Field(max_length=255)
    therapist_id: int = Field(foreign_key="therapists.id", index=True)
    package_id: int = Field(foreign_key="packages.id", index=True)
    status: PatientStatus = Field(
        default=PatientStatus.ACTIVE,
        sa_column=Column(String(32), nullable=False, index=True),
    )

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
