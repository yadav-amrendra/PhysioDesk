from datetime import date, time
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator, model_validator


def _parse_time(value: time | str) -> time:
    if isinstance(value, time):
        return value
    parts = value.strip().split(":")
    if len(parts) < 2:
        raise ValueError("Time must be HH:MM or HH:MM:SS")
    hour, minute = int(parts[0]), int(parts[1])
    second = int(parts[2]) if len(parts) > 2 else 0
    return time(hour, minute, second)


class TherapistCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)
    specialty: str = Field(min_length=1, max_length=255)
    working_days: list[int] = Field(min_length=1, max_length=7)
    default_start_time: time
    default_end_time: time
    slot_duration_minutes: int = Field(default=30, ge=5, le=180)
    is_active: bool = True

    @field_validator("working_days")
    @classmethod
    def validate_working_days(cls, value: list[int]) -> list[int]:
        cleaned = sorted(set(value))
        for day in cleaned:
            if day < 1 or day > 7:
                raise ValueError("working_days must be ISO weekdays 1–7 (Mon–Sun)")
        return cleaned

    @field_validator("default_start_time", "default_end_time", mode="before")
    @classmethod
    def coerce_time(cls, value: time | str) -> time:
        return _parse_time(value)

    @model_validator(mode="after")
    def validate_hours(self) -> "TherapistCreate":
        if self.default_end_time <= self.default_start_time:
            raise ValueError("default_end_time must be after default_start_time")
        return self


class TherapistUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    specialty: str | None = Field(default=None, min_length=1, max_length=255)
    working_days: list[int] | None = None
    default_start_time: time | None = None
    default_end_time: time | None = None
    slot_duration_minutes: int | None = Field(default=None, ge=5, le=180)
    is_active: bool | None = None

    @field_validator("working_days")
    @classmethod
    def validate_working_days(cls, value: list[int] | None) -> list[int] | None:
        if value is None:
            return None
        cleaned = sorted(set(value))
        for day in cleaned:
            if day < 1 or day > 7:
                raise ValueError("working_days must be ISO weekdays 1–7 (Mon–Sun)")
        return cleaned

    @field_validator("default_start_time", "default_end_time", mode="before")
    @classmethod
    def coerce_time(cls, value: time | str | None) -> time | None:
        if value is None:
            return None
        return _parse_time(value)


class TherapistResponse(BaseModel):
    id: int
    full_name: str
    specialty: str
    working_days: list[int]
    default_start_time: time
    default_end_time: time
    slot_duration_minutes: int
    is_active: bool
    weekly_hours: Decimal
    patients_seen_today: int

    model_config = {"from_attributes": True}


class DayOverrideUpsert(BaseModel):
    override_date: date
    is_day_off: bool = False
    start_time: time | None = None
    end_time: time | None = None

    @field_validator("start_time", "end_time", mode="before")
    @classmethod
    def coerce_time(cls, value: time | str | None) -> time | None:
        if value is None or value == "":
            return None
        return _parse_time(value)

    @model_validator(mode="after")
    def validate_override(self) -> "DayOverrideUpsert":
        if self.is_day_off:
            return self
        if self.start_time is None or self.end_time is None:
            raise ValueError("start_time and end_time are required when not a day off")
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


class DayOverrideResponse(BaseModel):
    id: int
    therapist_id: int
    override_date: date
    is_day_off: bool
    start_time: time | None
    end_time: time | None

    model_config = {"from_attributes": True}
