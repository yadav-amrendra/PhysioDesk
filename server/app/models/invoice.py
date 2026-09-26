from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Column, Date, DateTime, Numeric, String, func
from sqlmodel import Field, SQLModel

from app.models.enums import InvoiceStatus, PaymentMethod


class Invoice(SQLModel, table=True):
    __tablename__ = "invoices"

    id: int | None = Field(default=None, primary_key=True)
    invoice_number: str = Field(max_length=32, unique=True, index=True)
    patient_id: int = Field(foreign_key="patients.id", index=True)
    package_id: int = Field(foreign_key="packages.id", index=True)
    appointment_id: int | None = Field(default=None, foreign_key="appointments.id")
    created_by_user_id: int = Field(foreign_key="users.id", index=True)
    amount: Decimal = Field(sa_column=Column(Numeric(10, 2), nullable=False))
    discount: Decimal = Field(
        default=Decimal("0.00"),
        sa_column=Column(Numeric(10, 2), nullable=False, server_default="0"),
    )
    status: InvoiceStatus = Field(
        default=InvoiceStatus.DUE,
        sa_column=Column(String(32), nullable=False, index=True),
    )
    payment_method: PaymentMethod = Field(
        default=PaymentMethod.CASH,
        sa_column=Column(String(32), nullable=False),
    )
    issued_on: date = Field(sa_column=Column(Date, nullable=False, index=True))
    paid_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
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
