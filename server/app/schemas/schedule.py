from datetime import date, time

from pydantic import BaseModel, Field, field_validator, model_validator

from app.models.enums import AppointmentStatus, PaymentMethod
from app.schemas.therapist import _parse_time


class AppointmentResponse(BaseModel):
    id: int
    patient_id: int
    patient_name: str
    therapist_id: int
    therapist_name: str
    appointment_date: date
    start_time: time
    end_time: time
    status: AppointmentStatus
    payment_method: PaymentMethod
    notes: str | None

    model_config = {"from_attributes": True}


class AppointmentCreate(BaseModel):
    patient_id: int
    therapist_id: int
    appointment_date: date
    start_time: time
    payment_method: PaymentMethod = PaymentMethod.CASH
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator("start_time", mode="before")
    @classmethod
    def coerce_time(cls, value: time | str) -> time:
        return _parse_time(value)


class AppointmentUpdate(BaseModel):
    """Reschedule and/or edit notes / payment / status."""

    therapist_id: int | None = None
    appointment_date: date | None = None
    start_time: time | None = None
    payment_method: PaymentMethod | None = None
    notes: str | None = Field(default=None, max_length=2000)
    status: AppointmentStatus | None = None

    @field_validator("start_time", mode="before")
    @classmethod
    def coerce_time(cls, value: time | str | None) -> time | None:
        if value is None or value == "":
            return None
        return _parse_time(value)

    @model_validator(mode="after")
    def validate_reschedule_fields(self) -> "AppointmentUpdate":
        has_slot = (
            self.therapist_id is not None
            or self.appointment_date is not None
            or self.start_time is not None
        )
        if has_slot and not (
            self.appointment_date is not None and self.start_time is not None
            or self.therapist_id is None
            and self.appointment_date is None
            and self.start_time is None
        ):
            # Allow any combination as long as after merge we validate in service
            pass
        return self


class ScheduleSlot(BaseModel):
    start_time: time
    end_time: time
    state: str  # open | booked | off
    appointment: AppointmentResponse | None = None


class ScheduleTherapistColumn(BaseModel):
    id: int
    full_name: str
    specialty: str
    is_day_off: bool
    start_time: time | None
    end_time: time | None
    slot_duration_minutes: int
    slots: list[ScheduleSlot]


class ScheduleDayResponse(BaseModel):
    date: date
    time_labels: list[time]
    therapists: list[ScheduleTherapistColumn]
