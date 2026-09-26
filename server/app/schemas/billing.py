from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field, model_validator

from app.models.enums import InvoiceStatus, PaymentMethod


class InvoiceCreate(BaseModel):
    patient_id: int
    package_id: int
    appointment_id: int | None = None
    amount: Decimal | None = Field(default=None, ge=0)
    discount: Decimal = Field(default=Decimal("0.00"), ge=0)
    status: InvoiceStatus = InvoiceStatus.DUE
    payment_method: PaymentMethod = PaymentMethod.CASH
    issued_on: date | None = None
    notes: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def validate_discount(self) -> "InvoiceCreate":
        if self.amount is not None and self.discount > self.amount:
            raise ValueError("discount cannot exceed amount")
        return self


class InvoiceUpdate(BaseModel):
    package_id: int | None = None
    appointment_id: int | None = None
    amount: Decimal | None = Field(default=None, ge=0)
    discount: Decimal | None = Field(default=None, ge=0)
    status: InvoiceStatus | None = None
    payment_method: PaymentMethod | None = None
    issued_on: date | None = None
    notes: str | None = Field(default=None, max_length=2000)


class InvoiceResponse(BaseModel):
    id: int
    invoice_number: str
    patient_id: int
    patient_name: str
    package_id: int
    package_name: str
    appointment_id: int | None
    created_by_user_id: int
    amount: Decimal
    discount: Decimal
    net_amount: Decimal
    status: InvoiceStatus
    payment_method: PaymentMethod
    issued_on: date
    paid_at: date | None = None
    notes: str | None

    model_config = {"from_attributes": True}
