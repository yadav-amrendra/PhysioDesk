from datetime import date, datetime, time

from sqlalchemy import Column, Date, DateTime, String, Time, func
from sqlmodel import Field, SQLModel

from app.models.enums import AppointmentStatus, PaymentMethod


class Appointment(SQLModel, table=True):
    __tablename__ = "appointments"

    id: int | None = Field(default=None, primary_key=True)
    patient_id: int = Field(foreign_key="patients.id", index=True)
    therapist_id: int = Field(foreign_key="therapists.id", index=True)
    appointment_date: date = Field(sa_column=Column(Date, nullable=False, index=True))
    start_time: time = Field(sa_column=Column(Time, nullable=False))
    end_time: time = Field(sa_column=Column(Time, nullable=False))
    status: AppointmentStatus = Field(
        default=AppointmentStatus.BOOKED,
        sa_column=Column(String(32), nullable=False, index=True),
    )
    payment_method: PaymentMethod = Field(
        default=PaymentMethod.CASH,
        sa_column=Column(String(32), nullable=False),
    )
    notes: str | None = Field(default=None)

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
