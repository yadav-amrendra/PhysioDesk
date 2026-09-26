"""SQLModel / SQLAlchemy ORM models.

Import concrete models here so Alembic and metadata discovery see them.
"""

from sqlmodel import SQLModel

from app.models.activity_log import ActivityLog
from app.models.appointment import Appointment
from app.models.enums import (
    AppointmentStatus,
    InvoiceStatus,
    PatientGender,
    PatientStatus,
    PaymentMethod,
)
from app.models.invoice import Invoice
from app.models.package import Package
from app.models.patient import Patient
from app.models.refresh_token import RefreshToken
from app.models.therapist import Therapist, TherapistDayOverride
from app.models.user import User, UserRole

__all__ = [
    "SQLModel",
    "User",
    "UserRole",
    "RefreshToken",
    "Package",
    "Therapist",
    "TherapistDayOverride",
    "Patient",
    "Appointment",
    "Invoice",
    "ActivityLog",
    "PatientGender",
    "PatientStatus",
    "AppointmentStatus",
    "PaymentMethod",
    "InvoiceStatus",
]
