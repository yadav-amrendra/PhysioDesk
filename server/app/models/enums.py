"""Shared domain enums stored as strings in PostgreSQL."""

from enum import Enum


class PatientGender(str, Enum):
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"
    UNSPECIFIED = "unspecified"


class PatientStatus(str, Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    ON_HOLD = "on_hold"


class AppointmentStatus(str, Enum):
    BOOKED = "booked"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"


class PaymentMethod(str, Enum):
    CASH = "cash"
    CARD = "card"
    INSURANCE = "insurance"
    OTHER = "other"


class InvoiceStatus(str, Enum):
    PAID = "paid"
    DUE = "due"
