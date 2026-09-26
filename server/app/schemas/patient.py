from pydantic import BaseModel, Field

from app.models.enums import PatientGender, PatientStatus


class PatientCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)
    phone: str = Field(min_length=5, max_length=32)
    age: int = Field(ge=1, le=120)
    gender: PatientGender = PatientGender.UNSPECIFIED
    address: str = Field(default="", max_length=2000)
    condition: str = Field(min_length=1, max_length=255)
    therapist_id: int
    package_id: int
    status: PatientStatus = PatientStatus.ACTIVE


class PatientUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    phone: str | None = Field(default=None, min_length=5, max_length=32)
    age: int | None = Field(default=None, ge=1, le=120)
    gender: PatientGender | None = None
    address: str | None = Field(default=None, max_length=2000)
    condition: str | None = Field(default=None, min_length=1, max_length=255)
    therapist_id: int | None = None
    package_id: int | None = None
    status: PatientStatus | None = None


class PatientResponse(BaseModel):
    id: int
    full_name: str
    phone: str
    age: int
    gender: PatientGender
    address: str
    condition: str
    therapist_id: int
    therapist_name: str
    package_id: int
    package_name: str
    status: PatientStatus

    model_config = {"from_attributes": True}


class PatientSessionItem(BaseModel):
    id: int
    appointment_date: str
    start_time: str
    end_time: str
    therapist_id: int
    therapist_name: str
    status: str
    payment_method: str
    notes: str | None


class PatientInvoiceItem(BaseModel):
    id: int
    invoice_number: str
    issued_on: str
    package_name: str
    amount: str
    discount: str
    net_amount: str
    status: str
    payment_method: str


class PatientDetailResponse(PatientResponse):
    sessions: list[PatientSessionItem]
    invoices: list[PatientInvoiceItem]
